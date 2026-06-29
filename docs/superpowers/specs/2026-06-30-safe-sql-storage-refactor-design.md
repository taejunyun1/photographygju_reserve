# 2026-06-30 Safe SQL Storage And Refactor Design

## Goal

GJU-reserve의 DB 읽기/쓰기 경로를 더 효율적으로 만들고, 전체 코드 리팩토링을 단계적으로 진행한다. 현재 앱 심사 중인 상태를 고려해 기존 운영 데이터는 삭제하지 않고, 기존 API 동작과 배포 경로를 유지한다.

## Scope

- Cloudflare Durable Object SQLite 기반 저장소를 데이터 보존형으로 강화한다.
- 기존 legacy Durable Object `db` 값은 삭제하지 않고 보존한다.
- SQL 저장소가 비어 있을 때만 legacy DB를 SQL row로 복사한다.
- SQL 저장소가 이미 있으면 legacy DB가 남아 있어도 덮어쓰지 않는다.
- 쓰기는 변경된 row만 upsert/delete 하는 현재 방향을 유지하고 검증을 강화한다.
- 관리자 목록은 페이지 단위 API를 유지하되, 이후 SQL indexed query로 확장할 수 있게 경계를 정리한다.
- `core.mjs`, `events.js`, view/CSS 파일의 대형 파일 리팩토링은 storage 안정화 이후 단계적으로 진행한다.

## Non-Goals

- 현재 운영 DB를 초기화하거나 삭제하지 않는다.
- 심사 중인 앱의 API 응답 구조를 깨지 않는다.
- 이번 1차 작업에서 Cloudflare D1로 완전 이전하지 않는다.
- 인증 방식, 학생/관리자 권한 체계, 예약 정책을 동시에 바꾸지 않는다.
- 프론트 UI를 대규모로 재디자인하지 않는다.

## Current State

- `worker.mjs`의 Durable Object는 `createSqlAppStore(this.ctx.storage.sql, ...)`를 사용한다.
- SQL 저장소가 비어 있으면 `ctx.storage.get("db")`에서 legacy DB를 읽어 `migrateLegacyDb()`로 SQL에 저장한다.
- 현재 구현은 마이그레이션 후 `ctx.storage.delete("db")`를 호출한다.
- 이 삭제 동작은 "기존 DB를 없애거나 데이터를 지우지 않는다"는 운영 조건과 충돌한다.
- `storage-sql.mjs`는 컬렉션별 SQL table을 만들고, row 단위 snapshot 비교로 변경된 row만 저장한다.
- `core.mjs`는 API 라우팅, 인증, 예약 검증, Slack, cleanup, admin 목록 기능을 한 파일에 담고 있다.
- `public/js/data.js`는 관리자 users/reservations/reports를 page/pageSize 기반으로 요청한다.

## Recommended Architecture

### Storage Source Of Truth

SQL row store를 Worker의 주 저장소로 사용한다.

동시에 legacy `ctx.storage.get("db")` 값은 fallback snapshot으로 보존한다. 이 값은 SQL이 비어 있을 때 한 번만 읽고, 이후 자동 삭제하지 않는다.

마이그레이션 상태는 SQL singleton 또는 별도 metadata row에 기록한다.

```text
legacy ctx.storage["db"]
  - read-only fallback snapshot
  - never deleted automatically

ctx.storage.sql
  - primary runtime store
  - app_singletons: settings, darkroomChemicals, meta
  - users, sessions, equipment, reservations, reports, lectures, notices, warnings, audit_logs, slack_logs, import_batches
```

### Migration Rules

1. Worker startup calls `store.initialize()`.
2. If SQL has data, Worker loads SQL and ignores legacy DB.
3. If SQL has no data, Worker reads `ctx.storage.get("db")`.
4. If legacy DB exists, Worker copies it into SQL and records migration metadata.
5. Worker does not call `ctx.storage.delete("db")`.
6. If neither SQL nor legacy DB exists, Worker creates a fresh initial DB using `ADMIN_PASSWORD`.

This makes migration idempotent and reversible enough for the current review period. If the SQL path has an issue, the legacy snapshot still exists for manual recovery.

### Write Path

The storage layer keeps the existing row-diff strategy:

- Singletons are compared by snapshot and rewritten only when changed.
- Collections are compared by row id and JSON payload.
- Changed rows are `INSERT OR REPLACE`.
- Removed rows are `DELETE FROM table WHERE id = ?`.
- Tables are not cleared for normal saves.
- Saves run inside `ctx.storage.transactionSync()` when available.

This avoids rewriting one large JSON blob and keeps writes proportional to changed data.

### Read Path

The first implementation keeps compatibility by loading normalized in-memory DB objects from SQL rows before calling `handleApiRequest()`.

This preserves existing validation and API behavior while making storage safer. After the storage path is stable, admin list reads can move closer to SQL:

- `GET /api/admin/reservations?page=...` can query indexed SQL columns first.
- `GET /api/admin/users?page=...` can filter on role/status/search indexes where practical.
- `GET /api/admin/reports?page=...` can query submitted date and reservation/user keys.

The fallback in-memory path remains valid for endpoints that need full domain validation or cross-collection joins.

## Refactor Plan

### Phase 1: Data-Safe Storage Hardening

- Remove automatic legacy DB deletion from Worker migration.
- Add migration metadata without exposing secrets or raw personal data.
- Extend `scripts/sql-storage-smoke-test.mjs` to verify:
  - migration copies legacy data into SQL
  - legacy DB deletion is not called
  - repeated initialization does not overwrite existing SQL data
  - unchanged saves do not rewrite collection rows
  - changed rows upsert without clearing tables
- Add a focused Worker storage test if needed to model `ctx.storage.get/delete/sql`.

### Phase 2: Storage Interface Boundaries

- Keep `createSqlAppStore()` as the persistence boundary.
- Add small helper methods only when they remove real duplication:
  - `migrationStatus()`
  - `recordLegacyMigration(db)`
  - optional `loadList(collection, params)` later
- Keep domain logic in `core.mjs` during this phase to reduce behavioral risk.

### Phase 3: Core Domain Split

After storage verification passes, split `core.mjs` by domain without changing API behavior:

- `core/auth.mjs`: password hashing, sessions, login throttle, user access guards.
- `core/reservations.mjs`: reservation validation, conflict checks, status normalization.
- `core/admin-lists.mjs`: pagination, filtering, admin list projection.
- `core/settings.mjs`: settings sanitization and blocked schedule rules.
- `core/notifications.mjs`: Slack formatting and delivery.
- `core/maintenance.mjs`: cleanup and retention.

`core.mjs` can remain the route composition layer until all splits are stable.

### Phase 4: Frontend Event And View Split

- Split `public/js/events.js` submit/click/change handlers by domain:
  - auth/account
  - reservations
  - admin users
  - admin reservations
  - admin equipment
  - admin settings
- Split large views only where existing boundaries are already visible:
  - student reservation forms
  - student lists/reports/notices
  - admin dashboard
  - admin reservations/equipment/reports/settings
- Keep `public/js/ui.js` as shared primitive layer.

### Phase 5: CSS Organization

- Keep current visual output stable.
- Reorganize `public/styles.css` into sections or separate files only if the build pipeline supports copying them safely.
- Preserve existing tokens from `docs/frontend-design-system.md`.
- Do not introduce a new frontend framework during this refactor.

## Error Handling And Rollback

- If SQL initialization fails, return a server configuration error and do not mutate legacy DB.
- If legacy migration fails, do not mark migration complete.
- If SQL already has data, never import legacy DB over it automatically.
- Keep legacy DB available for manual inspection/recovery during app review.
- Do not add a production reset endpoint.
- Keep cleanup cron guarded by `INTERNAL_CRON_SECRET`.

## Testing

Required checks for Phase 1:

```bash
npm run test:storage
npm run test:security
npm run check
npm run check:js
```

Recommended before deployment:

```bash
npm run release:check
GJU_PRODUCTION_URL=https://photographygju.dothome.co.kr npm run deploy:check
```

The test suite must include explicit assertions that no migration code deletes `ctx.storage["db"]`.

## Deployment Notes

- Deploy as a normal Worker update after tests pass.
- No production DB reset or manual data deletion is required.
- The first request after deploy may copy legacy DB into SQL if SQL is empty.
- Existing SQL data remains authoritative after migration.
- Keep App Review credentials and current production secrets unchanged.

## Decisions

- Keep the preserved legacy DB snapshot at least until App Review is complete and the production SQL path has been verified after deployment. Archive or remove it only through an explicit manual maintenance task later.
- Implement Phase 1 first, then add SQL-backed list reads for admin reservations/users/reports before broad frontend refactoring. This gives the DB efficiency work priority without mixing it with UI changes.
- Do Phase 3 module splitting in small domain-focused commits within the same branch unless the diff becomes too large to review safely.

## Recommendation

Proceed with Phase 1 first. It directly fixes the current data deletion risk and improves DB write safety without changing user-facing behavior. Then run the full verification suite before any broader file split.

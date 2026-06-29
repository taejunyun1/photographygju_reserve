# Safe SQL Storage Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cloudflare Durable Object SQL storage migration non-destructive, preserve the legacy DB snapshot during App Review, and lock the efficient row-diff write and paginated admin read contracts with tests.

**Architecture:** Keep SQL row storage as the runtime store and keep legacy `ctx.storage["db"]` as a preserved fallback snapshot. Extract Worker storage initialization into a pure helper that can be tested without importing `cloudflare:workers`. Keep `core.mjs` API behavior stable while adding regression coverage for paginated admin reads and row-diff writes.

**Tech Stack:** Node.js ESM, Cloudflare Workers Durable Object SQLite, vanilla JS frontend, existing Node smoke-test scripts.

## Global Constraints

- Cloudflare Durable Object SQLite 기반 저장소를 데이터 보존형으로 강화한다.
- 기존 legacy Durable Object `db` 값은 삭제하지 않고 보존한다.
- SQL 저장소가 비어 있을 때만 legacy DB를 SQL row로 복사한다.
- SQL 저장소가 이미 있으면 legacy DB가 남아 있어도 덮어쓰지 않는다.
- 쓰기는 변경된 row만 upsert/delete 하는 현재 방향을 유지하고 검증을 강화한다.
- 관리자 목록은 페이지 단위 API를 유지하되, 이후 SQL indexed query로 확장할 수 있게 경계를 정리한다.
- 현재 운영 DB를 초기화하거나 삭제하지 않는다.
- 심사 중인 앱의 API 응답 구조를 깨지 않는다.
- 이번 1차 작업에서 Cloudflare D1로 완전 이전하지 않는다.
- 인증 방식, 학생/관리자 권한 체계, 예약 정책을 동시에 바꾸지 않는다.
- 프론트 UI를 대규모로 재디자인하지 않는다.

---

## File Structure

- Create `worker-storage.mjs`: pure Worker storage initialization helper. It decides whether to migrate legacy `db` into SQL and never deletes legacy storage.
- Modify `worker.mjs`: call `ensureSqlStoreInitialized()` from the Durable Object and remove the legacy delete call.
- Modify `storage-sql.mjs`: record migration metadata in the `meta` singleton and keep row-diff writes unchanged.
- Modify `scripts/sql-storage-smoke-test.mjs`: test non-destructive migration, idempotent SQL authority, migration metadata, and no-op save behavior.
- Modify `scripts/security-smoke-test.mjs`: lock paginated admin read contracts for reservations, users, and reports while preserving legacy array responses.
- Modify `docs/gju-reserve-production-guide.md`: document that the Worker SQL migration preserves the legacy Durable Object DB snapshot during App Review.

## Task 1: Non-Destructive Worker Storage Initialization

**Files:**
- Create: `worker-storage.mjs`
- Modify: `worker.mjs`
- Modify: `scripts/sql-storage-smoke-test.mjs`

**Interfaces:**
- Consumes: `store.initialize(): Promise<void>`, `store.hasSqlData(): boolean`, `store.migrateLegacyDb(db, detail): Promise<void>`, and `storage.get(key): Promise<any>`.
- Produces: `ensureSqlStoreInitialized({ storage, store, legacyKey }): Promise<{ source: "sql" | "legacy" | "initial", migrated: boolean, preservedLegacyDb: boolean }>`

- [ ] **Step 1: Write the failing test**

Append this block near the end of `scripts/sql-storage-smoke-test.mjs`, before the final process exit:

```js
const { ensureSqlStoreInitialized } = await import("../worker-storage.mjs");

class FakeDurableStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
    this.getCalls = [];
    this.deleteCalls = [];
  }

  async get(key) {
    this.getCalls.push(key);
    return this.entries.get(key);
  }

  async delete(key) {
    this.deleteCalls.push(key);
    this.entries.delete(key);
  }
}

function fakeInitStore({ hasSqlData, onMigrate = async () => {} }) {
  return {
    initialized: false,
    migrated: [],
    async initialize() {
      this.initialized = true;
    },
    hasSqlData() {
      return hasSqlData;
    },
    async migrateLegacyDb(db, detail) {
      this.migrated.push({ db, detail });
      await onMigrate(db, detail);
    }
  };
}

const preservedLegacyDb = await initialDb("admin-pass");
preservedLegacyDb.reservations.push({
  id: "res_preserved_legacy",
  type: "studio",
  status: "approved",
  userId: "user_admin",
  fields: { reservedDate: "2026-07-10", timeSlots: ["10:00-12:00"], studioSpaces: ["Studio A"] },
  history: [],
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z"
});

const legacyStorage = new FakeDurableStorage({ db: preservedLegacyDb });
const legacyStore = fakeInitStore({ hasSqlData: false });
const legacyInit = await ensureSqlStoreInitialized({ storage: legacyStorage, store: legacyStore });
assert.equal(legacyInit.source, "legacy");
assert.equal(legacyInit.migrated, true);
assert.equal(legacyInit.preservedLegacyDb, true);
assert.equal(legacyStore.initialized, true);
assert.equal(legacyStore.migrated.length, 1);
assert.equal(legacyStore.migrated[0].db.reservations.some((item) => item.id === "res_preserved_legacy"), true);
assert.equal(legacyStore.migrated[0].detail.from, "legacy-durable-object-db");
assert.equal(legacyStore.migrated[0].detail.preservedLegacyDb, true);
assert.deepEqual(legacyStorage.deleteCalls, [], "legacy Durable Object db must not be deleted during migration");

const authoritativeSqlStorage = new FakeDurableStorage({ db: preservedLegacyDb });
const authoritativeSqlStore = fakeInitStore({ hasSqlData: true });
const sqlInit = await ensureSqlStoreInitialized({ storage: authoritativeSqlStorage, store: authoritativeSqlStore });
assert.equal(sqlInit.source, "sql");
assert.equal(sqlInit.migrated, false);
assert.deepEqual(authoritativeSqlStorage.getCalls, [], "legacy db must not be read when SQL already has data");
assert.deepEqual(authoritativeSqlStorage.deleteCalls, [], "legacy db must not be deleted when SQL already has data");

const emptyStorage = new FakeDurableStorage();
const emptyStore = fakeInitStore({ hasSqlData: false });
const emptyInit = await ensureSqlStoreInitialized({ storage: emptyStorage, store: emptyStore });
assert.equal(emptyInit.source, "initial");
assert.equal(emptyInit.migrated, false);
assert.deepEqual(emptyStorage.deleteCalls, [], "empty initialization must not delete any Durable Object keys");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:storage
```

Expected: FAIL with an import error for `../worker-storage.mjs`.

- [ ] **Step 3: Create the storage initialization helper**

Create `worker-storage.mjs` with this full content:

```js
export async function ensureSqlStoreInitialized({ storage, store, legacyKey = "db" }) {
  await store.initialize();

  if (store.hasSqlData()) {
    return {
      source: "sql",
      migrated: false,
      preservedLegacyDb: true
    };
  }

  const legacyDb = await storage.get(legacyKey);
  if (legacyDb) {
    await store.migrateLegacyDb(legacyDb, {
      from: "legacy-durable-object-db",
      legacyKey,
      preservedLegacyDb: true
    });
    return {
      source: "legacy",
      migrated: true,
      preservedLegacyDb: true
    };
  }

  return {
    source: "initial",
    migrated: false,
    preservedLegacyDb: true
  };
}
```

- [ ] **Step 4: Wire the Worker to the helper**

Modify the imports at the top of `worker.mjs`:

```js
import { DurableObject } from "cloudflare:workers";
import { cleanupExpiredData, initialDb, normalizeDb, capLogs, handleApiRequest } from "./core.mjs";
import { createSqlAppStore } from "./storage-sql.mjs";
import { ensureSqlStoreInitialized } from "./worker-storage.mjs";
```

Replace the current `ensureInitialized()` method in `worker.mjs` with:

```js
  async ensureInitialized() {
    if (this.initialized) return;
    await ensureSqlStoreInitialized({
      storage: this.ctx.storage,
      store: this.store
    });
    this.initialized = true;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm run test:storage
```

Expected: PASS, including the assertions that no legacy `db` delete call occurs.

- [ ] **Step 6: Commit**

Run:

```bash
git add worker-storage.mjs worker.mjs scripts/sql-storage-smoke-test.mjs
git commit -m "2026-06-30 SQL 저장소 마이그레이션 보존 처리"
```

Expected: commit succeeds and includes only these three files.

## Task 2: Migration Metadata And Idempotence

**Files:**
- Modify: `storage-sql.mjs`
- Modify: `scripts/sql-storage-smoke-test.mjs`

**Interfaces:**
- Consumes: `migrateLegacyDb(db, detail)` from Task 1.
- Produces: `db.meta.storageMigration` with `{ from, legacyKey, migratedAt, preservedLegacyDb, collectionCounts }`.

- [ ] **Step 1: Write the failing metadata test**

In `scripts/sql-storage-smoke-test.mjs`, after `await migrationStore.migrateLegacyDb(legacyDb);`, insert:

```js
const migrationMeta = JSON.parse(migrationSql.records.app_singletons.get("meta").data);
assert.equal(migrationMeta.storageMigration.from, "legacy-durable-object-db");
assert.equal(migrationMeta.storageMigration.preservedLegacyDb, true);
assert.equal(typeof migrationMeta.storageMigration.migratedAt, "string");
assert.equal(migrationMeta.storageMigration.collectionCounts.reservations, 1);
assert.equal(migrationMeta.storageMigration.collectionCounts.users > 0, true);
assert.equal("passwordHash" in migrationMeta.storageMigration, false);
assert.equal("phone" in migrationMeta.storageMigration, false);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:storage
```

Expected: FAIL because `storageMigration` metadata is not recorded.

- [ ] **Step 3: Add migration metadata helpers**

In `storage-sql.mjs`, add these helpers after `function nowIso()`:

```js
function collectionCounts(db) {
  return Object.fromEntries(COLLECTIONS.map((collection) => [
    collection.key,
    Array.isArray(db[collection.key]) ? db[collection.key].length : 0
  ]));
}

function markLegacyMigration(db, detail = {}) {
  db.meta = {
    ...(db.meta || {}),
    storageMigration: {
      from: detail.from || "legacy-durable-object-db",
      legacyKey: detail.legacyKey || "db",
      migratedAt: nowIso(),
      preservedLegacyDb: detail.preservedLegacyDb !== false,
      collectionCounts: collectionCounts(db)
    }
  };
  return db;
}
```

Replace `migrateLegacyDb(db)` in `storage-sql.mjs` with:

```js
  async function migrateLegacyDb(db, detail = {}) {
    markLegacyMigration(db, detail);
    await saveDb(db);
  }
```

- [ ] **Step 4: Add SQL-authoritative idempotence test**

Append this block after the Task 1 helper tests in `scripts/sql-storage-smoke-test.mjs`:

```js
const overwriteGuardStorage = new FakeDurableStorage({
  db: {
    users: [],
    reservations: [{ id: "res_should_not_overwrite_sql", type: "print", status: "cancelled", fields: {}, history: [] }]
  }
});
let overwriteGuardMigrated = false;
const overwriteGuardStore = fakeInitStore({
  hasSqlData: true,
  onMigrate: async () => {
    overwriteGuardMigrated = true;
  }
});
const overwriteGuardInit = await ensureSqlStoreInitialized({
  storage: overwriteGuardStorage,
  store: overwriteGuardStore
});
assert.equal(overwriteGuardInit.source, "sql");
assert.equal(overwriteGuardMigrated, false);
assert.deepEqual(overwriteGuardStorage.getCalls, []);
assert.deepEqual(overwriteGuardStorage.deleteCalls, []);
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm run test:storage
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add storage-sql.mjs scripts/sql-storage-smoke-test.mjs
git commit -m "2026-06-30 SQL 마이그레이션 메타데이터 추가"
```

Expected: commit succeeds and includes only these two files.

## Task 3: Row-Diff Write Contract Regression

**Files:**
- Modify: `scripts/sql-storage-smoke-test.mjs`
- Modify: `storage-sql.mjs` only if the new test exposes a bug.

**Interfaces:**
- Consumes: `createSqlAppStore(sql, options)` from `storage-sql.mjs`.
- Produces: regression coverage that unchanged saves do not rewrite singleton or collection rows, and changed collection rows upsert without table clears.

- [ ] **Step 1: Strengthen the no-op save test**

In `scripts/sql-storage-smoke-test.mjs`, replace the existing no-op save block:

```js
const deleteCountBeforeNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
await store.saveDb(loaded);
const deleteCountAfterNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
assert.equal(deleteCountAfterNoopSave, deleteCountBeforeNoopSave, "unchanged saves should not rewrite SQL tables");
```

with:

```js
const deleteCountBeforeNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
const insertCountBeforeNoopSave = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE")).length;
await store.saveDb(loaded);
const deleteCountAfterNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
const insertCountAfterNoopSave = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE")).length;
assert.equal(deleteCountAfterNoopSave, deleteCountBeforeNoopSave, "unchanged saves should not delete SQL rows");
assert.equal(insertCountAfterNoopSave, insertCountBeforeNoopSave, "unchanged saves should not upsert SQL rows");
```

- [ ] **Step 2: Add a singleton-only update test**

Append this block after the changed reservation upsert assertions:

```js
const reservationInsertCountBeforeSettingsChange = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE INTO reservations")).length;
loaded.settings.appName = "GJU Reserve 운영";
await store.saveDb(loaded);
const reservationInsertCountAfterSettingsChange = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE INTO reservations")).length;
assert.equal(
  reservationInsertCountAfterSettingsChange,
  reservationInsertCountBeforeSettingsChange,
  "settings-only saves should not upsert reservation rows"
);
```

- [ ] **Step 3: Run test**

Run:

```bash
npm run test:storage
```

Expected: PASS. If it fails because a no-op save rewrites rows, inspect `lastSingletonSnapshot` and `lastCollectionSnapshots` in `storage-sql.mjs`, then update only the snapshot bookkeeping needed to make the assertions pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add scripts/sql-storage-smoke-test.mjs storage-sql.mjs
git commit -m "2026-06-30 SQL row diff 저장 검증 강화"
```

Expected: commit succeeds. If `storage-sql.mjs` did not change, commit only `scripts/sql-storage-smoke-test.mjs`.

## Task 4: Paginated Admin Read Contract Regression

**Files:**
- Modify: `scripts/security-smoke-test.mjs`
- Modify: `core.mjs` only if the new tests expose a regression.
- Modify: `public/js/data.js` only if the frontend no longer normalizes paginated responses.

**Interfaces:**
- Consumes: `handleApiRequest(ctx)` and existing admin list endpoints.
- Produces: test coverage that paginated admin reads return bounded `{ items, total, page, pageSize, hasMore }` shapes while legacy unpaginated calls still return arrays.

- [ ] **Step 1: Add pagination tests for admin reservations**

In `scripts/security-smoke-test.mjs`, after `const adminToken = adminLogin.body.data.token;`, insert:

```js
db.reservations.push(
  {
    id: "res_page_equipment_1",
    type: "equipment",
    status: "checked_out",
    userId: "user_admin",
    fields: { reservedDate: "2026-07-01", rentalTime: "10:00", returnTime: "12:00", equipmentItemIds: [] },
    history: [],
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z"
  },
  {
    id: "res_page_print_1",
    type: "print",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: "2026-07-02", startTime: "10:00", endTime: "11:00" },
    history: [],
    createdAt: "2026-06-30T00:01:00.000Z",
    updatedAt: "2026-06-30T00:01:00.000Z"
  },
  {
    id: "res_page_print_2",
    type: "print",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: "2026-07-03", startTime: "12:00", endTime: "13:00" },
    history: [],
    createdAt: "2026-06-30T00:02:00.000Z",
    updatedAt: "2026-06-30T00:02:00.000Z"
  }
);

const pagedReservations = await api("GET", "/api/admin/reservations?page=1&pageSize=1&type=print", {}, adminToken);
assert.equal(pagedReservations.status, 200);
assert.equal(Array.isArray(pagedReservations.body.data.items), true);
assert.equal(pagedReservations.body.data.page, 1);
assert.equal(pagedReservations.body.data.pageSize, 1);
assert.equal(pagedReservations.body.data.total >= 2, true);
assert.equal(pagedReservations.body.data.hasMore, true);
assert.equal(pagedReservations.body.data.items.length, 1);
assert.equal(pagedReservations.body.data.items.every((item) => item.type === "print"), true);

const legacyReservations = await api("GET", "/api/admin/reservations", {}, adminToken);
assert.equal(legacyReservations.status, 200);
assert.equal(Array.isArray(legacyReservations.body.data), true);
```

- [ ] **Step 2: Add pagination tests for admin users and reports**

Immediately after the reservations pagination block, insert:

```js
db.reports.push({
  id: "report_page_1",
  type: "studio",
  reservationId: "res_page_print_1",
  userId: "user_admin",
  fields: { actualTime: "1시간", participants: "1", cleanupConfirmed: true, damageFound: false },
  htmlSnapshot: "<article>report</article>",
  submittedAt: "2026-06-30T00:03:00.000Z",
  expiresAt: "2026-12-30T00:03:00.000Z"
});

const pagedUsers = await api("GET", "/api/admin/users?page=1&pageSize=1&role=student", {}, adminToken);
assert.equal(pagedUsers.status, 200);
assert.equal(Array.isArray(pagedUsers.body.data.items), true);
assert.equal(pagedUsers.body.data.pageSize, 1);
assert.equal(pagedUsers.body.data.items.every((user) => user.role === "student"), true);

const legacyUsers = await api("GET", "/api/admin/users", {}, adminToken);
assert.equal(legacyUsers.status, 200);
assert.equal(Array.isArray(legacyUsers.body.data), true);

const pagedReports = await api("GET", "/api/admin/reports?page=1&pageSize=1&q=report_page_1", {}, adminToken);
assert.equal(pagedReports.status, 200);
assert.equal(Array.isArray(pagedReports.body.data.items), true);
assert.equal(pagedReports.body.data.pageSize, 1);
assert.equal(pagedReports.body.data.items.length, 1);
assert.equal(pagedReports.body.data.items[0].id, "report_page_1");

const legacyReports = await api("GET", "/api/admin/reports", {}, adminToken);
assert.equal(legacyReports.status, 200);
assert.equal(Array.isArray(legacyReports.body.data), true);
```

- [ ] **Step 3: Run test**

Run:

```bash
npm run test:security
```

Expected: PASS. If it fails because `searchParams` is not parsed from paths containing `?`, verify that `handleApiRequest(ctx)` contains:

```js
  if (pathname.includes("?")) {
    const parsed = new URL(pathname, "https://gju-reserve.local");
    pathname = parsed.pathname;
    if (!ctx.searchParams) searchParams = parsed.searchParams;
  }
```

and restore that block if it is missing.

- [ ] **Step 4: Commit**

Run:

```bash
git add scripts/security-smoke-test.mjs core.mjs public/js/data.js
git commit -m "2026-06-30 관리자 페이지 읽기 계약 검증"
```

Expected: commit succeeds. If `core.mjs` and `public/js/data.js` did not change, commit only `scripts/security-smoke-test.mjs`.

## Task 5: Production Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/gju-reserve-production-guide.md`

**Interfaces:**
- Consumes: storage behavior from Tasks 1-3.
- Produces: operator-facing documentation that SQL migration preserves legacy Durable Object data.

- [ ] **Step 1: Update README production architecture note**

In `README.md`, replace this sentence:

```text
The production database is never reset in place (guardrail). There is no
reset endpoint; `INTERNAL_CRON_SECRET` only guards the retention-cleanup cron.
```

with:

```text
The production database is never reset in place (guardrail). There is no
reset endpoint; `INTERNAL_CRON_SECRET` only guards the retention-cleanup cron.
During the Durable Object SQLite migration, the legacy Durable Object `db`
snapshot is copied into SQL only when SQL is empty and is preserved for manual
recovery during App Review.
```

- [ ] **Step 2: Update production guide database rules**

In `docs/gju-reserve-production-guide.md`, after the "Database rules:" line, add this bullet:

```markdown
- During the current Durable Object SQLite migration, preserve the legacy Durable Object `db` snapshot. Copy it into SQL only when SQL is empty, and do not delete it automatically during App Review.
```

- [ ] **Step 3: Run documentation/source guard**

Run:

```bash
rg -n "ctx\\.storage\\.delete\\(\"db\"\\)|storage\\.delete\\(\"db\"\\)|delete\\(\"db\"\\)" worker.mjs worker-storage.mjs storage-sql.mjs README.md docs/gju-reserve-production-guide.md
```

Expected: no output.

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md docs/gju-reserve-production-guide.md
git commit -m "2026-06-30 SQL 마이그레이션 운영 문서 업데이트"
```

Expected: commit succeeds and includes only documentation changes.

## Task 6: Full Verification

**Files:**
- No source edits unless a verification command exposes a defect.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified branch ready for the next refactor plan.

- [ ] **Step 1: Run storage and security tests**

Run:

```bash
npm run test:storage && npm run test:security
```

Expected: PASS.

- [ ] **Step 2: Run syntax checks**

Run:

```bash
npm run check && npm run check:js
```

Expected: PASS.

- [ ] **Step 3: Run release check**

Run:

```bash
npm run release:check
```

Expected: PASS. If native release checks fail because local signing secrets or upload-key files are absent, record the exact missing prerequisite and continue with `npm run test:storage && npm run test:security && npm run check && npm run check:js` as the verified code-path gate.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: no uncommitted source changes from Tasks 1-5. Existing unrelated pre-task changes may remain in the worktree and must not be reverted.

- [ ] **Step 5: Prepare next refactor handoff**

Create a short note in the final response with:

```text
Verified:
- npm run test:storage
- npm run test:security
- npm run check
- npm run check:js

Deferred to next plan:
- core.mjs domain split
- public/js/events.js event handler split
- view/CSS organization
```

Expected: user can approve the next plan for backend module splitting after storage safety is verified.

# Task 2 Report: Safe Bulk Delete Backend

## Scope
- Worked only in:
  - `core/admin-bulk-delete.mjs`
  - `core/admin-lists.mjs`
  - `core.mjs`
  - `scripts/security-smoke-test.mjs`

## TDD Evidence
1. Added the Task 2 bulk delete smoke tests from the brief to `scripts/security-smoke-test.mjs`.
2. Ran RED:

```bash
npm run test:security
```

Observed failure:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
404 !== 400
```

This confirmed the missing `DELETE /api/admin/reservations/bulk` endpoint before production code changes.

3. Implemented:
   - Reusable admin filter exports in `core/admin-lists.mjs`
   - Safe bulk delete helper module in `core/admin-bulk-delete.mjs`
   - Bulk delete routes and audit wiring in `core.mjs`

4. Ran GREEN:

```bash
npm run test:security
```

Observed result:

```text
security smoke test passed
```

## Verification Commands
Executed after implementation:

```bash
npm run test:security
npm run check && npm run test:storage
```

Results:
- `npm run test:security` passed
- `npm run check` passed
- `npm run test:storage` passed

## Changed Files
- `core/admin-bulk-delete.mjs`
  - Added `FULL_DELETE_PHRASE`, `assertBulkScope`, `allowedFilters`
  - Added:
    - `deleteAdminReservations`
    - `deleteAdminReports`
    - `deleteAdminLectures`
    - `deleteAdminNotices`
  - Reservation deletes cascade to linked reports
  - Report deletes reset linked reservation `fields.reportStatus` from `submitted` to `required`

- `core/admin-lists.mjs`
  - Extracted reusable filter internals for reservations, reports, lectures, notices
  - Added `searchParamsFromFilters(filters = {})`
  - Exposed:
    - `filterAdminReservations`
    - `filterAdminReports`
    - `filterAdminLectures`
    - `filterAdminNotices`

- `core.mjs`
  - Imported bulk delete helpers
  - Wired routes:
    - `DELETE /api/admin/reservations/bulk`
    - `DELETE /api/admin/reports/bulk`
    - `DELETE /api/admin/lectures/bulk`
    - `DELETE /api/admin/notices/bulk`
  - Added audit actions:
    - `reservations.bulk_deleted`
    - `reports.bulk_deleted`
    - `lectures.bulk_deleted`
    - `notices.bulk_deleted`

- `scripts/security-smoke-test.mjs`
  - Added the required Task 2 bulk delete tests from the brief

## Self-Review
- Confirmed full-delete requests require the exact phrase `전체 삭제`
- Confirmed unsupported filter keys are rejected with `400`
- Confirmed reservations bulk delete removes linked reports
- Confirmed reports bulk delete resets linked reservation report status
- Confirmed lectures bulk delete removes linked lecture applications
- Confirmed notices bulk delete only affects notices
- Confirmed no bulk delete routes were added for users or equipment inventory
- Confirmed no migration/reset/truncate/deploy work was performed

## Concerns
- None.

## Review Fix Notes (2026-07-01)
- Removed the reservation bulk-delete narrowing path from `core/admin-bulk-delete.mjs`. Filtered reservation bulk delete now deletes the full current server-side filtered result instead of a latest-created subset.
- Updated `scripts/security-smoke-test.mjs` to assert the real reservation bulk-delete contract against the overlapping `2026-S2` semester fixtures. The test now proves that all matching filtered reservations and their linked reports are deleted.
- The prior audit minor about subset narrowing is no longer relevant after this change.

## Review Fix Verification
- `npm run test:security` -> passed
- `npm run check` -> passed
- `npm run test:storage` -> passed

# SQL Storage Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Worker production database from one Durable Object JSON blob to SQLite tables with indexes, then add bounded admin list APIs for four-year operation.

**Architecture:** Keep `core.mjs` as the in-memory domain/API layer for compatibility, but add a SQL table store that persists each logical collection into its own Durable Object SQLite table. Worker startup migrates legacy `storage.get("db")` data into SQL tables, loads a normalized DB from SQL rows per request, and writes changed collections back to SQL. Admin list endpoints gain optional pagination, type/status/date/query filters, while preserving legacy array responses when no pagination parameters are present.

**Tech Stack:** Node 18 ESM, Cloudflare Workers Durable Object SQLite `ctx.storage.sql.exec`, existing vanilla JS frontend, existing script-based smoke tests.

## Global Constraints

- Keep same public API behavior for existing unpaginated callers.
- Do not store production data in a single Durable Object value larger than Cloudflare KV value limits.
- Add SQL indexes for long-running list paths: reservations, reports, users, sessions, audit logs.
- Keep tests script-only; do not introduce a new test framework.
- Preserve deployment paths for Cloudflare Worker, Dothome web, iOS, and Android.

---

### Task 1: SQL Table Store

**Files:**
- Create: `storage-sql.mjs`
- Create: `scripts/sql-storage-smoke-test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createSqlAppStore(sql, options)` returning `{ initialize(), loadDb(), saveDb(db), migrateLegacyDb(db) }`.
- Consumes: existing `initialDb(adminPassword)`, `normalizeDb(db)`, and `capLogs(db)` from `core.mjs`.

- [ ] **Step 1: Write the failing test**

Create `scripts/sql-storage-smoke-test.mjs` with a fake SQL executor that records schema/index SQL and validates:

```js
import assert from "node:assert/strict";
import { initialDb } from "../core.mjs";
import { createSqlAppStore } from "../storage-sql.mjs";

class FakeSql {
  constructor() {
    this.statements = [];
    this.rows = new Map();
  }
  exec(sql, ...params) {
    this.statements.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (/^SELECT name, data FROM app_records/i.test(sql)) {
      return { toArray: () => [...this.rows].map(([name, data]) => ({ name, data })) };
    }
    if (/^SELECT COUNT\(\*\) AS count FROM app_records/i.test(sql)) {
      return { one: () => ({ count: this.rows.size }) };
    }
    if (/^DELETE FROM app_records/i.test(sql)) {
      this.rows.clear();
      return { toArray: () => [], one: () => ({}) };
    }
    if (/^INSERT OR REPLACE INTO app_records/i.test(sql)) {
      this.rows.set(params[0], params[1]);
      return { toArray: () => [], one: () => ({}) };
    }
    return { toArray: () => [], one: () => ({}) };
  }
}

const sql = new FakeSql();
const store = createSqlAppStore(sql, { initialDb: () => initialDb("admin-pass") });
await store.initialize();
assert.ok(sql.statements.some((item) => item.sql.includes("CREATE TABLE IF NOT EXISTS reservations")));
assert.ok(sql.statements.some((item) => item.sql.includes("CREATE INDEX IF NOT EXISTS idx_reservations_type_status_date")));

const db = await initialDb("admin-pass");
db.reservations.push({
  id: "res_sql_1",
  type: "print",
  status: "auto_confirmed",
  userId: "user_admin",
  fields: { reservedDate: "2026-07-01", startTime: "10:00", endTime: "11:00" },
  history: [],
  createdAt: "2026-06-24T00:00:00.000Z",
  updatedAt: "2026-06-24T00:00:00.000Z"
});
await store.saveDb(db);
const loaded = await store.loadDb();
assert.equal(loaded.reservations.length, 1);
assert.equal(loaded.reservations[0].id, "res_sql_1");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/sql-storage-smoke-test.mjs`
Expected: FAIL with `Cannot find module '../storage-sql.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `storage-sql.mjs` with schema creation, index creation, `app_records` collection storage, and normalized load/save helpers. Use JSON per collection in `app_records` for compatibility, plus indexed mirror tables for reservations/reports/users/sessions/audit logs to satisfy SQL structure and future querying.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/sql-storage-smoke-test.mjs`
Expected: PASS.

- [ ] **Step 5: Add npm script**

Modify `package.json`:

```json
"test:storage": "node scripts/sql-storage-smoke-test.mjs"
```

Run: `npm run test:storage`
Expected: PASS.

### Task 2: Worker Uses SQL Store

**Files:**
- Modify: `worker.mjs`
- Modify: `scripts/sql-storage-smoke-test.mjs`

**Interfaces:**
- Consumes: `createSqlAppStore(sql, { initialDb })`.
- Produces: Worker Durable Object uses SQLite tables and migrates legacy `ctx.storage.get("db")` once.

- [ ] **Step 1: Extend failing test**

Add assertions that `migrateLegacyDb(db)` saves existing reservations and `loadDb()` returns them after no `app_records` existed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:storage`
Expected: FAIL because `migrateLegacyDb` is missing or not wired.

- [ ] **Step 3: Implement Worker integration**

In `worker.mjs`, import `createSqlAppStore`, create `this.store` from `this.ctx.storage.sql`, run `this.store.initialize()`, read legacy `this.ctx.storage.get("db")`, migrate it into SQL if SQL is empty, then use `store.loadDb()` and `store.saveDb(db)` for all API requests.

- [ ] **Step 4: Run checks**

Run: `npm run test:storage && npm run check`
Expected: PASS.

### Task 3: Admin Pagination and Filters

**Files:**
- Modify: `core.mjs`
- Modify: `public/js/data.js`
- Modify: `public/js/views-admin.js`
- Modify: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Produces: `parseListParams(pathname, searchParams, defaults)` and paginated response shape `{ items, total, page, pageSize, hasMore }`.
- Preserves: legacy `/api/admin/reservations`, `/api/admin/reports`, `/api/admin/users` array response when no query string is provided.

- [ ] **Step 1: Write failing tests**

Extend `scripts/security-smoke-test.mjs` to call:

```js
const pagedReservations = await api("GET", "/api/admin/reservations?page=1&pageSize=2&type=print", {}, adminToken);
assert.equal(pagedReservations.status, 200);
assert.equal(Array.isArray(pagedReservations.body.data.items), true);
assert.equal(pagedReservations.body.data.pageSize, 2);
assert.equal(pagedReservations.body.data.items.every((item) => item.type === "print"), true);
```

Also assert unpaginated legacy route still returns an array:

```js
const legacyReservations = await api("GET", "/api/admin/reservations", {}, adminToken);
assert.equal(Array.isArray(legacyReservations.body.data), true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:security`
Expected: FAIL because the router currently ignores query strings.

- [ ] **Step 3: Implement minimal core support**

Update `handleApiRequest(ctx)` to accept `ctx.searchParams`; local/worker adapters pass URL query params. Add list helpers for reservations, reports, and users. Keep existing array response when `searchParams` is empty.

- [ ] **Step 4: Update admin frontend**

Change `loadAdminData()` to request bounded first pages:

```js
api("/api/admin/reservations?page=1&pageSize=100")
api("/api/admin/reports?page=1&pageSize=100")
api("/api/admin/users?page=1&pageSize=100")
```

Normalize responses with `items || response` so existing views keep working.

- [ ] **Step 5: Run tests**

Run: `npm run test:security && npm run check:js`
Expected: PASS.

### Task 4: Release Verification and Review

**Files:**
- Modify as needed from prior tasks.

**Interfaces:**
- Consumes: complete implementation from Tasks 1-3.
- Produces: reviewed, verified branch.

- [ ] **Step 1: Full verification**

Run: `npm run release:check && npm run test:storage && GJU_PRODUCTION_URL=https://photographygju.dothome.co.kr npm run deploy:check`
Expected: PASS.

- [ ] **Step 2: Code review**

Use `superpowers:requesting-code-review` with base `origin/main` and current `HEAD`.

- [ ] **Step 3: Apply Critical/Important review feedback**

Fix any Critical or Important issues, rerun relevant verification.

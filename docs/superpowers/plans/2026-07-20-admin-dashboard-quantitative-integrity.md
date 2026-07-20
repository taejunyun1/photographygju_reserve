# Admin Dashboard Quantitative Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every administrator dashboard count use an explicit operational definition and add a minimal report review action so pending report totals can decrease.

**Architecture:** Keep aggregation in `GET /api/admin/summary`, using small status predicates inside the route. Extend the existing report REST pattern with one administrator-only status transition and expose it through the existing React admin action bridge. Preserve legacy status-less reports by treating them as submitted.

**Tech Stack:** Node.js ES modules, Cloudflare Worker-compatible API core, React 19, TypeScript, static rendering tests, Node `assert` domain tests.

## Global Constraints

- Do not add a separate analytics page or custom date-range UI.
- Use `Asia/Seoul` for all “today” calculations.
- Exclude `cancelled`, `admin_cancelled`, and `rejected` from weekly, type-share, and popular-equipment metrics.
- Keep cancellation rate and distinct-reserved-day utilization formulas unchanged.
- The only new report workflow is `submitted` to `reviewed`.
- Do not modify or remove user-owned untracked files.
- Do not use subagents.

---

### Task 1: Correct dashboard reservation and equipment metrics

**Files:**
- Modify: `scripts/dashboard-data-integrity-test.mjs`
- Modify: `scripts/backend-domain-timing-test.mjs`
- Modify: `core.mjs:1360-1448`

**Interfaces:**
- Consumes: `GET /api/admin/summary` and reservation details produced by `withReservationDetails(db, reservation)`.
- Produces: corrected queue, today terminal cards, weekly totals, equipment availability, type share, and popular equipment.

- [ ] **Step 1: Write failing dashboard aggregation tests**

Add fixtures for an approved same-day checkout, a checked-out same-day return, an inquiry-only available item, and cancelled/rejected reservations. Assert:

```js
assert.deepEqual(
  summary.checkoutReturnQueue.map(({ id, queueAction }) => [id, queueAction]),
  [["approved_today", "checkout"], ["checked_out_today", "return"]]
);
assert.equal(summary.metrics.availableEquipment, 1);
assert.equal(summary.metrics.equipmentAvailableRate, 33);
assert.equal(summary.metrics.weekReservations, 4);
assert.deepEqual(summary.metrics.typeCounts, { equipment: 3, studio: 1 });
assert.equal(summary.metrics.popularEquipment.some((item) => item.name === "취소 장비"), false);
```

Add old returned and cancelled reservations, then assert the today cards do not include them.

- [ ] **Step 2: Run the tests and verify RED**

Run `npm run test:dashboard-integrity && npm run test:backend-domains`.

Expected: failures showing duplicate queue entries, inquiry-only availability, cancelled metrics, or non-today terminal cards.

- [ ] **Step 3: Implement minimal aggregation predicates**

Inside the summary route, define and use:

```js
const excludedMetricStatuses = new Set(["cancelled", "admin_cancelled", "rejected"]);
const metricReservations = detailedReservations.filter((item) => !excludedMetricStatuses.has(item.status));
const availableEquipment = activeEquipment.filter((item) => item.status === "가능" && item.reservable !== false && item.inquiryOnly !== true).length;
```

Build checkout entries from `approved` reservations whose start date is today and return entries from `checked_out` reservations whose computed end date is today. Build weekly, type-share, and popular-equipment metrics from `metricReservations`. Limit returned and cancelled dashboard cards to today.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run `npm run test:dashboard-integrity && npm run test:backend-domains`.

Expected: both scripts exit 0.

### Task 2: Add the report submitted-to-reviewed lifecycle

**Files:**
- Modify: `scripts/dashboard-data-integrity-test.mjs`
- Modify: `scripts/security-smoke-test.mjs`
- Modify: `core.mjs:1114-1127`
- Modify: `core.mjs:1443`
- Modify: `core.mjs:1815-1828`

**Interfaces:**
- Consumes: `PATCH /api/admin/reports/:id/status` with `{ status: "reviewed" }`.
- Produces: the updated report record and a decreasing `metrics.reportQueueCount`.

- [ ] **Step 1: Write failing report lifecycle tests**

Create a report through `POST /api/reports/studio` and assert `status === "submitted"`. Patch it as an administrator and assert:

```js
assert.equal(reviewedResponse.status, 200);
assert.equal(reviewedResponse.body.data.status, "reviewed");
assert.equal(reviewedSummary.body.data.metrics.reportQueueCount, 0);
```

Also assert that an unknown report returns 404 and a status other than `reviewed` returns 400.

- [ ] **Step 2: Run the tests and verify RED**

Run `npm run test:dashboard-integrity && npm run test:security`.

Expected: report creation has no status and the status endpoint returns 404.

- [ ] **Step 3: Implement the report lifecycle**

Store new reports with `status: "submitted"`. Add an administrator-only report status route that permits only `reviewed`, records `reviewedAt` and `reviewedBy`, writes an audit event, saves the database, and returns `reportWithDetails`. Count only `!report.status || report.status === "submitted"` in `reportQueueCount`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run `npm run test:dashboard-integrity && npm run test:security`.

Expected: both scripts exit 0.

### Task 3: Connect report review and today filters to React admin

**Files:**
- Modify: `src/react/platform/types.ts`
- Modify: `public/js/data.js`
- Modify: `public/js/renderer.js`
- Modify: `src/react/admin/screens/AdminReports.tsx`
- Modify: `src/react/admin/screens/AdminDashboard.tsx`
- Modify: `scripts/react-admin-data-test.mjs`
- Modify: `scripts/react-admin-render-test.mjs`

**Interfaces:**
- Consumes: `ReactAdminActions.reviewReport(reportId)` and reservation filters `from`/`to`.
- Produces: report confirmation controls and dashboard cards whose target list uses the same date range as the card count.

- [ ] **Step 1: Write failing bridge and render tests**

Assert that returned/cancelled cards navigate with `from` and `to` equal to today. Assert that submitted reports render a `확인 완료` button, reviewed reports do not, and calling `reviewReport` issues a `PATCH` to `/api/admin/reports/:id/status` with `{ status: "reviewed" }`.

- [ ] **Step 2: Run the tests and verify RED**

Run `npm run test:react-admin && npm run check:react-admin && node scripts/react-admin-data-test.mjs`.

Expected: the action type, button, endpoint call, or date query assertions fail.

- [ ] **Step 3: Implement the action and controls**

Add `from` and `to` to reservation filter types and persistence in `public/js/data.js`. Add `reviewReport(reportId: string): Promise<void>` to `ReactAdminActions` and implement it with `runAdminMutation`, invalidating reports and dashboard. Render `확인 완료` beside submitted report status in desktop and mobile layouts, add a reviewed report tab, and supply today as `from` and `to` on the returned and cancelled cards.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run `npm run test:react-admin && npm run check:react-admin && node scripts/react-admin-data-test.mjs`.

Expected: all commands exit 0.

### Task 4: Full regression verification and handoff

**Files:**
- Verify only: all changed source and test files

**Interfaces:**
- Consumes: the complete application test matrix.
- Produces: a release-ready local commit with no unrelated user files staged.

- [ ] **Step 1: Run full release verification**

Run `npm run release:check`.

Expected: all Node, TypeScript, build, Playwright, storage, security, and native release checks exit 0.

- [ ] **Step 2: Inspect the final diff**

Run `git diff --check`, `git status --short`, and `git diff --stat HEAD`.

Expected: no whitespace errors; only planned files are modified; `.codex-audit/` and `equipment-list-2026-07-14.txt` remain untracked and untouched.

- [ ] **Step 3: Commit the implementation**

Stage only planned source, test, and plan files, then commit with message `2026-07-20 관리자 대시보드 정량 지표 정합성 수정`.

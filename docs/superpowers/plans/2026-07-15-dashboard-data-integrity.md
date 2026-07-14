# Dashboard Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the admin dashboard, report submission eligibility, and admin report list expose the same reservation facts and never surface cancelled work in the active operations queue.

**Architecture:** The server is the source of truth for operational reservation state and report eligibility. `GET /api/admin/summary` derives counts and queues from that canonical predicate, while `GET /api/admin/reports` materializes the same eligible-but-unsubmitted studio reservations as read-only `missing` report rows alongside persisted submissions. The React admin dashboard passes a `missing` status filter so its report card resolves to exactly the rows it counts.

**Tech Stack:** Node.js ESM application core, Cloudflare Worker API, TypeScript React admin/student bundles, Node assertion scripts, Playwright.

## Global Constraints

- Treat `cancelled`, `admin_cancelled`, `rejected`, `returned`, and `completed` as non-operational reservations for active queues.
- A report submission target is a studio reservation with `reportStatus !== "submitted"`, a non-cancelled status, and `reservedDate <= today` in Asia/Seoul.
- Preserve completed studio reservations as report-eligible; completion means the studio use occurred, not that its report exists.
- Do not expose synthetic missing-report rows to destructive report-delete actions.
- Keep existing user-owned untracked files untouched.

---

### Task 1: Exclude terminal reservations from the admin operating timeline

**Files:**
- Create: `scripts/dashboard-data-integrity-test.mjs`
- Modify: `core.mjs:79-90,625-628,951-956`

**Interfaces:**
- Produces: `isOperationalReservation(reservation)` used by bootstrap and the dashboard's `todaySchedule`.

- [ ] **Step 1: Write the failing test**

```js
assert.deepEqual(
  summary.body.data.todaySchedule.map((reservation) => reservation.id),
  ["dashboard-active-today"]
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/dashboard-data-integrity-test.mjs`

Expected: terminal `dashboard-cancelled-today` and `dashboard-rejected-today` are incorrectly present.

- [ ] **Step 3: Write minimal implementation**

```js
function isOperationalReservation(reservation) {
  return !RESERVATION_CANCELLATION_TERMINAL_STATUSES.has(reservation?.status);
}

const todaySchedule = detailedReservations
  .filter((item) => item.fields?.reservedDate === today && isOperationalReservation(item));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/dashboard-data-integrity-test.mjs && npm run test:backend-domains`

Expected: both commands exit 0.

### Task 2: Define a server-owned studio report eligibility predicate

**Files:**
- Modify: `scripts/dashboard-data-integrity-test.mjs`
- Modify: `core.mjs:898-935,974-975`
- Modify: `core/reservation-views.mjs:1-48`

**Interfaces:**
- Produces: `isStudioReportDue(reservation, today)` and response field `reportDue?: boolean`.
- Consumes: `todayKeySeoul()` and `withReservationDetails`/`publicReservationSummary` response builders.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(summary.body.data.missingReports, 1);
assert.equal(futureReportAttempt.status, 409);
assert.equal(dueReportAttempt.status, 200);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/dashboard-data-integrity-test.mjs`

Expected: future reservations are counted as missing and accepted by the report POST endpoint.

- [ ] **Step 3: Write minimal implementation**

```js
function isStudioReportDue(reservation, today = todayKeySeoul()) {
  return reservation?.type === "studio" &&
    reservation?.fields?.reportStatus !== "submitted" &&
    !["cancelled", "admin_cancelled", "rejected"].includes(reservation?.status) &&
    Boolean(reservation?.fields?.reservedDate) &&
    reservation.fields.reservedDate <= today;
}
```

Use the predicate for `missingReports`, report submission validation, and the transient `reportDue` API response field.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/dashboard-data-integrity-test.mjs && npm run test:student-react && npm run test:backend-domains`

Expected: all commands exit 0.

### Task 3: Materialize missing report rows in the admin reports API

**Files:**
- Modify: `scripts/dashboard-data-integrity-test.mjs`
- Modify: `core/admin-lists.mjs:150-214`
- Modify: `core.mjs:451-464`

**Interfaces:**
- Produces: paginated `/api/admin/reports` items with `status: "missing"`, `isMissing: true`, and a linked `reservation` for each report-due studio reservation.
- Consumes: `isStudioReportDue` injected into `createAdminListHelpers`.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(missingRows.length, summary.body.data.missingReports);
assert.equal(missingRows[0].reservationId, "report-due-today");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/dashboard-data-integrity-test.mjs`

Expected: the reports API returns only persisted submissions, with no `missing` row.

- [ ] **Step 3: Write minimal implementation**

```js
const missing = db.reservations
  .filter((reservation) => isStudioReportDue(reservation))
  .map((reservation) => ({
    id: `missing:${reservation.id}`,
    reservationId: reservation.id,
    type: "studio",
    status: "missing",
    isMissing: true,
    reservation: withReservationDetails(db, reservation),
    user: publicUser(db.users.find((user) => user.id === reservation.userId))
  }));
```

Apply query, semester, sort, and pagination after combining `missing` rows with persisted reports. Keep destructive filtering based only on `db.reports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/dashboard-data-integrity-test.mjs && npm run test:react-admin && npm run test:backend-domains`

Expected: all commands exit 0.

### Task 4: Wire dashboard navigation and React views to the same report status

**Files:**
- Modify: `src/react/platform/types.ts:112-145,334-350`
- Modify: `src/react/student/reporting.ts:4-11`
- Modify: `src/react/admin/screens/AdminDashboard.tsx:242-251`
- Modify: `src/react/admin/screens/AdminReports.tsx:96-170`
- Modify: `public/js/data.js:173-184,252-264`
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/react-admin-data-test.mjs`
- Regenerate: `public/js/react-admin.generated.js`, `public/css/react-admin.generated.css`, `public/js/react-student.generated.js`, `public/css/react-student.generated.css`

**Interfaces:**
- Consumes: reports query parameter `status=missing` and `StudentReservation.reportDue`.
- Produces: dashboard report card navigation that filters the reports screen to exactly the report-due rows it counted.

- [ ] **Step 1: Write failing render and data tests**

```js
assert.deepEqual(dashboardNavigationCalls.at(-1), ["reports", { status: "missing", q: "", semester: "all", page: 1 }]);
assert.match(requestedReportUrl, /status=missing/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:react-admin && node scripts/react-admin-data-test.mjs`

Expected: report status is absent from dashboard navigation and the reports URL.

- [ ] **Step 3: Write minimal implementation**

Add `status` to report filter state, URL construction, server filter parsing, and React report tabs. Make `isReportDue` prefer an explicit boolean `reservation.reportDue` when the server provides it.

- [ ] **Step 4: Regenerate bundles and verify**

Run: `npm run build:react-admin && npm run test:react-admin && npm run test:student-react && node scripts/react-admin-data-test.mjs`

Expected: all commands exit 0 and generated bundles match source.

### Task 5: Run release-level regression checks

**Files:**
- Modify: `package.json` only if adding `test:dashboard-integrity` to the release test chain.

- [ ] **Step 1: Run targeted tests**

Run: `node scripts/dashboard-data-integrity-test.mjs && npm run test:backend-domains && npm run test:react-admin && npm run test:student-react`

Expected: all commands exit 0.

- [ ] **Step 2: Run full release verification**

Run: `npm run release:check`

Expected: all required checks exit 0.

- [ ] **Step 3: Review worktree**

Run: `git diff --check && git status --short --branch`

Expected: only implementation, test, plan, and generated bundle files are changed; user-owned untracked files are untouched.

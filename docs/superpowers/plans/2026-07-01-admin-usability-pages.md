# Admin Usability And Cloudflare Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first post-review update: safer Admin refresh/delete/filter workflows and Cloudflare Pages frontend preparation without deploying automatically.

**Architecture:** Keep the existing vanilla JS frontend and Worker-compatible backend. Add small shared backend helpers for academic-semester filtering and bulk deletion, then wire Admin views/events through existing `data-*` contracts. Prepare Cloudflare Pages as a frontend host with a Pages Function `/api/*` proxy to the existing Worker, while keeping Dothome fallback scripts intact.

**Tech Stack:** Node.js ESM, vanilla browser ESM, existing Node smoke tests, Cloudflare Workers/Pages Functions, Wrangler.

## Global Constraints

- Do not deploy to Cloudflare Pages or Worker during implementation.
- Do not reset, truncate, or migrate production data.
- Do not add bulk delete for student/admin users.
- Do not add bulk delete for equipment inventory.
- Bulk deletes default to current server-side filtered result; full deletion requires exact `전체 삭제` confirmation.
- Semester mapping is fixed: `YYYY년 1학기` = `YYYY-03-01` through `YYYY-08-31`; `YYYY년 2학기` = `YYYY-09-01` through the following February, including leap years.
- Preserve `?v=20260627-admin-lecture-nav` on public JS imports unless a separate cache-version update task is explicitly added later.
- Keep Dothome upload support and current Worker API path available.
- Follow TDD: write or extend tests before production code for each behavior change.

---

## File Structure

- Create `core/academic-semester.mjs`: date-to-semester helpers, semester labels, semester option collection, semester range matching.
- Create `core/admin-bulk-delete.mjs`: safe bulk deletion helpers for reservations, reports, lectures, and notices.
- Modify `core/admin-lists.mjs`: accept `semester` in list params, inject `lectureDetail`, expose reusable filter helpers and semester option metadata.
- Modify `core.mjs`: import helpers, add bulk delete API routes, return semester metadata for relevant admin lists.
- Modify `scripts/security-smoke-test.mjs`: backend regression coverage for semester filtering and bulk deletes.
- Modify `public/js/state.js`: Admin refresh state and semester filter state keys.
- Modify `public/js/data.js`: include semester params and store semester metadata.
- Modify `public/js/views-admin.js`: semester controls, bulk delete controls, refresh indicator markup.
- Modify `public/js/events.js`: import/setup Admin refresh handler.
- Create `public/js/events/admin-refresh.js`: pull-to-refresh pointer handling and refresh helper orchestration.
- Modify `public/js/events/admin-flow.js`: semester filter clicks, bulk delete clicks, scroll-preserving action refresh.
- Modify `public/js/events/forms.js`: scroll-preserving admin form refresh paths.
- Modify `public/js/events/shared.js`: expose scroll capture/restore helpers and `refreshAdminDataPreservingScroll`.
- Modify `public/js/renderer.js`: make toast show/hide preserve scroll.
- Modify `public/styles.css`: Admin refresh indicator and compact bulk/semester controls.
- Modify `scripts/admin-dashboard-ux-test.mjs`: source/render assertions for new Admin behavior.
- Add `functions/api/[[path]].js`: Cloudflare Pages Function proxy for `/api/*`.
- Add `scripts/check-pages-readiness.mjs`: static readiness checks for Pages scripts/config/proxy.
- Modify `package.json`: add `pages:build`, `pages:preview`, `pages:deploy`, `pages:check`.
- Modify `docs/pre-release-checklist.md` and `docs/release-qa-signoff.md`: record Pages transition procedure without marking it deployed.

## Task 1: Academic Semester Filtering Backend

**Files:**
- Create: `core/academic-semester.mjs`
- Modify: `core/admin-lists.mjs`
- Modify: `core.mjs`
- Modify: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Produces:
  - `dateToAcademicSemesterKey(dateKey: string): string`
  - `academicSemesterLabel(key: string): string`
  - `dateMatchesAcademicSemester(dateKey: string, semesterKey: string): boolean`
  - `academicSemesterOptionsFromDates(dateKeys: string[]): Array<{ key: string, label: string }>`
  - `adminReservationList(db, searchParams)` returns paginated metadata plus `semesterOptions`
  - `adminReportList(db, searchParams)` returns paginated metadata plus `semesterOptions`
  - `adminLectureList(db, searchParams)` returns paginated metadata plus `semesterOptions`
- Consumes: existing `withReservationDetails`, `reportWithDetails`, `publicUser`, and `lectureDetail` through `createAdminListHelpers`.

- [ ] **Step 1: Add failing backend semester tests**

Append to `scripts/security-smoke-test.mjs` after the existing admin pagination/list checks, using the existing `api()` helper and `adminToken`.

```js
db.reservations.push(
  {
    id: "res_semester_s1",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: "2026-03-10", studioSpaces: ["Studio A Front"], timeSlots: ["10:30-12:00"], reportStatus: "required" },
    history: [],
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  },
  {
    id: "res_semester_s2_jan",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: "2027-01-10", studioSpaces: ["Studio A Front"], timeSlots: ["13:00-14:00"], reportStatus: "submitted" },
    history: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z"
  }
);
db.reports.push({
  id: "report_semester_s2_jan",
  type: "studio",
  reservationId: "res_semester_s2_jan",
  userId: "user_admin",
  fields: { actualTime: "13:00-14:00", participants: "1" },
  htmlSnapshot: "<article>semester</article>",
  submittedAt: "2027-01-10T05:00:00.000Z",
  expiresAt: "2027-07-10T00:00:00.000Z"
});
db.lectures.push(
  {
    id: "lecture_semester_s1",
    title: "1학기 특강",
    lectureDate: "2026-05-01",
    time: "14:00-16:00",
    location: "강의실",
    instructorName: "강사",
    description: "봄 특강",
    status: "모집중",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z"
  },
  {
    id: "lecture_semester_s2",
    title: "2학기 특강",
    lectureDate: "2026-10-01",
    time: "14:00-16:00",
    location: "강의실",
    instructorName: "강사",
    description: "가을 특강",
    status: "모집중",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z"
  }
);

const semesterReservations = await api("GET", "/api/admin/reservations?semester=2026-S2&pageSize=200", {}, adminToken);
assert.equal(semesterReservations.status, 200);
assert.equal(semesterReservations.body.data.items.some((item) => item.id === "res_semester_s2_jan"), true);
assert.equal(semesterReservations.body.data.items.some((item) => item.id === "res_semester_s1"), false);
assert.equal(semesterReservations.body.data.semesterOptions.some((item) => item.key === "2026-S2" && item.label === "2026년 2학기"), true);

const semesterReports = await api("GET", "/api/admin/reports?semester=2026-S2&pageSize=200", {}, adminToken);
assert.equal(semesterReports.status, 200);
assert.equal(semesterReports.body.data.items.some((item) => item.id === "report_semester_s2_jan"), true);
assert.equal(semesterReports.body.data.semesterOptions.some((item) => item.key === "2026-S2"), true);

const semesterLectures = await api("GET", "/api/admin/lectures?semester=2026-S1", {}, adminToken);
assert.equal(semesterLectures.status, 200);
assert.equal(semesterLectures.body.data.items.some((item) => item.id === "lecture_semester_s1"), true);
assert.equal(semesterLectures.body.data.items.some((item) => item.id === "lecture_semester_s2"), false);
assert.equal(semesterLectures.body.data.semesterOptions.some((item) => item.key === "2026-S1" && item.label === "2026년 1학기"), true);
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npm run test:security
```

Expected: FAIL because `semester` is ignored and `/api/admin/lectures?semester=...` still returns a raw array without `items`/`semesterOptions`.

- [ ] **Step 3: Create semester helper**

Create `core/academic-semester.mjs`:

```js
function leapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function normalizedDateKey(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function dateToAcademicSemesterKey(value) {
  const date = normalizedDateKey(value);
  if (!date) return "";
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 8) return `${year}-S1`;
  if (month >= 9 && month <= 12) return `${year}-S2`;
  if (month >= 1 && month <= 2) return `${year - 1}-S2`;
  return "";
}

export function academicSemesterLabel(key) {
  const match = String(key || "").match(/^(\d{4})-S([12])$/);
  if (!match) return "";
  return `${match[1]}년 ${match[2]}학기`;
}

export function academicSemesterRange(key) {
  const match = String(key || "").match(/^(\d{4})-S([12])$/);
  if (!match) return null;
  const year = Number(match[1]);
  if (match[2] === "1") return { from: `${year}-03-01`, to: `${year}-08-31` };
  const nextYear = year + 1;
  return { from: `${year}-09-01`, to: `${nextYear}-02-${leapYear(nextYear) ? "29" : "28"}` };
}

export function dateMatchesAcademicSemester(value, key) {
  if (!key || key === "all") return true;
  return dateToAcademicSemesterKey(value) === key;
}

export function academicSemesterOptionsFromDates(values = []) {
  return [...new Set(values.map(dateToAcademicSemesterKey).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, label: academicSemesterLabel(key) }));
}
```

- [ ] **Step 4: Update admin list helpers**

In `core/admin-lists.mjs`:

- Import semester helpers.
- Add `semester` to `listParams`.
- Add helper date extractors:

```js
function reservationDate(item) {
  return item.fields?.reservedDate || "";
}

function reportDate(item) {
  return item.reservation?.fields?.reservedDate || item.submittedAt?.slice(0, 10) || "";
}
```

- Update `paginate(items, params, extra = {})` to spread metadata:

```js
return { items: pageItems, total, page: params.page, pageSize: params.pageSize, hasMore: start + pageItems.length < total, ...extra };
```

- For reservations, derive semester options from the full reservation details before semester filtering:

```js
const source = db.reservations.map((item) => withReservationDetails(db, item));
const semesterOptions = academicSemesterOptionsFromDates(source.map(reservationDate));
const items = source
  .filter((item) => !params.semester || params.semester === "all" || dateMatchesAcademicSemester(reservationDate(item), params.semester))
  ...
return paginate(items, params, { semesterOptions });
```

- Do the same for reports using `reportDate`.
- Change `createAdminListHelpers({ withReservationDetails, reportWithDetails, publicUser })` to `createAdminListHelpers({ withReservationDetails, reportWithDetails, publicUser, lectureDetail })`.
- Add `adminLectureList(db, searchParams)` inside `createAdminListHelpers`; it should call the injected `lectureDetail(db, lecture)` and then apply semester/search sorting and metadata.

- [ ] **Step 5: Update core lecture route**

In `core.mjs`, update `GET /api/admin/lectures`:

```js
if (routeKey(method, pathname) === "GET /api/admin/lectures") {
  requireAdmin(authorization, db);
  if (hasListQuery(searchParams)) return ok(adminLectureList(db, searchParams));
  const lectures = db.lectures
    .map((lecture) => lectureDetail(db, lecture))
    .sort((a, b) => String(a.lectureDate || "").localeCompare(String(b.lectureDate || "")));
  return ok(lectures);
}
```

Make `adminLectureList` available from `createAdminListHelpers`, and update the destructuring call in `core.mjs`:

```js
const {
  hasListQuery,
  adminReservationList,
  adminReportList,
  adminUserList,
  adminLectureList
} = createAdminListHelpers({
  withReservationDetails,
  reportWithDetails,
  publicUser,
  lectureDetail
});
```

- [ ] **Step 6: Run GREEN test**

Run:

```bash
npm run test:security
```

Expected: PASS.

- [ ] **Step 7: Run syntax check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add core/academic-semester.mjs core/admin-lists.mjs core.mjs scripts/security-smoke-test.mjs
git commit -m "2026-07-01 Admin 학기 필터 백엔드 추가"
```

## Task 2: Safe Bulk Delete Backend

**Files:**
- Create: `core/admin-bulk-delete.mjs`
- Modify: `core/admin-lists.mjs`
- Modify: `core.mjs`
- Modify: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Consumes:
  - `filterAdminReservations(db, filters)`
  - `filterAdminReports(db, filters)`
  - `filterAdminLectures(db, filters)`
  - `filterAdminNotices(db, filters)`
- Produces:
  - `deleteAdminReservations(db, { scope, filters, confirmText, admin })`
  - `deleteAdminReports(db, { scope, filters, confirmText, admin })`
  - `deleteAdminLectures(db, { scope, filters, confirmText, admin })`
  - `deleteAdminNotices(db, { scope, filters, confirmText, admin })`

- [ ] **Step 1: Add failing bulk delete tests**

Append to `scripts/security-smoke-test.mjs` after Task 1 semester tests:

```js
const fullDeleteWithoutPhrase = await api("DELETE", "/api/admin/reservations/bulk", {
  scope: "all",
  confirmText: ""
}, adminToken);
assert.equal(fullDeleteWithoutPhrase.status, 400);

db.reservations.push(
  {
    id: "res_bulk_keep_s1",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: "2026-04-10", studioSpaces: ["Studio A Front"], timeSlots: ["10:30-12:00"], reportStatus: "submitted" },
    history: [],
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z"
  },
  {
    id: "res_bulk_delete_s2",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: "2026-10-10", studioSpaces: ["Studio A Front"], timeSlots: ["10:30-12:00"], reportStatus: "submitted" },
    history: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z"
  }
);
db.reports.push(
  { id: "report_bulk_keep_s1", type: "studio", reservationId: "res_bulk_keep_s1", userId: "user_admin", fields: {}, htmlSnapshot: "", submittedAt: "2026-04-10T00:00:00.000Z", expiresAt: "2026-10-10T00:00:00.000Z" },
  { id: "report_bulk_delete_s2", type: "studio", reservationId: "res_bulk_delete_s2", userId: "user_admin", fields: {}, htmlSnapshot: "", submittedAt: "2026-10-10T00:00:00.000Z", expiresAt: "2027-04-10T00:00:00.000Z" }
);
const filteredReservationDelete = await api("DELETE", "/api/admin/reservations/bulk", {
  scope: "filtered",
  filters: { semester: "2026-S2", type: "studio" },
  confirmText: ""
}, adminToken);
assert.equal(filteredReservationDelete.status, 200);
assert.equal(filteredReservationDelete.body.data.deletedReservations, 1);
assert.equal(filteredReservationDelete.body.data.deletedReports, 1);
assert.equal(db.reservations.some((item) => item.id === "res_bulk_delete_s2"), false);
assert.equal(db.reports.some((item) => item.id === "report_bulk_delete_s2"), false);
assert.equal(db.reservations.some((item) => item.id === "res_bulk_keep_s1"), true);

const reportDelete = await api("DELETE", "/api/admin/reports/bulk", {
  scope: "filtered",
  filters: { semester: "2026-S1", q: "report_bulk_keep_s1" },
  confirmText: ""
}, adminToken);
assert.equal(reportDelete.status, 200);
assert.equal(reportDelete.body.data.deletedReports, 1);
assert.equal(reportDelete.body.data.resetReservations, 1);
assert.equal(db.reports.some((item) => item.id === "report_bulk_keep_s1"), false);
assert.equal(db.reservations.find((item) => item.id === "res_bulk_keep_s1").fields.reportStatus, "required");

db.lectures.push({ id: "lecture_bulk_delete", title: "삭제 특강", lectureDate: "2026-10-01", time: "10:00", location: "A", instructorName: "강사", description: "삭제", status: "모집중", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
db.lectureApplications.push({ id: "lecture_app_bulk_delete", lectureId: "lecture_bulk_delete", userId: "user_admin", appliedAt: "2026-09-02T00:00:00.000Z" });
const lectureDelete = await api("DELETE", "/api/admin/lectures/bulk", {
  scope: "filtered",
  filters: { semester: "2026-S2", q: "삭제 특강" },
  confirmText: ""
}, adminToken);
assert.equal(lectureDelete.status, 200);
assert.equal(lectureDelete.body.data.deletedLectures, 1);
assert.equal(lectureDelete.body.data.deletedApplications, 1);
assert.equal(db.lectureApplications.some((item) => item.lectureId === "lecture_bulk_delete"), false);

db.notices.push({ id: "notice_bulk_delete", title: "삭제 공지", category: "일반", body: "삭제 테스트", pinned: false, status: "published", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" });
const noticeDelete = await api("DELETE", "/api/admin/notices/bulk", {
  scope: "filtered",
  filters: { q: "삭제 공지" },
  confirmText: ""
}, adminToken);
assert.equal(noticeDelete.status, 200);
assert.equal(noticeDelete.body.data.deletedNotices, 1);
assert.equal(db.notices.some((item) => item.id === "notice_bulk_delete"), false);
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npm run test:security
```

Expected: FAIL because bulk endpoints do not exist.

- [ ] **Step 3: Export reusable filters**

In `core/admin-lists.mjs`, extract and export plain filter functions from existing list logic:

```js
function searchParamsFromFilters(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== undefined && value !== null && value !== "" && value !== "all") params.set(key, String(value));
  }
  return params;
}
```

Expose from `createAdminListHelpers`:

```js
filterAdminReservations: (db, filters) => filterReservations(db, listParams(searchParamsFromFilters(filters), 100000)),
filterAdminReports: (db, filters) => filterReports(db, listParams(searchParamsFromFilters(filters), 100000)),
filterAdminLectures: (db, filters) => filterLectures(db, listParams(searchParamsFromFilters(filters), 100000)),
filterAdminNotices: (db, filters) => filterNotices(db, listParams(searchParamsFromFilters(filters), 100000))
```

`filterAdminNotices` should search `title`, `category`, `body`, `link`, and `createdAt`.

- [ ] **Step 4: Create bulk delete helper**

Create `core/admin-bulk-delete.mjs` with:

```js
const FULL_DELETE_PHRASE = "전체 삭제";

function assertBulkScope({ scope, confirmText }) {
  if (!["filtered", "all"].includes(scope)) {
    throw Object.assign(new Error("삭제 범위를 확인할 수 없습니다."), { status: 400 });
  }
  if (scope === "all" && confirmText !== FULL_DELETE_PHRASE) {
    throw Object.assign(new Error("전체 삭제를 실행하려면 확인 문구를 정확히 입력하세요."), { status: 400 });
  }
}

function allowedFilters(filters = {}, allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  const rejected = Object.keys(filters || {}).filter((key) => !allowed.has(key));
  if (rejected.length) {
    throw Object.assign(new Error(`지원하지 않는 삭제 필터입니다: ${rejected.join(", ")}`), { status: 400 });
  }
  return Object.fromEntries(Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "all"));
}
```

Implement four delete functions. Each function accepts `audit` callback from `core.mjs` or returns audit details for `core.mjs` to write. Use `Set` of matching IDs, filter arrays, and return exact counts.

Report deletion must reset linked reservations:

```js
for (const reservation of db.reservations || []) {
  if (resetReservationIds.has(reservation.id) && reservation.fields?.reportStatus === "submitted") {
    reservation.fields.reportStatus = "required";
    reservation.updatedAt = nowIso();
    resetReservations += 1;
  }
}
```

- [ ] **Step 5: Wire core routes**

In `core.mjs`, import bulk helpers and add routes before single-item lecture delete and notices GET:

```js
if (routeKey(method, pathname) === "DELETE /api/admin/reservations/bulk") {
  const admin = requireAdmin(authorization, db);
  const body = await parseBody(readText);
  const result = deleteAdminReservations(db, { ...body, admin });
  audit(db, admin, "reservations.bulk_deleted", "reservations", result.audit);
  await saveDb();
  return ok(result.summary);
}
```

Repeat for reports, lectures, and notices with action names:

- `reports.bulk_deleted`
- `lectures.bulk_deleted`
- `notices.bulk_deleted`

- [ ] **Step 6: Run GREEN test**

Run:

```bash
npm run test:security
```

Expected: PASS.

- [ ] **Step 7: Run storage and syntax checks**

Run:

```bash
npm run check && npm run test:storage
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add core/admin-bulk-delete.mjs core/admin-lists.mjs core.mjs scripts/security-smoke-test.mjs
git commit -m "2026-07-01 Admin 안전 일괄 삭제 API 추가"
```

## Task 3: Admin Semester Filters And Bulk Delete UI

**Files:**
- Modify: `public/js/state.js`
- Modify: `public/js/data.js`
- Modify: `public/js/views-admin.js`
- Modify: `public/js/events/admin-flow.js`
- Modify: `scripts/admin-dashboard-ux-test.mjs`

**Interfaces:**
- Consumes backend `semesterOptions` and bulk delete endpoints.
- Produces:
  - `state.adminReservationSemesterFilter`
  - `state.adminReportSemesterFilter`
  - `state.adminLectureSemesterFilter`
  - `state.adminReservationSemesters`
  - `state.adminReportSemesters`
  - `state.adminLectureSemesters`
  - UI `data-admin-*-semester`
  - UI `data-admin-bulk-delete`

- [ ] **Step 1: Add failing render/source assertions**

In `scripts/admin-dashboard-ux-test.mjs`, add state setup:

```js
state.adminReservationSemesters = [{ key: "2026-S1", label: "2026년 1학기" }, { key: "2026-S2", label: "2026년 2학기" }];
state.adminReportSemesters = state.adminReservationSemesters;
state.adminLectureSemesters = state.adminReservationSemesters;
state.adminReservationSemesterFilter = "2026-S1";
state.adminReportSemesterFilter = "2026-S2";
state.adminLectureSemesterFilter = "all";
```

Add assertions after view rendering:

```js
assert(reservationsView.includes("2026년 1학기"), "reservation management must render semester filter labels");
assert(reservationsView.includes('data-admin-reservation-semester="2026-S1"'), "reservation semester filter must expose data attribute");
assert(reservationsView.includes('data-admin-bulk-delete="reservations:filtered"'), "reservation management must expose filtered bulk delete");
assert(reservationsView.includes('data-admin-bulk-delete="reservations:all"'), "reservation management must expose guarded full delete");
assert(!reservationsView.includes('data-admin-bulk-delete="users'), "student approval must not expose user bulk delete");

const reportsView = adminReportsView();
assert(reportsView.includes('data-admin-report-semester="2026-S2"'), "reports must render semester filters");
assert(reportsView.includes('data-admin-bulk-delete="reports:filtered"'), "reports must expose filtered bulk delete");

const lecturesViewWithSemester = adminLecturesView();
assert(lecturesViewWithSemester.includes('data-admin-lecture-semester="all"'), "lectures must render all-semester filter");
assert(lecturesViewWithSemester.includes('data-admin-bulk-delete="lectures:filtered"'), "lectures must expose filtered bulk delete");

const noticesView = adminNoticesView();
assert(noticesView.includes('data-admin-bulk-delete="notices:filtered"'), "notices must expose filtered bulk delete");

assert(eventSource.includes("target.dataset.adminReservationSemester"), "reservation semester event handler must exist");
assert(eventSource.includes("target.dataset.adminBulkDelete"), "bulk delete click handler must exist");
```

Import `adminReportsView` and `adminNoticesView` at the top of the test if not already imported.

- [ ] **Step 2: Run RED test**

Run:

```bash
npm run test:admin-ui
```

Expected: FAIL because UI and handlers do not exist.

- [ ] **Step 3: Add state/data plumbing**

In `public/js/state.js`, add:

```js
adminReservationSemesterFilter: "all",
adminReportSemesterFilter: "all",
adminLectureSemesterFilter: "all",
adminReservationSemesters: [],
adminReportSemesters: [],
adminLectureSemesters: [],
```

In `public/js/data.js`, include semester params:

```js
semester: state.adminReservationSemesterFilter
```

Store metadata:

```js
adminReservationSemesters: reservations?.semesterOptions || [],
adminReportSemesters: reports?.semesterOptions || [],
adminLectures: pagedItems(lectures),
adminLectureSemesters: lectures?.semesterOptions || [],
```

Use `pagedItems(lectures)` so legacy arrays still work.

- [ ] **Step 4: Add Admin view helpers**

In `public/js/views-admin.js`, add:

```js
function semesterTabs(options = [], active = "all", dataset = "") {
  const items = [{ key: "all", label: "전체" }, ...(options || [])];
  if (items.length <= 1) return "";
  return tabs(items, { active, dataset, className: "wrap admin-semester-tabs", ariaLabel: "학기 필터" });
}

function bulkDeletePanel(kind, filteredCount, totalCount, filterLabel) {
  const count = Math.max(0, Number(filteredCount || 0));
  const total = Math.max(0, Number(totalCount || 0));
  return `
    <div class="bulk-danger-zone">
      <span class="muted">${escapeHtml(filterLabel)}</span>
      <div class="row-actions">
        <button class="button danger compact" type="button" data-admin-bulk-delete="${kind}:filtered" ${count ? "" : "disabled"}>${icon("trash")}현재 필터 결과 삭제</button>
        <button class="button ghost danger compact" type="button" data-admin-bulk-delete="${kind}:all" ${total ? "" : "disabled"}>${icon("trash")}전체 삭제</button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Render controls**

Add semester controls to:

- `adminReservationsView()` before page summary.
- `adminReportsView()` before sort tabs.
- `adminLecturesView()` in the list control panel.

Add bulk delete panels to:

- `adminReservationsView()` after filters.
- `adminReportsView()` after filters.
- `adminLecturesView()` list panel.
- `adminNoticesView()` after notice search.

Use filtered counts from the currently rendered collection and total counts from page metadata.

- [ ] **Step 6: Add event handlers**

In `public/js/events/admin-flow.js`, handle:

```js
if (target.dataset.adminReservationSemester !== undefined) {
  state.adminReservationSemesterFilter = target.dataset.adminReservationSemester;
  resetAdminPage("adminReservationsPage");
  await refreshAdminDataPreservingScroll();
  return;
}
```

Repeat for report and lecture semester.

Add `data-admin-bulk-delete` handler:

- Parse `kind:scope`.
- For `scope === "all"`, prompt exact `전체 삭제`.
- For filtered scope, use `confirm()` with current filter label.
- Call matching endpoint.
- Toast exact result summary.
- Reload data preserving scroll.

Example result copy:

- reservations: `예약 ${deletedReservations}건과 연결 보고서 ${deletedReports}건을 삭제했습니다.`
- reports: `보고서 ${deletedReports}건을 삭제했습니다.`
- lectures: `특강 ${deletedLectures}건과 신청 ${deletedApplications}건을 삭제했습니다.`
- notices: `공지 ${deletedNotices}건을 삭제했습니다.`

- [ ] **Step 7: Run GREEN test**

Run:

```bash
npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add public/js/state.js public/js/data.js public/js/views-admin.js public/js/events/admin-flow.js scripts/admin-dashboard-ux-test.mjs
git commit -m "2026-07-01 Admin 학기 필터와 일괄 삭제 UI 추가"
```

## Task 4: Scroll-Safe Toast And Admin Action Refresh

**Files:**
- Modify: `public/js/renderer.js`
- Modify: `public/js/events/shared.js`
- Modify: `public/js/events/admin-flow.js`
- Modify: `public/js/events/forms.js`
- Modify: `scripts/admin-dashboard-ux-test.mjs`

**Interfaces:**
- Produces:
  - `renderPreservingScroll()`
  - `renderAtTop()`
  - `refreshAdminDataPreservingScroll({ includeBootstrap?: boolean, includeMe?: boolean })`
  - `toast(message, { preserveScroll?: boolean } = {})`

- [ ] **Step 1: Add failing source assertions**

In `scripts/admin-dashboard-ux-test.mjs`, add:

```js
const rendererSource = fs.readFileSync("public/js/renderer.js", "utf8");
assert(rendererSource.includes("export function toast(message, options = {})"), "toast must accept options");
assert(rendererSource.includes("options.preserveScroll"), "toast must support preserveScroll");
assert(eventSource.includes("refreshAdminDataPreservingScroll"), "Admin data refreshes must use the scroll-preserving helper");
assert(!eventSource.includes(".then(() => render())"), "Admin async refresh paths must not use bare render in promise callbacks");
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npm run test:admin-ui
```

Expected: FAIL because toast options/helper are missing.

- [ ] **Step 3: Export scroll helpers and admin refresh helper**

In `public/js/events/shared.js`:

- Export `captureScrollState` and `restoreScrollState`.
- Import `loadAdminData`, `loadBootstrap`, and optionally `loadMe`.
- Add:

```js
export async function refreshAdminDataPreservingScroll(options = {}) {
  const { includeBootstrap = false, includeMe = false } = options;
  const scrollState = captureScrollState();
  const jobs = [loadAdminData()];
  if (includeBootstrap) jobs.unshift(loadBootstrap());
  if (includeMe) jobs.push(loadMe());
  await Promise.all(jobs);
  render();
  restoreScrollState(scrollState);
}
```

Avoid circular imports. If importing `loadAdminData` into `shared.js` creates a cycle, move this helper to a new `public/js/events/admin-refresh-data.js` and import it from handlers.

- [ ] **Step 4: Update toast**

In `public/js/renderer.js`:

```js
import { captureScrollState, restoreScrollState } from "./events/shared.js?v=20260627-admin-lecture-nav";
```

Then:

```js
export function toast(message, options = {}) {
  if (toastTimer) clearTimeout(toastTimer);
  const scrollState = options.preserveScroll ? captureScrollState() : null;
  state.toast = message;
  render();
  if (scrollState) restoreScrollState(scrollState);
  toastTimer = setTimeout(() => {
    const hideScrollState = options.preserveScroll ? captureScrollState() : null;
    state.toast = "";
    toastTimer = null;
    render();
    if (hideScrollState) restoreScrollState(hideScrollState);
  }, 2600);
}
```

- [ ] **Step 5: Replace bare Admin refreshes**

In `public/js/events/admin-flow.js` and `forms.js`:

- Use `await refreshAdminDataPreservingScroll({ includeBootstrap: true })` when action changes bootstrap-visible data.
- Use `await refreshAdminDataPreservingScroll()` for admin list-only changes.
- Use `toast("...", { preserveScroll: true })` for Admin action toasts.
- Replace `Promise.all([loadBootstrap(), loadAdminData()]).then(() => render())` with an awaited helper path.

- [ ] **Step 6: Run GREEN test**

Run:

```bash
npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/js/renderer.js public/js/events/shared.js public/js/events/admin-flow.js public/js/events/forms.js scripts/admin-dashboard-ux-test.mjs
git commit -m "2026-07-01 Admin 토스트 스크롤 유지 보정"
```

## Task 5: Admin Pull-To-Refresh

**Files:**
- Create: `public/js/events/admin-refresh.js`
- Modify: `public/js/events.js`
- Modify: `public/js/state.js`
- Modify: `public/js/views-admin.js`
- Modify: `public/styles.css`
- Modify: `scripts/admin-dashboard-ux-test.mjs`

**Interfaces:**
- Produces:
  - `setupAdminRefreshHandlers()`
  - `state.adminRefresh = { pulling, refreshing, distance, message }`
  - `.admin-refresh-indicator`

- [ ] **Step 1: Add failing render/source assertions**

In `scripts/admin-dashboard-ux-test.mjs`, add:

```js
assert(adminShell().includes("admin-refresh-indicator"), "Admin shell must render pull-to-refresh indicator");
assert(eventSource.includes("setupAdminRefreshHandlers"), "Admin refresh handler must be wired through events facade");
assert(eventSource.includes("closest(\"input, textarea, select, button, a, form\")"), "pull refresh must ignore form controls");
assert(css.includes(".admin-refresh-indicator"), "pull refresh indicator styles must exist");
```

- [ ] **Step 2: Run RED test**

Run:

```bash
npm run test:admin-ui
```

Expected: FAIL.

- [ ] **Step 3: Add state and markup**

In `public/js/state.js`:

```js
adminRefresh: {
  pulling: false,
  refreshing: false,
  distance: 0,
  message: "당겨서 새로고침"
},
```

In `adminShell()`, inside `.admin-main` before Admin headers:

```js
${adminRefreshIndicator()}
```

Add:

```js
function adminRefreshIndicator() {
  const refresh = state.adminRefresh || {};
  const visible = refresh.pulling || refresh.refreshing;
  const distance = Math.min(96, Math.max(0, Number(refresh.distance || 0)));
  return `<div class="admin-refresh-indicator ${visible ? "visible" : ""} ${refresh.refreshing ? "refreshing" : ""}" style="transform: translateY(${distance ? Math.round(distance / 3) : 0}px)"><span>${escapeHtml(refresh.message || "당겨서 새로고침")}</span></div>`;
}
```

- [ ] **Step 4: Create admin refresh event module**

Create `public/js/events/admin-refresh.js`:

```js
import { state } from "../state.js?v=20260627-admin-lecture-nav";
import { render, toast } from "../renderer.js?v=20260627-admin-lecture-nav";
import { refreshAdminDataPreservingScroll } from "./shared.js?v=20260627-admin-lecture-nav";

const THRESHOLD = 72;
const MAX_DISTANCE = 120;
let startY = 0;
let tracking = false;

function setRefreshState(patch) {
  state.adminRefresh = { ...(state.adminRefresh || {}), ...patch };
  render();
}

function resetRefreshState() {
  setRefreshState({ pulling: false, refreshing: false, distance: 0, message: "당겨서 새로고침" });
}

function canStartRefresh(event) {
  if (!(event.target instanceof Element)) return false;
  if (!state.user || state.user.role !== "admin") return false;
  if (event.target.closest("input, textarea, select, button, a, form")) return false;
  const main = event.target.closest(".admin-main");
  return Boolean(main && main.scrollTop <= 0);
}

async function runRefresh() {
  setRefreshState({ pulling: false, refreshing: true, distance: THRESHOLD, message: "새로고침 중" });
  try {
    await refreshAdminDataPreservingScroll({ includeBootstrap: true });
    toast("최신 데이터를 불러왔습니다.", { preserveScroll: true });
  } catch (error) {
    toast(error.message || "데이터 새로고침에 실패했습니다.", { preserveScroll: true });
  } finally {
    resetRefreshState();
  }
}

export function setupAdminRefreshHandlers() {
  document.addEventListener("pointerdown", (event) => {
    if (!canStartRefresh(event)) return;
    tracking = true;
    startY = event.clientY || 0;
  }, { passive: true });

  document.addEventListener("pointermove", (event) => {
    if (!tracking || state.adminRefresh?.refreshing) return;
    const distance = Math.max(0, Math.min(MAX_DISTANCE, (event.clientY || 0) - startY));
    if (distance <= 0) return;
    setRefreshState({
      pulling: true,
      distance,
      message: distance >= THRESHOLD ? "놓으면 새로고침" : "당겨서 새로고침"
    });
  }, { passive: true });

  document.addEventListener("pointerup", () => {
    if (!tracking) return;
    tracking = false;
    if (Number(state.adminRefresh?.distance || 0) >= THRESHOLD) {
      runRefresh();
    } else {
      resetRefreshState();
    }
  }, { passive: true });

  document.addEventListener("pointercancel", () => {
    tracking = false;
    resetRefreshState();
  }, { passive: true });
}
```

- [ ] **Step 5: Wire facade and styles**

In `public/js/events.js`, import and call `setupAdminRefreshHandlers()`.

In `public/styles.css`, add compact styles:

```css
.admin-refresh-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}

.admin-refresh-indicator.visible {
  height: 36px;
  opacity: 1;
}

.admin-refresh-indicator span {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  padding: 6px 10px;
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 6: Run GREEN test**

Run:

```bash
npm run test:admin-ui && npm run check:js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/js/events/admin-refresh.js public/js/events.js public/js/state.js public/js/views-admin.js public/styles.css scripts/admin-dashboard-ux-test.mjs
git commit -m "2026-07-01 Admin 당겨서 새로고침 추가"
```

## Task 6: Cloudflare Pages Frontend Preparation

**Files:**
- Create: `functions/api/[[path]].js`
- Create: `scripts/check-pages-readiness.mjs`
- Modify: `package.json`
- Modify: `docs/pre-release-checklist.md`
- Modify: `docs/release-qa-signoff.md`

**Interfaces:**
- Produces scripts:
  - `pages:build`
  - `pages:preview`
  - `pages:deploy`
  - `pages:check`
- Produces Pages Function proxy:
  - `/api/*` forwards to `GJU_WORKER_API_BASE` or `https://photographygju-reserve.taejunyun.workers.dev`.

- [ ] **Step 1: Add failing readiness check script reference**

Modify `package.json` in a temporary test-first way by adding only:

```json
"pages:check": "node scripts/check-pages-readiness.mjs"
```

Do not add the script file yet.

- [ ] **Step 2: Run RED check**

Run:

```bash
npm run pages:check
```

Expected: FAIL because `scripts/check-pages-readiness.mjs` does not exist.

- [ ] **Step 3: Create Pages Function proxy**

Create `functions/api/[[path]].js`:

```js
const DEFAULT_WORKER_API_BASE = "https://photographygju-reserve.taejunyun.workers.dev";

function targetUrl(request, env) {
  const source = new URL(request.url);
  const base = String(env.GJU_WORKER_API_BASE || DEFAULT_WORKER_API_BASE).replace(/\/$/, "");
  return `${base}${source.pathname}${source.search}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method || "GET";
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", new URL(request.url).host);
  headers.set("x-forwarded-proto", "https");
  const init = {
    method,
    headers,
    redirect: "manual"
  };
  if (!["GET", "HEAD"].includes(method)) init.body = request.body;
  return fetch(targetUrl(request, env), init);
}
```

- [ ] **Step 4: Create readiness check**

Create `scripts/check-pages-readiness.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const proxy = fs.readFileSync("functions/api/[[path]].js", "utf8");
const publicConfig = fs.readFileSync("public/config.js", "utf8");

assert.equal(pkg.scripts["pages:build"], "npm run build");
assert.equal(pkg.scripts["pages:preview"], "npm run pages:build && wrangler pages dev dist");
assert.equal(pkg.scripts["pages:deploy"], "npm run pages:build && wrangler pages deploy dist --project-name gju-reserve");
assert.equal(pkg.scripts["pages:check"], "node scripts/check-pages-readiness.mjs");
assert(proxy.includes("GJU_WORKER_API_BASE"), "Pages proxy must support configurable Worker API base");
assert(proxy.includes("https://photographygju-reserve.taejunyun.workers.dev"), "Pages proxy must keep current Worker fallback");
assert(proxy.includes("export async function onRequest"), "Pages proxy must export onRequest");
assert(publicConfig.includes('window.GJU_API_BASE = ""'), "web frontend must keep same-origin API base for Pages/Dothome");

console.log("Cloudflare Pages readiness checks passed.");
```

- [ ] **Step 5: Add package scripts**

In `package.json`, add:

```json
"pages:build": "npm run build",
"pages:preview": "npm run pages:build && wrangler pages dev dist",
"pages:deploy": "npm run pages:build && wrangler pages deploy dist --project-name gju-reserve",
"pages:check": "node scripts/check-pages-readiness.mjs"
```

Do not run `pages:deploy`.

- [ ] **Step 6: Update docs**

In `docs/pre-release-checklist.md`, add a section:

```md
## Cloudflare Pages 전환 준비

- `npm run pages:check`로 Pages 프록시와 스크립트 구성을 확인한다.
- `npm run pages:preview`로 로컬 Pages 호환 프리뷰를 확인한다.
- 운영 전환 전에는 `pages:deploy`를 수동으로 실행하고 `/api/bootstrap`, Admin 로그인, 계정 삭제 페이지를 확인한다.
- Dothome 업로드 경로는 첫 Pages 운영 릴리스가 안정화될 때까지 유지한다.
```

In `docs/release-qa-signoff.md`, record Pages as "준비 완료 / 운영 전환 보류".

- [ ] **Step 7: Run GREEN checks**

Run:

```bash
npm run pages:check && npm run check:js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add functions/api/[[path]].js scripts/check-pages-readiness.mjs package.json docs/pre-release-checklist.md docs/release-qa-signoff.md
git commit -m "2026-07-01 Cloudflare Pages 프론트 전환 준비"
```

## Task 7: Full Regression, Browser QA, And Review

**Files:**
- No planned production source edits unless verification finds issues.
- May modify tests or docs only to fix verified gaps.

**Interfaces:**
- Consumes completed Tasks 1-6.
- Produces final verification evidence and code review result.

- [ ] **Step 1: Run full local gates**

Run:

```bash
npm run test:security && npm run test:storage && npm run test:admin-ui && npm run test:equipment-ui && npm run check && npm run check:js && npm run release:check && npm run pages:check
```

Expected: PASS.

- [ ] **Step 2: Run Dothome/Worker read-only deploy checks**

Run:

```bash
npm run deploy:check
GJU_PRODUCTION_URL=https://photographygju.dothome.co.kr npm run deploy:check
```

Expected: PASS. These are read-only production checks and do not deploy.

- [ ] **Step 3: Start local app for Browser QA**

Find an unused port, for example:

```bash
PORT=5175 npm run dev
```

Keep the session running only for QA and stop it before final response.

- [ ] **Step 4: Browser QA target flow**

Use `build-web-apps:frontend-testing-debugging` plus Browser plugin.

Flow under test:

```text
Admin login -> navigate Admin tabs -> pull-to-refresh -> action toast appears/disappears -> semester filter -> filtered bulk delete in local dev dataset -> no console errors and no unexpected scroll jump.
```

Required Browser checks:

- Page identity and title.
- Nonblank rendered Admin UI.
- No framework overlay.
- Console warning/error log check.
- Screenshot on desktop.
- Screenshot on mobile viewport.
- Interaction proof for pull-to-refresh.
- Interaction proof for toast disappearance preserving scroll.
- Interaction proof for semester filter.

- [ ] **Step 5: Request final code review**

Use `superpowers:requesting-code-review` on the implementation range from this plan's first implementation commit to HEAD.

Reviewer must check:

- Bulk delete safety.
- Semester date correctness.
- Admin scroll preservation.
- Pull-to-refresh control conflicts.
- Pages proxy safety.
- No accidental production deploy or data reset.

- [ ] **Step 6: Fix Critical/Important review items**

If reviewer reports Critical or Important findings, fix them with TDD and rerun relevant tests plus full gates.

- [ ] **Step 7: Final status check**

Run:

```bash
git status --short --untracked-files=all
git log --oneline --decorate -10
```

Expected: no unrelated unstaged changes; recent commits show each completed task.

- [ ] **Step 8: Final report**

Report:

- Commits created.
- Tests run and passed.
- Browser QA evidence.
- Pages not deployed.
- Any remaining manual production steps.

import fs from "node:fs";
import assert from "node:assert/strict";

globalThis.document = { querySelector: () => null };
globalThis.window = {};

const storage = new Map([["gju_native_notifications_enabled", "true"]]);

globalThis.localStorage = {
  getItem: (key) => storage.get(key) || "",
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = globalThis.localStorage;

const { state } = await import("../public/js/state.js?v=20260627-admin-lecture-nav");
const { adminShell, adminDashboardView, adminSettingsView, adminDashboardMetrics, adminReservationsView, adminReportsView, adminLecturesView, adminNoticesView } = await import("../public/js/views-admin.js?v=20260627-admin-lecture-nav");
const { plannedAdminNotifications } = await import("../public/js/native-notifications.js?v=20260627-admin-lecture-nav");

function seoulTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const today = seoulTodayKey();

state.user = { id: "admin1", role: "admin" };
state.bootstrap = { settings: {
  printBankAccount: "광주은행 000",
  googleDriveUrl: "https://drive.google.com/example",
  darkroomCapacity: 4,
  printAvailableStart: "09:00",
  printAvailableEnd: "18:00",
  printUploadStartDate: "2026-06-01",
  printUploadEndDate: "2026-12-31",
  equipmentHighValueCategories: ["Body", "Lens"],
  equipmentBagKeywords: ["펠리컨", "Pelican"],
  equipmentCameraBagNotice: "가방 지참",
  blockedSchedules: []
} };
state.summary = { pendingUsers: 2, pendingEquipment: 99, equipmentCheckedOut: 1, equipmentReturned: 1, equipmentCancelled: 1, todayReservations: 4, missingReports: 1 };
state.nativeNotifications = { supported: true, permission: "granted", syncedAt: "2026-06-26T08:00:00.000Z", error: "" };
state.adminReservations = [
  { id: "r1", type: "equipment", status: "checked_out", user: { name: "김학생" }, fields: { reservedDate: today, rentalTime: "10:00", returnDate: today } },
  { id: "r2", type: "equipment", status: "returned", user: { name: "이학생" }, fields: { reservedDate: today, rentalTime: "13:00", returnDate: today } },
  { id: "r3", type: "equipment", status: "cancelled", user: { name: "박학생" }, fields: { reservedDate: today, rentalTime: "15:00", returnDate: today } },
  { id: "r4", type: "studio", status: "auto_confirmed", user: { name: "최학생" }, fields: { reservedDate: today, timeSlots: ["16:00-17:00"] } }
];
state.adminEquipment = [
  { id: "e1", active: true, status: "가능" },
  { id: "e2", active: true, status: "가능" },
  { id: "e3", active: true, status: "수리중" },
  { id: "e4", active: false, status: "가능" }
];
state.adminReports = [{
  id: "report1",
  status: "pending",
  reservationId: "r4",
  user: { name: "최학생" },
  fields: { actualTime: "16:00-17:00", participants: "2명", damageFound: false, resultPhotoUrl: "" },
  reservation: { fields: { reservedDate: today, studioSpace: "A 스튜디오", studioSpaces: ["A 스튜디오"] } },
  submittedAt: "2026-06-26T09:00:00.000Z"
}];
state.adminLectures = [{ id: "lecture1", title: "프린트 워크숍", status: "모집중", lectureDate: "2026-07-01", startsAt: "2026-07-01", applications: [] }];
state.adminNotices = [{ id: "notice1", title: "하계 운영 안내", createdAt: "2026-06-26T07:00:00.000Z" }];
state.adminReservationSemesters = [{ key: "2026-S1", label: "2026년 1학기" }, { key: "2026-S2", label: "2026년 2학기" }];
state.adminReportSemesters = state.adminReservationSemesters;
state.adminLectureSemesters = state.adminReservationSemesters;
state.adminReservationSemesterFilter = "2026-S1";
state.adminReportSemesterFilter = "2026-S2";
state.adminLectureSemesterFilter = "all";

const dashboard = adminDashboardView();
state.adminReservationTab = "equipment";
state.adminEquipmentReservationStatusFilter = "all";
state.adminReservationSearch = "";
const reservationsView = adminReservationsView();
const reportsView = adminReportsView();
state.adminView = "lectures";
state.adminLecturePanelTab = "list";
const lecturesView = adminLecturesView();
state.adminView = "notices";
const noticesView = adminNoticesView();
state.adminView = "dashboard";
state.activeAdminQueueSheet = "today";
const dashboardWithQueueSheet = adminShell();
state.activeAdminQueueSheet = "";
const settings = adminSettingsView();
const metrics = adminDashboardMetrics();
const notifications = plannedAdminNotifications(new Date("2026-06-26T08:00:00.000Z"));
const css = fs.readFileSync("public/styles.css", "utf8");
const viewsSource = fs.readFileSync("public/js/views-admin.js", "utf8");
const coreSource = fs.readFileSync("core.mjs", "utf8");
const dataSource = fs.readFileSync("public/js/data.js", "utf8");
const searchSource = fs.readFileSync("public/js/events/search.js", "utf8");
function readEventSource() {
  return [
    "public/js/events.js",
    "public/js/events/shared.js",
    "public/js/events/search.js",
    "public/js/events/student-flow.js",
    "public/js/events/reservation-inputs.js",
    "public/js/events/admin-flow.js",
    "public/js/events/forms.js"
  ]
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

const eventSource = readEventSource();

function cssRule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule must exist`);
  const end = css.indexOf("\n}", start);
  assert.notEqual(end, -1, `${selector} rule must close`);
  return css.slice(start, end);
}

const buttonRule = cssRule(".button");
const primaryButtonRule = cssRule(".button.primary");

function countOccurrences(source, token) {
  return source.split(token).length - 1;
}

assert(!dashboard.includes("운영 네이티브 알림"), "dashboard must not render native notification card");
assert(dashboard.includes("오늘 처리할 일"), "dashboard must render today's action section");
assert(dashboard.includes("운영 큐"), "dashboard must render operations queue");
assert(dashboard.includes("운영 지표"), "dashboard must render quantitative metrics");
assert(dashboard.includes("대여완료"), "dashboard must include equipment checked-out work");
assert(dashboard.includes("반납완료"), "dashboard must include equipment returned work");
assert(dashboard.includes("대여취소"), "dashboard must include equipment cancelled work");
assert.equal(countOccurrences(dashboard, "admin-action-card"), 5, "top action cards must use the visual admin card treatment");
assert.equal(countOccurrences(dashboard, "admin-action-icon"), 5, "top action cards must show visible icon badges");
assert.equal(countOccurrences(dashboard, "admin-queue-item"), 0, "operations queue must not repeat top KPI cards");
assert(dashboard.includes("admin-queue-sheet-grid"), "operations queue must render clickable sheet entry cards");
assert(dashboard.includes('data-admin-queue-sheet="today"'), "today timeline queue must open a bottom sheet");
assert(dashboard.includes('data-admin-queue-sheet="checkout"'), "checkout queue must open a bottom sheet");
assert(!dashboard.includes("admin-queue-detail-grid"), "operations queue must not inline duplicate detail panels");
assert(dashboard.includes('admin-action-card tone-yellow'), "dashboard checked-out equipment action must use the yellow tone");
assert(dashboardWithQueueSheet.includes("bottom-sheet admin-queue-sheet"), "operations queue click must render a bottom sheet");
assert(dashboardWithQueueSheet.includes("admin-queue-sheet-list"), "operations queue bottom sheet must render a detail list");
assert(dashboardWithQueueSheet.includes('<span class="tag yellow">대여완료</span>'), "queue sheet checked-out equipment status must use the shared yellow status tag");
assert(reservationsView.includes('<span class="tag green">반납완료</span>'), "reservation management returned equipment status must use green");
assert(reservationsView.includes('<span class="tag gray">대여취소</span>'), "reservation management cancelled equipment status must use gray");
assert(!dashboard.includes("승인 완료"), "equipment dashboard must not show legacy approval status");
assert(!dashboard.includes("기자재 승인 대기"), "equipment dashboard must not show legacy pending equipment status");
assert(reservationsView.includes("대여완료"), "equipment reservation filter/action must include checked-out status");
assert(reservationsView.includes("반납완료"), "equipment reservation filter/action must include returned status");
assert(reservationsView.includes("대여취소"), "equipment reservation filter/action must include cancelled status");
assert(reservationsView.includes("2026년 1학기"), "reservation management must render semester filter labels");
assert(reservationsView.includes('data-admin-reservation-semester="2026-S1"'), "reservation semester filter must expose data attribute");
assert(reservationsView.includes('data-admin-bulk-delete="reservations:filtered"'), "reservation management must expose filtered bulk delete");
assert(reservationsView.includes('data-admin-bulk-delete="reservations:all"'), "reservation management must expose guarded full delete");
assert(!reservationsView.includes('data-admin-bulk-delete="users'), "student approval must not expose user bulk delete");
assert(reservationsView.includes('data-status="checked_out"'), "equipment reservations must expose checked-out action");
assert(reservationsView.includes('data-status="returned"'), "equipment reservations must expose returned action");
assert(reservationsView.includes('data-status="cancelled"'), "equipment reservations must expose cancelled action");
assert.match(reservationsView, /data-status="checked_out"[^>]*disabled[^>]*aria-current="true"/, "current checked-out equipment status action must be disabled and programmatically marked current");
assert.match(reservationsView, /data-status="returned"[^>]*disabled[^>]*aria-current="true"/, "current returned equipment status action must be disabled and programmatically marked current");
assert.match(reservationsView, /data-status="cancelled"[^>]*disabled[^>]*aria-current="true"/, "current cancelled equipment status action must be disabled and programmatically marked current");
assert(!reservationsView.includes('data-status="approved"'), "equipment reservations must not expose legacy approval action");
assert(!reservationsView.includes('data-status="admin_cancelled"'), "equipment reservations must not expose legacy admin cancellation action");
assert(reportsView.includes('data-admin-report-semester="2026-S2"'), "reports must render semester filters");
assert(reportsView.includes('data-admin-bulk-delete="reports:filtered"'), "reports must expose filtered bulk delete");
assert(!viewsSource.includes('state.adminReservations.filter((reservation) => reservationSearchText(reservation).includes(query))'), "reservation view must not re-filter server-backed search results on the client");
assert(!viewsSource.includes('state.adminReports.filter((report) => reportSearchText(report).includes(query))'), "report view must not re-filter server-backed search results on the client");
assert(viewsSource.includes('현재 표시 ${reservations.length}건'), "reservation search copy must describe the rendered server result set");
assert(viewsSource.includes('현재 표시 ${reports.length}건'), "report search copy must describe the rendered server result set");
assert(lecturesView.includes("admin-lecture-status-chip"), "admin lecture cards must render compact status chip");
assert(lecturesView.includes("admin-lecture-status-dot"), "admin lecture status must use a small dot indicator");
assert(!lecturesView.includes("<div><span>진행상태</span><strong>모집중</strong></div>"), "admin lecture status must not render as a large strong meta value");
assert(lecturesView.includes('data-admin-lecture-semester="all"'), "lectures must render all-semester filter");
assert(lecturesView.includes('data-admin-bulk-delete="lectures:filtered"'), "lectures must expose filtered bulk delete");
assert(noticesView.includes('data-admin-bulk-delete="notices:filtered"'), "notices must expose filtered bulk delete");
assert(settings.includes("운영 알림"), "settings must render operations notification section");
assert(settings.includes("마지막 동기화"), "settings notification section must show last sync");
assert.equal(metrics.weekReservations, 4, "metrics must count reservations from current state");
assert.equal(metrics.equipmentCheckedOut, 1, "metrics must count checked-out equipment reservations");
assert.equal(metrics.equipmentReturned, 1, "metrics must count returned equipment reservations");
assert.equal(metrics.equipmentCancelled, 1, "metrics must count cancelled equipment reservations");
assert.equal(metrics.pendingEquipment, 1, "legacy pendingEquipment metric must map to checked-out equipment count");
assert.equal(metrics.availableEquipment, 2, "metrics must count active available equipment");
assert.equal(metrics.repairEquipment, 1, "metrics must count repair equipment");
assert.equal(notifications.length, 1, "admin digest must be planned when summary has work");
assert(notifications[0].body.includes("대여완료 1건"), "admin digest must include checked-out equipment count");
assert(notifications[0].body.includes("반납완료 1건"), "admin digest must include returned equipment count");
assert(notifications[0].body.includes("대여취소 1건"), "admin digest must include cancelled equipment count");
assert(!notifications[0].body.includes("기자재 승인"), "admin digest must not use legacy equipment approval wording");
assert(css.includes(".admin-dashboard-section"), "dashboard section styles must exist");
assert(css.includes(".admin-action-card"), "admin action card styles must exist");
assert(css.includes(".admin-action-icon"), "admin action icon styles must exist");
assert(css.includes(".admin-action-card.tone-yellow .admin-action-icon"), "yellow dashboard action icon tone must exist");
assert(css.includes(".admin-dashboard-grid {\n  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));\n}"), "desktop admin dashboard action cards must wrap before they risk clipping at narrower desktop widths");
assert(css.includes(".admin-action-card {\n  min-height: 112px;"), "admin action cards must be more compact");
assert(css.includes(".admin-action-top {\n  display: flex;\n  align-items: center;"), "admin action card label and icon must use a compact inline header");
assert(css.includes(".admin-action-card strong {\n    font-size: 36px;"), "mobile admin action numbers must be larger than the shared stat size");
assert(!css.includes(".stat-grid.admin-dashboard-grid {\n    grid-template-columns: 1fr;"), "mobile admin action cards must stay in a two-column grid");
assert(css.includes(".admin-queue-sheet-grid"), "operations queue sheet trigger styles must exist");
assert(css.includes(".admin-queue-sheet-list"), "operations queue bottom sheet list styles must exist");
assert(!css.includes(".admin-queue-item"), "duplicated operations queue card styles must be removed");
assert(css.includes(".admin-lecture-status-dot"), "admin lecture status dot styles must exist");
assert(css.includes("width: 6px;\n  height: 6px;"), "admin lecture status dot must stay visually small");
assert(buttonRule.includes("box-shadow: 0 1px 2px"), "button must use one clear surface shadow");
assert(!primaryButtonRule.includes("linear-gradient"), "primary button must use a clear single-color surface");
assert(!primaryButtonRule.includes("inset"), "primary button must not use an inset highlight that reads as a double button");

assert(coreSource.includes("const today = todayKeySeoul();"), "admin summary must use the Seoul calendar day, not UTC");
assert(!coreSource.includes('const today = new Date().toISOString().slice(0, 10);'), "admin summary must not use UTC ISO date for today's one-day dashboard");
assert(eventSource.includes("SCROLL_RESTORE_TARGET_SELECTOR"), "scroll preservation must use one shared target selector");
assert(eventSource.includes(".mobile-nav") && eventSource.includes(".admin-mobile-nav"), "scroll preservation must include mobile menu bars");
assert(eventSource.includes(".desktop-nav") && eventSource.includes(".side-nav"), "scroll preservation must include desktop menu bars");
assert(eventSource.includes("target.dataset.adminReservationSemester"), "reservation semester event handler must exist");
assert(eventSource.includes("target.dataset.adminBulkDelete"), "bulk delete click handler must exist");
assert(searchSource.includes('"adminLectureSearch"') && searchSource.includes("adminServerSearchStateKeys"), "lecture admin search must be treated as server-backed search state");
assert(searchSource.includes('"adminNoticeSearch"') && searchSource.includes("adminServerSearchStateKeys"), "notice admin search must be treated as server-backed search state");
assert(searchSource.includes('resetAdminPage("adminLecturesPage")'), "lecture server-backed search must reset lecture paging");
assert(dataSource.includes("function adminNoticesPath()"), "notice admin data must load through a dedicated path helper");
assert(dataSource.includes("q: state.adminNoticeSearch"), "notice admin data path must forward the notice search query");
assert(dataSource.includes("api(adminNoticesPath())"), "notice admin data load must use the query-aware notices path");
assert(dataSource.includes("adminNotices: pagedItems(notices)"), "notice admin data must support paged notice payloads");

const resStatusStart = eventSource.indexOf("if (target.dataset.resStatus)");
const resStatusEnd = eventSource.indexOf("if (target.dataset.equipmentStatusAction)", resStatusStart);
assert.notEqual(resStatusStart, -1, "reservation status handler must exist");
assert.notEqual(resStatusEnd, -1, "reservation status handler must close before equipment status actions");
const resStatusBlock = eventSource.slice(resStatusStart, resStatusEnd);
assert(resStatusBlock.includes('target.dataset.status === "cancelled"'), "reservation status handler must detect destructive equipment cancellation");
assert(resStatusBlock.includes('confirm("예약을 대여취소로 변경할까요?")'), "reservation status handler must confirm before destructive equipment cancellation");

function blockBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `${startToken} block must exist`);
  const end = source.indexOf(endToken, start);
  assert.notEqual(end, -1, `${startToken} block must close before ${endToken}`);
  return source.slice(start, end);
}

for (const [token, next] of [
  ["if (target.dataset.adminView)", "if (target.dataset.adminReservationTab && !target.dataset.adminView)"],
  ["if (target.dataset.adminReservationTab && !target.dataset.adminView)", "if (target.dataset.adminEquipmentReservationStatus"],
  ["if (target.dataset.adminEquipmentTab)", "if (target.dataset.adminEquipmentCategoryTab)"],
  ["if (target.dataset.adminEquipmentCategoryTab)", "if (target.dataset.lectureUpdate)"],
  ["if (target.dataset.lectureEdit)", "if (target.dataset.lectureEditCancel"],
  ["if (target.dataset.adminUsersPage)", "if (target.dataset.adminReservationsPage)"],
  ["if (target.dataset.adminReservationsPage)", "if (target.dataset.adminReportsPage)"],
  ["if (target.dataset.adminReportsPage)", "if (target.dataset.adminSessionSort)"]
]) {
  const block = blockBetween(eventSource, token, next);
  assert(block.includes("renderPreservingScroll();"), `${token} must preserve scroll`);
  assert(!block.includes("renderAtTop();"), `${token} must not force top scroll`);
}

assert(eventSource.includes("target.dataset.adminEquipmentPanelTab"), "admin equipment must support add/manage inner tabs");
assert(eventSource.includes("target.dataset.adminLecturePanelTab"), "admin lectures must support add/list inner tabs");

const adminMobileHeaderRule = cssRule("  .admin-mobile-header");
assert(!adminMobileHeaderRule.includes("position: sticky;"), "admin mobile header must not be sticky");
assert(adminMobileHeaderRule.includes("position: relative;"), "admin mobile header must scroll naturally with the page");
assert(adminMobileHeaderRule.includes("width: 100vw;"), "admin mobile header must fill the full screen width");
assert(adminMobileHeaderRule.includes("margin-left: calc(50% - 50vw);"), "admin mobile header must align to the left viewport edge");
assert(adminMobileHeaderRule.includes("margin-right: calc(50% - 50vw);"), "admin mobile header must align to the right viewport edge");
assert(adminMobileHeaderRule.includes("overflow: hidden;"), "admin mobile header must clip its scroll-away blur layer");
assert(adminMobileHeaderRule.includes("isolation: isolate;"), "admin mobile header must isolate its blur layer behind controls");

const studentTopAppbarRule = cssRule(".top-appbar");
assert(!studentTopAppbarRule.includes("position: sticky;"), "student top appbar must not be sticky");
assert(!studentTopAppbarRule.includes("position: fixed;"), "student top appbar must not be fixed");
assert(studentTopAppbarRule.includes("position: relative;"), "student top appbar must scroll naturally with the page");
assert(studentTopAppbarRule.includes("overflow: hidden;"), "student top appbar must clip its scroll-away blur layer");
assert(studentTopAppbarRule.includes("isolation: isolate;"), "student top appbar must isolate its blur layer behind controls");
assert(css.includes(".top-appbar::before,\n.admin-mobile-header::before"), "student/admin top bars must share a scroll-away blur layer");
assert(css.includes("-webkit-mask-image: linear-gradient"), "scroll-away blur layer must fade like a native app header");
assert(css.includes("backdrop-filter: var(--blur-strong);"), "scroll-away blur layer must use the strong backdrop blur token");

assert(css.includes(".admin-inner-tabs"), "admin inner tab styles must exist");
assert(css.includes(".admin-equipment-list-card.compact"), "registered equipment card must have compact density styles");
assert(css.includes(".admin-user-core-group .button.compact"), "student approval action buttons must have compact mobile sizing");
assert(dashboard.includes("오늘 처리할 일"), "dashboard day work section must stay visible");

console.log("Admin dashboard UX checks passed.");

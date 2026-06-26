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

const { state } = await import("../public/js/state.js?v=20260626-equipment-reservation-status-3");
const { adminDashboardView, adminSettingsView, adminDashboardMetrics, adminReservationsView } = await import("../public/js/views-admin.js?v=20260626-equipment-reservation-status-3");
const { plannedAdminNotifications } = await import("../public/js/native-notifications.js?v=20260626-equipment-reservation-status-3");

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
  { id: "r1", type: "equipment", status: "checked_out", user: { name: "김학생" }, fields: { reservedDate: "2026-06-26", rentalTime: "10:00", returnDate: "2026-06-26" } },
  { id: "r2", type: "equipment", status: "returned", user: { name: "이학생" }, fields: { reservedDate: "2026-06-26", rentalTime: "13:00", returnDate: "2026-06-26" } },
  { id: "r3", type: "equipment", status: "cancelled", user: { name: "박학생" }, fields: { reservedDate: "2026-06-26", rentalTime: "15:00", returnDate: "2026-06-26" } },
  { id: "r4", type: "studio", status: "auto_confirmed", user: { name: "최학생" }, fields: { reservedDate: "2026-06-26", timeSlots: ["16:00-17:00"] } }
];
state.adminEquipment = [
  { id: "e1", active: true, status: "가능" },
  { id: "e2", active: true, status: "가능" },
  { id: "e3", active: true, status: "수리중" },
  { id: "e4", active: false, status: "가능" }
];
state.adminReports = [{ id: "report1", status: "pending" }];
state.adminLectures = [{ id: "lecture1", title: "프린트 워크숍", status: "모집중", startsAt: "2026-07-01" }];
state.adminNotices = [{ id: "notice1", title: "하계 운영 안내", createdAt: "2026-06-26T07:00:00.000Z" }];

const dashboard = adminDashboardView();
state.adminReservationTab = "equipment";
state.adminEquipmentReservationStatusFilter = "all";
state.adminReservationSearch = "";
const reservationsView = adminReservationsView();
const settings = adminSettingsView();
const metrics = adminDashboardMetrics();
const notifications = plannedAdminNotifications(new Date("2026-06-26T08:00:00.000Z"));
const css = fs.readFileSync("public/styles.css", "utf8");

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
assert(dashboard.includes("admin-queue-detail-grid"), "operations queue must render compact detail panels");
assert(dashboard.includes('<span class="tag purple">대여완료</span>'), "dashboard checked-out equipment status must use the shared purple status tag");
assert(dashboard.includes('<span class="tag green">반납완료</span>'), "dashboard returned equipment status must use the shared green status tag");
assert(dashboard.includes('<span class="tag gray">대여취소</span>'), "dashboard cancelled equipment status must use the shared gray status tag");
assert(!dashboard.includes("승인 완료"), "equipment dashboard must not show legacy approval status");
assert(!dashboard.includes("기자재 승인 대기"), "equipment dashboard must not show legacy pending equipment status");
assert(reservationsView.includes("대여완료"), "equipment reservation filter/action must include checked-out status");
assert(reservationsView.includes("반납완료"), "equipment reservation filter/action must include returned status");
assert(reservationsView.includes("대여취소"), "equipment reservation filter/action must include cancelled status");
assert(reservationsView.includes('data-status="checked_out"'), "equipment reservations must expose checked-out action");
assert(reservationsView.includes('data-status="returned"'), "equipment reservations must expose returned action");
assert(reservationsView.includes('data-status="cancelled"'), "equipment reservations must expose cancelled action");
assert(!reservationsView.includes('data-status="approved"'), "equipment reservations must not expose legacy approval action");
assert(!reservationsView.includes('data-status="admin_cancelled"'), "equipment reservations must not expose legacy admin cancellation action");
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
assert(css.includes(".admin-action-card {\n  min-height: 112px;"), "admin action cards must be more compact");
assert(css.includes(".admin-action-top {\n  display: flex;\n  align-items: center;"), "admin action card label and icon must use a compact inline header");
assert(css.includes(".admin-action-card strong {\n    font-size: 36px;"), "mobile admin action numbers must be larger than the shared stat size");
assert(!css.includes(".stat-grid.admin-dashboard-grid {\n    grid-template-columns: 1fr;"), "mobile admin action cards must stay in a two-column grid");
assert(css.includes(".admin-queue-detail-grid"), "compressed operations queue styles must exist");
assert(!css.includes(".admin-queue-item"), "duplicated operations queue card styles must be removed");
assert(buttonRule.includes("box-shadow: 0 1px 2px"), "button must use one clear surface shadow");
assert(!primaryButtonRule.includes("linear-gradient"), "primary button must use a clear single-color surface");
assert(!primaryButtonRule.includes("inset"), "primary button must not use an inset highlight that reads as a double button");

console.log("Admin dashboard UX checks passed.");

import assert from "node:assert/strict";
import { adminExportData, cleanupExpiredData, handleApiRequest, initialDb, normalizeDb } from "../core.mjs";

const db = await initialDb("production-admin-password");
db.settings.adminUrl = "https://admin.photographygju.dothome.co.kr";
normalizeDb(db);
assert.equal(db.settings.adminUrl, "https://photographygju.dothome.co.kr");
const fantasyLabItems = db.equipment.filter((item) => item.source === "fantasy_lab");
assert.ok(fantasyLabItems.length > 0);
assert.equal(fantasyLabItems.every((item) => item.facility === "판타지랩" && item.reservable === false && item.inquiryOnly === true), true);

db.sessions.push({
  id: "session_expired",
  token: "expired",
  userId: "user_admin",
  expiresAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2025-12-01T00:00:00.000Z"
});

db.reservations.push({
  id: "res_old_completed",
  type: "studio",
  userId: "user_admin",
  status: "completed",
  fields: {
    reservedDate: "2025-12-01",
    phone: "01012345678",
    studentStatus: "재학생"
  },
  history: [{ at: "2025-12-01T00:00:00.000Z", actorId: "user_admin", action: "created" }],
  createdAt: "2025-12-01T00:00:00.000Z",
  updatedAt: "2025-12-01T00:00:00.000Z"
});

db.reports.push({
  id: "report_old",
  type: "studio",
  reservationId: "res_old_completed",
  userId: "user_admin",
  fields: {},
  htmlSnapshot: "<article>old</article>",
  submittedAt: "2025-12-01T00:00:00.000Z",
  expiresAt: "2026-01-01T00:00:00.000Z"
});

const summary = cleanupExpiredData(db, new Date("2026-06-14T00:00:00.000Z"), "test");
assert.equal(summary.changed, true);
assert.equal(summary.anonymizedReservations, 1);
assert.equal(summary.deletedReportHtmlSnapshots, 1);
assert.equal(summary.deletedExpiredSessions, 1);
assert.equal(db.sessions.some((session) => session.id === "session_expired"), false);
assert.equal(db.reservations[0].userId, "");
assert.equal(db.reservations[0].fields.phone, "");
assert.equal(db.reports[0].htmlSnapshot, "");

const exported = adminExportData(db);
assert.equal(exported.users.some((user) => "passwordHash" in user), false);
assert.equal(exported.settings.adminUrl, "https://photographygju.dothome.co.kr");

async function api(method, pathname, body = {}, token = "", meta = {}) {
  return handleApiRequest({
    method,
    pathname,
    authorization: token ? `Bearer ${token}` : "",
    readText: async () => JSON.stringify(body),
    db,
    saveDb: async () => {},
    slackWebhook: "",
    clientIp: meta.ip || "203.0.113.10",
    userAgent: meta.userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  });
}

const adminLogin = await api("POST", "/api/auth/login", {
  loginId: "admin",
  password: "production-admin-password"
}, "", { ip: "203.0.113.20" });
assert.equal(adminLogin.status, 200);
const adminToken = adminLogin.body.data.token;

const createdFantasyLab = await api("POST", "/api/admin/equipment", {
  name: "테스트 판타지랩 장비",
  category: "Other",
  source: "fantasy_lab",
  quantity: 1,
  reservable: true
}, adminToken);
assert.equal(createdFantasyLab.status, 200);
assert.equal(createdFantasyLab.body.data[0].reservable, false);
assert.equal(createdFantasyLab.body.data[0].inquiryOnly, true);

const importedFantasyLab = await api("POST", "/api/admin/equipment/import", {
  rows: [{
    name: "CSV 판타지랩 장비",
    category: "Other",
    source: "fantasy_lab",
    quantity: 1,
    reservable: "true"
  }]
}, adminToken);
assert.equal(importedFantasyLab.status, 200);
const importedFantasyLabItem = db.equipment.find((item) => item.id === importedFantasyLab.body.data.createdItemIds[0]);
assert.equal(importedFantasyLabItem.reservable, false);
assert.equal(importedFantasyLabItem.inquiryOnly, true);

const patchedFantasyLab = await api("PATCH", `/api/admin/equipment/${createdFantasyLab.body.data[0].id}`, {
  reservable: true,
  inquiryOnly: false
}, adminToken);
assert.equal(patchedFantasyLab.status, 200);
assert.equal(patchedFantasyLab.body.data.reservable, false);
assert.equal(patchedFantasyLab.body.data.inquiryOnly, true);

const createdRepairEquipment = await api("POST", "/api/admin/equipment", {
  name: "수리 상태 테스트 장비",
  category: "Other",
  source: "department",
  quantity: 1,
  status: "수리중"
}, adminToken);
assert.equal(createdRepairEquipment.status, 200);
assert.equal(createdRepairEquipment.body.data[0].status, "수리중");
assert.equal(createdRepairEquipment.body.data[0].reservable, false);

const fixedEquipment = await api("PATCH", `/api/admin/equipment/${createdRepairEquipment.body.data[0].id}`, {
  status: "가능"
}, adminToken);
assert.equal(fixedEquipment.status, 200);
assert.equal(fixedEquipment.body.data.status, "가능");
assert.equal(fixedEquipment.body.data.reservable, true);

const brokenEquipment = await api("PATCH", `/api/admin/equipment/${createdRepairEquipment.body.data[0].id}`, {
  status: "파손"
}, adminToken);
assert.equal(brokenEquipment.status, 200);
assert.equal(brokenEquipment.body.data.status, "파손");
assert.equal(brokenEquipment.body.data.reservable, false);

const ignoredEquipmentPatch = await api("PATCH", `/api/admin/equipment/${createdRepairEquipment.body.data[0].id}`, {
  id: "eq_should_not_override",
  createdAt: "2000-01-01T00:00:00.000Z",
  status: "가능"
}, adminToken);
assert.equal(ignoredEquipmentPatch.status, 200);
assert.equal(ignoredEquipmentPatch.body.data.id, createdRepairEquipment.body.data[0].id);
assert.notEqual(ignoredEquipmentPatch.body.data.createdAt, "2000-01-01T00:00:00.000Z");
assert.equal(ignoredEquipmentPatch.body.data.status, "가능");

const bulkEquipment = await api("POST", "/api/admin/equipment", {
  name: "일괄 상태 테스트 장비",
  category: "Other",
  source: "department",
  quantity: 2,
  status: "가능"
}, adminToken);
assert.equal(bulkEquipment.status, 200);
const bulkIds = bulkEquipment.body.data.map((item) => item.id);
const bulkRepair = await api("PATCH", "/api/admin/equipment/bulk", {
  ids: bulkIds,
  patch: { status: "수리중", id: "eq_bulk_override" }
}, adminToken);
assert.equal(bulkRepair.status, 200);
assert.equal(bulkRepair.body.data.length, 2);
assert.equal(bulkRepair.body.data.every((item) => bulkIds.includes(item.id) && item.status === "수리중" && item.reservable === false), true);

const bulkRemove = await api("PATCH", "/api/admin/equipment/bulk", {
  ids: [bulkIds[0]],
  patch: { active: false }
}, adminToken);
assert.equal(bulkRemove.status, 200);
assert.equal(bulkRemove.body.data[0].active, false);

const brokenForReservation = await api("PATCH", `/api/admin/equipment/${createdRepairEquipment.body.data[0].id}`, {
  status: "파손"
}, adminToken);
assert.equal(brokenForReservation.status, 200);

const failedLogin = await api("POST", "/api/auth/login", {
  loginId: "20260001",
  password: "wrong-password"
}, "", { ip: "203.0.113.21" });
assert.equal(failedLogin.status, 401);
assert.equal(db.auditLogs.some((log) => log.action === "auth.login_failed" && log.detail.ip === "203.0.113.21"), true);

const sessionsResult = await api("GET", "/api/admin/sessions", {}, adminToken);
assert.equal(sessionsResult.status, 200);
assert.equal(sessionsResult.body.data.some((session) => "token" in session), false);
assert.equal(sessionsResult.body.data.some((session) => session.ip === "203.0.113.20"), true);

const studentLogin = await api("POST", "/api/auth/login", {
  loginId: "20260001",
  password: "student1234"
}, "", { ip: "203.0.113.30", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" });
assert.equal(studentLogin.status, 200);
const studentSession = db.sessions.find((session) => session.userId === studentLogin.body.data.user.id);
assert.equal(Boolean(studentSession?.ip), true);

const brokenEquipmentReservation = await api("POST", "/api/reservations", {
  type: "equipment",
  fields: {
    reservedDate: "2026-07-02",
    period: "당일",
    rentalTime: "10:15",
    returnTime: "17:10",
    phone: "01039546412",
    equipmentItemIds: [brokenForReservation.body.data.id]
  }
}, studentLogin.body.data.token);
assert.equal(brokenEquipmentReservation.status, 400);

const createdLecture = await api("POST", "/api/admin/lectures", {
  title: "내 예약 표시 테스트 특강",
  lectureDate: "2026-07-01",
  time: "14:00-16:00",
  location: "사진영상미디어학과 강의실",
  instructorName: "홍길동",
  instructorAffiliation: "GJU",
  professor: "김교수",
  targetGrades: "전체",
  capacity: 20,
  description: "내 예약 특강 표시 테스트",
  notes: "",
  baseApplicationCount: 0,
  status: "모집중"
}, adminToken);
assert.equal(createdLecture.status, 200);

const lectureApply = await api("POST", `/api/lectures/${createdLecture.body.data.id}/apply`, {}, studentLogin.body.data.token);
assert.equal(lectureApply.status, 200);

const myReservations = await api("GET", "/api/reservations/my", {}, studentLogin.body.data.token);
assert.equal(myReservations.status, 200);
const myLectureReservation = myReservations.body.data.find((item) => item.type === "lecture" && item.fields.title === "내 예약 표시 테스트 특강");
assert.equal(Boolean(myLectureReservation), true);
assert.equal(myLectureReservation.status, "lecture_applied");
assert.equal(myLectureReservation.fields.reservedDate, "2026-07-01");

const revokeResult = await api("POST", `/api/admin/sessions/${studentSession.id}/revoke`, {}, adminToken);
assert.equal(revokeResult.status, 200);
assert.equal(db.sessions.some((session) => session.id === studentSession.id), false);

const firstStudentLogin = await api("POST", "/api/auth/login", {
  loginId: "20260001",
  password: "student1234"
});
const secondStudentLogin = await api("POST", "/api/auth/login", {
  loginId: "20260001",
  password: "student1234"
});
assert.equal(firstStudentLogin.status, 200);
assert.equal(secondStudentLogin.status, 200);
const studentId = firstStudentLogin.body.data.user.id;
assert.equal(db.sessions.filter((session) => session.userId === studentId).length, 2);
const changePassword = await api("PATCH", "/api/me/password", {
  currentPassword: "student1234",
  newPassword: "student12345"
}, firstStudentLogin.body.data.token);
assert.equal(changePassword.status, 200);
assert.equal(db.sessions.some((session) => session.userId === studentId), false);

console.log("security smoke test passed");

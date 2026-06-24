import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { adminExportData, cleanupExpiredData, handleApiRequest, initialDb, normalizeDb } from "../core.mjs";

const db = await initialDb("production-admin-password");
db.settings.adminUrl = "https://admin.photographygju.dothome.co.kr";
normalizeDb(db);
assert.equal(db.settings.adminUrl, "https://photographygju.dothome.co.kr");
const fantasyLabItems = db.equipment.filter((item) => item.source === "fantasy_lab");
assert.ok(fantasyLabItems.length > 0);
assert.equal(fantasyLabItems.every((item) => item.facility === "판타지랩" && item.reservable === false && item.inquiryOnly === true), true);
assert.equal(db.users.some((user) => user.username === "ta" && user.email === "ta@gju.local"), false);

db.users.push({
  id: "user_seeded_ta",
  role: "admin",
  username: "ta",
  name: "조교",
  email: "ta@gju.local",
  approvalStatus: "approved",
  passwordHash: "pbkdf2:test:test"
});
db.sessions.push({
  id: "session_seeded_ta",
  token: "seeded-ta",
  userId: "user_seeded_ta",
  expiresAt: "2026-12-31T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z"
});
normalizeDb(db);
assert.equal(db.users.some((user) => user.id === "user_seeded_ta"), false);
assert.equal(db.sessions.some((session) => session.userId === "user_seeded_ta"), false);

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

const removedTaLogin = await api("POST", "/api/auth/login", {
  loginId: "ta",
  password: "ta1234"
});
assert.equal(removedTaLogin.status, 401);

const rejectedNoticeLink = await api("POST", "/api/admin/notices", {
  title: "잘못된 링크",
  body: "javascript URL 차단",
  link: "javascript:alert(1)"
}, adminToken);
assert.equal(rejectedNoticeLink.status, 400);

const rejectedGoogleDriveUrl = await api("PATCH", "/api/admin/settings", {
  googleDriveUrl: "javascript:alert(1)"
}, adminToken);
assert.equal(rejectedGoogleDriveUrl.status, 400);

const acceptedGoogleDriveUrl = await api("PATCH", "/api/admin/settings", {
  googleDriveUrl: "https://drive.google.com/drive/folders/example"
}, adminToken);
assert.equal(acceptedGoogleDriveUrl.status, 200);
assert.equal(acceptedGoogleDriveUrl.body.data.googleDriveUrl, "https://drive.google.com/drive/folders/example");

const ignoredSettingsKey = await api("PATCH", "/api/admin/settings", {
  adminUrl: "https://evil.example",
  darkroomCapacity: 7
}, adminToken);
assert.equal(ignoredSettingsKey.status, 200);
assert.equal(ignoredSettingsKey.body.data.adminUrl, "https://photographygju.dothome.co.kr");
assert.equal(ignoredSettingsKey.body.data.darkroomCapacity, 7);

const invalidBlockedSchedule = await api("PATCH", "/api/admin/settings", {
  blockedSchedules: [{
    id: "block_bad",
    type: "studio",
    day: "monday",
    from: "2026-07-01<script>",
    to: "2026-07-10",
    start: "10:00",
    end: "12:00"
  }]
}, adminToken);
assert.equal(invalidBlockedSchedule.status, 400);

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

const studentSignup = await api("POST", "/api/auth/signup", {
  name: "보안테스트학생",
  studentStatus: "재학생",
  phone: "01039546412",
  email: "security-student@gju.local",
  studentId: "20260001",
  grade: "3",
  password: "student1234"
});
assert.equal(studentSignup.status, 200);

const approveStudent = await api("PATCH", `/api/admin/users/${studentSignup.body.data.user.id}/approval`, {
  approvalStatus: "approved"
}, adminToken);
assert.equal(approveStudent.status, 200);

const studentLogin = await api("POST", "/api/auth/login", {
  loginId: "20260001",
  password: "student1234"
}, "", { ip: "203.0.113.30", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" });
assert.equal(studentLogin.status, 200);
const studentSession = db.sessions.find((session) => session.userId === studentLogin.body.data.user.id);
assert.equal(Boolean(studentSession?.ip), true);

const studioReservationForReport = await api("POST", "/api/reservations", {
  type: "studio",
  fields: {
    reservedDate: "2026-07-06",
    phone: "01039546412",
    studioSpace: "Studio A Front",
    studioSpaces: ["Studio A Front"],
    timeSlots: ["10:30-12:00"],
    participants: "보안테스트학생",
    requiredEquipment: "-"
  }
}, studentLogin.body.data.token);
assert.equal(studioReservationForReport.status, 200);

const rejectedReportUrl = await api("POST", "/api/reports/studio", {
  reservationId: studioReservationForReport.body.data.id,
  actualTime: "10:30-12:00",
  participants: "보안테스트학생",
  cleanupConfirmed: true,
  resultPhotoUrl: "javascript:alert(1)"
}, studentLogin.body.data.token);
assert.equal(rejectedReportUrl.status, 400);

const acceptedReportUrl = await api("POST", "/api/reports/studio", {
  reservationId: studioReservationForReport.body.data.id,
  actualTime: "10:30-12:00",
  participants: "보안테스트학생",
  cleanupConfirmed: true,
  resultPhotoUrl: "https://drive.google.com/file/d/example/view"
}, studentLogin.body.data.token);
assert.equal(acceptedReportUrl.status, 200);
assert.equal(acceptedReportUrl.body.data.fields.resultPhotoUrl, "https://drive.google.com/file/d/example/view");

const pagedReports = await api("GET", "/api/admin/reports?page=1&pageSize=1&q=보안테스트학생", {}, adminToken);
assert.equal(pagedReports.status, 200);
assert.equal(Array.isArray(pagedReports.body.data.items), true);
assert.equal(pagedReports.body.data.page, 1);
assert.equal(pagedReports.body.data.pageSize, 1);
assert.equal(pagedReports.body.data.total >= 1, true);
assert.equal(pagedReports.body.data.items[0].user.email, "security-student@gju.local");

const nonStudioReports = await api("GET", "/api/admin/reports?type=print", {}, adminToken);
assert.equal(nonStudioReports.status, 200);
assert.equal(Array.isArray(nonStudioReports.body.data.items), true);
assert.equal(nonStudioReports.body.data.pageSize, 100);
assert.equal(nonStudioReports.body.data.total, 0);

const legacyReports = await api("GET", "/api/admin/reports", {}, adminToken);
assert.equal(legacyReports.status, 200);
assert.equal(Array.isArray(legacyReports.body.data), true);

const reportedStudioCancellation = await api("POST", `/api/reservations/${studioReservationForReport.body.data.id}/cancel`, {
  reason: "중복 보고서 우선순위 테스트"
}, studentLogin.body.data.token);
assert.equal(reportedStudioCancellation.status, 200);

const duplicateReportAfterCancellation = await api("POST", "/api/reports/studio", {
  reservationId: studioReservationForReport.body.data.id,
  actualTime: "10:30-12:00",
  participants: "보안테스트학생",
  cleanupConfirmed: true,
  resultPhotoUrl: "https://drive.google.com/file/d/example/view"
}, studentLogin.body.data.token);
assert.equal(duplicateReportAfterCancellation.status, 409);

const cancelledStudioReservation = await api("POST", "/api/reservations", {
  type: "studio",
  fields: {
    reservedDate: "2026-07-07",
    phone: "01039546412",
    studioSpace: "Studio B Front",
    studioSpaces: ["Studio B Front"],
    timeSlots: ["10:30-12:00"],
    participants: "보안테스트학생",
    requiredEquipment: "-"
  }
}, studentLogin.body.data.token);
assert.equal(cancelledStudioReservation.status, 200);

const cancelledStudio = await api("POST", `/api/reservations/${cancelledStudioReservation.body.data.id}/cancel`, {
  reason: "보고서 차단 테스트"
}, studentLogin.body.data.token);
assert.equal(cancelledStudio.status, 200);

const cancelledStudioReport = await api("POST", "/api/reports/studio", {
  reservationId: cancelledStudioReservation.body.data.id,
  actualTime: "10:30-12:00",
  participants: "보안테스트학생",
  cleanupConfirmed: true,
  resultPhotoUrl: "https://drive.google.com/file/d/example/view"
}, studentLogin.body.data.token);
assert.equal(cancelledStudioReport.status, 400);

const deleteSignup = await api("POST", "/api/auth/signup", {
  name: "삭제테스트학생",
  studentStatus: "재학생",
  phone: "01022223333",
  email: "delete-student@gju.local",
  studentId: "20260002",
  grade: "2",
  password: "delete1234"
});
assert.equal(deleteSignup.status, 200);

const approveDeleteStudent = await api("PATCH", `/api/admin/users/${deleteSignup.body.data.user.id}/approval`, {
  approvalStatus: "approved"
}, adminToken);
assert.equal(approveDeleteStudent.status, 200);

const deleteStudentLogin = await api("POST", "/api/auth/login", {
  loginId: "20260002",
  password: "delete1234"
});
assert.equal(deleteStudentLogin.status, 200);

const deleteStudentReservation = await api("POST", "/api/reservations", {
  type: "print",
  fields: {
    reservedDate: "2026-07-10",
    startTime: "10:00",
    endTime: "11:00",
    phone: "01022223333",
    printType: "과제",
    paper: "글로시",
    size: "소형"
  }
}, deleteStudentLogin.body.data.token);
assert.equal(deleteStudentReservation.status, 200);

const wrongPasswordDelete = await api("DELETE", "/api/me", {
  currentPassword: "wrong-password",
  confirmText: "계정 삭제"
}, deleteStudentLogin.body.data.token);
assert.equal(wrongPasswordDelete.status, 401);

const wrongConfirmDelete = await api("DELETE", "/api/me", {
  currentPassword: "delete1234",
  confirmText: "삭제"
}, deleteStudentLogin.body.data.token);
assert.equal(wrongConfirmDelete.status, 400);

const deletedAccount = await api("DELETE", "/api/me", {
  currentPassword: "delete1234",
  confirmText: "계정 삭제"
}, deleteStudentLogin.body.data.token);
assert.equal(deletedAccount.status, 200);
assert.equal(deletedAccount.body.data.removedReservations, 1);
assert.equal(db.users.some((user) => user.id === deleteSignup.body.data.user.id), false);
assert.equal(db.reservations.some((reservation) => reservation.userId === deleteSignup.body.data.user.id), false);
assert.equal(db.sessions.some((session) => session.userId === deleteSignup.body.data.user.id), false);
assert.equal(db.auditLogs.some((log) => log.action === "user.account_deleted" && log.targetId === deleteSignup.body.data.user.id), true);

const deletedStudentLogin = await api("POST", "/api/auth/login", {
  loginId: "20260002",
  password: "delete1234"
});
assert.equal(deletedStudentLogin.status, 401);

const invalidDateReservation = await api("POST", "/api/reservations", {
  type: "print",
  fields: {
    reservedDate: "9999-12-31<img src=x onerror=alert(1)>",
    startTime: "10:00",
    endTime: "11:00",
    phone: "01039546412",
    printType: "과제",
    paper: "글로시",
    size: "소형"
  }
}, studentLogin.body.data.token);
assert.equal(invalidDateReservation.status, 400);

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

const editableReservation = await api("POST", "/api/reservations", {
  type: "print",
  fields: {
    reservedDate: "2026-07-03",
    startTime: "10:00",
    endTime: "11:00",
    phone: "01039546412",
    printType: "과제",
    paper: "글로시",
    size: "소형"
  }
}, studentLogin.body.data.token);
assert.equal(editableReservation.status, 200);

const secondPrintReservation = await api("POST", "/api/reservations", {
  type: "print",
  fields: {
    reservedDate: "2026-07-04",
    startTime: "10:00",
    endTime: "11:00",
    phone: "01039546412",
    printType: "과제",
    paper: "매트",
    size: "중형"
  }
}, studentLogin.body.data.token);
assert.equal(secondPrintReservation.status, 200);

const pagedReservations = await api("GET", "/api/admin/reservations?page=1&pageSize=1&type=print&from=2026-07-03&to=2026-07-04", {}, adminToken);
assert.equal(pagedReservations.status, 200);
assert.equal(Array.isArray(pagedReservations.body.data.items), true);
assert.equal(pagedReservations.body.data.page, 1);
assert.equal(pagedReservations.body.data.pageSize, 1);
assert.equal(pagedReservations.body.data.total >= 2, true);
assert.equal(pagedReservations.body.data.hasMore, true);
assert.equal(pagedReservations.body.data.items.every((item) => item.type === "print"), true);

const filterOnlyReservations = await api("GET", "/api/admin/reservations?type=print&from=2026-07-03&to=2026-07-04", {}, adminToken);
assert.equal(filterOnlyReservations.status, 200);
assert.equal(filterOnlyReservations.body.data.pageSize, 100);
assert.equal(filterOnlyReservations.body.data.total >= 2, true);
assert.equal(filterOnlyReservations.body.data.items.length >= 2, true);

const legacyReservations = await api("GET", "/api/admin/reservations", {}, adminToken);
assert.equal(legacyReservations.status, 200);
assert.equal(Array.isArray(legacyReservations.body.data), true);

const pagedUsers = await api("GET", "/api/admin/users?page=1&pageSize=1&role=student&q=보안테스트학생", {}, adminToken);
assert.equal(pagedUsers.status, 200);
assert.equal(Array.isArray(pagedUsers.body.data.items), true);
assert.equal(pagedUsers.body.data.items.length, 1);
assert.equal(pagedUsers.body.data.items[0].email, "security-student@gju.local");

const blockStudent = await api("PATCH", `/api/admin/users/${studentLogin.body.data.user.id}/approval`, {
  approvalStatus: "blocked",
  limitDuration: "week1"
}, adminToken);
assert.equal(blockStudent.status, 200);

const blockedEdit = await api("PATCH", `/api/reservations/${editableReservation.body.data.id}`, {
  fields: { reservedDate: "2026-07-04" }
}, studentLogin.body.data.token);
assert.equal(blockedEdit.status, 403);

const unblockStudent = await api("PATCH", `/api/admin/users/${studentLogin.body.data.user.id}/approval`, {
  approvalStatus: "approved"
}, adminToken);
assert.equal(unblockStudent.status, 200);

const invalidLectureDate = await api("POST", "/api/admin/lectures", {
  title: "잘못된 날짜 특강",
  lectureDate: "2026-07-01<script>",
  time: "14:00-16:00",
  location: "사진영상미디어학과 강의실",
  instructorName: "홍길동",
  description: "날짜 검증 테스트",
  status: "모집중"
}, adminToken);
assert.equal(invalidLectureDate.status, 400);

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

const insecureUpload = spawnSync("bash", ["scripts/upload-dothome.sh"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DOTHOME_FTP_HOST: "example.com",
    DOTHOME_FTP_USER: "demo",
    DOTHOME_FTP_PASSWORD: "demo",
    DOTHOME_FTP_SCHEME: "ftp"
  },
  encoding: "utf8"
});
assert.notEqual(insecureUpload.status, 0);
assert.match(insecureUpload.stderr, /Refusing insecure upload protocol/);

console.log("security smoke test passed");

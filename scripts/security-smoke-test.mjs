import assert from "node:assert/strict";
import { adminExportData, cleanupExpiredData, handleApiRequest, initialDb, normalizeDb } from "../core.mjs";

const db = await initialDb("production-admin-password");
db.settings.adminUrl = "https://admin.photographygju.dothome.co.kr";
normalizeDb(db);
assert.equal(db.settings.adminUrl, "https://photographygju.dothome.co.kr");

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

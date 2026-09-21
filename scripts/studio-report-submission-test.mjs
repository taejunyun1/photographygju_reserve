import assert from "node:assert/strict";

import { handleApiRequest, initialDb } from "../core.mjs";

const reportBody = (overrides = {}) => ({
  reservationId: "studio-report-fixture",
  actualTime: "18:00–20:00",
  participants: "2",
  usedEquipment: "조명",
  resultPhotoUrl: "",
  cleanupConfirmed: true,
  damageFound: false,
  notes: "",
  ...overrides
});

async function fixture({ status = "auto_confirmed", googleDriveUrl = "", reservationId = "studio-report-fixture" } = {}) {
  const db = await initialDb("studio-report-submission-password");
  db.settings = { ...db.settings, googleDriveUrl };
  const student = {
    id: "user_report_student",
    role: "student",
    username: "report-student",
    name: "보고서 학생",
    email: "report-student@gju.local",
    phone: "01012345678",
    studentId: "20260001",
    grade: "2",
    studentStatus: "재학생",
    approvalStatus: "approved",
    passwordHash: "fixture",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  const otherStudent = { ...student, id: "user_other_student", username: "other-student", email: "other@gju.local" };
  db.users.push(student, otherStudent);
  db.sessions.push(
    { id: "session-report-student", token: "studio-report-student-token", userId: student.id, expiresAt: "2099-12-31T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", lastSeenAt: "2026-01-01T00:00:00.000Z" },
    { id: "session-other-student", token: "studio-report-other-token", userId: otherStudent.id, expiresAt: "2099-12-31T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", lastSeenAt: "2026-01-01T00:00:00.000Z" }
  );
  db.reservations.push({
    id: reservationId,
    type: "studio",
    status,
    userId: student.id,
    fields: {
      reservedDate: "2099-01-10",
      timeSlots: ["18:00-20:00"],
      studioSpaces: ["Studio A"],
      reportStatus: "required"
    },
    history: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
  return db;
}

async function api(db, token, body) {
  return handleApiRequest({
    method: "POST",
    pathname: "/api/reports/studio",
    authorization: `Bearer ${token}`,
    readText: async () => JSON.stringify(body),
    db,
    saveDb: async () => {},
    slackWebhook: ""
  });
}

const db = await fixture();
const body = reportBody();
const submitted = await api(db, "studio-report-student-token", body);
assert.equal(submitted.status, 200, "a report must be submit-able without a print-room Drive URL");
assert.equal(db.reports.filter((report) => report.reservationId === body.reservationId).length, 1);
assert.equal(db.reservations.find((reservation) => reservation.id === body.reservationId).fields.reportStatus, "submitted");

const duplicate = await api(db, "studio-report-student-token", body);
assert.equal(duplicate.status, 409, "duplicate report submissions must be rejected");

const otherUser = await api(db, "studio-report-other-token", reportBody({ resultPhotoUrl: "https://example.com/result.jpg" }));
assert.equal(otherUser.status, 403, "a student must not submit another student's report");

const linkedDb = await fixture();
const linked = await api(linkedDb, "studio-report-student-token", reportBody({ resultPhotoUrl: "https://drive.google.com/file/d/example/view" }));
assert.equal(linked.status, 200, "a valid optional result photo URL must be accepted");
assert.equal(linked.body.data.fields.resultPhotoUrl, "https://drive.google.com/file/d/example/view");

for (const status of ["cancelled", "admin_cancelled", "rejected"]) {
  const cancelledDb = await fixture({ status });
  const response = await api(cancelledDb, "studio-report-student-token", reportBody());
  assert.equal(response.status, 400, `${status} reservations must reject reports`);
}

const invalidUrlDb = await fixture();
const invalidUrl = await api(invalidUrlDb, "studio-report-student-token", reportBody({ resultPhotoUrl: "javascript:alert(1)" }));
assert.equal(invalidUrl.status, 400, "non-http result photo URLs must be rejected");

const longUrlDb = await fixture();
const longUrl = await api(longUrlDb, "studio-report-student-token", reportBody({ resultPhotoUrl: `https://example.com/${"x".repeat(500)}` }));
assert.equal(longUrl.status, 400, "result photo URLs longer than 500 characters must be rejected");

console.log("Studio report submission checks passed.");

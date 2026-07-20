import assert from "node:assert/strict";

import { handleApiRequest, initialDb } from "../core.mjs";

const db = await initialDb("dashboard-data-integrity-password");
const token = "dashboard-data-integrity-token";
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

db.reservations = [
  {
    id: "dashboard-active-today",
    type: "darkroom",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: today, timeSlots: ["12:00-14:00"] },
    history: []
  },
  {
    id: "dashboard-cancelled-today",
    type: "darkroom",
    status: "cancelled",
    userId: "user_admin",
    fields: { reservedDate: today, timeSlots: ["14:00-16:00"] },
    history: []
  },
  {
    id: "dashboard-rejected-today",
    type: "equipment",
    status: "rejected",
    userId: "user_admin",
    fields: { reservedDate: today, rentalTime: "16:00", returnTime: "18:00" },
    history: []
  }
];
db.reports = [];
db.sessions.push({
  id: "session_dashboard_data_integrity",
  token,
  userId: "user_admin",
  expiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSeenAt: "2026-01-01T00:00:00.000Z"
});

const summary = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/summary",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});

assert.equal(summary.status, 200);
assert.deepEqual(
  summary.body.data.todaySchedule.map((reservation) => reservation.id),
  ["dashboard-active-today"],
  "today's operating timeline must exclude cancelled and rejected reservations"
);

const dateKeyOffset = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

db.equipment = [
  { id: "metric-reservable", code: "METRIC-1", name: "예약 가능 장비", category: "Body", active: true, status: "가능", reservable: true, inquiryOnly: false },
  { id: "metric-inquiry", code: "METRIC-2", name: "취소 장비", category: "Body", active: true, status: "가능", reservable: false, inquiryOnly: true },
  { id: "metric-repair", code: "METRIC-3", name: "수리 장비", category: "Body", active: true, status: "수리중", reservable: false, inquiryOnly: true }
];
const equipmentReservation = (id, status, equipmentItemId, rentalTime = "10:00", returnTime = "17:00", reservedDate = today) => ({
  id,
  type: "equipment",
  status,
  userId: "user_admin",
  fields: { reservedDate, period: "당일", rentalTime, returnTime, equipmentItemIds: [equipmentItemId] },
  history: []
});
db.reservations = [
  equipmentReservation("approved-today", "approved", "metric-reservable", "09:00", "16:00"),
  equipmentReservation("checked-out-today", "checked_out", "metric-reservable", "10:00", "17:00"),
  equipmentReservation("returned-today", "returned", "metric-reservable", "11:00", "18:00"),
  equipmentReservation("cancelled-today", "cancelled", "metric-inquiry", "12:00", "19:00"),
  equipmentReservation("rejected-today", "rejected", "metric-inquiry", "13:00", "20:00"),
  {
    id: "studio-operational-today",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: { reservedDate: today, timeSlots: ["14:00-16:00"] },
    history: []
  }
];

const metricSummary = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/summary",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});

assert.equal(metricSummary.status, 200);
assert.deepEqual(
  metricSummary.body.data.checkoutReturnQueue.map(({ id, queueAction }) => [id, queueAction]),
  [["approved-today", "checkout"], ["checked-out-today", "return"]],
  "checkout/return queue must show each reservation only for its current action"
);
assert.equal(metricSummary.body.data.metrics.activeEquipment, 3);
assert.equal(metricSummary.body.data.metrics.availableEquipment, 1, "inquiry-only equipment must not count as available");
assert.equal(metricSummary.body.data.metrics.equipmentAvailableRate, 33);
assert.equal(metricSummary.body.data.metrics.weekReservations, 4, "weekly reservations must exclude cancelled and rejected requests");
assert.deepEqual(metricSummary.body.data.metrics.typeCounts, { equipment: 3, studio: 1 });
assert.equal(metricSummary.body.data.metrics.popularEquipment.some((item) => item.name === "취소 장비"), false);
assert.equal(metricSummary.body.data.equipmentReturned, 1);
assert.equal(metricSummary.body.data.equipmentCancelled, 2);

db.reservations.push(
  equipmentReservation("returned-before-today", "returned", "metric-reservable", "11:00", "18:00", dateKeyOffset(today, -1)),
  equipmentReservation("cancelled-before-today", "cancelled", "metric-inquiry", "12:00", "19:00", dateKeyOffset(today, -1))
);
const todayCardSummary = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/summary",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});
assert.equal(todayCardSummary.body.data.equipmentReturned, 1, "returned card must count only today's reservations");
assert.equal(todayCardSummary.body.data.equipmentCancelled, 2, "cancelled card must count only today's reservations");

const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);
const studioFields = (reservedDate) => ({
  reservedDate,
  reportStatus: "required",
  studioSpaces: ["Studio A Front"],
  timeSlots: ["10:30-12:00"]
});

db.reservations = [
  {
    id: "report-due-today",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: studioFields(today),
    history: []
  },
  {
    id: "report-future",
    type: "studio",
    status: "auto_confirmed",
    userId: "user_admin",
    fields: studioFields(tomorrow),
    history: []
  },
  {
    id: "report-cancelled",
    type: "studio",
    status: "cancelled",
    userId: "user_admin",
    fields: studioFields(today),
    history: []
  }
];
db.reports = [];

const reportSummary = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/summary",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});

assert.equal(reportSummary.status, 200);
assert.equal(
  reportSummary.body.data.missingReports,
  1,
  "dashboard must count only studio reservations whose use date has arrived"
);

const missingReportPage = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/reports?status=missing&page=1&pageSize=100",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});

assert.equal(missingReportPage.status, 200);
assert.equal(
  missingReportPage.body.data.total,
  reportSummary.body.data.missingReports,
  "report screen and dashboard must expose the same missing report count"
);
assert.deepEqual(
  missingReportPage.body.data.items.map((report) => ({
    reservationId: report.reservationId,
    status: report.status,
    isMissing: report.isMissing
  })),
  [{ reservationId: "report-due-today", status: "missing", isMissing: true }]
);

const submittedReport = await handleApiRequest({
  method: "POST",
  pathname: "/api/reports/studio",
  authorization: `Bearer ${token}`,
  readText: async () => JSON.stringify({
    reservationId: "report-due-today",
    actualTime: "10:30-12:00",
    participants: "2명",
    cleanupConfirmed: true
  }),
  db,
  saveDb: async () => {},
  slackWebhook: ""
});

assert.equal(submittedReport.status, 200);
assert.equal(submittedReport.body.data.status, "submitted", "new studio reports must enter the review queue explicitly");

const submittedSummary = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/summary",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});
assert.equal(submittedSummary.body.data.metrics.reportQueueCount, 1);

const invalidReview = await handleApiRequest({
  method: "PATCH",
  pathname: `/api/admin/reports/${submittedReport.body.data.id}/status`,
  authorization: `Bearer ${token}`,
  readText: async () => JSON.stringify({ status: "rejected" }),
  db,
  saveDb: async () => {},
  slackWebhook: ""
});
assert.equal(invalidReview.status, 400, "report review endpoint must reject unsupported statuses");

const missingReview = await handleApiRequest({
  method: "PATCH",
  pathname: "/api/admin/reports/missing-report/status",
  authorization: `Bearer ${token}`,
  readText: async () => JSON.stringify({ status: "reviewed" }),
  db,
  saveDb: async () => {},
  slackWebhook: ""
});
assert.equal(missingReview.status, 404, "report review endpoint must reject unknown reports");

const reviewedReport = await handleApiRequest({
  method: "PATCH",
  pathname: `/api/admin/reports/${submittedReport.body.data.id}/status`,
  authorization: `Bearer ${token}`,
  readText: async () => JSON.stringify({ status: "reviewed" }),
  db,
  saveDb: async () => {},
  slackWebhook: ""
});
assert.equal(reviewedReport.status, 200);
assert.equal(reviewedReport.body.data.status, "reviewed");
assert.equal(reviewedReport.body.data.reviewedBy, "user_admin");

const reviewedSummary = await handleApiRequest({
  method: "GET",
  pathname: "/api/admin/summary",
  authorization: `Bearer ${token}`,
  readText: async () => "{}",
  db,
  saveDb: async () => {},
  slackWebhook: ""
});
assert.equal(reviewedSummary.body.data.metrics.reportQueueCount, 0, "reviewed reports must leave the dashboard queue");

console.log("Dashboard reservation and report integrity checks passed.");

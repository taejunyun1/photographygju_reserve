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

console.log("Dashboard reservation and report integrity checks passed.");

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

console.log("Dashboard cancelled reservation integrity check passed.");

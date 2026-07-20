import assert from "node:assert/strict";

import { handleApiRequest, initialDb } from "../core.mjs";

const { buildOperationsInsights } = await import("../core/operations-insights.mjs").catch(() => ({}));

assert.equal(typeof buildOperationsInsights, "function", "operations insight builder must be exported");

const now = new Date("2099-01-28T12:00:00+09:00");
const equipment = [
  { id: "eq_camera", code: "CAM-01", name: "Camera One", category: "Camera", active: true, reservable: true, status: "가능" },
  { id: "eq_camera_alt", code: "CAM-02", name: "Camera Two", category: "Camera", active: true, reservable: true, status: "가능" }
];
const reservations = [
  {
    id: "returned-reservation",
    type: "equipment",
    status: "returned",
    user: { name: "다른 학생", phone: "010-9999-9999" },
    fields: { reservedDate: "2099-01-10", rentalTime: "10:00", returnTime: "17:00", equipmentItemIds: ["eq_camera"], phone: "010-9999-9999" },
    timing: { startAt: "2099-01-10T01:00:00.000Z", endAt: "2099-01-10T08:00:00.000Z" },
    equipmentItems: [equipment[0]]
  },
  {
    id: "cancelled-reservation",
    type: "equipment",
    status: "cancelled",
    fields: { reservedDate: "2099-01-12", rentalTime: "10:00", returnTime: "17:00", equipmentItemIds: ["eq_camera"] },
    timing: { startAt: "2099-01-12T01:00:00.000Z", endAt: "2099-01-12T08:00:00.000Z" },
    equipmentItems: [equipment[0]]
  },
  {
    id: "overdue-reservation",
    type: "equipment",
    status: "checked_out",
    fields: { reservedDate: "2099-01-27", rentalTime: "10:00", returnTime: "17:00", equipmentItemIds: ["eq_camera"] },
    timing: { startAt: "2099-01-27T01:00:00.000Z", endAt: "2099-01-27T08:00:00.000Z" },
    equipmentItems: [equipment[0]]
  }
];

const insights = buildOperationsInsights({ reservations, equipment, now });
assert.deepEqual(insights.period, { from: "2099-01-01", to: "2099-01-28", days: 28 });
assert.deepEqual(insights.cancellationRate, { totalRequests: 3, cancelledRequests: 1, percent: 33 });
assert.equal(insights.equipmentUtilization[0].equipmentId, "eq_camera");
assert.equal(insights.warnings.some((item) => item.kind === "overdue_return" && item.reservationId === "overdue-reservation"), true);
assert.equal(JSON.stringify(insights).includes("010-9999-9999"), false, "insights must not leak phone numbers");
assert.equal(JSON.stringify(insights).includes("다른 학생"), false, "insights must not leak student names");

const db = await initialDb("smart-reservation-domain-password");
const token = "smart-reservation-domain-token";
db.sessions.push({
  id: "session_smart_reservation_domain",
  token,
  userId: "user_admin",
  expiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2099-01-01T00:00:00.000Z",
  lastSeenAt: "2099-01-01T00:00:00.000Z"
});

async function api(authorization = "") {
  return handleApiRequest({
    method: "GET",
    pathname: "/api/admin/summary",
    authorization,
    readText: async () => "",
    db,
    saveDb: async () => {},
    slackWebhook: ""
  });
}

const deniedResponse = await api();
assert.equal(deniedResponse.status, 401, "administrator insights must remain administrator-only");

const summaryResponse = await api(`Bearer ${token}`);
assert.equal(summaryResponse.status, 200);
assert.ok(summaryResponse.body.data.metrics.insights, "admin summary must include operations insights");

console.log("Smart reservation domain checks passed.");

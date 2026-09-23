import assert from "node:assert/strict";

import { handleApiRequest, initialDb } from "../core.mjs";

const db = await initialDb("reservation-request-test-password");
const token = "reservation-request-test-token";
db.sessions.push({
  id: "reservation-request-test-session",
  token,
  userId: db.users[0].id,
  expiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2099-01-01T00:00:00.000Z",
  lastSeenAt: "2099-01-01T00:00:00.000Z"
});

async function api(method, pathname, body = {}) {
  return handleApiRequest({
    method,
    pathname,
    authorization: `Bearer ${token}`,
    readText: async () => JSON.stringify(body),
    db,
    saveDb: async () => {},
    slackWebhook: ""
  });
}

const requestedEquipment = [
  { name: " LED 조명 ", quantity: 2, note: " 소프트박스 포함 " },
  { name: "C 스탠드", quantity: 3, note: "" }
];

const studio = await api("POST", "/api/reservations", {
  type: "studio",
  fields: {
    reservedDate: "2099-01-05",
    phone: "01012345678",
    studioSpaces: ["Studio A Front"],
    timeSlots: ["12:00-14:00"],
    requestedEquipment,
    reportStatus: "required"
  }
});
assert.equal(studio.status, 200);
assert.equal(studio.body.data.status, "auto_confirmed", "studio status must remain unchanged");
assert.deepEqual(studio.body.data.fields.requestedEquipment, [
  { name: "LED 조명", quantity: 2, note: "소프트박스 포함" },
  { name: "C 스탠드", quantity: 3, note: "" }
]);

const equipment = await api("POST", "/api/reservations", {
  type: "equipment",
  fields: {
    reservedDate: "2099-01-05",
    period: "당일",
    rentalTime: "10:15",
    returnTime: "17:10",
    phone: "01012345678",
    equipmentItemIds: [],
    requestedEquipment
  }
});
assert.equal(equipment.status, 200, `request-only equipment booking must be accepted: ${JSON.stringify(equipment.body)}`);
assert.equal(equipment.body.data.status, "pending_approval", "equipment status must remain unchanged");
assert.deepEqual(equipment.body.data.fields.requestedEquipment, studio.body.data.fields.requestedEquipment);

const catalogItem = db.equipment.find((item) => item.active && item.reservable && item.status === "가능");
assert(catalogItem, "seed data must contain a reservable catalog item");
const mixed = await api("POST", "/api/reservations", {
  type: "equipment",
  fields: {
    reservedDate: "2099-01-05",
    period: "당일",
    rentalTime: "10:15",
    returnTime: "17:10",
    phone: "01012345678",
    equipmentItemIds: [catalogItem.id],
    cameraBagConfirmed: true,
    requestedEquipment: [{ name: "추가 마이크", quantity: 1, note: "" }]
  }
});
assert.equal(mixed.status, 200, `catalog and unlisted items must coexist: ${JSON.stringify(mixed.body)}`);
assert.deepEqual(mixed.body.data.fields.equipmentItemIds, [catalogItem.id]);
assert.equal(mixed.body.data.fields.requestedEquipment[0].name, "추가 마이크");

const mine = await api("GET", "/api/reservations/my");
assert.equal(mine.status, 200);
assert.deepEqual(
  mine.body.data.find((item) => item.id === equipment.body.data.id).fields.requestedEquipment,
  equipment.body.data.fields.requestedEquipment,
  "request rows must survive the authenticated list round-trip"
);

for (const invalid of [
  [{ name: "", quantity: 1, note: "" }],
  [{ name: "마이크", quantity: 0, note: "" }],
  [{ name: "마이크", quantity: 1.5, note: "" }],
  [{ name: "마이크", quantity: 1, note: "설명".repeat(300) }],
  Array.from({ length: 21 }, (_, index) => ({ name: `장비 ${index}`, quantity: 1, note: "" }))
]) {
  const response = await api("POST", "/api/reservations", {
    type: "equipment",
    fields: {
      reservedDate: "2099-01-05",
      period: "당일",
      rentalTime: "10:15",
      returnTime: "17:10",
      phone: "01012345678",
      equipmentItemIds: [],
      requestedEquipment: invalid
    }
  });
  assert.equal(response.status, 400, `invalid request row must be rejected: ${JSON.stringify(invalid[0])}`);
}

console.log("reservation equipment requests: ok");

import assert from "node:assert/strict";

import { handleApiRequest, initialDb } from "../core.mjs";

const { buildOperationsInsights } = await import("../core/operations-insights.mjs").catch(() => ({}));
const { validateFavoriteGroups } = await import("../core/favorite-equipment.mjs").catch(() => ({}));
const { findReservationRecommendations } = await import("../core/reservation-recommendations.mjs").catch(() => ({}));

assert.equal(typeof buildOperationsInsights, "function", "operations insight builder must be exported");
assert.equal(typeof validateFavoriteGroups, "function", "favorite group validator must be exported");
assert.equal(typeof findReservationRecommendations, "function", "reservation recommendation builder must be exported");

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

const insightSettings = {
  equipmentRentalTimes: ["10:15", "12:00"],
  studioSpaces: ["Studio A", "Studio B"],
  studioSlots: ["12:00-14:00"],
  darkroomCapacity: 6,
  printAvailableStart: "10:00",
  printAvailableEnd: "19:00",
  printCapacityWindowMinutes: 120,
  printCapacityPerWindow: 4
};
const uniqueSlotReservations = [
  { id: "slot-equipment-1015", type: "equipment", status: "approved", fields: { reservedDate: "2099-01-10", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] } },
  { id: "slot-equipment-1200", type: "equipment", status: "approved", fields: { reservedDate: "2099-01-11", rentalTime: "12:00", equipmentItemIds: ["eq_camera_alt"] } },
  { id: "slot-studio-1200", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2099-01-12", timeSlots: ["12:00-14:00"] } }
];
const capacityAwareInsights = buildOperationsInsights({ reservations: uniqueSlotReservations, equipment, settings: insightSettings, now });
assert.equal(capacityAwareInsights.congestion.insufficientData, true, "inventory size is not a reservation sample size");
assert.deepEqual(capacityAwareInsights.congestion.items, [], "single bookings must not be described as congestion");
const capacityWithRepairEquipment = buildOperationsInsights({
  reservations: [uniqueSlotReservations[0]],
  equipment: [...equipment, { id: "eq_repair", code: "CAM-REPAIR", name: "수리중 카메라", category: "Camera", active: true, reservable: true, status: "수리중" }],
  settings: insightSettings,
  now
});
assert.deepEqual(capacityWithRepairEquipment.congestion.items, [], "inventory changes must not turn one booking into a trend");
const rankedByOccupancyInsights = buildOperationsInsights({
  reservations: [
    { id: "rank-equipment-1", type: "equipment", status: "approved", fields: { reservedDate: "2099-01-10", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] } },
    { id: "rank-equipment-2", type: "equipment", status: "approved", fields: { reservedDate: "2099-01-11", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] } },
    { id: "rank-studio-1", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2099-01-12", timeSlots: ["12:00-14:00"] } },
    { id: "rank-studio-2", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2099-01-13", timeSlots: ["12:00-14:00"] } },
    { id: "rank-studio-3", type: "studio", status: "auto_confirmed", fields: { reservedDate: "2099-01-14", timeSlots: ["12:00-14:00"] } }
  ],
  equipment,
  settings: { ...insightSettings, studioSpaces: ["Studio A", "Studio B", "Studio C", "Studio D"] },
  now
});
assert.equal(rankedByOccupancyInsights.congestion.items[0]?.type, "studio", "popular times must rank by booking count with at least three observations");
assert.equal(rankedByOccupancyInsights.congestion.items[0]?.count, 3);
assert.equal(rankedByOccupancyInsights.congestion.items[0]?.availableCount, undefined, "do not divide reservation count by inventory capacity");
const spanning = { ...reservations[0], fields: { ...reservations[0].fields, reservedDate: "2098-12-31" }, timing: { startAt: "2098-12-31T01:00:00Z", endAt: "2099-01-03T08:00:00Z" } };
const spanningInsights = buildOperationsInsights({ reservations: [spanning, { ...spanning, id: "overlapping" }, reservations[1]], equipment, now });
assert.equal(spanningInsights.equipmentUtilization[0].reservedDays, 3, "count all overlapping rental days once, including rentals beginning before the window; exclude cancellations");

const historicalReservation = {
  id: "historical-equipment",
  type: "equipment",
  status: "returned",
  fields: { reservedDate: "2099-01-08", rentalTime: "10:15", equipmentItemIds: ["eq_historical"] },
  equipmentItems: [{ id: "eq_historical", code: "CAM-H01", name: "Historical Camera", category: "Camera" }]
};
const historicalAvailable = buildOperationsInsights({
  reservations: [historicalReservation],
  equipment: [{ id: "eq_historical", code: "CAM-H01", name: "Current Camera Name", category: "Camera", active: true, reservable: true, status: "가능" }],
  now
});
const historicalRepair = buildOperationsInsights({
  reservations: [historicalReservation],
  equipment: [{ id: "eq_historical", code: "CAM-H01", name: "Current Camera Name", category: "Camera", active: true, reservable: true, status: "수리중" }],
  now
});
assert.deepEqual(
  historicalRepair.equipmentUtilization,
  historicalAvailable.equipmentUtilization,
  "historical utilization must not change when the equipment's current availability changes"
);
assert.equal(historicalRepair.equipmentUtilization[0]?.name, "Current Camera Name", "current metadata should label historical usage when it still exists");

const deletedEquipmentInsights = buildOperationsInsights({ reservations: [historicalReservation], equipment: [], now });
assert.equal(deletedEquipmentInsights.equipmentUtilization[0]?.equipmentId, "eq_historical", "deleted equipment must remain in historical utilization");
assert.equal(deletedEquipmentInsights.equipmentUtilization[0]?.name, "Historical Camera", "reservation metadata should label deleted equipment history");

const metadataMissingReservation = {
  ...historicalReservation,
  id: "historical-metadata-missing",
  fields: { ...historicalReservation.fields, equipmentItemIds: ["eq_missing"] },
  equipmentItems: []
};
const metadataMissingInsights = buildOperationsInsights({ reservations: [metadataMissingReservation], equipment: [], now });
assert.equal(metadataMissingInsights.equipmentUtilization[0]?.name, "기록상 장비", "missing historical metadata must use a stable fallback label");

const requestDateInsights = buildOperationsInsights({
  reservations: [
    { id: "old-approved", type: "equipment", status: "approved", createdAt: "2098-12-01T00:00:00.000Z", fields: { reservedDate: "2099-01-10", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] } },
    { id: "old-cancelled", type: "equipment", status: "cancelled", createdAt: "2098-12-02T00:00:00.000Z", fields: { reservedDate: "2099-01-11", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] } },
    { id: "recent-request", type: "equipment", status: "cancelled", createdAt: "2099-01-12T00:00:00.000Z", fields: { reservedDate: "2099-02-15", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] } }
  ],
  equipment,
  settings: insightSettings,
  now
});
assert.deepEqual(requestDateInsights.cancellationRate, { totalRequests: 1, cancelledRequests: 1, percent: 100 }, "cancellation rate must use request creation date, not scheduled reservation date");

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

async function api({ method = "GET", pathname = "/api/admin/summary", authorization = "", body = {} } = {}) {
  return handleApiRequest({
    method,
    pathname,
    authorization,
    readText: async () => JSON.stringify(body),
    db,
    saveDb: async () => {},
    slackWebhook: ""
  });
}

const deniedResponse = await api();
assert.equal(deniedResponse.status, 401, "administrator insights must remain administrator-only");

const summaryResponse = await api({ authorization: `Bearer ${token}` });
assert.equal(summaryResponse.status, 200);
assert.ok(summaryResponse.body.data.metrics.insights, "admin summary must include operations insights");

const favoriteEquipment = db.equipment.filter((item) => item.active && item.reservable).slice(0, 6);
assert.equal(favoriteEquipment.length, 6, "fixture requires six active reservable equipment items");
const favoriteGroups = [
  { name: "카메라", equipmentItemIds: [favoriteEquipment[0].id, favoriteEquipment[1].id] },
  { name: "렌즈", equipmentItemIds: [favoriteEquipment[2].id] },
  { name: "조명", equipmentItemIds: [favoriteEquipment[3].id] }
];
const savedGroups = await api({
  method: "PUT",
  pathname: "/api/me/favorite-equipment-groups",
  authorization: `Bearer ${token}`,
  body: { groups: favoriteGroups }
});
assert.equal(savedGroups.status, 200);
assert.equal(savedGroups.body.data.favoriteGroups.length, 3);
assert.equal(savedGroups.body.data.favoriteGroups[0].equipmentItemIds[0], favoriteEquipment[0].id);

const tooManyGroups = await api({
  method: "PUT",
  pathname: "/api/me/favorite-equipment-groups",
  authorization: `Bearer ${token}`,
  body: { groups: [...favoriteGroups, { name: "기타", equipmentItemIds: [] }] }
});
assert.equal(tooManyGroups.status, 400);
assert.match(tooManyGroups.body.error, /3개/);

const duplicateEquipment = await api({
  method: "PUT",
  pathname: "/api/me/favorite-equipment-groups",
  authorization: `Bearer ${token}`,
  body: { groups: [{ name: "중복", equipmentItemIds: [favoriteEquipment[0].id] }, { name: "다른 그룹", equipmentItemIds: [favoriteEquipment[0].id] }] }
});
assert.equal(duplicateEquipment.status, 400);
assert.match(duplicateEquipment.body.error, /한 그룹/);

const tooManyItems = await api({
  method: "PUT",
  pathname: "/api/me/favorite-equipment-groups",
  authorization: `Bearer ${token}`,
  body: { groups: [{ name: "한도 초과", equipmentItemIds: favoriteEquipment.map((item) => item.id) }] }
});
assert.equal(tooManyItems.status, 400);
assert.match(tooManyItems.body.error, /5개/);

db.equipment.push({ id: "favorite-inactive", code: "FAV-STOP", name: "비활성 장비", category: "Body", active: false, reservable: true });
const inactiveEquipment = await api({
  method: "PUT",
  pathname: "/api/me/favorite-equipment-groups",
  authorization: `Bearer ${token}`,
  body: { groups: [{ name: "비활성", equipmentItemIds: ["favorite-inactive"] }] }
});
assert.equal(inactiveEquipment.status, 400);
assert.match(inactiveEquipment.body.error, /추가할 수 없는/);

db.reservations.push({
  id: "shortcut-reservation",
  type: "equipment",
  userId: "user_admin",
  status: "returned",
  fields: { reservedDate: "2099-01-14", period: "당일", rentalTime: "10:00", returnTime: "17:00", equipmentItemIds: [favoriteEquipment[0].id], phone: "010-1111-2222", purpose: "과제", standRequest: "조명 스탠드" },
  history: [],
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z"
});
db.reservations.push({
  id: "other-student-reservation",
  type: "equipment",
  userId: "another-student",
  status: "returned",
  fields: { equipmentItemIds: [favoriteEquipment[1].id], purpose: "다른 학생 예약" },
  history: [],
  createdAt: "2099-01-02T00:00:00.000Z",
  updatedAt: "2099-01-02T00:00:00.000Z"
});
const shortcuts = await api({ method: "GET", pathname: "/api/me/reservation-shortcuts", authorization: `Bearer ${token}` });
assert.equal(shortcuts.status, 200);
assert.equal(shortcuts.body.data.favoriteGroups.length, 3);
assert.equal(shortcuts.body.data.recentReservations[0].id, "shortcut-reservation");
assert.equal(shortcuts.body.data.recentReservations[0].fields.standRequest, "조명 스탠드", "shortcut response must retain supported reusable equipment requests");
assert.equal(shortcuts.body.data.recentReservations.some((item) => item.id === "other-student-reservation"), false, "shortcut response must never include another student's reservation");
assert.equal(JSON.stringify(shortcuts.body.data).includes("010-1111-2222"), false, "shortcut response must not expose stored phone numbers");

db.reservations.push(
  { id: "admin-filter-equipment-1015", userId: "user_admin", type: "equipment", status: "approved", fields: { reservedDate: "2099-01-20", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] }, history: [], createdAt: "2099-01-19T00:00:00.000Z", updatedAt: "2099-01-19T00:00:00.000Z" },
  { id: "admin-filter-equipment-1200", userId: "user_admin", type: "equipment", status: "approved", fields: { reservedDate: "2099-01-20", rentalTime: "12:00", equipmentItemIds: ["eq_camera"] }, history: [], createdAt: "2099-01-19T00:00:00.000Z", updatedAt: "2099-01-19T00:00:00.000Z" },
  { id: "admin-filter-equipment-admin-cancelled", userId: "user_admin", type: "equipment", status: "admin_cancelled", fields: { reservedDate: "2099-01-20", rentalTime: "10:15", equipmentItemIds: ["eq_camera"] }, history: [], createdAt: "2099-01-19T00:00:00.000Z", updatedAt: "2099-01-19T00:00:00.000Z" }
);
const filteredReservations = await api({ authorization: `Bearer ${token}`, pathname: "/api/admin/reservations?type=equipment&status=approved&time=10%3A15&pageSize=200" });
assert.equal(filteredReservations.status, 200);
assert.equal(filteredReservations.body.data.items.length, 1, "admin reservation list must support insight time filters");
assert.equal(filteredReservations.body.data.items[0].id, "admin-filter-equipment-1015");
const cancelledReservations = await api({ authorization: `Bearer ${token}`, pathname: "/api/admin/reservations?type=equipment&status=cancelled_or_rejected&pageSize=200" });
assert.equal(cancelledReservations.body.data.items.some((item) => item.id === "admin-filter-equipment-admin-cancelled"), true, "cancellation insight navigation must include administrator-cancelled reservations");

const recommendationEquipment = db.equipment.filter((item) => item.active && item.reservable && item.category === "Body").slice(0, 2);
assert.equal(recommendationEquipment.length, 2, "fixture requires two reservable same-category equipment items");
const conflictingRecommendationFields = {
  reservedDate: "2099-01-05",
  period: "당일",
  rentalTime: "10:15",
  returnTime: "17:10",
  equipmentItemIds: [recommendationEquipment[0].id],
  cameraBagConfirmed: true,
  phone: "010-2222-3333",
  purpose: "추천 검증"
};
db.reservations.push({
  id: "recommendation-conflict",
  type: "equipment",
  userId: "another-student",
  userName: "다른 학생",
  status: "pending_approval",
  fields: { ...conflictingRecommendationFields, phone: "010-9999-9999" },
  history: [],
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z"
});
const recommendations = await api({
  method: "POST",
  pathname: "/api/reservations/recommendations",
  authorization: `Bearer ${token}`,
  body: { type: "equipment", fields: conflictingRecommendationFields }
});
assert.equal(recommendations.status, 200);
assert.equal(recommendations.body.data.alternatives.length <= 3, true);
assert.equal(recommendations.body.data.alternatives.every((item) => item.patch.type === "equipment"), true);
assert.equal(recommendations.body.data.alternatives.some((item) => item.kind === "same_equipment_time"), true);
assert.equal(recommendations.body.data.alternatives.some((item) => item.kind === "alternate_equipment"), true);
assert.equal(JSON.stringify(recommendations.body.data).includes("userName"), false);
assert.equal(JSON.stringify(recommendations.body.data).includes("010-9999-9999"), false);
assert.equal(JSON.stringify(recommendations.body.data).includes("010-2222-3333"), false);

const noCandidateRecommendations = await api({
  method: "POST",
  pathname: "/api/reservations/recommendations",
  authorization: `Bearer ${token}`,
  body: {
    type: "equipment",
    fields: { ...conflictingRecommendationFields, equipmentItemIds: ["missing-equipment"] }
  }
});
assert.equal(noCandidateRecommendations.status, 200);
assert.deepEqual(noCandidateRecommendations.body.data.alternatives, [], "no-candidate requests must return a safe empty list");

console.log("Smart reservation domain checks passed.");

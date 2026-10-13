import assert from "node:assert/strict";
import { handleApiRequest, initialDb } from "../core.mjs";

const db = await initialDb("equipment-operations-password");
const admin = db.users.find((user) => user.role === "admin");
const adminToken = "equipment-operations-admin-token";
db.sessions.push({
  id: "session_equipment_operations_admin",
  token: adminToken,
  userId: admin.id,
  expiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2099-01-01T00:00:00.000Z",
  lastSeenAt: "2099-01-01T00:00:00.000Z"
});

let saveCount = 0;

async function api(method, pathname, body = {}, token = adminToken) {
  return handleApiRequest({
    method,
    pathname,
    authorization: `Bearer ${token}`,
    readText: async () => JSON.stringify(body),
    db,
    saveDb: async () => {
      saveCount += 1;
    },
    slackWebhook: ""
  });
}

db.equipment.forEach((item, index) => {
  item.code = `LEGACY-${String(index + 1).padStart(3, "0")}`;
  item.legacyCodes = [];
  delete item.codeVersion;
  delete item.codeAssignedAt;
  delete item.codeAssignedBy;
});
const beforePreview = JSON.stringify(db.equipment);

const previewResponse = await api(
  "POST",
  "/api/admin/equipment/code-migrations/preview"
);
assert.equal(previewResponse.status, 200);
assert.equal(previewResponse.body.data.codeVersion, 2);
assert.equal(previewResponse.body.data.items.length, db.equipment.length);
assert.equal(
  new Set(previewResponse.body.data.items.map((item) => item.newCode)).size,
  db.equipment.length
);
assert.equal(JSON.stringify(db.equipment), beforePreview);
assert.equal(saveCount, 1, "preview metadata must be persisted exactly once");

const migrationId = previewResponse.body.data.id;
const getPreview = await api(
  "GET",
  `/api/admin/equipment/code-migrations/${migrationId}`
);
assert.equal(getPreview.status, 200);
assert.equal(getPreview.body.data.id, migrationId);

const applyResponse = await api(
  "POST",
  `/api/admin/equipment/code-migrations/${migrationId}/apply`,
  {
    confirmedIds: previewResponse.body.data.items
      .filter((item) => item.warnings.length > 0)
      .map((item) => item.equipmentId)
  }
);
assert.equal(applyResponse.status, 200);
assert.equal(applyResponse.body.data.status, "applied");
assert.equal(db.equipment.every((item) => item.codeVersion === 2), true);
assert.equal(
  new Set(db.equipment.map((item) => item.code)).size,
  db.equipment.length
);
for (const mapping of previewResponse.body.data.items) {
  const item = db.equipment.find(
    (candidate) => candidate.id === mapping.equipmentId
  );
  assert.equal(item.legacyCodes.includes(mapping.oldCode), true);
  assert.equal(item.code, mapping.newCode);
}

const secondApply = await api(
  "POST",
  `/api/admin/equipment/code-migrations/${migrationId}/apply`
);
assert.equal(secondApply.status, 200);
assert.equal(
  secondApply.body.data.appliedAt,
  applyResponse.body.data.appliedAt,
  "migration apply must be idempotent"
);

const stalePreview = await api(
  "POST",
  "/api/admin/equipment/code-migrations/preview"
);
assert.equal(stalePreview.status, 200);
db.equipment[0].updatedAt = "2099-02-01T00:00:00.000Z";
const staleApply = await api(
  "POST",
  `/api/admin/equipment/code-migrations/${stalePreview.body.data.id}/apply`,
  {
    confirmedIds: stalePreview.body.data.items
      .filter((item) => item.warnings.length > 0)
      .map((item) => item.equipmentId)
  }
);
assert.equal(staleApply.status, 409);
assert.match(staleApply.body.error, /미리보기|변경/);

const missingMigration = await api(
  "GET",
  "/api/admin/equipment/code-migrations/missing"
);
assert.equal(missingMigration.status, 404);

const codePreview = await api(
  "POST",
  "/api/admin/equipment/code-preview",
  {
    category: "Drone",
    name: "DJI 매빅2 프로",
    brand: "DJI",
    quantity: 1
  }
);
assert.equal(codePreview.status, 200);
assert.match(
  codePreview.body.data.codes[0],
  /^DRN-DJI-MAVIC2PRO-\d{3}$/
);

const created = await api(
  "POST",
  "/api/admin/equipment",
  {
    category: "Body",
    name: "소니 A7MIII Body",
    brand: "Sony",
    model: "A7MIII",
    functionTags: ["영상 촬영"],
    quantity: 2,
    source: "department",
    status: "가능"
  }
);
assert.equal(created.status, 200);
assert.match(created.body.data[0].code, /^CAM-SNY-A7M3-\d{3}$/);
assert.equal(
  created.body.data[1].code.slice(-3),
  String(Number(created.body.data[0].code.slice(-3)) + 1).padStart(3, "0")
);
assert.equal(created.body.data[0].codeVersion, 2);
assert.deepEqual(created.body.data[0].functionTags, ["영상 촬영"]);

const searchByFunction = await api(
  "GET",
  "/api/admin/equipment/search?q=영상%20촬영"
);
assert.equal(searchByFunction.status, 200);
assert.equal(searchByFunction.body.data[0].id, created.body.data[0].id);

const previousCode = created.body.data[0].code;
const regenerated = await api(
  "POST",
  `/api/admin/equipment/${created.body.data[0].id}/regenerate-code`,
  { confirmation: "코드 재생성" }
);
assert.equal(regenerated.status, 200);
assert.notEqual(regenerated.body.data.code, previousCode);
assert.equal(regenerated.body.data.legacyCodes.includes(previousCode), true);

const imported = await api(
  "POST",
  "/api/admin/equipment/import",
  {
    rows: [{
      category: "Audio",
      name: "RODE 샷건 마이크",
      brand: "Rode",
      function_tags: "인터뷰|동시녹음",
      code: "AUD-OLD-01"
    }]
  }
);
assert.equal(imported.status, 200);
const importedItem = db.equipment.find(
  (item) => item.importBatchId === imported.body.data.id
);
assert.match(importedItem.code, /^AUD-ROD-SHOTGUN-\d{3}$/);
assert.deepEqual(importedItem.legacyCodes, ["AUD-OLD-01"]);
assert.deepEqual(importedItem.functionTags, ["인터뷰", "동시녹음"]);

const searchByLegacyCode = await api(
  "GET",
  "/api/admin/equipment/search?q=AUD-OLD-01"
);
assert.equal(searchByLegacyCode.status, 200);
assert.equal(searchByLegacyCode.body.data[0].id, importedItem.id);

const returnItems = db.equipment.slice(0, 3);
returnItems.forEach((item) => {
  item.status = "가능";
  item.reservable = true;
  item.inquiryOnly = false;
});
const checkedOutReservation = {
  id: "reservation_return_inspection",
  type: "equipment",
  status: "checked_out",
  userId: admin.id,
  fields: {
    reservedDate: "2099-07-29",
    equipmentItemIds: returnItems.map((item) => item.id)
  },
  history: [],
  createdAt: "2099-07-20T00:00:00.000Z",
  updatedAt: "2099-07-20T00:00:00.000Z"
};
db.reservations.push(checkedOutReservation);

const returnInspection = await api(
  "POST",
  `/api/admin/reservations/${checkedOutReservation.id}/return-inspection`,
  {
    inspections: [
      {
        equipmentId: returnItems[0].id,
        outcome: "normal",
        note: ""
      },
      {
        equipmentId: returnItems[1].id,
        outcome: "needs_inspection",
        note: "렌즈 유격 확인"
      },
      {
        equipmentId: returnItems[2].id,
        outcome: "needs_repair",
        note: "전원 불량"
      }
    ]
  }
);
assert.equal(returnInspection.status, 200);
assert.equal(checkedOutReservation.status, "returned");
assert.equal(returnItems[0].status, "가능");
assert.equal(returnItems[1].status, "수리중");
assert.equal(returnItems[2].status, "수리중");
assert.equal(db.equipmentInspections.length, 3);
assert.deepEqual(
  db.equipmentInspections.map((item) => item.outcome),
  ["normal", "needs_inspection", "needs_repair"]
);

const approvedReservation = {
  ...checkedOutReservation,
  id: "reservation_not_checked_out",
  status: "approved",
  history: []
};
db.reservations.push(approvedReservation);
const invalidStatusInspection = await api(
  "POST",
  `/api/admin/reservations/${approvedReservation.id}/return-inspection`,
  {
    inspections: returnItems.map((item) => ({
      equipmentId: item.id,
      outcome: "normal",
      note: ""
    }))
  }
);
assert.equal(invalidStatusInspection.status, 409);

const missingRepairReasonReservation = {
  ...checkedOutReservation,
  id: "reservation_missing_repair_reason",
  status: "checked_out",
  history: []
};
db.reservations.push(missingRepairReasonReservation);
const missingRepairReason = await api(
  "POST",
  `/api/admin/reservations/${missingRepairReasonReservation.id}/return-inspection`,
  {
    inspections: returnItems.map((item, index) => ({
      equipmentId: item.id,
      outcome: index === 0 ? "needs_repair" : "normal",
      note: ""
    }))
  }
);
assert.equal(missingRepairReason.status, 400);
assert.equal(missingRepairReasonReservation.status, "checked_out");

const unrelatedEquipmentInspection = await api(
  "POST",
  `/api/admin/reservations/${missingRepairReasonReservation.id}/return-inspection`,
  {
    inspections: [
      ...returnItems.slice(0, 2).map((item) => ({
        equipmentId: item.id,
        outcome: "normal",
        note: ""
      })),
      {
        equipmentId: importedItem.id,
        outcome: "normal",
        note: ""
      }
    ]
  }
);
assert.equal(unrelatedEquipmentInspection.status, 400);

db.users.push({
  id: "user_equipment_operations_student",
  role: "student",
  username: "equipment-operations-student",
  name: "기자재 테스트 학생",
  approvalStatus: "approved",
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z"
});
db.sessions.push({
  id: "session_equipment_operations_student",
  token: "equipment-operations-student-token",
  userId: "user_equipment_operations_student",
  expiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2099-01-01T00:00:00.000Z",
  lastSeenAt: "2099-01-01T00:00:00.000Z"
});
const studentInspection = await api(
  "POST",
  `/api/admin/reservations/${missingRepairReasonReservation.id}/return-inspection`,
  {
    inspections: returnItems.map((item) => ({
      equipmentId: item.id,
      outcome: "normal",
      note: ""
    }))
  },
  "equipment-operations-student-token"
);
assert.equal(studentInspection.status, 403);

console.log("Equipment operations API checks passed.");

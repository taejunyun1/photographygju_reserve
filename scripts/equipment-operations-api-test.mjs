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

console.log("Equipment operations API checks passed.");

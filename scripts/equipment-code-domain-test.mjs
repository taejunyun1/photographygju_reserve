import assert from "node:assert/strict";
import {
  allocateEquipmentCodes,
  buildEquipmentCodeMigrationPreview,
  equipmentSearchScore,
  inferEquipmentIdentity
} from "../core/equipment-code.mjs";
import { createEquipmentHelpers } from "../core/equipment.mjs";

assert.deepEqual(
  inferEquipmentIdentity({
    category: "Body",
    name: "소니 A7MIII Body",
    brand: "",
    model: ""
  }),
  {
    category: "Body",
    categoryCode: "CAM",
    brand: "Sony",
    brandCode: "SNY",
    model: "A7M3",
    productKey: "A7M3",
    functionTags: [],
    warnings: []
  }
);

assert.deepEqual(
  inferEquipmentIdentity({
    category: "Lens",
    name: "삼양 AF 35mm F2.8 Lens",
    functionTags: "인물|스냅"
  }),
  {
    category: "Lens",
    categoryCode: "LEN",
    brand: "Samyang",
    brandCode: "SAM",
    model: "AF35F28",
    productKey: "AF35F28",
    functionTags: ["인물", "스냅"],
    warnings: []
  }
);

assert.equal(
  inferEquipmentIdentity({
    category: "Drone",
    name: "DJI 매빅2 프로"
  }).productKey,
  "MAVIC2PRO"
);

assert.deepEqual(
  inferEquipmentIdentity({
    category: "Other",
    name: "삼각대"
  }).warnings,
  ["브랜드 정보를 확인하세요."]
);

const allocated = allocateEquipmentCodes({
  items: [
    { code: "CAM-SNY-A7M3-001", active: false },
    { code: "CAM-SNY-A7M3-003", active: true }
  ],
  input: {
    category: "Body",
    brand: "Sony",
    model: "A7M3",
    name: "소니 A7M3"
  },
  quantity: 2
});
assert.deepEqual(allocated.codes, [
  "CAM-SNY-A7M3-004",
  "CAM-SNY-A7M3-005"
]);

const preview = buildEquipmentCodeMigrationPreview([
  {
    id: "lens-samyang",
    category: "Lens",
    name: "삼양 AF 35mm F2.8 Lens",
    code: "LEN-8LENS-01",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "lens-sony",
    category: "Lens",
    name: "소니 FE 24-70mm F2.8 Lens",
    code: "LEN-8LENS-01",
    createdAt: "2026-01-02T00:00:00.000Z"
  },
  {
    id: "drone-air",
    category: "Drone",
    name: "DJI 매빅 에어",
    code: "DRN-DJI-01",
    createdAt: "2026-01-03T00:00:00.000Z"
  },
  {
    id: "drone-spark",
    category: "Drone",
    name: "DJI 스파크",
    code: "DRN-DJI-01",
    createdAt: "2026-01-04T00:00:00.000Z"
  }
]);
assert.equal(preview.codeVersion, 2);
assert.equal(new Set(preview.items.map((item) => item.newCode)).size, 4);
assert.equal(preview.items.every((item) => item.oldCode !== item.newCode), true);
assert.equal(preview.fingerprint.includes("lens-samyang|LEN-8LENS-01"), true);

assert.equal(
  equipmentSearchScore(
    {
      code: "CAM-SNY-A7M3-001",
      legacyCodes: ["CAM-A7M3-01"],
      brand: "Sony",
      model: "A7M3",
      functionTags: ["영상 촬영"]
    },
    "CAM-SNY-A7M3-001"
  ),
  400
);
assert.equal(
  equipmentSearchScore(
    {
      code: "CAM-SNY-A7M3-001",
      legacyCodes: ["CAM-A7M3-01"],
      brand: "Sony",
      model: "A7M3",
      functionTags: ["영상 촬영"]
    },
    "CAM-A7M3-01"
  ),
  350
);
assert.equal(
  equipmentSearchScore(
    {
      code: "CAM-SNY-A7M3-001",
      brand: "Sony",
      model: "A7M3",
      functionTags: ["영상 촬영"]
    },
    "영상 촬영"
  ),
  100
);

let equipmentSequence = 0;
const equipmentHelpers = createEquipmentHelpers({
  seedEquipmentGroups: [
    ["department", "Body", "캐논 750D", 2, true, ""],
    ["fantasy_lab", "Body", "캐논 750D", 1, false, "문의"]
  ],
  defaultSettings: {
    equipmentFacility: "극기관",
    equipmentHighValueCategories: [],
    equipmentBagKeywords: []
  },
  id: () => `eq-${++equipmentSequence}`,
  nowIso: () => "2026-07-29T00:00:00.000Z",
  addDaysToDateKey: (key) => key
});
const seededEquipment = equipmentHelpers.seedEquipment();
assert.deepEqual(
  seededEquipment.map((item) => item.code),
  [
    "CAM-CAN-750D-001",
    "CAM-CAN-750D-002",
    "CAM-CAN-750D-003"
  ]
);
assert.equal(seededEquipment.every((item) => item.codeVersion === 2), true);
assert.equal(seededEquipment.every((item) => item.brand === "Canon"), true);
assert.equal(seededEquipment[2].reservable, false);

console.log("Equipment code domain checks passed.");

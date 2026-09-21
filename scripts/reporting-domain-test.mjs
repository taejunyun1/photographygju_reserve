import assert from "node:assert/strict";

import { getReportRequirement, validateReportDraft } from "../core/reporting.mjs";

const base = {
  settings: { studioReportDeadlineHours: 48, equipmentReportDeadlineHours: 48 },
  reports: []
};

const approvedRental = { id: "r-approved", type: "equipment", status: "approved", fields: { reservedDate: "2026-09-21" } };
assert.equal(getReportRequirement(base, approvedRental, new Date("2026-09-21T12:00:00+09:00")).required, false);

const checkedOutRental = {
  id: "r-checked-out",
  type: "equipment",
  status: "checked_out",
  fields: { reservedDate: "2026-09-21", period: "당일", returnTime: "17:00" },
  timing: { startAt: "2026-09-21T01:15:00.000Z", endAt: "2026-09-21T08:00:00.000Z" }
};
assert.equal(getReportRequirement(base, checkedOutRental, new Date("2026-09-21T05:00:00.000Z")).canDraft, true);
assert.equal(getReportRequirement(base, checkedOutRental, new Date("2026-09-21T05:00:00.000Z")).canSubmit, false);
assert.equal(getReportRequirement(base, checkedOutRental, new Date("2026-09-21T09:00:00.000Z")).canSubmit, true);

const cancelled = { ...checkedOutRental, id: "r-cancelled", status: "cancelled" };
assert.equal(getReportRequirement(base, cancelled, new Date("2026-09-22T00:00:00Z")).required, false);

const returned = { ...checkedOutRental, id: "r-returned", status: "returned", history: [{ action: "returned", at: "2026-09-21T08:30:00.000Z" }] };
assert.equal(getReportRequirement(base, returned, new Date("2026-09-21T09:00:00Z")).required, true);

assert.throws(() => validateReportDraft({ reservation: returned, type: "equipment", body: { equipmentDamageAnswer: "yes", returnReadyConfirmed: true, equipmentDamageDescription: "렌즈 흠집" }, photos: [] }), /사진/);
assert.throws(() => validateReportDraft({ reservation: returned, type: "equipment", body: { equipmentDamageAnswer: "no", returnReadyConfirmed: true }, photos: [{ size: 1, mimeType: "image/gif" }] }), /JPG/);

const valid = validateReportDraft({
  reservation: returned,
  type: "equipment",
  body: { equipmentDamageAnswer: "yes", returnReadyConfirmed: true, equipmentDamageDescription: "렌즈 흠집" },
  photos: [{ id: "p1", category: "equipment_damage", size: 100, mimeType: "image/jpeg" }]
});
assert.equal(valid.checks.equipment.answer, "yes");
assert.equal(valid.damageFound, true);

const studio = {
  id: "r-studio",
  type: "studio",
  status: "approved",
  fields: { reservedDate: "2026-09-21" },
  timing: { startAt: "2026-09-21T01:00:00.000Z", endAt: "2026-09-21T03:00:00.000Z" }
};
assert.throws(() => validateReportDraft({
  reservation: studio,
  type: "studio",
  body: { actualTime: "10:00-12:00", participants: "2", cleanupConfirmed: true, studioDamageAnswer: "no" },
  photos: []
}), /스튜디오와 대여 기자재/);
const validStudio = validateReportDraft({
  reservation: studio,
  type: "studio",
  body: {
    actualTime: "10:00-12:00",
    participants: "2",
    cleanupConfirmed: true,
    studioDamageAnswer: "no",
    equipmentDamageAnswer: "yes",
    equipmentDamageDescription: "삼각대 잠금장치 점검 필요"
  },
  photos: [{ id: "p2", category: "equipment_damage", size: 100, mimeType: "image/jpeg" }]
});
assert.equal(validStudio.checks.studio.answer, "no");
assert.equal(validStudio.checks.equipment.answer, "yes");

console.log("Report policy checks passed.");

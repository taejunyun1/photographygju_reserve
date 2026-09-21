import assert from "node:assert/strict";

import { initialDb, handleApiRequest } from "../core.mjs";
import { getReportRequirement } from "../core/reporting.mjs";
import { syncReportToDrive } from "../integrations/report-drive-jobs.mjs";

const db = await initialDb("reporting-real-api-test");
db.users.push({ id: "qa-student", role: "student", approvalStatus: "approved", name: "QA 학생", studentStatus: "재학생" });
db.sessions.push({ id: "qa-session", token: "qa-token", userId: "qa-student", expiresAt: "2099-12-31T00:00:00Z" });
const rental = {
  id: "qa-rental",
  userId: "qa-student",
  type: "equipment",
  status: "returned",
  fields: { reservedDate: "2026-09-01", rentalTime: "10:00", returnTime: "17:00", period: "당일", equipmentItemIds: [], reportPolicyVersion: 2 },
  history: [{ action: "returned", at: "2026-09-01T08:00:00.000Z" }]
};
db.reservations.push(rental);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const api = (method, pathname, body = {}, bytes) => handleApiRequest({
  method,
  pathname,
  authorization: "Bearer qa-token",
  readText: async () => JSON.stringify(body),
  readBytes: async () => bytes,
  db,
  saveDb: async () => {},
  slackWebhook: ""
});

const draftResponse = await api("POST", "/api/reports/drafts", { reservationId: rental.id });
assert.equal(draftResponse.status, 200);
const draft = draftResponse.body.data;
let firstPhoto;
for (let index = 0; index < 5; index += 1) {
  const reserved = await api("POST", `/api/reports/drafts/${draft.id}/photos`, {
    clientPhotoId: `photo-${index}`,
    category: "equipment_damage",
    mimeType: "image/png",
    size: png.length
  });
  assert.equal(reserved.status, 200);
  firstPhoto ||= reserved.body.data;
  const uploaded = await api("POST", `/api/reports/drafts/${draft.id}/photos/${reserved.body.data.id}/content`, {}, png);
  assert.equal(uploaded.status, 200);
}

const reloaded = await api("POST", "/api/reports/drafts", { reservationId: rental.id });
assert.equal(reloaded.body.data.photos.length, 5, "초안 재조회 시 사진 5장이 유지되어야 함");

const patched = await api("PATCH", `/api/reports/drafts/${draft.id}`, {
  revision: 0,
  fields: { equipmentDamageAnswer: "yes", equipmentDamageDescription: "QA 파손", returnReadyConfirmed: true }
});
assert.equal(patched.status, 200);
const submitted = await api("POST", `/api/reports/drafts/${draft.id}/submit`, { revision: patched.body.data.revision, submissionKey: "qa-submit" });
assert.equal(submitted.status, 200);
const retry = await api("POST", `/api/reports/drafts/${draft.id}/submit`, { revision: patched.body.data.revision, submissionKey: "qa-submit" });
assert.equal(retry.status, 200, "동일 제출 키 재시도는 기존 결과를 반환해야 함");
const reportDetail = await api("GET", `/api/reports/${submitted.body.data.id}`);
assert.equal(reportDetail.status, 200, "학생은 제출 후 보고서 상세를 다시 조회할 수 있어야 함");
assert.equal(reportDetail.body.data.photos.length, 5, "제출 상세에 첨부 사진 메타데이터가 포함되어야 함");
const photoContent = await api("GET", `/api/reports/${submitted.body.data.id}/photos/${firstPhoto.id}/content`);
assert.equal(photoContent.status, 200, "학생은 제출 사진을 다시 열람할 수 있어야 함");
const deleted = await api("DELETE", `/api/reports/drafts/${draft.id}/photos/${firstPhoto.id}`);
assert.equal(deleted.status, 409, "제출 후 사진 삭제는 차단해야 함");

const futureStudio = { id: "future-studio", type: "studio", status: "approved", fields: { reservedDate: "2099-01-01", timeSlots: ["10:00-12:00"] } };
assert.equal(getReportRequirement(db, futureStudio, new Date("2026-09-21T00:00:00Z")).required, false, "미래 스튜디오는 보고서 대상이 아님");
const oldReturned = { ...rental, id: "old-returned", fields: { ...rental.fields, reportPolicyVersion: undefined } };
assert.equal(getReportRequirement(db, oldReturned, new Date("2026-09-21T00:00:00Z")).required, false, "활성화 전 반납 건은 소급 대상이 아님");

let driveCalls = 0;
const client = {
  ensureFolder: async () => ({ id: "folder" }),
  uploadFile: async ({ fileId, name }) => {
    driveCalls += 1;
    if (driveCalls === 2) throw new Error("simulated timeout");
    return { id: fileId || `${name}-${driveCalls}` };
  }
};
const driveReport = { id: "drive-report", type: "equipment", reservationId: rental.id, reservationSnapshot: { fields: rental.fields }, fields: {}, drive: {} };
await assert.rejects(() => syncReportToDrive({ client, connection: { id: "connection", folderId: "root" }, report: driveReport }));
assert.ok(driveReport.drive.jsonFileId, "Drive JSON ID는 부분 성공 후에도 보존되어야 함");

console.log("Real report API checks passed.");

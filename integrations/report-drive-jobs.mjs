function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function semesterFolder(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-/);
  if (!match) return "날짜 미상";
  const year = Number(match[1]);
  const month = Number(match[2]);
  return `${month >= 3 && month <= 8 ? year : month >= 9 ? year : year - 1}년 ${month >= 3 && month <= 8 ? 1 : 2}학기`;
}

function safeName(value, fallback = "보고서") {
  return String(value || fallback).replace(/[\\/:*?"<>|\n\r]/g, " ").trim().slice(0, 120) || fallback;
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

export async function syncReportToDrive({ client, connection, report, attachments = [], now = new Date() }) {
  if (!client || !connection?.folderId) throw Object.assign(new Error("보고서 Google Drive 연결이 없습니다."), { code: "not_connected" });
  const snapshot = report.reservationSnapshot || {};
  const dateKey = snapshot.fields?.reservedDate || now.toISOString().slice(0, 10);
  const typeLabel = report.type === "equipment" ? "기자재" : "스튜디오";
  const semester = await client.ensureFolder(semesterFolder(dateKey), connection.folderId);
  const typeFolder = await client.ensureFolder(typeLabel, semester.id);
  const reportFolder = await client.ensureFolder(`${safeName(dateKey)}_${safeName(report.reservationId)}`, typeFolder.id);
  const reportJson = await client.uploadFile({
    name: "보고서.json",
    mimeType: "application/json",
    parents: [reportFolder.id],
    fileId: report.drive?.jsonFileId || "",
    body: jsonBytes({ ...report, drive: undefined, htmlSnapshot: undefined })
  });
  const reportHtml = await client.uploadFile({
    name: "보고서.html",
    mimeType: "text/html",
    parents: [reportFolder.id],
    fileId: report.drive?.htmlFileId || "",
    body: new TextEncoder().encode(`<!doctype html><meta charset="utf-8"><title>GJU 사용 보고서</title>${report.htmlSnapshot || ""}`)
  });
  const uploadedPhotos = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const photo = attachments[index];
    if (!photo?.data) continue;
    const result = await client.uploadFile({
      name: `${String(index + 1).padStart(2, "0")}_${photo.category || "사용상태"}.${photo.mimeType === "image/png" ? "png" : "jpg"}`,
      mimeType: photo.mimeType,
      parents: [reportFolder.id],
      fileId: photo.driveFileId || "",
      body: base64ToBytes(photo.data)
    });
    photo.driveFileId = result.id;
    photo.driveWebViewLink = result.webViewLink || "";
    photo.status = "synced";
    uploadedPhotos.push(photo.id);
  }
  report.drive = {
    ...(report.drive || {}),
    status: "synced",
    connectionId: connection.id,
    folderId: reportFolder.id,
    folderUrl: reportFolder.webViewLink || "",
    htmlFileId: reportHtml.id,
    jsonFileId: reportJson.id,
    lastSyncedAt: now.toISOString(),
    errorCode: null,
    uploadedPhotos
  };
  connection.lastSyncedAt = now.toISOString();
  return report;
}


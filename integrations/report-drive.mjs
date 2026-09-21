const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function keyBytes(secret) {
  const bytes = new TextEncoder().encode(String(secret || ""));
  const output = new Uint8Array(32);
  output.set(bytes.subarray(0, 32));
  return output;
}

export async function encryptRefreshToken(token, secret) {
  if (!token || !secret) throw new Error("보고서 Drive 암호화 키가 설정되지 않았습니다.");
  const key = await crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(result);
}

export async function decryptRefreshToken(payload, secret) {
  if (!payload || !secret) return "";
  const bytes = base64ToBytes(payload);
  const key = await crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(decrypted);
}

export function buildReportDriveConnectUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) throw Object.assign(new Error("Google Drive OAuth 환경변수가 설정되지 않았습니다."), { status: 503 });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeReportDriveCode({ fetchImpl = fetch, clientId, clientSecret, code, redirectUri }) {
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw Object.assign(new Error("Google Drive 연결 인증에 실패했습니다."), { status: 502, code: body.error || "oauth_exchange_failed" });
  return body;
}

export async function refreshReportDriveAccessToken({ fetchImpl = fetch, clientId, clientSecret, refreshToken }) {
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw Object.assign(new Error("Google Drive 재인증이 필요합니다."), { status: 401, code: body.error || "refresh_failed" });
  return body;
}

function driveUrl(id) {
  return id ? `https://drive.google.com/drive/folders/${encodeURIComponent(id)}` : "";
}

export function createReportDriveClient({ fetchImpl = fetch, accessToken }) {
  async function request(path, options = {}) {
    const response = await fetchImpl(`${DRIVE_API}${path}`, {
      ...options,
      headers: { authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || "Google Drive 요청에 실패했습니다."), { status: response.status, code: body?.error?.errors?.[0]?.reason || "drive_error" });
    return body;
  }

  return {
    async about() { return request("/about?fields=user(displayName,emailAddress),storageQuota"); },
    async findFolder(name, parentId = "root") {
      const q = [`name = '${String(name).replaceAll("'", "\\'")}'`, "mimeType = 'application/vnd.google-apps.folder'", "trashed = false", `'${parentId}' in parents`].join(" and ");
      const result = await request(`/files?spaces=drive&fields=files(id,name,webViewLink)&pageSize=10&q=${encodeURIComponent(q)}`);
      return result.files?.[0] || null;
    },
    async createFolder(name, parentId = "root") {
      return request("/files?fields=id,name,webViewLink", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }) });
    },
    async ensureFolder(name = "GJU 사용보고서", parentId = "root") {
      return (await this.findFolder(name, parentId)) || this.createFolder(name, parentId);
    },
    async verifyFolder(folderId) {
      return request(`/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink,capabilities(canAddChildren)`);
    },
    async uploadFile({ name, mimeType, body, parents = [], fileId = "" }) {
      const boundary = `gju-report-${crypto.randomUUID()}`;
      const metadata = JSON.stringify({ name, mimeType, ...(parents.length ? { parents } : {}) });
      const bytes = body instanceof Uint8Array ? body : new TextEncoder().encode(String(body || ""));
      const preamble = new TextEncoder().encode(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`);
      const ending = new TextEncoder().encode(`\r\n--${boundary}--`);
      const payload = new Uint8Array(preamble.length + bytes.length + ending.length);
      payload.set(preamble);
      payload.set(bytes, preamble.length);
      payload.set(ending, preamble.length + bytes.length);
      const target = fileId ? `${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}` : DRIVE_UPLOAD_API;
      const response = await fetchImpl(`${target}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`, {
        method: fileId ? "PATCH" : "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": `multipart/related; boundary=${boundary}` },
        body: payload
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(result?.error?.message || "Google Drive 파일 업로드에 실패했습니다."), { status: response.status, code: result?.error?.errors?.[0]?.reason || "drive_upload_failed" });
      return result;
    },
    async createFileId() {
      const result = await request("/files?fields=id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: ".gju-report-placeholder", mimeType: "application/octet-stream" }) });
      return result.id;
    },
    folderUrl: driveUrl
  };
}

export function reportDrivePublicConnection(connection) {
  if (!connection) return { status: "disconnected", accountEmail: "", folderId: "", folderName: "", folderUrl: "", lastVerifiedAt: null, lastSyncedAt: null, errorCode: null };
  return {
    id: connection.id,
    status: connection.status || "disconnected",
    accountEmail: connection.accountEmail || "",
    folderId: connection.folderId || "",
    folderName: connection.folderName || "GJU 사용보고서",
    folderUrl: connection.folderUrl || driveUrl(connection.folderId),
    lastVerifiedAt: connection.lastVerifiedAt || null,
    lastSyncedAt: connection.lastSyncedAt || null,
    errorCode: connection.errorCode || null,
    updatedAt: connection.updatedAt || null
  };
}


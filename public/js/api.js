import { state } from "./state.js?v=20260614-fasttoast1";

export async function api(path, options = {}) {
  const apiBase = String(window.GJU_API_BASE || "").replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${apiBase}${path}`;
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다." }));
  if (!payload.ok) throw new Error(payload.error || "요청 실패");
  return payload.data;
}

import { state } from "./state.js?v=20260703-react-astryx-admin";

function setLoading(delta) {
  state.loadingCount = Math.max(0, Number(state.loadingCount || 0) + delta);
  document.dispatchEvent(new CustomEvent("gju-loading-change"));
}

export async function api(path, options = {}) {
  const { loading = true, ...requestOptions } = options;
  const apiBase = String(window.GJU_API_BASE || "").replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${apiBase}${path}`;
  const headers = {
    "content-type": "application/json",
    ...(requestOptions.headers || {})
  };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  if (loading) setLoading(1);
  try {
    const response = await fetch(url, {
      ...requestOptions,
      headers,
      body: requestOptions.body && typeof requestOptions.body !== "string" ? JSON.stringify(requestOptions.body) : requestOptions.body
    });
    const payload = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다." }));
    if (!payload.ok) throw new Error(payload.error || "요청 실패");
    return payload.data;
  } finally {
    if (loading) setLoading(-1);
  }
}

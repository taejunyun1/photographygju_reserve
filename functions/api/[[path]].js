const DEFAULT_WORKER_API_BASE = "https://photographygju-reserve.taejunyun.workers.dev";

function targetUrl(request, env) {
  const source = new URL(request.url);
  const base = String(env.GJU_WORKER_API_BASE || DEFAULT_WORKER_API_BASE).replace(/\/$/, "");
  return `${base}${source.pathname}${source.search}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method || "GET";
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", new URL(request.url).host);
  headers.set("x-forwarded-proto", "https");
  const init = {
    method,
    headers,
    redirect: "manual"
  };
  if (!["GET", "HEAD"].includes(method)) init.body = request.body;
  return fetch(targetUrl(request, env), init);
}

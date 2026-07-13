export async function parseBody(readText) {
  const text = await readText();
  if (!text) return {};
  if (text.length > 1024 * 1024) throw Object.assign(new Error("요청 본문이 너무 큽니다."), { status: 413 });
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("JSON 형식이 올바르지 않습니다."), { status: 400 });
  }
}

export function ok(data = null) {
  return { status: 200, body: { ok: true, data } };
}

export function fail(error) {
  return { status: error.status || 500, body: { ok: false, error: error.message || "서버 오류가 발생했습니다." } };
}

export function assertRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw Object.assign(new Error(`${field} 값이 필요합니다.`), { status: 400 });
    }
  }
}

export function routeKey(method, pathname) {
  return `${method} ${pathname}`;
}

export function requestPath(ctx) {
  let pathname = ctx.pathname || "/";
  let searchParams = ctx.searchParams || new URLSearchParams();
  if (pathname.includes("?")) {
    const parsed = new URL(pathname, "https://gju-reserve.local");
    pathname = parsed.pathname;
    if (!ctx.searchParams) searchParams = parsed.searchParams;
  }
  return { pathname, searchParams };
}

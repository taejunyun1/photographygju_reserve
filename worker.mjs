import { DurableObject } from "cloudflare:workers";
import { cleanupExpiredData, initialDb, normalizeDb, capLogs, handleApiRequest } from "./core.mjs";
import { createSqlAppStore } from "./storage-sql.mjs";
import { ensureSqlStoreInitialized } from "./worker-storage.mjs";

// Browser JS may only read API responses from these origins. The API itself is
// bearer-token authenticated (no cookies), so this is defense-in-depth.
const PRODUCTION_ORIGIN = "https://gjupreserve.com";
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "https://www.gjupreserve.com",
  "https://photographygju.dothome.co.kr",
  "https://admin.photographygju.dothome.co.kr",
  "https://photographygju-reserve.taejunyun.workers.dev",
  "capacitor://localhost",
  "ionic://localhost"
]);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://photographygju-reserve.taejunyun.workers.dev",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests"
].join("; ");

const SECURITY_HEADERS = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

function corsHeadersFor(origin) {
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "access-control-allow-origin": allowed ? origin : PRODUCTION_ORIGIN,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function withSecurityHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonResponse(body, status, headers = {}) {
  return withSecurityHeaders(new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    }
  }));
}

export class GjuReserveDb extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.db = null;
    this.store = createSqlAppStore(this.ctx.storage.sql, {
      transactionSync: (callback) => this.ctx.storage.transactionSync(callback),
      initialDb: async () => {
        if (!this.env.ADMIN_PASSWORD) {
          throw Object.assign(new Error("ADMIN_PASSWORD must be configured before initializing production data."), { status: 500 });
        }
        return initialDb(this.env.ADMIN_PASSWORD);
      }
    });
    this.initialized = false;
  }

  async ensureInitialized() {
    if (this.initialized) return;
    await ensureSqlStoreInitialized({
      storage: this.ctx.storage,
      store: this.store
    });
    this.initialized = true;
  }

  async loadDb() {
    await this.ensureInitialized();
    if (!this.db) this.db = await this.store.loadDb();
    const beforeStatuses = JSON.stringify((this.db.reservations || []).map((item) => [item.id, item.type, item.status]));
    normalizeDb(this.db);
    const afterStatuses = JSON.stringify((this.db.reservations || []).map((item) => [item.id, item.type, item.status]));
    if (beforeStatuses !== afterStatuses) await this.saveDb();
    return this.db;
  }

  async saveDb() {
    capLogs(this.db);
    await this.store.saveDb(this.db);
  }

  async fetch(request) {
    const cors = corsHeadersFor(request.headers.get("origin"));
    if (request.method === "OPTIONS") {
      return withSecurityHeaders(new Response(null, { status: 204, headers: cors }));
    }
    const url = new URL(request.url);
    // NOTE: a production DB reset endpoint was intentionally removed.
    // Guardrail: the production database is never reset/initialized in place.
    if (url.pathname === "/api/internal/cleanup") {
      const secret = this.env.INTERNAL_CRON_SECRET || "";
      if (!secret || request.headers.get("x-internal-cron-secret") !== secret) {
        return jsonResponse({ ok: false, error: "Forbidden" }, 403, cors);
      }
      let db;
      try {
        db = await this.loadDb();
      } catch (error) {
        return jsonResponse({ ok: false, error: error.message || "Server configuration error" }, error.status || 500, cors);
      }
      const summary = cleanupExpiredData(db, new Date(), "cron");
      if (summary.changed) await this.saveDb();
      return jsonResponse({ ok: true, data: summary }, 200, cors);
    }
    let db;
    try {
      db = await this.loadDb();
    } catch (error) {
      return jsonResponse({ ok: false, error: error.message || "Server configuration error" }, error.status || 500, cors);
    }
    const result = await handleApiRequest({
      method: request.method || "GET",
      pathname: url.pathname,
      searchParams: url.searchParams,
      authorization: request.headers.get("authorization") || "",
      readText: () => request.text(),
      db,
      saveDb: () => this.saveDb(),
      slackWebhook: this.env.SLACK_WEBHOOK_URL,
      clientIp: request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        "",
      userAgent: request.headers.get("user-agent") || ""
    });
    return jsonResponse(result.body, result.status, cors);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const stub = env.GJU_RESERVE_DB.getByName("global");
      return stub.fetch(request);
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },

  async scheduled(_event, env, ctx) {
    if (!env.INTERNAL_CRON_SECRET) {
      console.warn("INTERNAL_CRON_SECRET is not configured; cleanup skipped.");
      return;
    }
    const stub = env.GJU_RESERVE_DB.getByName("global");
    ctx.waitUntil(stub.fetch("https://gju-reserve.internal/api/internal/cleanup", {
      method: "POST",
      headers: { "x-internal-cron-secret": env.INTERNAL_CRON_SECRET }
    }));
  }
};

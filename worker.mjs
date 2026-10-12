import { DurableObject } from "cloudflare:workers";
import { createMutationQueue } from "./core/mutation-queue.mjs";
import { runEquipmentOverdueSweep, equipmentOverdueCronPath, applyEquipmentOverdueActivation } from "./core/equipment-overdue-scheduler.mjs";
import { cleanupExpiredData, initialDb, normalizeDb, capLogs, handleApiRequest } from "./core.mjs";
import { createSqlAppStore } from "./storage-sql.mjs";
import { ensureSqlStoreInitialized } from "./worker-storage.mjs";

// Browser JS may only read API responses from these origins. The API itself is
// bearer-token authenticated (no cookies), so this is defense-in-depth.
const PRODUCTION_ORIGIN = "https://gjureserve.co.kr";
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "https://www.gjureserve.co.kr",
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
  "img-src 'self' data: blob:",
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
    this.mutationQueue = createMutationQueue();
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
    return this.mutationQueue.run(async () => {
      try {
        const response = await this.fetchSerialized(request);
        // API errors must not leak an uncommitted cached mutation into a later read.
        if (response.status >= 400) this.db = null;
        return response;
      } catch (error) {
        this.db = null;
        throw error;
      }
    });
  }

  async fetchSerialized(request) {
    const cors = corsHeadersFor(request.headers.get("origin"));
    if (request.method === "OPTIONS") {
      return withSecurityHeaders(new Response(null, { status: 204, headers: cors }));
    }
    const url = new URL(request.url);
    // NOTE: a production DB reset endpoint was intentionally removed.
    // Guardrail: the production database is never reset/initialized in place.
    if (["/api/internal/cleanup", "/api/internal/equipment-overdue"].includes(url.pathname)) {
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405, cors);
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
      const snapshot = structuredClone(db);
      try {
        if (url.pathname.endsWith("equipment-overdue")) {
          applyEquipmentOverdueActivation(db, this.env.EQUIPMENT_OVERDUE_ACTIVATION_AT, new Date());
        }
        const summary = url.pathname.endsWith("equipment-overdue")
          ? runEquipmentOverdueSweep(db, new Date())
          : cleanupExpiredData(db, new Date(), "cron");
        if (summary.changed) await this.saveDb();
        return jsonResponse({ ok: true, data: summary }, 200, cors);
      } catch (error) {
        this.db = snapshot;
        if (url.pathname.endsWith("equipment-overdue")) {
          snapshot.meta ||= {};
          snapshot.meta.equipmentOverdueSweep = {
            ...(snapshot.meta.equipmentOverdueSweep || {}),
            lastRunAt: new Date().toISOString(), status: "failed",
            error: "자동 경고 점검에 실패했습니다. 서버 로그를 확인하세요."
          };
          try { await this.saveDb(); } catch { this.db = null; }
          console.error(JSON.stringify({ event: "equipment_overdue_sweep_failed", message: error.message }));
        }
        return jsonResponse({ ok: false, error: "정기 작업 저장에 실패했습니다." }, 503, cors);
      }
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
      readBytes: async (maxBytes = 3 * 1024 * 1024 + 1) => {
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > maxBytes) throw Object.assign(new Error("사진 파일이 너무 큽니다."), { status: 413 });
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > maxBytes) throw Object.assign(new Error("사진 파일이 너무 큽니다."), { status: 413 });
        return bytes;
      },
      db,
      saveDb: () => this.saveDb(),
      slackWebhook: this.env.SLACK_WEBHOOK_URL,
      clientIp: request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        "",
      userAgent: request.headers.get("user-agent") || "",
      reportDriveConfig: {
        clientId: this.env.REPORT_DRIVE_CLIENT_ID,
        clientSecret: this.env.REPORT_DRIVE_CLIENT_SECRET,
        tokenEncryptionKey: this.env.REPORT_DRIVE_TOKEN_ENCRYPTION_KEY,
        redirectUri: this.env.REPORT_DRIVE_REDIRECT_URI || "https://gjureserve.co.kr/api/oauth/report-drive/callback"
      }
    });
    return jsonResponse(result.body, result.status, cors);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/version") {
      const releaseResponse = await env.ASSETS.fetch(new Request(new URL("/release.json", request.url), { headers: { "cache-control": "no-cache" } }));
      if (!releaseResponse.ok) return jsonResponse({ ok: false, error: "Release metadata unavailable" }, 503);
      const release = await releaseResponse.json();
      return jsonResponse({ ok: true, data: { commit: release.commit, target: release.target, generatedAt: release.generatedAt } }, 200);
    }
    if (url.pathname.startsWith("/api/")) {
      const stub = env.GJU_RESERVE_DB.getByName("global");
      return stub.fetch(request);
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },

  async scheduled(event, env, ctx) {
    const pathname = equipmentOverdueCronPath(event.cron);
    if (!pathname) return;
    if (!env.INTERNAL_CRON_SECRET) {
      console.error(JSON.stringify({ event: "scheduled_job_skipped", cron: event.cron, reason: "internal_secret_missing" }));
      return;
    }
    const stub = env.GJU_RESERVE_DB.getByName("global");
    ctx.waitUntil((async () => {
      const response = await stub.fetch(`https://gju-reserve.internal${pathname}`, {
        method: "POST",
        headers: { "x-internal-cron-secret": env.INTERNAL_CRON_SECRET }
      });
      if (!response.ok) throw new Error(`Scheduled job ${event.cron} failed: ${response.status}`);
    })());
  }
};

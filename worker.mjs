import { DurableObject } from "cloudflare:workers";
import { initialDb, normalizeDb, capLogs, handleApiRequest } from "./core.mjs";

// Browser JS may only read API responses from these origins. The API itself is
// bearer-token authenticated (no cookies), so this is defense-in-depth.
const ALLOWED_ORIGINS = new Set([
  "https://photographygju.dothome.co.kr",
  "https://admin.photographygju.dothome.co.kr",
  "https://photographygju-reserve.taejunyun.workers.dev"
]);

function corsHeadersFor(origin) {
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "access-control-allow-origin": allowed ? origin : "https://photographygju.dothome.co.kr",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

export class GjuReserveDb extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.db = null;
  }

  async loadDb() {
    if (!this.db) {
      this.db = await this.ctx.storage.get("db");
      if (!this.db) {
        this.db = await initialDb(this.env.ADMIN_PASSWORD || "admin");
        await this.saveDb();
      }
    }
    normalizeDb(this.db);
    return this.db;
  }

  async saveDb() {
    capLogs(this.db);
    await this.ctx.storage.put("db", this.db);
  }

  async fetch(request) {
    const cors = corsHeadersFor(request.headers.get("origin"));
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    const url = new URL(request.url);
    const db = await this.loadDb();
    const result = await handleApiRequest({
      method: request.method || "GET",
      pathname: url.pathname,
      authorization: request.headers.get("authorization") || "",
      readText: () => request.text(),
      db,
      saveDb: () => this.saveDb(),
      slackWebhook: this.env.SLACK_WEBHOOK_URL
    });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...cors, "content-type": "application/json; charset=utf-8" }
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const stub = env.GJU_RESERVE_DB.getByName("global");
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

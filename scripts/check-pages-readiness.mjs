import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const proxy = fs.readFileSync("functions/api/[[path]].js", "utf8");
const publicConfig = fs.readFileSync("public/config.js", "utf8");

assert.equal(pkg.scripts["pages:build"], "npm run build");
assert.equal(pkg.scripts["pages:preview"], "npm run pages:build && wrangler pages dev dist");
assert.equal(pkg.scripts["pages:deploy"], "npm run pages:build && wrangler pages deploy dist --project-name gju-reserve");
assert.equal(pkg.scripts["pages:check"], "node scripts/check-pages-readiness.mjs");
assert(proxy.includes("GJU_WORKER_API_BASE"), "Pages proxy must support configurable Worker API base");
assert(proxy.includes("https://photographygju-reserve.taejunyun.workers.dev"), "Pages proxy must keep current Worker fallback");
assert(proxy.includes("export async function onRequest"), "Pages proxy must export onRequest");
assert(publicConfig.includes('window.GJU_API_BASE = ""'), "web frontend must keep same-origin API base for Pages/Dothome");

console.log("Cloudflare Pages readiness checks passed.");

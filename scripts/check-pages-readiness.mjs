import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const proxy = fs.readFileSync("functions/api/[[path]].js", "utf8");
const publicConfig = fs.readFileSync("public/config.js", "utf8");
const pagesConfig = fs.readFileSync("wrangler.jsonc", "utf8");
const workerConfig = fs.readFileSync("wrangler.worker.jsonc", "utf8");

assert.equal(pkg.scripts["pages:build"], "npm run build");
assert.equal(pkg.scripts["pages:preview"], "npm run pages:build && wrangler pages dev dist");
assert.equal(pkg.scripts["pages:deploy"], "npm run pages:build && wrangler pages deploy dist --project-name gju-reserve");
assert.equal(pkg.scripts["pages:check"], "node scripts/check-pages-readiness.mjs");
assert.equal(pkg.scripts["deploy"], "wrangler deploy --config wrangler.worker.jsonc");
assert.equal(pkg.scripts["preview"], "wrangler dev --config wrangler.worker.jsonc");
assert(pagesConfig.includes('"name": "gju-reserve"'), "root wrangler.jsonc must target the Pages project");
assert(pagesConfig.includes('"pages_build_output_dir": "./dist"'), "root wrangler.jsonc must define Pages output directory");
assert(pagesConfig.includes('"GJU_WORKER_API_BASE": "https://photographygju-reserve.taejunyun.workers.dev"'), "Pages config must pin the Worker API base");
assert(!pagesConfig.includes('"main"'), "Pages config must not include Worker-only main entry");
assert(!pagesConfig.includes('"assets"'), "Pages config must not include Worker assets bindings");
assert(workerConfig.includes('"name": "photographygju-reserve"'), "Worker config must target the production Worker");
assert(workerConfig.includes('"main": "./worker.mjs"'), "Worker config must keep the Worker entry point");
assert(workerConfig.includes('"binding": "ASSETS"'), "Worker config must keep the assets binding expected by worker.mjs");
assert(proxy.includes("GJU_WORKER_API_BASE"), "Pages proxy must support configurable Worker API base");
assert(proxy.includes("https://photographygju-reserve.taejunyun.workers.dev"), "Pages proxy must keep current Worker fallback");
assert(proxy.includes("export async function onRequest"), "Pages proxy must export onRequest");
assert(publicConfig.includes('window.GJU_API_BASE = ""'), "web frontend must keep same-origin API base for Pages/Dothome");

console.log("Cloudflare Pages readiness checks passed.");

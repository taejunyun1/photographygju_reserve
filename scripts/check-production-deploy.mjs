import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const productionUrl = (process.env.GJU_PRODUCTION_URL || "https://photographygju-reserve.taejunyun.workers.dev").replace(/\/$/, "");
const isWorkerUrl = /\.workers\.dev$/i.test(new URL(productionUrl).hostname);
const verifyManifest = process.argv.includes("--manifest");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Production deploy check failed: ${message}`);
  }
}

function ok(message) {
  console.log(`ok - ${message}`);
}

async function fetchText(pathname, expectedStatus = 200, options = {}) {
  const response = await fetch(`${productionUrl}${pathname}`, { cache: "no-store", ...options });
  const text = await response.text();
  assert(response.status === expectedStatus, `${pathname} returned ${response.status}, expected ${expectedStatus}: ${text.slice(0, 180)}`);
  return { response, text };
}

async function fetchBytes(pathname) {
  const response = await fetch(`${productionUrl}${pathname}`, { cache: "no-store" });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(response.status === 200, `${pathname} returned ${response.status}, expected 200`);
  return bytes;
}

if (verifyManifest) {
  const { text: remoteManifestText } = await fetchText("/release.json");
  const remoteManifest = JSON.parse(remoteManifestText);
  const localManifestPath = path.join(root, remoteManifest.target === "pages" ? "dist" : "public", "release.json");
  assert(fs.existsSync(localManifestPath), `local ${remoteManifest.target} release manifest is missing`);
  const localManifest = JSON.parse(fs.readFileSync(localManifestPath, "utf8"));
  assert(remoteManifest.commit === localManifest.commit, `deployed commit ${remoteManifest.commit} does not match local ${localManifest.commit}`);
  for (const [asset, expectedHash] of Object.entries(localManifest.assets || {})) {
    const bytes = await fetchBytes(`/${asset}`);
    const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
    assert(actualHash === expectedHash, `asset hash mismatch for ${asset}`);
  }
  const { text: versionText } = await fetchText("/api/version");
  const version = JSON.parse(versionText);
  assert(version.data?.commit === localManifest.commit, "API version and deployed asset manifest commits differ");
  ok(`release manifest and API commit ${localManifest.commit.slice(0, 12)}`);
}

const indexHtml = read("public/index.html");
const cacheVersion = [...indexHtml.matchAll(/\?v=([0-9A-Za-z-]+)/g)].map((match) => match[1])[0];
assert(cacheVersion, "local public/index.html must include a cache version");

const { text: appJs } = await fetchText(`/app.js?v=${cacheVersion}`);
assert(appJs.includes(`?v=${cacheVersion}`), `production app.js must reference cache version ${cacheVersion}`);
ok(`production app.js cache version ${cacheVersion}`);

const { text: actionsJs } = await fetchText(`/js/actions.js?v=${cacheVersion}`);
assert(actionsJs.includes('method: "DELETE"') && actionsJs.includes('api("/api/me"'), "production actions.js must include account deletion API call");
ok("production account deletion action is deployed");

const { text: studentViewsJs } = await fetchText(`/js/views-student.js?v=${cacheVersion}`);
assert(studentViewsJs.includes('data-form="account-delete"'), "production student views must include account deletion form");
ok("production account deletion UI is deployed");
assert(studentViewsJs.includes("/privacy.html") && studentViewsJs.includes("개인정보 처리방침"), "production student views must link to the privacy policy");
ok("production privacy policy link is deployed in the student UI");

const { text: privacyHtml } = await fetchText("/privacy.html");
assert(privacyHtml.includes("개인정보 처리방침") && privacyHtml.includes("https://gjureserve.co.kr/account-deletion.html"), "production privacy policy page must be deployed");
ok("production privacy policy page is deployed");

const { response: optionsResponse } = await fetchText("/api/me", 204, {
  method: "OPTIONS",
  headers: { origin: "capacitor://localhost" }
});
if (isWorkerUrl) {
  assert((optionsResponse.headers.get("access-control-allow-methods") || "").includes("DELETE"), "production CORS must allow DELETE");
  ok("production API allows DELETE through CORS");
} else {
  ok("production same-origin API proxy responds to OPTIONS");
}

const { text: bootstrapText } = await fetchText("/api/bootstrap");
const bootstrap = JSON.parse(bootstrapText);
assert(bootstrap.ok === true && bootstrap.data?.settings?.appName === "GJU Photography Reservation", "production bootstrap must return app settings");
ok("production bootstrap API is healthy");

const { text: deleteText } = await fetchText("/api/me", 401, {
  method: "DELETE",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ currentPassword: "x", confirmText: "계정 삭제" })
});
const deleteResult = JSON.parse(deleteText);
assert(deleteResult.ok === false, "unauthenticated account deletion must fail safely");
ok("production account deletion endpoint is protected");

console.log(`Production deploy checks passed for ${productionUrl}`);

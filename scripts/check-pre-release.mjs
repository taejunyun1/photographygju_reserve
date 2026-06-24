import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const productionApiBase = "https://photographygju-reserve.taejunyun.workers.dev";
const requiredPackageId = "kr.ac.gju.photomedia.reserve";

function resolveRoot(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(resolveRoot(file), "utf8");
}

function readIfExists(file) {
  const target = resolveRoot(file);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Pre-release check failed: ${message}`);
  }
}

function ok(message) {
  console.log(`ok - ${message}`);
}

function note(message) {
  console.log(`note - ${message}`);
}

function fileExists(file) {
  return fs.existsSync(resolveRoot(file));
}

function listFiles(dir, predicate = () => true) {
  const base = resolveRoot(dir);
  if (!fs.existsSync(base)) return [];
  const output = [];
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "build" || entry.name === "DerivedData") continue;
        stack.push(fullPath);
      } else if (predicate(fullPath)) {
        output.push(path.relative(root, fullPath));
      }
    }
  }
  return output;
}

function assertNoText(files, pattern, label) {
  const offenders = files.filter((file) => pattern.test(readIfExists(file)));
  assert(offenders.length === 0, `${label}: ${offenders.join(", ")}`);
}

const pkg = readJson("package.json");
const cap = readJson("capacitor.config.json");
const indexHtml = read("public/index.html");
const appEntry = read("public/app.js");
const worker = read("worker.mjs");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const androidVariables = read("android/variables.gradle");
const androidBuildGradle = read("android/app/build.gradle");
const infoPlist = read("ios/App/App/Info.plist");
const privacyManifest = read("ios/App/App/PrivacyInfo.xcprivacy");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
const targetSdk = Number((androidVariables.match(/targetSdkVersion\s*=\s*(\d+)/) || [])[1] || 0);

assert(pkg.scripts?.check, "package.json must include npm run check");
assert(pkg.scripts?.["native:sync"], "package.json must include npm run native:sync");
assert(pkg.scripts?.["native:release:check"], "package.json must include npm run native:release:check");
assert(pkg.scripts?.["native:android:bundle"], "package.json must include npm run native:android:bundle");
assert(pkg.scripts?.["native:ios:archive"], "package.json must include npm run native:ios:archive");
assert(pkg.scripts?.["native:ios:export"], "package.json must include npm run native:ios:export");
assert(pkg.scripts?.["deploy:check"], "package.json must include npm run deploy:check");
assert(fileExists("scripts/ios-appstore-export.mjs"), "iOS App Store export script must exist");
assert(fileExists("scripts/check-production-deploy.mjs"), "production deploy check script must exist");
ok("required npm scripts are present");

assert(fileExists("docs/pre-release-checklist.md"), "docs/pre-release-checklist.md must exist");
assert(fileExists("docs/native-app-build.md"), "docs/native-app-build.md must exist");
assert(fileExists("docs/store-submission-materials.md"), "docs/store-submission-materials.md must exist");
assert(fileExists("docs/release-qa-signoff.md"), "docs/release-qa-signoff.md must exist");
assert(read("docs/native-app-build.md").includes("pre-release-checklist.md"), "native build guide must link the pre-release checklist");
ok("release documentation is linked");

assert(cap.appId === requiredPackageId, `Capacitor appId must be ${requiredPackageId}`);
assert(cap.appName === "GJU Photography Reservation", "Capacitor appName must be GJU Photography Reservation");
assert(cap.webDir === "dist", "Capacitor webDir must be dist");
assert(cap.plugins?.LocalNotifications?.smallIcon === "ic_stat_notify", "LocalNotifications must use the release notification icon");
ok("Capacitor release identity is stable");

assert(indexHtml.includes("Content-Security-Policy"), "public/index.html must define a CSP");
assert(indexHtml.includes(productionApiBase), "public/index.html CSP connect-src must include the production Worker API");
assert(fileExists("public/.htaccess"), "Dothome web root must include Apache security headers and SPA fallback");
assert(worker.includes("permissions-policy"), "worker.mjs must set Permissions-Policy");
assert(worker.includes(productionApiBase), "worker.mjs CSP connect-src must include the production Worker API");
ok("web security headers and production API origin are configured");

const cacheVersions = [...indexHtml.matchAll(/\?v=([0-9A-Za-z-]+)/g)].map((match) => match[1]);
const uniqueCacheVersions = [...new Set(cacheVersions)];
assert(uniqueCacheVersions.length === 1, `public/index.html cache versions must match: ${uniqueCacheVersions.join(", ") || "none"}`);
assert(appEntry.includes(uniqueCacheVersions[0]), "public/app.js must import main.js with the same cache version");
ok(`web cache version is consistent (${uniqueCacheVersions[0]})`);

assert(read("public/config.js").includes('window.GJU_API_BASE = ""'), "public/config.js must keep same-origin API for web deploy");
const distConfig = readIfExists("dist/config.js");
if (distConfig) {
  assert(!distConfig.includes("window.GJU_NATIVE_APP = true") || distConfig.includes(productionApiBase), "native dist/config.js must point to the production API");
  if (distConfig.includes("window.GJU_NATIVE_APP = true")) {
    note("dist/config.js is currently native-mode; run npm run build before a web-only deploy.");
  }
}
ok("web/native API config is explicit");

assert(targetSdk >= 35, `Android targetSdkVersion must be 35 or higher, current ${targetSdk}`);
assert(androidBuildGradle.includes("GJU_ANDROID_KEYSTORE_PATH"), "Android release signing hook must read upload-key env vars");
assert(androidManifest.includes('android:allowBackup="false"'), "Android backup must be disabled for release");
assert(androidManifest.includes('android:usesCleartextTraffic="false"'), "Android cleartext traffic must be disabled");
assert(!androidManifest.includes("SCHEDULE_EXACT_ALARM") && !androidManifest.includes("USE_EXACT_ALARM"), "Android app manifest must not request exact alarm permissions");
ok("Android release hardening is configured");

assert(infoPlist.includes("<string>사진영상미디어학과 예약</string>"), "iOS display name must be 사진영상미디어학과 예약");
assert(infoPlist.includes("<string>UIInterfaceOrientationPortrait</string>") && !infoPlist.includes("UIInterfaceOrientationLandscape"), "iOS initial release must be portrait-only");
assert(xcodeProject.includes("TARGETED_DEVICE_FAMILY = 1;"), "iOS initial release must target iPhone only");
assert(fileExists("ios/App/App/PrivacyInfo.xcprivacy"), "iOS PrivacyInfo.xcprivacy must exist");
assert(privacyManifest.includes("NSPrivacyTracking") && privacyManifest.includes("<false/>"), "iOS privacy manifest must declare no tracking");
assert(privacyManifest.includes("NSPrivacyCollectedDataTypeEmailAddress"), "iOS privacy manifest must include email collection");
assert(privacyManifest.includes("NSPrivacyCollectedDataTypePhoneNumber"), "iOS privacy manifest must include phone collection");
assert(read("ios/App/App.xcodeproj/project.pbxproj").includes("PrivacyInfo.xcprivacy in Resources"), "iOS privacy manifest must be included in the Xcode resources phase");
ok("iOS privacy manifest is present and linked");

assert(read("core.mjs").includes('DELETE /api/me'), "student account deletion API must exist");
assert(read("public/js/views-student.js").includes('data-form="account-delete"'), "student account deletion UI must exist");
assert(read("public/js/actions.js").includes('api("/api/me",') && read("public/js/actions.js").includes('method: "DELETE"'), "student account deletion action must call DELETE /api/me");
assert(fileExists("public/account-deletion.html"), "public account deletion instructions page must exist for Play Console");
ok("student account deletion is available in-app");

const sourceFiles = [
  "core.mjs",
  "server.mjs",
  "worker.mjs",
  "package.json",
  ...listFiles("public", (file) => /\.(js|css|html|svg)$/.test(file)),
  ...listFiles("docs", (file) => /\.(md|html|csv)$/.test(file)),
  ...listFiles("scripts", (file) => /\.(js|mjs|sh)$/.test(file))
];
assertNoText(sourceFiles, /https:\/\/hooks\.slack\.com\/services\//, "Slack webhook URL must not be committed");
assertNoText(sourceFiles, /-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/, "private key material must not be committed");
ok("no obvious committed webhook/private-key secrets found");

const releaseRequiredDocs = [
  "App Store Connect 개인정보 답변",
  "Play Console Data safety",
  "테스트 계정",
  "실기기 QA",
  "출시일 롤백"
];
const preReleaseChecklist = read("docs/pre-release-checklist.md");
for (const phrase of releaseRequiredDocs) {
  assert(preReleaseChecklist.includes(phrase), `pre-release checklist must include "${phrase}"`);
}
ok("manual store submission tasks are documented");

console.log("Pre-release checks passed.");

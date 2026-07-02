import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const requiredCacheVersion = "20260702-admin-icon-header";

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fileExists(file) {
  return fs.existsSync(path.join(root, file));
}

function contains(file, text) {
  return read(file).includes(text);
}

const pkg = readJson("package.json");
const cap = readJson("capacitor.config.json");
const variables = read("android/variables.gradle");
const androidBuildGradle = read("android/app/build.gradle");
const targetSdk = Number((variables.match(/targetSdkVersion\s*=\s*(\d+)/) || [])[1] || 0);
const androidVersionCode = Number((androidBuildGradle.match(/versionCode\s+(\d+)/) || [])[1] || 0);
const androidVersionName = (androidBuildGradle.match(/versionName\s+"([^"]+)"/) || [])[1] || "";
const infoPlist = read("ios/App/App/Info.plist");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
const iosBuildNumber = Number((xcodeProject.match(/CURRENT_PROJECT_VERSION = (\d+);/) || [])[1] || 0);
const iosMarketingVersion = (xcodeProject.match(/MARKETING_VERSION = ([^;]+);/) || [])[1] || "";
const rootGitignore = read(".gitignore");
const androidGitignore = read("android/.gitignore");

const checks = [
  ["app id", cap.appId === "kr.ac.gju.photomedia.reserve"],
  ["app name", cap.appName === "GJU Photography Reservation"],
  ["native api build script", pkg.scripts?.["build:native"] === "node scripts/build-native.js"],
  ["iOS archive script", pkg.scripts?.["native:ios:archive"]?.includes("ios-appstore-export.mjs") && fileExists("scripts/ios-appstore-export.mjs")],
  ["iOS export script", pkg.scripts?.["native:ios:export"]?.includes("ios-appstore-export.mjs")],
  ["android bundle script", Boolean(pkg.scripts?.["native:android:bundle"]?.includes("native:android:verify"))],
  ["android upload key script", pkg.scripts?.["native:android:key"] === "node scripts/create-android-upload-key.mjs" && fileExists("scripts/create-android-upload-key.mjs")],
  ["android signed bundle verifier", pkg.scripts?.["native:android:verify"] === "node scripts/check-android-release.mjs" && fileExists("scripts/check-android-release.mjs")],
  ["android signing secrets ignored", rootGitignore.includes("*.p12") && rootGitignore.includes("android/release-signing.properties") && androidGitignore.includes("release-signing.properties")],
  ["Android upload version matches iOS review build", androidVersionName === iosMarketingVersion && androidVersionCode === iosBuildNumber],
  ["local notifications dependency", Boolean(pkg.dependencies?.["@capacitor/local-notifications"])],
  ["local notifications config", Boolean(cap.plugins?.LocalNotifications?.smallIcon)],
  ["android target sdk >= 35", targetSdk >= 35],
  ["android notification icon", fileExists("android/app/src/main/res/drawable/ic_stat_notify.xml")],
  ["native notification bridge", fileExists("public/js/native-notifications.js")],
  ["student UI imports native notifications", contains("public/js/views-student.js", "nativeNotificationSettingsCard")],
  ["iOS privacy manifest file", fileExists("ios/App/App/PrivacyInfo.xcprivacy")],
  ["iOS privacy manifest in xcode project", contains("ios/App/App.xcodeproj/project.pbxproj", "PrivacyInfo.xcprivacy in Resources")],
  ["iOS iPhone portrait release target", infoPlist.includes("UIInterfaceOrientationPortrait") && !infoPlist.includes("UIInterfaceOrientationLandscape") && xcodeProject.includes("TARGETED_DEVICE_FAMILY = 1;")],
  ["iOS plugin generated package", contains("ios/App/CapApp-SPM/Package.swift", "CapacitorLocalNotifications")],
  ["Android plugin generated settings", contains("android/capacitor.settings.gradle", "capacitor-local-notifications")],
  ["Android release signing hook", contains("android/app/build.gradle", "GJU_ANDROID_KEYSTORE_PATH")],
  ["web cache version", contains("public/index.html", requiredCacheVersion) && contains("public/app.js", requiredCacheVersion)],
  ["student account deletion", contains("core.mjs", "DELETE /api/me") && contains("public/js/views-student.js", "account-delete")],
  ["privacy policy page", fileExists("public/privacy.html") && contains("public/privacy.html", "개인정보 처리방침") && contains("public/privacy.html", "https://gjureserve.co.kr/account-deletion.html")],
  ["privacy policy in app", contains("public/js/views-student.js", "/privacy.html") && contains("public/js/views-student.js", "개인정보 처리방침")],
  ["watch reservation bridge", fileExists("ios/App/App/GJUWatchReservationsPlugin.swift") && contains("ios/App/App/GJUWatchReservationsPlugin.swift", "WatchConnectivity") && contains("ios/App/App/GJUWatchReservationsPlugin.swift", "GJUWatchReservations") && contains("public/js/native-notifications.js", "syncWatchReservationSnapshot")],
  ["watch reservation data sync", contains("public/js/data.js", "syncWatchReservationSnapshot") && contains("public/js/native-notifications.js", "watchReservationSnapshot")],
  ["watch app scaffold", fileExists("ios/App/GJUWatchApp/GJUWatchApp.swift") && fileExists("ios/App/GJUWatchApp/ReservationListView.swift") && fileExists("ios/App/GJUWatchApp/Info.plist")],
  ["watch plugin in xcode sources", contains("ios/App/App.xcodeproj/project.pbxproj", "GJUWatchReservationsPlugin.swift in Sources")],
  ["store docs include watch scope", contains("docs/store-submission-materials.md", "Apple Watch") && contains("docs/native-app-build.md", "Apple Watch")]
];

for (const [label, passed] of checks) {
  assert(passed, `Native release check failed: ${label}`);
  console.log(`ok - ${label}`);
}

console.log("Native release readiness checks passed.");

const signingEnv = [
  "GJU_ANDROID_KEYSTORE_PATH",
  "GJU_ANDROID_KEYSTORE_PASSWORD",
  "GJU_ANDROID_KEY_ALIAS",
  "GJU_ANDROID_KEY_PASSWORD"
];
if (fileExists("android/release-signing.properties")) {
  console.log("note - Android release signing will use ignored android/release-signing.properties.");
} else if (!signingEnv.every((key) => process.env[key])) {
  console.log("note - Android upload-key env vars are not all set; run npm run native:android:key or provide Play upload-key env vars before building a Play AAB.");
}

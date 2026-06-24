import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const archiveOnly = process.argv.includes("--archive-only");
const buildDir = process.env.IOS_BUILD_DIR || "build";
const archivePath = process.env.IOS_ARCHIVE_PATH || path.join(buildDir, "AppStoreCheck.xcarchive");
const exportPath = process.env.IOS_EXPORT_PATH || path.join(buildDir, "AppStoreExport");
const exportOptionsPath = process.env.IOS_EXPORT_OPTIONS_PLIST || path.join(buildDir, "exportOptions-appstore.plist");
const exportMethod = process.env.IOS_EXPORT_METHOD || "app-store-connect";
const signingStyle = process.env.IOS_SIGNING_STYLE || "automatic";
const teamId = process.env.IOS_TEAM_ID || "";
const allowProvisioningUpdates = process.env.IOS_ALLOW_PROVISIONING_UPDATES !== "0";

function run(label, command, args) {
  console.log(`\n> ${label}`);
  console.log([command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" "));
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n${label} failed with exit code ${result.status ?? 1}.`);
    if (label === "Export iOS App Store archive") {
      console.error("If the archive succeeded but export failed, check App Store Connect provider access, Apple Distribution certificate, and App Store provisioning profile for kr.ac.gju.photomedia.reserve.");
    }
    process.exit(result.status ?? 1);
  }
}

function plistValue(key, value) {
  return value ? `\t<key>${key}</key>\n\t<string>${value}</string>\n` : "";
}

function writeExportOptions() {
  mkdirSync(path.dirname(exportOptionsPath), { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${plistValue("method", exportMethod)}${plistValue("signingStyle", signingStyle)}${plistValue("teamID", teamId)}\t<key>stripSwiftSymbols</key>
\t<true/>
\t<key>uploadSymbols</key>
\t<true/>
</dict>
</plist>
`;
  writeFileSync(exportOptionsPath, plist);
}

mkdirSync(buildDir, { recursive: true });

const archiveArgs = [
  "-project", "ios/App/App.xcodeproj",
  "-scheme", "App",
  "-configuration", "Release",
  "-destination", "generic/platform=iOS",
  "-archivePath", archivePath
];
if (allowProvisioningUpdates) archiveArgs.push("-allowProvisioningUpdates");
archiveArgs.push("archive");

run("Archive iOS release build", "xcodebuild", archiveArgs);

if (archiveOnly) {
  console.log(`\nArchive created at ${archivePath}`);
  process.exit(0);
}

writeExportOptions();

const exportArgs = [
  "-exportArchive",
  "-archivePath", archivePath,
  "-exportPath", exportPath,
  "-exportOptionsPlist", exportOptionsPath
];
if (allowProvisioningUpdates) exportArgs.push("-allowProvisioningUpdates");

run("Export iOS App Store archive", "xcodebuild", exportArgs);
console.log(`\nApp Store export created at ${exportPath}`);

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const nativeApiBase = process.env.GJU_NATIVE_API_BASE || "https://photographygju-reserve.taejunyun.workers.dev";
const notificationDiagnosticsEnabled = process.env.GJU_NOTIFICATION_DIAGNOSTICS === "1";
const notificationDiagnosticsAutorun = notificationDiagnosticsEnabled && process.env.GJU_NOTIFICATION_DIAGNOSTICS_AUTORUN === "1";
const nativeApiOrigin = (() => {
  try {
    return new URL(nativeApiBase).origin;
  } catch {
    return "";
  }
})();

execFileSync(process.execPath, [path.join(__dirname, "build-static.js")], { stdio: "inherit" });

if (nativeApiOrigin) {
  const indexPath = path.join(dist, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  fs.writeFileSync(
    indexPath,
    indexHtml.replace(
      /(connect-src\s+[^;"]*)/,
      (match) => match.includes(nativeApiOrigin) ? match : `${match} ${nativeApiOrigin}`
    ).replace(nativeApiOrigin.startsWith("http:") ? /; upgrade-insecure-requests/g : /$^/, "")
  );
}

fs.writeFileSync(
  path.join(dist, "config.js"),
  `(function () {
  window.GJU_API_BASE = ${JSON.stringify(nativeApiBase)};
  window.GJU_NATIVE_APP = true;
  window.GJU_REACT_ADMIN_ENABLED = true;
  window.GJU_REACT_STUDENT_ENABLED = true;
  window.GJU_NOTIFICATION_DIAGNOSTICS = ${notificationDiagnosticsEnabled};
  window.GJU_NOTIFICATION_DIAGNOSTICS_AUTORUN = ${notificationDiagnosticsAutorun};
  document.documentElement.dataset.nativeApp = "true";
})();
`
);

console.log(`Native build written to dist/ with API base ${nativeApiBase}`);

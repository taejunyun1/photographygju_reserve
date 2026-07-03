import assert from "node:assert/strict";
import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

const pkg = readJson("package.json");
const indexHtml = read("public/index.html");
const publicConfig = read("public/config.js");
const stateSource = read("public/js/state.js");
const rendererSource = read("public/js/renderer.js");
const buildStatic = read("scripts/build-static.js");
const gitignore = read(".gitignore");
const platformTypes = read("src/react/platform/types.ts");
const reactAdminMain = read("src/react/admin/main.tsx");

assert.equal(pkg.scripts["build:react-admin"], "node scripts/build-react-admin.mjs --target public");
assert.equal(pkg.scripts["check:react-admin"], "tsc --noEmit && node scripts/build-react-admin.mjs --target public --dry-run && node scripts/react-admin-render-test.mjs");
assert.equal(pkg.scripts["test:react-admin"], "node scripts/react-admin-contract-test.mjs");
assert(pkg.scripts["release:check"].includes("npm run check:react-admin"), "release:check must include React Admin checks");
assert(pkg.scripts["release:check"].includes("npm run test:react-admin"), "release:check must include React Admin contract test");

assert(indexHtml.includes("/js/react-admin.generated.js?v="), "index.html must load React Admin generated JS");
assert(indexHtml.includes("/css/react-admin.generated.css?v="), "index.html must load React Admin generated CSS");
assert(publicConfig.includes("window.GJU_REACT_ADMIN_ENABLED = true"), "public config must enable React Admin by default");
assert(stateSource.includes("reactAdminEnabled"), "state must expose reactAdminEnabled");
assert(rendererSource.includes("const adminMarkup = adminContent();"), "legacy renderer must compute legacy admin content for React Admin mounts");
assert(rendererSource.includes("legacyRenderAdminContent: () => adminMarkup"), "legacy renderer must pass legacy admin content fallback into React Admin mounts");
assert(rendererSource.includes("document.dispatchEvent(new CustomEvent(\"gju-react-admin-refresh\"))"), "renderer bridge must dispatch a refresh event for React Admin");
assert(rendererSource.includes("document.dispatchEvent(new CustomEvent(\"gju-react-admin-logout\"))"), "renderer bridge must dispatch a logout event for React Admin");
assert(rendererSource.includes("updateReactAdminChrome"), "renderer bridge must update React Admin chrome without replacing the mounted shell");
assert(buildStatic.includes("build-react-admin.mjs"), "static build must produce React Admin generated assets");
assert(gitignore.includes("public/js/react-admin.generated.js"), "generated React Admin JS must be ignored");
assert(gitignore.includes("public/css/react-admin.generated.css"), "generated React Admin CSS must be ignored");
assert(platformTypes.includes("legacyRenderAdminContent: () => string;"), "React Admin platform types must declare the legacy content fallback");
assert(platformTypes.includes("refreshAdminData(): Promise<void>;"), "React Admin actions contract must include refreshAdminData");
assert(platformTypes.includes("logout(): Promise<void> | void;"), "React Admin actions contract must include logout");
assert(reactAdminMain.includes("window.GJUReactAdmin = { mount, unmount }"), "React Admin bundle entry must expose mount/unmount globals");
assert(reactAdminMain.includes("mountedRoot"), "React Admin bundle must track the mounted root between bridge updates");
assert(reactAdminMain.includes("options.legacyRenderAdminContent()"), "React Admin mount must call the legacy admin content fallback");
assert(!reactAdminMain.includes("React Admin 준비중"), "React Admin entry must not replace the admin UI with a placeholder in this milestone");

console.log("React Admin contract checks passed.");

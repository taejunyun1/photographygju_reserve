import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
const designSystemCss = read("src/react/design-system/react-admin.css");
const iconsSource = read("src/react/design-system/icons.tsx");
const motionSource = read("src/react/design-system/motion.ts");
const buttonSource = read("src/react/design-system/Button.tsx");
const cardSource = read("src/react/design-system/Card.tsx");
const badgeSource = read("src/react/design-system/StatusBadge.tsx");
const renderTestSource = read("scripts/react-admin-render-test.mjs");

function readTree(rootDir) {
  const entries = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...readTree(fullPath));
      continue;
    }
    entries.push({
      file: fullPath,
      source: read(fullPath)
    });
  }
  return entries;
}

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
assert(fs.existsSync("src/react/design-system/Button.tsx"), "Task 3 must provide the button wrapper");
assert(fs.existsSync("src/react/design-system/Card.tsx"), "Task 3 must provide the card wrapper");
assert(fs.existsSync("src/react/design-system/StatusBadge.tsx"), "Task 3 must provide the status badge wrapper");
assert(fs.existsSync("src/react/design-system/Dialog.tsx"), "Task 3 must provide the dialog wrapper");
assert(fs.existsSync("src/react/design-system/Toast.tsx"), "Task 3 must provide the toast wrapper");
assert(buttonSource.includes("export function GjuButton"), "Button wrapper must export GjuButton");
assert(buttonSource.includes("export function GjuIconButton"), "Button wrapper must export GjuIconButton");
assert(buttonSource.includes('"aria-label": label'), "Icon button wrapper must keep the accessible label");
assert(cardSource.includes("export function GjuCard"), "Card wrapper must export GjuCard");
assert(badgeSource.includes("export function GjuStatusBadge"), "Status badge wrapper must export GjuStatusBadge");
assert(iconsSource.includes('export type GjuIconName ='), "Design system icons must export the icon name union");
for (const iconName of ["refresh", "user", "logOut", "trash", "check", "x", "camera", "fileText", "userPlus", "edit", "plus"]) {
  assert(iconsSource.includes(`| "${iconName}"`), `Design system icons must include ${iconName}`);
}
assert.equal(
  motionSource.trim(),
  [
    "export const motionClass = {",
    '  screen: "gju-motion-screen",',
    '  panel: "gju-motion-panel",',
    '  toast: "gju-motion-toast",',
    '  dialog: "gju-motion-dialog"',
    "} as const;"
  ].join("\n"),
  "Motion token contract must match the Task 3 brief exactly"
);
for (const className of [
  "gju-app-shell",
  "gju-button",
  "gju-icon-button",
  "gju-card",
  "gju-tabs",
  "gju-table",
  "gju-dialog",
  "gju-toast",
  "gju-empty-state",
  "gju-status-badge",
  "gju-motion-enter"
]) {
  assert(designSystemCss.includes(`.${className}`), `Design system CSS must define .${className}`);
}
for (const token of [
  "--gju-motion-duration-instant: 80ms;",
  "--gju-motion-duration-fast: 120ms;",
  "--gju-motion-duration-normal: 180ms;",
  "--gju-motion-duration-panel: 240ms;",
  "--gju-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);"
]) {
  assert(designSystemCss.includes(token), `Design system CSS must include ${token}`);
}
assert(designSystemCss.includes(".gju-motion-screen {\n  animation: gju-screen-enter var(--gju-motion-duration-normal) var(--gju-motion-ease-standard);\n}"), "Screen motion class must use the Task 3 animation contract");
assert(designSystemCss.includes("@media (prefers-reduced-motion: reduce)"), "Design system CSS must include reduced-motion handling");
for (const motionClassName of [".gju-motion-screen", ".gju-motion-panel", ".gju-motion-toast", ".gju-motion-dialog"]) {
  assert(designSystemCss.includes(motionClassName), `Reduced-motion CSS must cover ${motionClassName}`);
}
assert(renderTestSource.includes('aria-label="삭제"'), "Render test must assert the icon button accessible label");
assert(renderTestSource.includes('!iconButton.includes(">삭제<")'), "Render test must assert the icon button stays icon-only");

const nonWrapperReactSources = readTree("src/react")
  .filter(({ file }) => !file.includes(`${path.sep}design-system${path.sep}`))
  .map(({ file, source }) => ({ file, source }));

for (const { file, source } of nonWrapperReactSources) {
  assert(!source.includes("@astryxdesign"), `Feature React source must not import Astryx directly outside wrappers: ${file}`);
}

console.log("React Admin contract checks passed.");

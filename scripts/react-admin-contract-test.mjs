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
const dialogSource = read("src/react/design-system/Dialog.tsx");
const emptyStateSource = read("src/react/design-system/EmptyState.tsx");
const tableSource = read("src/react/design-system/Table.tsx");
const toastSource = read("src/react/design-system/Toast.tsx");
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

function cssRule(source, selector, fromIndex = 0) {
  const start = source.indexOf(selector, fromIndex);
  assert.notEqual(start, -1, `${selector} rule must exist`);
  const end = source.indexOf("}", start);
  assert.notEqual(end, -1, `${selector} rule must close`);
  return source.slice(start, end + 1);
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
assert(/@astryxdesign\/core\/Button/.test(buttonSource), "Button wrapper must import Astryx Button");
assert(/@astryxdesign\/core\/IconButton/.test(buttonSource), "Icon button wrapper must import Astryx IconButton");
assert(cardSource.includes("export function GjuCard"), "Card wrapper must export GjuCard");
assert(/@astryxdesign\/core\/Card/.test(cardSource), "Card wrapper must import Astryx Card");
assert(badgeSource.includes("export function GjuStatusBadge"), "Status badge wrapper must export GjuStatusBadge");
assert(/@astryxdesign\/core\/Badge/.test(badgeSource), "Status badge wrapper must import Astryx Badge");
assert(/@astryxdesign\/core\/Dialog/.test(dialogSource), "Dialog wrapper must import Astryx Dialog");
assert(/useId/.test(dialogSource), "Dialog wrapper must generate unique title ids per instance");
assert(/@astryxdesign\/core\/EmptyState/.test(emptyStateSource), "Empty state wrapper must import Astryx EmptyState");
assert(/@astryxdesign\/core\/Table/.test(tableSource), "Table wrapper must import Astryx Table");
assert(/@astryxdesign\/core\/Toast/.test(toastSource), "Toast wrapper must import Astryx Toast");
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
const reactRootRule = cssRule(designSystemCss, "#react-admin-root {");
for (const token of ["min-height: 100vh;", "min-height: 100dvh;"]) {
  assert(reactRootRule.includes(token), `React Admin root container must fill the viewport to avoid clipped admin surfaces: ${token}`);
}
const appShellRule = cssRule(designSystemCss, ".gju-app-shell {");
for (const token of ["min-height: 100vh;", "min-height: 100dvh;"]) {
  assert(appShellRule.includes(token), `React Admin shell background must extend to the viewport: ${token}`);
}
assert(designSystemCss.includes("--gju-app-shell-mobile-edge: clamp(18px, 5vw, 24px);"), "React Admin mobile shell must define a shared screen-edge spacing token");
const mobileMediaStart = designSystemCss.indexOf("@media (max-width: 900px)");
assert.notEqual(mobileMediaStart, -1, "Design system CSS must define the mobile React Admin shell media query");
const mobileReactRootRule = cssRule(designSystemCss, "  #react-admin-root {", mobileMediaStart);
for (const token of ["min-height: 100vh;", "min-height: 100dvh;", "height: 100vh;", "height: 100dvh;"]) {
  assert(mobileReactRootRule.includes(token), `Mobile React Admin root rule must include ${token}`);
}
const mobileAppShellRule = cssRule(designSystemCss, "  .gju-app-shell {", mobileMediaStart);
for (const token of ["min-height: 100vh;", "min-height: 100dvh;", "height: 100vh;", "height: 100dvh;"]) {
  assert(mobileAppShellRule.includes(token), `Mobile React Admin shell rule must include ${token}`);
}
const mobileShellMainRule = cssRule(designSystemCss, "  .gju-app-shell__main {", mobileMediaStart);
for (const token of ["min-height: 0;", "height: 100%;", "overflow: hidden;"]) {
  assert(mobileShellMainRule.includes(token), `Mobile React Admin shell main rule must include ${token}`);
}
const mobileShellContentRule = cssRule(designSystemCss, "  .gju-app-shell__content {", mobileMediaStart);
for (const token of ["flex: 1 1 auto;", "min-height: 0;", "overflow-x: hidden;", "overflow-y: auto;", "-webkit-overflow-scrolling: touch;", "overscroll-behavior-y: contain;"]) {
  assert(mobileShellContentRule.includes(token), `Mobile React Admin content rule must include ${token}`);
}
assert(mobileShellContentRule.includes("max(var(--gju-app-shell-mobile-edge), var(--gju-safe-area-right))"), "Mobile React Admin content must keep a safe right edge inset");
assert(mobileShellContentRule.includes("max(var(--gju-app-shell-mobile-edge), var(--gju-safe-area-left))"), "Mobile React Admin content must keep a safe left edge inset");
const mobileContentContainmentRule = cssRule(designSystemCss, "  .gju-app-shell__content > *,", mobileMediaStart);
for (const token of ["width: 100%;", "min-width: 0;", "max-width: 100%;"]) {
  assert(mobileContentContainmentRule.includes(token), `Mobile React Admin content containment must include ${token}`);
}
for (const selector of [
  ".gju-app-shell__content .ui-search-field",
  ".gju-app-shell__content .bulk-danger-zone",
  ".gju-app-shell__content .admin-reservation-grid",
  ".gju-app-shell__content .admin-reservation-card",
  ".gju-app-shell__content .reservation-card-head",
  ".gju-app-shell__content .property-list",
  ".gju-app-shell__content .prop",
  ".gju-app-shell__content .guide-card"
]) {
  assert(mobileContentContainmentRule.includes(selector), `Mobile React Admin content containment must cover ${selector}`);
}
const mobileContentClipRule = cssRule(
  designSystemCss,
  "  .gju-app-shell__content .gju-card,\n  .gju-app-shell__content .gju-card__body,\n  .gju-app-shell__content .gju-legacy-admin-panel,",
  mobileMediaStart
);
assert(mobileContentClipRule.includes("overflow-x: clip;"), "Mobile React Admin cards and panels must clip accidental horizontal overflow");
assert(mobileContentClipRule.includes(".gju-app-shell__content .admin-reservation-card"), "Mobile React Admin reservation cards must clip accidental horizontal overflow");
const mobileContentScrollableRule = cssRule(designSystemCss, "  .gju-app-shell__content .table-wrap,", mobileMediaStart);
for (const token of ["max-width: 100%;", "overflow-x: auto;", "overscroll-behavior-x: contain;"]) {
  assert(mobileContentScrollableRule.includes(token), `Mobile React Admin tables must keep horizontal overflow inside the table region: ${token}`);
}
const mobileContentControlsRule = cssRule(designSystemCss, "  .gju-app-shell__content .tab-row,", mobileMediaStart);
for (const token of ["width: 100%;", "max-width: 100%;", "overflow-x: auto;"]) {
  assert(mobileContentControlsRule.includes(token), `Mobile React Admin tab/control rows must stay within screen width: ${token}`);
}
const mobileContentGridRule = cssRule(designSystemCss, "  .gju-app-shell__content .grid {", mobileMediaStart);
assert(mobileContentGridRule.includes("grid-template-columns: minmax(0, 1fr);"), "Mobile React Admin legacy grids must use a single shrinkable column inside the React shell");
const mobileReservationTabsRule = cssRule(designSystemCss, "  .gju-app-shell__content .admin-reservation-type-tabs,", mobileMediaStart);
for (const token of ["grid-template-columns: repeat(auto-fit, minmax(0, 1fr));", "grid-auto-columns: auto;", "overflow-x: hidden;"]) {
  assert(mobileReservationTabsRule.includes(token), `Mobile reservation tabs must fit within the screen without horizontal overflow: ${token}`);
}
const mobileContentTextRule = cssRule(designSystemCss, "  .gju-app-shell__content :where(td, th, p, span, strong, small, em, label, input, select, textarea, button, a) {", mobileMediaStart);
for (const token of ["min-width: 0;", "max-width: 100%;", "overflow-wrap: anywhere;"]) {
  assert(mobileContentTextRule.includes(token), `Mobile React Admin text and controls must resist width overflow: ${token}`);
}
const mobileShellHeaderRule = cssRule(designSystemCss, "  .gju-app-shell__mobile-header {", mobileMediaStart);
assert(mobileShellHeaderRule.includes("max(var(--gju-app-shell-mobile-edge), var(--gju-safe-area-right))"), "Mobile React Admin header must keep a safe right edge inset");
assert(mobileShellHeaderRule.includes("max(var(--gju-app-shell-mobile-edge), var(--gju-safe-area-left))"), "Mobile React Admin header must keep a safe left edge inset");
const mobileShellBottomNavRule = cssRule(designSystemCss, "  .gju-app-shell__bottom-nav {", mobileMediaStart);
assert(mobileShellBottomNavRule.includes("max(var(--gju-app-shell-mobile-edge), var(--gju-safe-area-right))"), "Mobile React Admin bottom nav must keep a safe right edge inset");
assert(mobileShellBottomNavRule.includes("max(var(--gju-app-shell-mobile-edge), var(--gju-safe-area-left))"), "Mobile React Admin bottom nav must keep a safe left edge inset");
const mobileBottomNavItemsRule = cssRule(designSystemCss, "  .gju-admin-nav--bottom {", mobileMediaStart);
assert(mobileBottomNavItemsRule.includes("scroll-padding-inline: var(--gju-app-shell-mobile-edge);"), "Mobile React Admin bottom nav scroll area must respect the shared edge spacing");
for (const motionClassName of [".gju-motion-screen", ".gju-motion-panel", ".gju-motion-toast", ".gju-motion-dialog"]) {
  assert(designSystemCss.includes(motionClassName), `Reduced-motion CSS must cover ${motionClassName}`);
}
assert(renderTestSource.includes('aria-label="삭제"'), "Render test must assert the icon button accessible label");
assert(renderTestSource.includes('!iconButton.includes(">삭제<")'), "Render test must assert the icon button stays icon-only");
for (const astryxClassName of [
  "astryx-button",
  "astryx-card",
  "astryx-badge",
  "astryx-dialog",
  "astryx-empty-state",
  "astryx-table",
  "astryx-toast"
]) {
  assert(renderTestSource.includes(astryxClassName), `Render test must assert ${astryxClassName} adaptation`);
}
assert(renderTestSource.includes("new Set(dialogIds).size"), "Render test must assert unique dialog title ids");

const nonWrapperReactSources = readTree("src/react")
  .filter(({ file }) => !file.includes(`${path.sep}design-system${path.sep}`))
  .map(({ file, source }) => ({ file, source }));

for (const { file, source } of nonWrapperReactSources) {
  assert(!source.includes("@astryxdesign"), `Feature React source must not import Astryx directly outside wrappers: ${file}`);
}

console.log("React Admin contract checks passed.");

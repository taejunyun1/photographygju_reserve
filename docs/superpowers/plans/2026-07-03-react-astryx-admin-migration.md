# React Astryx Admin Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first React/Astryx Admin island milestone while keeping student/auth flows, Worker APIs, database storage, Cloudflare Pages, and Capacitor output stable.

**Architecture:** Add a generated React Admin bundle that exposes `window.GJUReactAdmin`, then let `public/js/renderer.js` mount React only for Admin users when `state.reactAdminEnabled` is true and the bundle is available. React owns the Admin shell plus dashboard/users/equipment/logs, while unconverted Admin tabs render through the existing `adminContent()` fallback inside the React shell.

**Tech Stack:** React, React DOM, TypeScript, esbuild, `@astryxdesign/core`, existing vanilla JS state/API/event modules, Cloudflare Pages static `dist`, Capacitor `webDir: "dist"`.

## Global Constraints

- Student/auth/reservation screens remain legacy until a separate student React migration spec is approved.
- Backend API, DB schema, Cloudflare Worker, Pages Function proxy, and `capacitor.config.json` `webDir: "dist"` remain unchanged.
- Use TypeScript for all new React code.
- Use React Context plus small reducer/action modules for the first Admin milestone.
- Use Astryx only through local GJU wrappers in `src/react/design-system`.
- Do not add Framer Motion or haptics in this milestone.
- Keep legacy Admin views and tests until equivalent React ownership is verified.
- Generated files `public/js/react-admin.generated.js`, `public/css/react-admin.generated.css`, `dist/js/react-admin.generated.js`, and `dist/css/react-admin.generated.css` are build artifacts and must not be committed.
- Preserve the current cache-version workflow and update all `?v=` imports to one new version at the end of the migration.

---

## File Structure

Create these source files:

```text
src/react/admin/main.tsx
src/react/admin/AdminApp.tsx
src/react/admin/LegacyAdminPanel.tsx
src/react/admin/screens/AdminDashboard.tsx
src/react/admin/screens/AdminUsers.tsx
src/react/admin/screens/AdminEquipment.tsx
src/react/admin/screens/AdminLogs.tsx
src/react/design-system/AppShell.tsx
src/react/design-system/Button.tsx
src/react/design-system/Card.tsx
src/react/design-system/Dialog.tsx
src/react/design-system/EmptyState.tsx
src/react/design-system/StatusBadge.tsx
src/react/design-system/Table.tsx
src/react/design-system/Tabs.tsx
src/react/design-system/Toast.tsx
src/react/design-system/icons.tsx
src/react/design-system/motion.ts
src/react/design-system/react-admin.css
src/react/platform/adminActions.ts
src/react/platform/adminNav.ts
src/react/platform/types.ts
```

Modify these existing files:

```text
package.json
package-lock.json
tsconfig.json
.gitignore
public/config.js
public/index.html
public/js/state.js
public/js/renderer.js
public/js/views-admin.js
scripts/build-static.js
scripts/build-react-admin.mjs
scripts/check-js-syntax.mjs
scripts/check-native-release.mjs
scripts/check-pre-release.mjs
scripts/check-pages-readiness.mjs
scripts/react-admin-contract-test.mjs
scripts/react-admin-render-test.mjs
```

Task boundaries below are intentionally sequenced. Do not start Task 4 before Task 1-3 are green.

---

### Task 1: React Build Contract And Guard

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`
- Modify: `.gitignore`
- Modify: `public/config.js`
- Modify: `public/index.html`
- Modify: `public/js/state.js`
- Create: `scripts/build-react-admin.mjs`
- Modify: `scripts/build-static.js`
- Create: `scripts/react-admin-contract-test.mjs`
- Modify: `scripts/check-js-syntax.mjs`
- Modify: `scripts/check-pre-release.mjs`
- Modify: `scripts/check-native-release.mjs`
- Modify: `scripts/check-pages-readiness.mjs`

**Interfaces:**
- Produces generated assets:
  - `public/js/react-admin.generated.js`
  - `public/css/react-admin.generated.css`
  - `dist/js/react-admin.generated.js`
  - `dist/css/react-admin.generated.css`
- Produces script commands:
  - `npm run build:react-admin`
  - `npm run check:react-admin`
  - `npm run test:react-admin`
- Produces state/config contract:
  - `window.GJU_REACT_ADMIN_ENABLED = true`
  - `state.reactAdminEnabled === true` unless config is explicitly false

- [ ] **Step 1: Add failing contract test**

Create `scripts/react-admin-contract-test.mjs` with these checks:

```js
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
const buildStatic = read("scripts/build-static.js");
const gitignore = read(".gitignore");

assert.equal(pkg.scripts["build:react-admin"], "node scripts/build-react-admin.mjs --target public");
assert.equal(pkg.scripts["check:react-admin"], "tsc --noEmit && node scripts/build-react-admin.mjs --target public --dry-run && node scripts/react-admin-render-test.mjs");
assert.equal(pkg.scripts["test:react-admin"], "node scripts/react-admin-contract-test.mjs");
assert(pkg.scripts["release:check"].includes("npm run check:react-admin"), "release:check must include React Admin checks");
assert(pkg.scripts["release:check"].includes("npm run test:react-admin"), "release:check must include React Admin contract test");

assert(indexHtml.includes("/js/react-admin.generated.js?v="), "index.html must load React Admin generated JS");
assert(indexHtml.includes("/css/react-admin.generated.css?v="), "index.html must load React Admin generated CSS");
assert(publicConfig.includes("window.GJU_REACT_ADMIN_ENABLED = true"), "public config must enable React Admin by default");
assert(stateSource.includes("reactAdminEnabled"), "state must expose reactAdminEnabled");
assert(buildStatic.includes("build-react-admin.mjs"), "static build must produce React Admin generated assets");
assert(gitignore.includes("public/js/react-admin.generated.js"), "generated React Admin JS must be ignored");
assert(gitignore.includes("public/css/react-admin.generated.css"), "generated React Admin CSS must be ignored");

console.log("React Admin contract checks passed.");
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm run test:react-admin
```

Expected: fails because script entries and generated asset references do not exist yet.

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install react react-dom @astryxdesign/core
npm install -D typescript esbuild @types/react @types/react-dom
```

Expected: `package.json` and `package-lock.json` update. Do not install Framer Motion.

- [ ] **Step 4: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "allowJs": false,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["react", "react-dom"]
  },
  "include": ["src/react/**/*.ts", "src/react/**/*.tsx"]
}
```

- [ ] **Step 5: Add build script**

Create `scripts/build-react-admin.mjs` with this CLI contract:

```js
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const args = new Set(process.argv.slice(2));
const targetIndex = process.argv.indexOf("--target");
const targetName = targetIndex >= 0 ? process.argv[targetIndex + 1] : "public";
const dryRun = args.has("--dry-run");
const root = path.resolve(new URL("..", import.meta.url).pathname);
const outRoot = targetName === "dist" ? path.join(root, "dist") : path.join(root, "public");
const jsOutfile = path.join(outRoot, "js", "react-admin.generated.js");
const cssSource = path.join(root, "src", "react", "design-system", "react-admin.css");
const cssOutfile = path.join(outRoot, "css", "react-admin.generated.css");

if (!["public", "dist"].includes(targetName)) {
  throw new Error("--target must be public or dist");
}

if (!dryRun) {
  fs.mkdirSync(path.dirname(jsOutfile), { recursive: true });
  fs.mkdirSync(path.dirname(cssOutfile), { recursive: true });
}

await build({
  entryPoints: [path.join(root, "src", "react", "admin", "main.tsx")],
  outfile: jsOutfile,
  bundle: true,
  sourcemap: false,
  minify: targetName === "dist",
  format: "iife",
  target: ["es2020"],
  platform: "browser",
  globalName: "GJUReactAdminBundle",
  write: !dryRun,
  define: {
    "process.env.NODE_ENV": JSON.stringify(targetName === "dist" ? "production" : "development")
  }
});

if (dryRun) {
  if (!fs.existsSync(cssSource)) throw new Error(`Missing ${cssSource}`);
} else {
  fs.copyFileSync(cssSource, cssOutfile);
}

console.log(`React Admin bundle ${dryRun ? "checked" : "written"} for ${targetName}`);
```

- [ ] **Step 6: Add minimal temporary React entry for build only**

Create `src/react/admin/main.tsx` and `src/react/design-system/react-admin.css` with minimal content. Task 4 replaces this placeholder with the real shell, but it must expose the final global shape now.

`src/react/admin/main.tsx`:

```tsx
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import "../design-system/react-admin.css";

type MountOptions = {
  root: HTMLElement;
};

let rootInstance: Root | null = null;

function PlaceholderAdmin() {
  return <main className="react-admin-root">React Admin 준비중</main>;
}

function mount(options: MountOptions) {
  if (rootInstance) rootInstance.unmount();
  rootInstance = createRoot(options.root);
  rootInstance.render(<PlaceholderAdmin />);
}

function unmount() {
  if (!rootInstance) return;
  rootInstance.unmount();
  rootInstance = null;
}

window.GJUReactAdmin = { mount, unmount };
```

`src/react/design-system/react-admin.css`:

```css
.react-admin-root {
  min-height: 100%;
}
```

- [ ] **Step 7: Add browser global types**

Create `src/react/platform/types.ts`:

```ts
export type LegacyState = Record<string, unknown> & {
  adminView?: string;
  user?: { role?: string; name?: string; email?: string; studentId?: string };
  summary?: Record<string, unknown> | null;
  adminUsers?: unknown[];
  adminEquipment?: unknown[];
  adminSessions?: unknown[];
  adminLogs?: unknown[];
};

export type ReactAdminActions = {
  setAdminView(view: string): Promise<void> | void;
  refreshAdminData(): Promise<void>;
  logout(): Promise<void> | void;
  render(): void;
};

export type ReactAdminMountOptions = {
  root: HTMLElement;
  state: LegacyState;
  actions: ReactAdminActions;
  legacyRenderAdminContent: () => string;
};

declare global {
  interface Window {
    GJU_REACT_ADMIN_ENABLED?: boolean;
    GJUReactAdmin?: {
      mount(options: ReactAdminMountOptions): void;
      unmount(): void;
    };
  }
}
```

Update `main.tsx` to import and use `ReactAdminMountOptions`.

- [ ] **Step 8: Wire package scripts and static build**

Set `package.json`:

```json
"build:react-admin": "node scripts/build-react-admin.mjs --target public",
"check:react-admin": "tsc --noEmit && node scripts/build-react-admin.mjs --target public --dry-run && node scripts/react-admin-render-test.mjs",
"test:react-admin": "node scripts/react-admin-contract-test.mjs"
```

Update `release:check` to include:

```text
npm run check:react-admin && npm run test:react-admin
```

Update `scripts/build-static.js` after copying `public` to `dist`:

```js
const { spawnSync } = require("node:child_process");
const reactBuild = spawnSync(process.execPath, [path.join(root, "scripts/build-react-admin.mjs"), "--target", "dist"], { stdio: "inherit" });
if (reactBuild.status !== 0) process.exit(reactBuild.status || 1);
```

- [ ] **Step 9: Wire static references and guard**

Update `public/index.html` with generated assets using the current cache version string:

```html
<link rel="stylesheet" href="/css/react-admin.generated.css?v=20260703-react-admin-foundation" />
<script src="/js/react-admin.generated.js?v=20260703-react-admin-foundation"></script>
```

Keep `/app.js` as the module app entry after the React script.

Update `public/config.js`:

```js
(function () {
  window.GJU_API_BASE = "";
  window.GJU_REACT_ADMIN_ENABLED = true;
})();
```

Update `public/js/state.js`:

```js
reactAdminEnabled: window.GJU_REACT_ADMIN_ENABLED !== false,
```

- [ ] **Step 10: Ignore generated assets**

Add to `.gitignore`:

```gitignore
public/js/react-admin.generated.js
public/css/react-admin.generated.css
dist/js/react-admin.generated.js
dist/css/react-admin.generated.css
```

- [ ] **Step 11: Update release checks**

Update:

- `scripts/check-js-syntax.mjs`: include `src/react/**/*.ts` and `src/react/**/*.tsx` only through `tsc`; keep existing JS checks for JS files.
- `scripts/check-pre-release.mjs`: assert React generated CSS/JS references in `public/index.html`, assert `check:react-admin`, assert no Framer Motion dependency.
- `scripts/check-native-release.mjs`: update `requiredCacheVersion` to `20260703-react-admin-foundation`.
- `scripts/check-pages-readiness.mjs`: assert `pages:build` still equals `npm run build`.

- [ ] **Step 12: Run tests to verify GREEN**

Run:

```bash
npm run build:react-admin
npm run check:react-admin
npm run test:react-admin
npm run pages:build
```

Expected: all pass and generated files exist but are ignored by git.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore public/config.js public/index.html public/js/state.js scripts/build-react-admin.mjs scripts/build-static.js scripts/check-js-syntax.mjs scripts/check-pre-release.mjs scripts/check-native-release.mjs scripts/check-pages-readiness.mjs scripts/react-admin-contract-test.mjs src/react
git commit -m "2026-07-03 Add React Admin build foundation"
```

---

### Task 2: Renderer Bridge And Legacy Admin Content Fallback

**Files:**
- Modify: `public/js/renderer.js`
- Modify: `public/js/views-admin.js`
- Modify: `scripts/admin-dashboard-ux-test.mjs`
- Modify: `scripts/react-admin-contract-test.mjs`

**Interfaces:**
- Consumes `window.GJUReactAdmin.mount(options)`.
- Produces `legacyRenderAdminContent: () => string`.
- Produces fallback behavior when `state.reactAdminEnabled === false` or bundle is missing.

- [ ] **Step 1: Add failing renderer tests**

Extend `scripts/admin-dashboard-ux-test.mjs` with assertions:

```js
assert(viewsSource.includes("export function adminContent"), "legacy Admin content renderer must remain exported");
assert(rendererSource.includes("react-admin-root"), "renderer must include React Admin root");
assert(rendererSource.includes("window.GJUReactAdmin?.mount"), "renderer must mount React Admin when available");
assert(rendererSource.includes("window.GJUReactAdmin?.unmount"), "renderer must unmount React Admin when leaving Admin");
assert(rendererSource.includes("legacyRenderAdminContent"), "renderer must pass legacy Admin content fallback to React");
assert(rendererSource.includes("state.reactAdminEnabled !== false"), "renderer must guard React Admin with state.reactAdminEnabled");
```

Run:

```bash
npm run test:admin-ui
```

Expected: fails before bridge exists.

- [ ] **Step 2: Implement bridge in renderer**

Update `public/js/renderer.js` with these functions:

```js
let reactAdminMounted = false;

function unmountReactAdmin() {
  if (!reactAdminMounted) return;
  window.GJUReactAdmin?.unmount?.();
  reactAdminMounted = false;
}

function canUseReactAdmin() {
  return state.user?.role === "admin" && state.reactAdminEnabled !== false && typeof window.GJUReactAdmin?.mount === "function";
}

function renderReactAdminShell() {
  return `<div id="react-admin-root"></div>`;
}
```

In `render()`:

```js
const useReactAdmin = canUseReactAdmin();
const body = !state.user ? authView() : state.user.role === "admin" ? (useReactAdmin ? renderReactAdminShell() : adminShell()) : studentShell();
$app.innerHTML = `<div class="app">${body}${noticeBottomSheet()}${warningPopup()}${loadingOverlay()}${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}</div>`;
if (useReactAdmin) {
  const root = document.querySelector("#react-admin-root");
  if (root) {
    window.GJUReactAdmin.mount({
      root,
      state,
      actions: reactAdminActions,
      legacyRenderAdminContent: adminContent
    });
    reactAdminMounted = true;
  }
} else {
  unmountReactAdmin();
}
```

Add `reactAdminActions` in the same file:

```js
const reactAdminActions = {
  async setAdminView(view) {
    state.adminView = view;
    render();
  },
  async refreshAdminData() {
    document.dispatchEvent(new CustomEvent("gju-react-admin-refresh"));
  },
  logout() {
    document.dispatchEvent(new CustomEvent("gju-react-admin-logout"));
  },
  render
};
```

- [ ] **Step 3: Bridge refresh/logout custom events to existing handlers**

Update `public/js/events/admin-refresh.js` or `public/js/events.js` to listen for:

```js
document.addEventListener("gju-react-admin-refresh", async () => {
  const scrollState = captureScrollState();
  state.adminRefresh.refreshing = true;
  await refreshAdminDataPreservingScroll({ scrollState, includeMe: true });
  state.adminRefresh.refreshing = false;
  toast("최신 데이터를 불러왔습니다.", { scrollState });
});
```

Update `public/js/events/shared.js` or `public/js/events.js` to listen for logout through existing `logout()` action. If a direct imported logout creates a cycle, dispatch a click-compatible hidden path by creating a small exported `performLogout()` in `public/js/actions.js` and use it from both legacy and React events.

- [ ] **Step 4: Ensure legacy content function is exported**

`public/js/views-admin.js` already has `export function adminContent()`. Keep it shell-free and do not change its internal routing.

- [ ] **Step 5: Run tests**

```bash
npm run test:admin-ui
npm run test:react-admin
npm run check:js
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add public/js/renderer.js public/js/views-admin.js public/js/events.js public/js/events/admin-refresh.js public/js/events/shared.js public/js/actions.js scripts/admin-dashboard-ux-test.mjs scripts/react-admin-contract-test.mjs
git commit -m "2026-07-03 Bridge React Admin renderer"
```

---

### Task 3: GJU Design System Wrappers And Motion CSS

**Files:**
- Create/modify: `src/react/design-system/*`
- Create: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/react-admin-contract-test.mjs`

**Interfaces:**
- Produces wrapper-only imports for feature screens.
- Produces reusable props:
  - `GjuButton({ variant, tone, icon, loading, children })`
  - `GjuIconButton({ label, icon, tone, disabled })`
  - `GjuDialog({ open, title, body, confirmLabel, cancelLabel })`
  - `GjuToast({ message })`

- [ ] **Step 1: Add failing render test**

Create `scripts/react-admin-render-test.mjs`:

```js
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const buttonModule = await import("../src/react/design-system/Button.tsx");
const cardModule = await import("../src/react/design-system/Card.tsx");
const badgeModule = await import("../src/react/design-system/StatusBadge.tsx");

const iconButton = renderToStaticMarkup(
  React.createElement(buttonModule.GjuIconButton, { label: "삭제", icon: "trash", tone: "danger" })
);
assert(iconButton.includes('aria-label="삭제"'), "icon button must keep accessible label");
assert(!iconButton.includes(">삭제<"), "icon button must not render visible label text");
assert(iconButton.includes("gju-icon-button"), "icon button must use shared class");

const card = renderToStaticMarkup(
  React.createElement(cardModule.GjuCard, { title: "테스트 카드" }, "본문")
);
assert(card.includes("테스트 카드"), "card must render title");
assert(card.includes("gju-card"), "card must use shared class");

const badge = renderToStaticMarkup(
  React.createElement(badgeModule.GjuStatusBadge, { tone: "green" }, "가능")
);
assert(badge.includes("가능"), "status badge must render label");
assert(badge.includes("gju-status-badge"), "status badge must use shared class");

console.log("React Admin render checks passed.");
```

Run:

```bash
npm run check:react-admin
```

Expected: fails until wrappers exist.

- [ ] **Step 2: Implement wrappers**

Implement wrapper components using local classes and Astryx primitive imports where available. If an Astryx component import path differs, keep the GJU wrapper API stable and adapt only inside the wrapper file.

Required CSS class contract:

```text
gju-app-shell
gju-button
gju-icon-button
gju-card
gju-tabs
gju-table
gju-dialog
gju-toast
gju-empty-state
gju-status-badge
gju-motion-enter
```

Required icon names in `icons.tsx`:

```ts
export type GjuIconName = "refresh" | "user" | "logOut" | "trash" | "check" | "x" | "camera" | "fileText" | "userPlus" | "edit" | "plus";
```

Use inline SVG fallback icons in `icons.tsx` so the wrapper does not add a second icon dependency.

- [ ] **Step 3: Implement motion tokens**

In `src/react/design-system/motion.ts`:

```ts
export const motionClass = {
  screen: "gju-motion-screen",
  panel: "gju-motion-panel",
  toast: "gju-motion-toast",
  dialog: "gju-motion-dialog"
} as const;
```

In `react-admin.css`, add:

```css
:root {
  --gju-motion-duration-instant: 80ms;
  --gju-motion-duration-fast: 120ms;
  --gju-motion-duration-normal: 180ms;
  --gju-motion-duration-panel: 240ms;
  --gju-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
}

.gju-motion-screen {
  animation: gju-screen-enter var(--gju-motion-duration-normal) var(--gju-motion-ease-standard);
}

@keyframes gju-screen-enter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .gju-motion-screen,
  .gju-motion-panel,
  .gju-motion-toast,
  .gju-motion-dialog {
    animation: none;
    transition: none;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm run check:react-admin
npm run test:react-admin
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/react/design-system scripts/react-admin-render-test.mjs scripts/react-admin-contract-test.mjs
git commit -m "2026-07-03 Add GJU Astryx design wrappers"
```

---

### Task 4: React Admin Context, Actions, And Shell

**Files:**
- Create/modify: `src/react/platform/adminActions.ts`
- Create/modify: `src/react/platform/adminNav.ts`
- Modify: `src/react/admin/main.tsx`
- Create/modify: `src/react/admin/AdminApp.tsx`
- Create/modify: `src/react/admin/LegacyAdminPanel.tsx`
- Create/modify: `src/react/design-system/AppShell.tsx`
- Modify: `scripts/react-admin-render-test.mjs`

**Interfaces:**
- Consumes `ReactAdminMountOptions`.
- Produces React Admin shell that can render every Admin view.
- Produces stable navigation item keys:
  - `dashboard`, `users`, `reservations`, `equipment`, `reports`, `lectures`, `notices`, `logs`, `settings`, `account`.

- [ ] **Step 1: Add failing shell render test**

Extend `scripts/react-admin-render-test.mjs`:

```js
const appModule = await import("../src/react/admin/AdminApp.tsx");

const shellMarkup = renderToStaticMarkup(
  React.createElement(appModule.AdminApp, {
    state: { adminView: "dashboard", user: { role: "admin", name: "admin" }, summary: {} },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(shellMarkup.includes("gju-app-shell"), "React Admin shell must render app shell");
assert(shellMarkup.includes("학생 승인"), "React Admin shell must render Korean nav labels");
assert(shellMarkup.includes('aria-label="새로고침"'), "React Admin shell must render refresh icon action");
```

Run:

```bash
npm run check:react-admin
```

Expected: fails until `AdminApp` exists.

- [ ] **Step 2: Implement nav constants**

Create `src/react/platform/adminNav.ts`:

```ts
export const adminNavItems = [
  ["dashboard", "대시보드"],
  ["users", "학생 승인"],
  ["reservations", "예약 관리"],
  ["equipment", "기자재"],
  ["reports", "보고서"],
  ["lectures", "비교과 특강"],
  ["notices", "공지사항"],
  ["logs", "로그/세션"],
  ["settings", "설정"]
] as const;

export function adminTitle(view = "dashboard") {
  return {
    dashboard: "대시보드",
    users: "학생 승인",
    reservations: "예약 관리",
    equipment: "기자재 관리",
    reports: "보고서",
    lectures: "비교과 특강",
    notices: "공지사항",
    logs: "로그/세션",
    settings: "설정",
    account: "내 정보"
  }[view] || "대시보드";
}
```

- [ ] **Step 3: Implement shell**

`AdminApp.tsx` must:

- render `GjuAppShell`
- pass desktop nav, mobile header, mobile bottom nav
- render top actions as `GjuIconButton`
- use `actions.setAdminView("account")` for account
- use `actions.refreshAdminData()` for refresh
- use `actions.logout()` for logout
- route `dashboard`, `users`, `equipment`, `logs` to React screens after Task 5
- route all other Admin views to `LegacyAdminPanel`

Initial implementation can route all content to `LegacyAdminPanel` except dashboard placeholder until Task 5.

- [ ] **Step 4: Implement main mount**

Update `src/react/admin/main.tsx` so:

```tsx
function mount(options: ReactAdminMountOptions) {
  if (rootInstance) rootInstance.unmount();
  rootInstance = createRoot(options.root);
  rootInstance.render(<AdminApp {...options} />);
}
```

- [ ] **Step 5: Implement legacy panel**

`LegacyAdminPanel.tsx`:

```tsx
import { useEffect, useRef } from "react";

type Props = {
  renderHtml: () => string;
};

export function LegacyAdminPanel({ renderHtml }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = renderHtml();
  });
  return <div className="gju-legacy-admin-panel" ref={ref} />;
}
```

- [ ] **Step 6: Run tests**

```bash
npm run check:react-admin
npm run test:admin-ui
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/react/admin src/react/platform src/react/design-system/AppShell.tsx scripts/react-admin-render-test.mjs
git commit -m "2026-07-03 Add React Admin shell"
```

---

### Task 5: React Dashboard Screen

**Files:**
- Create/modify: `src/react/admin/screens/AdminDashboard.tsx`
- Modify: `src/react/admin/AdminApp.tsx`
- Modify: `scripts/react-admin-render-test.mjs`

**Interfaces:**
- Consumes `state.summary`, `state.adminReservations`, `state.adminEquipment`, `state.adminReports`, `state.adminLectures`, `state.adminNotices`.
- Produces React-owned dashboard cards with same labels:
  - `가입 승인 대기`
  - `대여완료`
  - `반납완료`
  - `대여취소`
  - `보고서 확인 필요`

- [ ] **Step 1: Add failing dashboard render test**

Extend `scripts/react-admin-render-test.mjs`:

```js
const dashboardMarkup = renderToStaticMarkup(
  React.createElement(appModule.AdminApp, {
    state: {
      adminView: "dashboard",
      user: { role: "admin" },
      summary: { pendingUsers: 2, equipmentCheckedOut: 1, equipmentReturned: 3, equipmentCancelled: 4, missingReports: 5 },
      adminReservations: [],
      adminEquipment: [],
      adminReports: [],
      adminLectures: [],
      adminNotices: []
    },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(dashboardMarkup.includes("가입 승인 대기"), "dashboard must render pending users card");
assert(dashboardMarkup.includes("대여완료"), "dashboard must render checked-out card");
assert(dashboardMarkup.includes("보고서 확인 필요"), "dashboard must render report card");
assert(!dashboardMarkup.includes("legacy"), "dashboard must be React-owned");
```

- [ ] **Step 2: Implement dashboard**

Use `GjuCard`, `GjuStatusBadge`, `motionClass.screen`. Action cards call `actions.setAdminView(...)` with the same target views as legacy dashboard.

Metric fallback:

```ts
const summary = state.summary || {};
const pendingUsers = Number(summary.pendingUsers || 0);
const checkedOut = Number(summary.equipmentCheckedOut || summary.pendingEquipment || 0);
const returned = Number(summary.equipmentReturned || 0);
const cancelled = Number(summary.equipmentCancelled || 0);
const missingReports = Number(summary.missingReports || 0);
```

- [ ] **Step 3: Route dashboard in AdminApp**

When `state.adminView === "dashboard"`, render `<AdminDashboard />`.

- [ ] **Step 4: Run tests**

```bash
npm run check:react-admin
npm run test:admin-ui
```

- [ ] **Step 5: Commit**

```bash
git add src/react/admin/screens/AdminDashboard.tsx src/react/admin/AdminApp.tsx scripts/react-admin-render-test.mjs
git commit -m "2026-07-03 Convert Admin dashboard to React"
```

---

### Task 6: React Users, Equipment, And Logs Screens

**Files:**
- Create/modify: `src/react/admin/screens/AdminUsers.tsx`
- Create/modify: `src/react/admin/screens/AdminEquipment.tsx`
- Create/modify: `src/react/admin/screens/AdminLogs.tsx`
- Modify: `src/react/admin/AdminApp.tsx`
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/admin-dashboard-ux-test.mjs`

**Interfaces:**
- Uses existing state arrays:
  - `state.adminUsers`
  - `state.adminEquipment`
  - `state.adminSessions`
- Keeps existing delegated action contracts:
  - `data-user-approval`
  - `data-user-limit-duration`
  - `data-user-reset`
  - `data-user-delete`
  - `data-equipment-bulk-status`
  - `data-equipment-bulk-remove`
  - `data-equipment-remove-admin`
  - `data-session-revoke`
- React action buttons must bubble to existing delegated event handlers.

- [ ] **Step 1: Add failing render tests**

Extend `scripts/react-admin-render-test.mjs`:

```js
const usersMarkup = renderToStaticMarkup(
  React.createElement(appModule.AdminApp, {
    state: {
      adminView: "users",
      user: { role: "admin" },
      adminUsers: [{ id: "u1", role: "student", name: "학생", email: "s@gju.local", studentId: "20260001", studentStatus: "재학생", phone: "010", approvalStatus: "approved" }]
    },
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(usersMarkup.includes('data-user-delete="u1"'), "React users screen must render delete action contract");
assert(usersMarkup.includes('aria-label="삭제"'), "React users delete must be icon-only accessible");
assert(!usersMarkup.includes(">삭제</button>"), "React users delete must not render visible delete text");

const equipmentMarkup = renderToStaticMarkup(
  React.createElement(appModule.AdminApp, {
    state: {
      adminView: "equipment",
      user: { role: "admin" },
      adminEquipment: [{ id: "e1", code: "CAM-1", name: "카메라", category: "Body", source: "school", status: "가능", active: true, reservable: true }]
    },
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(equipmentMarkup.includes('data-equipment-remove-admin="e1"'), "React equipment screen must render remove action contract");
assert(equipmentMarkup.includes('data-equipment-bulk-status="문의"'), "React equipment screen must include inquiry status action");

const logsMarkup = renderToStaticMarkup(
  React.createElement(appModule.AdminApp, {
    state: {
      adminView: "logs",
      user: { role: "admin" },
      adminSessions: [{ id: "s1", user: { name: "admin", email: "admin@gju.local" }, ip: "127.0.0.1", device: "Mac / Chrome", userAgent: "UA", createdAt: "2026-07-03T00:00:00.000Z", expiresAt: "2026-07-17T00:00:00.000Z" }],
      adminLogs: []
    },
    actions: noopActions,
    legacyRenderAdminContent: () => "<section>legacy</section>"
  })
);
assert(logsMarkup.includes('data-session-revoke="s1"'), "React logs screen must render session revoke action contract");
assert(!logsMarkup.includes(">로그아웃</button>"), "React session revoke must be icon-only");
```

- [ ] **Step 2: Implement users screen**

Render:

- search/filter controls remain legacy fallback for this milestone, but list rows and action panels must be React-owned.
- for each non-admin user:
  - identity
  - student id
  - student status
  - phone
  - status badge
  - approve/reject button with `data-user-approval`
  - limit select with `data-user-limit-duration`
  - reset button with `data-user-reset`
  - icon-only delete with `data-user-delete`

- [ ] **Step 3: Implement equipment screen**

Render:

- management tab content only.
- source/category filters can be rendered as display controls using current `state` values and `data-admin-equipment-tab`, `data-admin-equipment-category-tab`.
- bulk status buttons for `가능`, `수리중`, `파손`, `문의`.
- selected count from `state.adminSelectedEquipmentIds || []` if present; otherwise `0`.
- equipment rows with status actions and icon-only remove actions.

- [ ] **Step 4: Implement logs screen**

Render current login sessions table:

- user
- IP
- device/userAgent
- login date
- expiry date
- icon-only revoke button

Activity logs can remain below as a compact legacy fallback section in this milestone if the full log renderer is too large; the session table must be React-owned.

- [ ] **Step 5: Route screens in AdminApp**

Map:

```ts
users -> AdminUsers
equipment -> AdminEquipment
logs -> AdminLogs
```

- [ ] **Step 6: Update Admin UX tests**

Extend `scripts/admin-dashboard-ux-test.mjs` to assert React source contracts:

```js
const reactUsersSource = fs.readFileSync("src/react/admin/screens/AdminUsers.tsx", "utf8");
const reactEquipmentSource = fs.readFileSync("src/react/admin/screens/AdminEquipment.tsx", "utf8");
const reactLogsSource = fs.readFileSync("src/react/admin/screens/AdminLogs.tsx", "utf8");

assert(reactUsersSource.includes("data-user-delete"), "React users screen must keep delegated delete contract");
assert(reactEquipmentSource.includes("data-equipment-remove-admin"), "React equipment screen must keep delegated remove contract");
assert(reactEquipmentSource.includes('data-equipment-bulk-status="문의"'), "React equipment screen must expose inquiry status");
assert(reactLogsSource.includes("data-session-revoke"), "React logs screen must keep delegated revoke contract");
```

- [ ] **Step 7: Run tests**

```bash
npm run check:react-admin
npm run test:admin-ui
npm run test:react-admin
```

- [ ] **Step 8: Commit**

```bash
git add src/react/admin/screens src/react/admin/AdminApp.tsx scripts/react-admin-render-test.mjs scripts/admin-dashboard-ux-test.mjs
git commit -m "2026-07-03 Convert core Admin screens to React"
```

---

### Task 7: Dialog, Toast, Scroll, And Browser QA

**Files:**
- Modify: `src/react/design-system/Dialog.tsx`
- Modify: `src/react/design-system/Toast.tsx`
- Modify: `src/react/admin/AdminApp.tsx`
- Modify: `public/js/renderer.js`
- Modify: `scripts/react-admin-render-test.mjs`

**Interfaces:**
- Destructive actions may still use existing `confirm()` in legacy handlers during this milestone.
- React shell must render toast placement consistently with legacy `state.toast`.
- React dialog wrapper exists for next-step replacement of `confirm()`, but existing destructive flows do not need to be rewritten in this milestone.

- [ ] **Step 1: Add render tests**

Extend `scripts/react-admin-render-test.mjs`:

```js
const dialogModule = await import("../src/react/design-system/Dialog.tsx");
const toastModule = await import("../src/react/design-system/Toast.tsx");

const dialogMarkup = renderToStaticMarkup(
  React.createElement(dialogModule.GjuDialog, { open: true, title: "삭제 확인", onClose() {} }, "본문")
);
assert(dialogMarkup.includes("삭제 확인"), "dialog must render title");
assert(dialogMarkup.includes("gju-dialog"), "dialog must use shared class");

const toastMarkup = renderToStaticMarkup(
  React.createElement(toastModule.GjuToast, { message: "저장됨" })
);
assert(toastMarkup.includes("저장됨"), "toast must render message");
assert(toastMarkup.includes("gju-motion-toast"), "toast must use motion class");
```

- [ ] **Step 2: Implement Dialog and Toast wrappers**

Dialog requirements:

- `role="dialog"`
- `aria-modal="true"`
- title id linked by `aria-labelledby`
- close button with `aria-label="닫기"`
- reduced-motion CSS applies through `.gju-motion-dialog`

Toast requirements:

- `role="status"`
- `aria-live="polite"`
- `.gju-motion-toast`

- [ ] **Step 3: Keep scroll preservation through legacy handlers**

Do not rewrite existing action handlers. Ensure React action buttons keep the same `data-*` attributes so existing handlers continue to call `toast(..., { preserveScroll: true })` or `toast(..., { scrollState })`.

- [ ] **Step 4: Browser QA**

Run:

```bash
npm run dev
```

Verify in browser:

- Admin login succeeds.
- Dashboard is React-owned.
- Users screen delete buttons are icon-only.
- Equipment screen row remove buttons are icon-only.
- Logs session revoke buttons are icon-only.
- Reservations/reports/lectures/notices/settings still render through legacy fallback.
- Console has no relevant errors.

- [ ] **Step 5: Mobile QA**

Set mobile viewport around `390x844` and verify:

- mobile header top actions are icon-only.
- mobile bottom nav safe-area does not overlap content.
- student approval content scrolls.
- equipment content scrolls.

- [ ] **Step 6: Run automated checks**

```bash
npm run check:react-admin
npm run test:admin-ui
npm run release:check
```

- [ ] **Step 7: Commit**

```bash
git add src/react/design-system src/react/admin/AdminApp.tsx public/js/renderer.js scripts/react-admin-render-test.mjs
git commit -m "2026-07-03 Stabilize React Admin motion and overlays"
```

---

### Task 8: Final Cache Version, Native Sync Smoke, And Deployment Prep

**Files:**
- Modify all tracked files containing the prior cache version.
- Modify: `scripts/check-native-release.mjs`
- Modify: `docs/superpowers/specs/2026-07-03-react-astryx-motion-design.md` if ownership notes changed.
- Create or modify: `docs/release-qa-signoff.md` only if this project already records release signoff updates there for this release.

**Interfaces:**
- Final cache version: `20260703-react-astryx-admin`
- Production check remains:
  - `GJU_PRODUCTION_URL=https://gjureserve.co.kr npm run deploy:check`

- [ ] **Step 1: Update cache version**

Replace the current web cache version everywhere with:

```text
20260703-react-astryx-admin
```

Do not change unrelated dates or release notes.

- [ ] **Step 2: Run full automated checks**

```bash
npm run check
npm run check:js
npm run check:react-admin
npm run test:react-admin
npm run test:admin-ui
npm run test:equipment-ui
npm run test:storage
npm run test:security
npm run release:check
npm run pages:check
```

- [ ] **Step 3: Run static build and inspect generated assets**

```bash
npm run pages:build
test -f dist/js/react-admin.generated.js
test -f dist/css/react-admin.generated.css
```

Expected: both `test` commands exit `0`.

- [ ] **Step 4: Run native sync smoke**

```bash
npm run native:sync
```

Expected: Capacitor sync succeeds. If the local Xcode environment blocks an archive command, record that exact blocker in final notes; do not fake an App Store upload.

- [ ] **Step 5: Final browser QA**

Run local browser QA again after final cache version:

- desktop dashboard/users/equipment/logs
- mobile users/equipment
- legacy fallback tab
- console health

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json public scripts src docs capacitor.config.json
git commit -m "2026-07-03 Complete React Astryx Admin migration"
```

- [ ] **Step 7: Push and deploy only after all checks pass**

```bash
git push origin codex/sql-storage-pagination
npm run pages:build
npx wrangler pages deploy dist --project-name gju-reserve --branch codex/sql-storage-pagination --commit-hash "$(git rev-parse --short HEAD)" --commit-message "2026-07-03 React Astryx Admin migration"
GJU_PRODUCTION_URL=https://gjureserve.co.kr npm run deploy:check
```

Expected:

- Cloudflare Pages deploy succeeds.
- Production deploy check passes for `https://gjureserve.co.kr`.

---

## Execution Notes

- Use subagent-driven execution. Dispatch one subagent per task, then review the diff before starting the next task.
- Do not run code formatters that rewrite unrelated files.
- Do not remove legacy Admin views in this milestone.
- Do not rewrite student reservation screens.
- Do not change Worker API contracts or DB schema.
- If Astryx import paths differ from the docs, adapt only inside `src/react/design-system/*`; feature screens must continue importing GJU wrappers.
- If a task needs to adjust the plan because of package API reality, update this plan document in a separate commit before implementing that task.

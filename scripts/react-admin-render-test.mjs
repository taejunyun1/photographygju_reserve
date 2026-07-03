import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const renderEntry = await build({
  stdin: {
    contents: `
      export { GjuButton, GjuIconButton } from "../src/react/design-system/Button.tsx";
      export { GjuCard } from "../src/react/design-system/Card.tsx";
      export { GjuDialog } from "../src/react/design-system/Dialog.tsx";
      export { GjuEmptyState } from "../src/react/design-system/EmptyState.tsx";
      export { GjuStatusBadge } from "../src/react/design-system/StatusBadge.tsx";
      export { GjuTable } from "../src/react/design-system/Table.tsx";
      export { GjuToast } from "../src/react/design-system/Toast.tsx";
      export { AdminApp } from "../src/react/admin/AdminApp.tsx";
    `,
    resolveDir: path.join(process.cwd(), "scripts"),
    sourcefile: "scripts/react-admin-render-entry.tsx",
    loader: "tsx"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  external: ["react", "react-dom", "react-dom/server"]
});

const compiledModulePath = path.join(process.cwd(), "scripts", ".react-admin-render-test.compiled.mjs");
fs.writeFileSync(compiledModulePath, renderEntry.outputFiles[0].text);
process.on("exit", () => {
  if (fs.existsSync(compiledModulePath)) {
    fs.unlinkSync(compiledModulePath);
  }
});
const renderModule = await import(pathToFileURL(compiledModulePath).href);

const button = renderToStaticMarkup(
  React.createElement(renderModule.GjuButton, { tone: "danger" }, "삭제")
);
assert(button.includes("gju-button"), "button must use shared class");
assert(button.includes("astryx-button"), "button wrapper must adapt Astryx Button");
assert(button.includes('data-tone="danger"'), "button must preserve tone data attribute");

const iconButton = renderToStaticMarkup(
  React.createElement(renderModule.GjuIconButton, { label: "삭제", icon: "trash", tone: "danger" })
);
assert(iconButton.includes('aria-label="삭제"'), "icon button must keep accessible label");
assert(!iconButton.includes(">삭제<"), "icon button must not render visible label text");
assert(iconButton.includes("gju-icon-button"), "icon button must use shared class");
assert(iconButton.includes("astryx-button"), "icon button wrapper must adapt Astryx IconButton");

const card = renderToStaticMarkup(
  React.createElement(renderModule.GjuCard, { title: "테스트 카드" }, "본문")
);
assert(card.includes("테스트 카드"), "card must render title");
assert(card.includes("gju-card"), "card must use shared class");
assert(card.includes("astryx-card"), "card wrapper must adapt Astryx Card");

const badge = renderToStaticMarkup(
  React.createElement(renderModule.GjuStatusBadge, { tone: "green" }, "가능")
);
assert(badge.includes("가능"), "status badge must render label");
assert(badge.includes("gju-status-badge"), "status badge must use shared class");
assert(badge.includes("astryx-badge"), "status badge wrapper must adapt Astryx Badge");

const dialogMarkup = renderToStaticMarkup(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(renderModule.GjuDialog, { open: true, title: "첫 번째 확인" }),
    React.createElement(renderModule.GjuDialog, { open: true, title: "두 번째 확인" })
  )
);
assert(dialogMarkup.includes("gju-dialog"), "dialog must use shared class");
assert(dialogMarkup.includes("astryx-dialog"), "dialog wrapper must adapt Astryx Dialog");
const dialogIds = [...dialogMarkup.matchAll(/id="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((id) => id.includes("gju-dialog-title"));
assert.equal(dialogIds.length, 2, "dialog must render one title id per instance");
assert.equal(new Set(dialogIds).size, 2, "dialog title ids must be unique per instance");
for (const dialogId of dialogIds) {
  assert(dialogMarkup.includes(`aria-labelledby="${dialogId}"`), "dialog must label itself with its unique title id");
}

const emptyState = renderToStaticMarkup(
  React.createElement(renderModule.GjuEmptyState, {
    title: "비어 있음",
    message: "표시할 데이터가 없습니다."
  })
);
assert(emptyState.includes("gju-empty-state"), "empty state must use shared class");
assert(emptyState.includes("astryx-empty-state"), "empty state wrapper must adapt Astryx EmptyState");

const table = renderToStaticMarkup(
  React.createElement(
    renderModule.GjuTable,
    null,
    React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "이름"))),
    React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", null, "홍길동")))
  )
);
assert(table.includes("gju-table"), "table must use shared class");
assert(table.includes("astryx-table"), "table wrapper must adapt Astryx Table");

const toast = renderToStaticMarkup(
  React.createElement(renderModule.GjuToast, { message: "저장되었습니다." })
);
assert(toast.includes("gju-toast"), "toast must use shared class");
assert(toast.includes("astryx-toast"), "toast wrapper must adapt Astryx Toast");
assert(toast.includes("저장되었습니다."), "toast must render the message");

const shellMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
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
assert(shellMarkup.includes("gju-app-shell__sidebar gju-app-shell__desktop-only"), "React Admin shell must mark desktop sidebar chrome explicitly");
assert(shellMarkup.includes("gju-app-shell__mobile-header gju-app-shell__mobile-only"), "React Admin shell must mark mobile header chrome explicitly");
assert(shellMarkup.includes("gju-app-shell__bottom-nav gju-app-shell__mobile-only"), "React Admin shell must mark mobile bottom navigation explicitly");

const refreshingShellMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: {
      adminView: "dashboard",
      user: { role: "admin", name: "admin" },
      summary: {},
      adminRefresh: { refreshing: true }
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
assert(refreshingShellMarkup.includes('aria-label="새로고침 중"'), "React Admin refresh action must announce the in-progress label");
assert(refreshingShellMarkup.includes('aria-busy="true"'), "React Admin refresh action must expose aria-busy while refreshing");

const legacyFallbackMarkup = renderToStaticMarkup(
  React.createElement(renderModule.AdminApp, {
    state: { adminView: "reports", user: { role: "admin", name: "admin" }, summary: {} },
    actions: {
      setAdminView() {},
      refreshAdminData() {},
      logout() {},
      render() {}
    },
    legacyRenderAdminContent: () =>
      '<main class="admin-shell"><aside class="sidebar">legacy nav</aside><section class="admin-main"><header class="admin-mobile-header">mobile header</header><header class="admin-header">desktop header</header><section class="legacy-fragment">legacy report body</section></section><nav class="admin-mobile-nav">legacy bottom nav</nav></main>'
  })
);
assert(legacyFallbackMarkup.includes("gju-legacy-admin-panel"), "Non-dashboard admin views must render the legacy panel fallback");
assert(legacyFallbackMarkup.includes("legacy report body"), "Legacy fallback content must render inside the React Admin shell");
assert(!legacyFallbackMarkup.includes('class="admin-shell"'), "Legacy fallback must not re-render the old admin shell inside React Admin");
assert(!legacyFallbackMarkup.includes('class="admin-mobile-nav"'), "Legacy fallback must not duplicate the old mobile nav inside React Admin");

console.log("React Admin render checks passed.");

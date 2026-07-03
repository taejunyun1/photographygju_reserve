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
      export { GjuIconButton } from "../src/react/design-system/Button.tsx";
      export { GjuCard } from "../src/react/design-system/Card.tsx";
      export { GjuStatusBadge } from "../src/react/design-system/StatusBadge.tsx";
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

const iconButton = renderToStaticMarkup(
  React.createElement(renderModule.GjuIconButton, { label: "삭제", icon: "trash", tone: "danger" })
);
assert(iconButton.includes('aria-label="삭제"'), "icon button must keep accessible label");
assert(!iconButton.includes(">삭제<"), "icon button must not render visible label text");
assert(iconButton.includes("gju-icon-button"), "icon button must use shared class");

const card = renderToStaticMarkup(
  React.createElement(renderModule.GjuCard, { title: "테스트 카드" }, "본문")
);
assert(card.includes("테스트 카드"), "card must render title");
assert(card.includes("gju-card"), "card must use shared class");

const badge = renderToStaticMarkup(
  React.createElement(renderModule.GjuStatusBadge, { tone: "green" }, "가능")
);
assert(badge.includes("가능"), "status badge must render label");
assert(badge.includes("gju-status-badge"), "status badge must use shared class");

console.log("React Admin render checks passed.");

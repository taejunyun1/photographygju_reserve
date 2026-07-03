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

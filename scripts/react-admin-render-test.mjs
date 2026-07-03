import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const buildResult = spawnSync(process.execPath, ["scripts/build-react-admin.mjs", "--target", "public"], {
  stdio: "inherit"
});

assert.equal(buildResult.status, 0, "React Admin public build must succeed before render checks");
assert(fs.existsSync("public/js/react-admin.generated.js"), "React Admin generated JS must exist");
assert(fs.existsSync("public/css/react-admin.generated.css"), "React Admin generated CSS must exist");

const bundle = fs.readFileSync("public/js/react-admin.generated.js", "utf8");
const styles = fs.readFileSync("public/css/react-admin.generated.css", "utf8");

assert(bundle.includes("GJUReactAdmin"), "React Admin bundle must expose the browser global");
assert(bundle.includes("legacyRenderAdminContent"), "React Admin bundle must preserve the legacy content fallback at runtime");
assert(styles.includes(".react-admin-root"), "React Admin CSS bundle must still be emitted");

const context = {
  window: {},
  console
};

vm.runInNewContext(bundle, context);

assert.equal(typeof context.window.GJUReactAdmin?.mount, "function", "React Admin runtime must expose mount()");
assert.equal(typeof context.window.GJUReactAdmin?.unmount, "function", "React Admin runtime must expose unmount()");

const firstRoot = { innerHTML: "" };
const secondRoot = { innerHTML: "" };
let fallbackCalls = 0;

context.window.GJUReactAdmin.mount({
  root: firstRoot,
  state: {},
  actions: {},
  legacyRenderAdminContent() {
    fallbackCalls += 1;
    return '<section data-legacy-admin="first">Legacy Admin</section>';
  }
});

assert.equal(fallbackCalls, 1, "React Admin mount must call the legacy content fallback");
assert(firstRoot.innerHTML.includes('data-legacy-admin="first"'), "React Admin mount must render the legacy admin content into the provided root");

context.window.GJUReactAdmin.mount({
  root: secondRoot,
  state: {},
  actions: {},
  legacyRenderAdminContent() {
    fallbackCalls += 1;
    return '<section data-legacy-admin="second">Legacy Admin Updated</section>';
  }
});

assert.equal(fallbackCalls, 2, "React Admin remount must call the legacy content fallback again");
assert.equal(firstRoot.innerHTML, "", "React Admin remount must clear the previous root");
assert(secondRoot.innerHTML.includes('data-legacy-admin="second"'), "React Admin remount must render the updated legacy admin content");

context.window.GJUReactAdmin.unmount();

assert.equal(secondRoot.innerHTML, "", "React Admin unmount must clear the mounted legacy admin content");

console.log("React Admin render checks passed.");

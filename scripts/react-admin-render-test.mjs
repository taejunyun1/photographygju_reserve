import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const buildResult = spawnSync(process.execPath, ["scripts/build-react-admin.mjs", "--target", "public"], {
  stdio: "inherit"
});

assert.equal(buildResult.status, 0, "React Admin public build must succeed before render checks");
assert(fs.existsSync("public/js/react-admin.generated.js"), "React Admin generated JS must exist");
assert(fs.existsSync("public/css/react-admin.generated.css"), "React Admin generated CSS must exist");

const bundle = fs.readFileSync("public/js/react-admin.generated.js", "utf8");
const styles = fs.readFileSync("public/css/react-admin.generated.css", "utf8");

assert(bundle.includes("GJUReactAdmin"), "React Admin bundle must expose the browser global");
assert(bundle.includes("react-admin-root"), "React Admin bundle must render the placeholder shell root");
assert(styles.includes(".react-admin-root"), "React Admin CSS must include the placeholder root class");

console.log("React Admin render checks passed.");

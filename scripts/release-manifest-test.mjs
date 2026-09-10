import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { buildReleaseManifest } = await import("./generate-release-manifest.mjs").catch(() => ({}));
assert.equal(typeof buildReleaseManifest, "function", "release manifest builder must be exported");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gju-release-manifest-"));
fs.writeFileSync(path.join(directory, "app.js"), "alpha");
fs.writeFileSync(path.join(directory, ".htaccess"), "not deployed by Cloudflare Assets");
const first = buildReleaseManifest({ directory, commit: "abc123", target: "test" });
fs.writeFileSync(path.join(directory, "app.js"), "beta");
const second = buildReleaseManifest({ directory, commit: "abc123", target: "test" });
assert.equal(first.commit, "abc123");
assert.equal(first.target, "test");
assert.notEqual(first.assets["app.js"], second.assets["app.js"], "asset content changes must change its release hash");
assert.equal("release.json" in second.assets, false, "manifest must not hash itself");
assert.equal(".htaccess" in second.assets, false, "manifest must exclude dotfiles that static hosting does not deploy");

console.log("Release manifest checks passed.");

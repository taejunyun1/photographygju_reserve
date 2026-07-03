const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const source = path.join(root, "public");
const output = path.join(root, "dist");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, output, { recursive: true });

const reactBuild = spawnSync(process.execPath, [path.join(root, "scripts/build-react-admin.mjs"), "--target", "dist"], {
  stdio: "inherit"
});
if (reactBuild.status !== 0) process.exit(reactBuild.status || 1);

console.log("Static build written to dist/");

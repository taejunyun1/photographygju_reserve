import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const bundlePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "android/app/build/outputs/bundle/release/app-release.aab");
const androidStudioJbr = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
const javaHome = process.env.JAVA_HOME || (fs.existsSync(androidStudioJbr) ? androidStudioJbr : "");
const jarsigner = javaHome ? path.join(javaHome, "bin", "jarsigner") : "jarsigner";

function fail(message) {
  console.error(`Android release check failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(bundlePath)) fail(`missing bundle at ${bundlePath}`);

const stat = fs.statSync(bundlePath);
if (!stat.size) fail(`bundle is empty at ${bundlePath}`);

const result = spawnSync(jarsigner, ["-verify", "-verbose", "-certs", bundlePath], {
  encoding: "utf8"
});
const output = `${result.stdout || ""}\n${result.stderr || ""}`;

if (result.status !== 0) fail(output.trim() || `jarsigner exited with ${result.status}`);
if (/jar is unsigned/i.test(output)) fail("release bundle is unsigned");
if (!/jar verified/i.test(output)) fail("release bundle signature could not be verified");

console.log(`ok - signed Android release bundle: ${path.relative(root, bundlePath)} (${Math.round(stat.size / 1024)} KiB)`);

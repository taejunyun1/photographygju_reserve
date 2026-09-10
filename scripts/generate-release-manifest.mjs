import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

function assetFiles(directory, current = directory) {
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) return assetFiles(directory, absolute);
    const relative = path.relative(directory, absolute).split(path.sep).join("/");
    return relative === "release.json" ? [] : [relative];
  }).sort();
}

export function buildReleaseManifest({ directory, commit, target = "web", generatedAt = new Date().toISOString() }) {
  const assets = Object.fromEntries(assetFiles(directory).map((relative) => [
    relative,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, relative))).digest("hex")
  ]));
  return { schemaVersion: 1, commit, target, generatedAt, assets };
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(projectRoot, argValue("--directory", "dist"));
  const target = argValue("--target", "web");
  const commit = argValue("--commit") || execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
  const manifest = buildReleaseManifest({ directory, commit, target });
  fs.writeFileSync(path.join(directory, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Release manifest written for ${target} at ${commit.slice(0, 12)}`);
}

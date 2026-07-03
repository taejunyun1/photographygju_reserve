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

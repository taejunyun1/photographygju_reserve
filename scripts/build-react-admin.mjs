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
const studentJsOutfile = path.join(outRoot, "js", "react-student.generated.js");
const studentCssOutfile = path.join(outRoot, "css", "react-student.generated.css");

if (!["public", "dist"].includes(targetName)) {
  throw new Error("--target must be public or dist");
}

if (!dryRun) {
  fs.mkdirSync(path.dirname(jsOutfile), { recursive: true });
  fs.mkdirSync(path.dirname(cssOutfile), { recursive: true });
  fs.mkdirSync(path.dirname(studentJsOutfile), { recursive: true });
  fs.mkdirSync(path.dirname(studentCssOutfile), { recursive: true });
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

const studentBuild = await build({
  entryPoints: [path.join(root, "src", "react", "app", "student-main.tsx")],
  outfile: studentJsOutfile,
  bundle: true,
  sourcemap: false,
  minify: targetName === "dist",
  format: "iife",
  target: ["es2020"],
  platform: "browser",
  globalName: "GJUReactStudentBundle",
  write: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify(targetName === "dist" ? "production" : "development")
  }
});

if (dryRun) {
  if (!fs.existsSync(cssSource)) throw new Error(`Missing ${cssSource}`);
} else {
  fs.copyFileSync(cssSource, cssOutfile);
  const studentJavaScript = studentBuild.outputFiles.find((file) => file.path.endsWith(".js"));
  const studentCss = studentBuild.outputFiles.find((file) => file.path.endsWith(".css"));
  if (!studentJavaScript || !studentCss) throw new Error("Student React bundle did not emit JavaScript and CSS");
  fs.writeFileSync(studentJsOutfile, studentJavaScript.contents);
  fs.writeFileSync(studentCssOutfile, studentCss.contents);
}

console.log(`React Admin/Student bundles ${dryRun ? "checked" : "written"} for ${targetName}`);

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const targets = ["public", "scripts"];

function listJavaScriptFiles(dir) {
  const base = path.join(root, dir);
  const output = [];
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (/\.(js|mjs)$/.test(entry.name)) {
        output.push(fullPath);
      }
    }
  }
  return output.sort();
}

const files = targets.flatMap(listJavaScriptFiles);

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  console.log(`ok - ${path.relative(root, file)}`);
}

console.log(`JavaScript syntax checks passed (${files.length} files).`);

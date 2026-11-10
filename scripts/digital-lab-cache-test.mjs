import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const version = '20261110-digital-lab-r1';
const root = resolve('public');
const seen = new Set();
async function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)) {
    const [path, query = ''] = match[1].split('?');
    if (!/\.m?js$/.test(path)) continue;
    assert.equal(new URLSearchParams(query).get('v'), version, `${file}: stale/unversioned dependency ${match[1]}`);
    await visit(resolve(dirname(file), path));
  }
}
const html = await readFile(resolve(root, 'index.html'), 'utf8');
for (const asset of ['app.js', 'js/react-admin.generated.js', 'js/react-student.generated.js', 'css/react-admin.generated.css', 'css/react-student.generated.css']) {
  assert.ok(html.includes(`/${asset}?v=${version}`), `HTML version for ${asset}`);
}
await visit(resolve(root, 'app.js'));
assert.ok(seen.has(resolve(root, 'js/notification-planner.js')));
assert.ok(seen.has(resolve(root, 'js/state.js')));
console.log(`PASS: ${seen.size} browser modules share ${version}, including notification planner and state`);

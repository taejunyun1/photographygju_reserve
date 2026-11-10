// Explicit snapshot input: normal release checks must not depend on disposable old bundles.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { initialDb, handleApiRequest } from '../core.mjs';

const snapshot = process.argv[2];
assert.ok(snapshot, 'Usage: node scripts/digital-lab-compatibility-test.mjs /absolute/previous-production [screenshot-directory]');
const root = resolve(snapshot);
const screenshotDir = process.argv[3];
const manifest = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
for (const [path, hash] of Object.entries(manifest.assets)) assert.equal(createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'), hash, `unchanged old asset ${path}`);
const db = await initialDb('compatibility-password');
async function api(path, method = 'GET', body, token = '') {
  const url = new URL(path, 'http://fixture');
  return handleApiRequest({ db, method, pathname: url.pathname, searchParams: url.searchParams, authorization: `Bearer ${token}`, readText: async () => JSON.stringify(body), saveDb: async () => {} });
}
async function data(...args) { const result = await api(...args); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data; }
const admin = await data('/api/auth/login', 'POST', { loginId: 'admin', password: 'compatibility-password' });
const { user } = await data('/api/auth/signup', 'POST', { name: '이전 번들 테스트', email: 'old-client@example.test', phone: '01000000101', password: 'compatibility-password', studentStatus: '재학생' });
await data(`/api/admin/users/${user.id}/approval`, 'PATCH', { approvalStatus: 'approved' }, admin.token);
const student = await data('/api/auth/login', 'POST', { loginId: user.email, password: 'compatibility-password' });
await data('/api/admin/settings', 'PATCH', { digitalLabEnabled: true, digitalLabOpenTime: '00:00', digitalLabCloseTime: '24:00' }, admin.token);
const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const reservation = await data('/api/reservations', 'POST', { type: 'digital_lab', fields: { reservedDate: date, seatId: 'mac-01', startTime: '10:00', endTime: '12:00', purpose: '이전 배포 호환성', phone: '01000000101' } }, student.token);
const seen = { student: false, admin: false };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://fixture');
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const token = request.headers.authorization?.replace(/^Bearer /, '') || '';
      const result = await api(request.url, request.method, body ? JSON.parse(body) : undefined, token);
      if (JSON.stringify(result.body).includes(reservation.id)) seen[token === student.token ? 'student' : 'admin'] = true;
      response.writeHead(result.status, { 'content-type': 'application/json' }); response.end(JSON.stringify(result.body)); return;
    }
    const path = resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
    assert.ok(path.startsWith(`${root}/`));
    const type = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream';
    response.writeHead(200, { 'content-type': type }); response.end(await readFile(path));
  } catch (error) { response.writeHead(500); response.end(error.message); }
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch();
  const errors = [];
  for (const [role, token] of [['student', student.token], ['admin', admin.token]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
    await page.addInitScript(value => localStorage.setItem('gju_token', value), token);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const nav = page.getByRole('navigation', { name: role === 'student' ? '학생 메뉴' : '관리자 모바일 메뉴' });
    await nav.getByRole('button', { name: role === 'student' ? '내 예약' : '예약', exact: true }).filter({ visible: true }).click();
    if (role === 'admin') await page.getByRole('tablist', { name: '예약 유형' }).getByRole('tab', { name: '전체', exact: true }).click();
    await page.getByText(role === 'student' ? '10:00–12:00' : user.email, { exact: false }).filter({ visible: true }).first().waitFor({ state: 'visible' });
    assert.equal(seen[role], true, `${role} received new digital_lab reservation from actual current API`);
    if (screenshotDir) { await mkdir(screenshotDir, { recursive: true }); await page.screenshot({ path: resolve(screenshotDir, `old-bundle-${role}.png`), fullPage: true }); }
    await context.close();
  }
  assert.deepEqual(errors, [], 'old bundle must consume new type without runtime exceptions');
  console.log(`PASS: unchanged previous ${manifest.commit}, ${Object.keys(manifest.assets).length} SHA-256 assets; current API digital_lab payload rendered in owner/admin lists; zero pageerrors`);
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }

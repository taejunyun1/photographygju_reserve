import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { initialDb } from '../core.mjs';

const directory = await mkdtemp(`${tmpdir()}/digital-lab-worker-`);
try {
  await build({ entryPoints: ['worker.mjs'], bundle: true, platform: 'node', format: 'esm', outfile: `${directory}/worker.mjs`, plugins: [{ name: 'platform', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'platform', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }' }));
  } }] });
  const { GjuReserveDb } = await import(`${directory}/worker.mjs`);
  const sqlite = new DatabaseSync(':memory:');
  const legacy = await initialDb('admin-pass');
  let failSave = false, alarmAt = null;
  const storage = {
    sql: { exec(query, ...params) { const statement = sqlite.prepare(query); const rows = statement.columns().length ? statement.all(...params) : (statement.run(...params), []); return { toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() }; } },
    transactionSync(callback) { sqlite.exec('BEGIN'); try { const result = callback(); if (failSave) throw new Error('injected save failure'); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
    async get() { return structuredClone(legacy); },
    async getAlarm() { return alarmAt; }, async setAlarm(value) { alarmAt = value; }, async deleteAlarm() { alarmAt = null; }
  };
  const env = { ADMIN_PASSWORD: 'admin-pass', EQUIPMENT_OVERDUE_ACTIVATION_AT: '2026-10-12T04:17:07.000Z' };
  let owner = new GjuReserveDb({ storage }, env);
  const api = (path = '/api/bootstrap', method = 'GET', body, token = '') => owner.fetch(new Request(`https://test${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  assert.equal((await api()).status, 200);
  const before = await owner.store.loadDb();
  const originalAlarm = alarmAt;
  for (const flag of [undefined, '', 'bad-date', '123', '2026-02-30T00:00:00.000Z', '2999-01-01T00:00:00.000Z']) {
    env.DIGITAL_LAB_ACTIVATION_AT = flag;
    assert.equal((await api()).status, 200);
    assert.equal((await owner.store.loadDb()).settings.digitalLabEnabled, false);
    assert.equal(Object.hasOwn((await owner.store.loadDb()).meta, 'digitalLabActivationApplied'), false);
  }
  env.DIGITAL_LAB_ACTIVATION_AT = '2026-01-01T00:00:00.000Z';
  failSave = true;
  assert.equal((await api()).status, 500, 'activation save failure must not expose enabled settings');
  assert.equal(owner.db, null, 'discard uncommitted cached activation');
  assert.deepEqual(await owner.store.loadDb(), before, 'SQLite rollback preserves all records');
  failSave = false;
  const responses = await Promise.all(Array.from({ length: 8 }, () => api()));
  assert.ok(responses.every(response => response.status === 200));
  let db = await owner.store.loadDb();
  assert.equal(db.settings.digitalLabEnabled, true);
  assert.equal(db.settings.digitalLabOpenTime, '00:00');
  assert.equal(db.settings.digitalLabCloseTime, '24:00');
  assert.equal(db.meta.digitalLabActivationApplied, env.DIGITAL_LAB_ACTIVATION_AT);
  assert.deepEqual({ ...db.settings, digitalLabEnabled: before.settings.digitalLabEnabled, digitalLabOpenTime: before.settings.digitalLabOpenTime, digitalLabCloseTime: before.settings.digitalLabCloseTime }, before.settings);
  assert.deepEqual(db.users, before.users); assert.deepEqual(db.reservations, before.reservations);
  assert.equal(alarmAt, originalAlarm, 'digital activation must not postpone existing overdue alarm');
  const login = await (await api('/api/auth/login', 'POST', { loginId: 'admin', password: 'admin-pass' })).json();
  const token = login.data.token;
  assert.equal((await api('/api/admin/settings', 'PATCH', { digitalLabEnabled: false, digitalLabOpenTime: '08:00', digitalLabCloseTime: '20:00' }, token)).status, 200);
  owner = new GjuReserveDb({ storage }, env);
  await api();
  db = await owner.store.loadDb();
  assert.equal(db.settings.digitalLabEnabled, false); assert.equal(db.settings.digitalLabOpenTime, '08:00'); assert.equal(db.settings.digitalLabCloseTime, '20:00');
  // Simulate the pre-activation deployment. An explicit administrator choice vetoes defaults.
  env.DIGITAL_LAB_ACTIVATION_AT = undefined;
  delete (await owner.loadDb()).meta.digitalLabActivationApplied;
  await owner.saveDb();
  failSave = true;
  assert.ok((await api('/api/admin/settings', 'PATCH', { digitalLabEnabled: false }, token)).status >= 400);
  failSave = false;
  assert.equal(Object.hasOwn((await owner.store.loadDb()).meta, 'digitalLabActivationApplied'), false);
  assert.equal((await api('/api/admin/settings', 'PATCH', { digitalLabOpenTime: '06:00' }, token)).status, 200);
  db = await owner.store.loadDb();
  assert.ok(db.meta.digitalLabActivationApplied, 'explicit hours alone persist administrator veto');
  const marker = db.meta.digitalLabActivationApplied;
  env.DIGITAL_LAB_ACTIVATION_AT = '2026-01-02T00:00:00.000Z';
  owner = new GjuReserveDb({ storage }, env);
  await api();
  assert.equal((await owner.store.loadDb()).settings.digitalLabEnabled, false);
  assert.equal((await owner.store.loadDb()).settings.digitalLabOpenTime, '06:00');
  assert.equal((await owner.store.loadDb()).meta.digitalLabActivationApplied, marker);
  sqlite.close();
  console.log('PASS: digital lab real Worker/SQLite missing-invalid-future flag, rollback, queue, restart, administrator veto, settings/alarm preservation');
} finally { await rm(directory, { recursive: true, force: true }); }

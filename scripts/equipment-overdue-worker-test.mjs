import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { initialDb } from '../core.mjs';
const directory = await mkdtemp(`${tmpdir()}/overdue-worker-`);
try {
  await build({entryPoints:['worker.mjs'],bundle:true,platform:'node',format:'esm',outfile:`${directory}/worker.mjs`,plugins:[{name:'platform',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'platform',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
  const { GjuReserveDb } = await import(`${directory}/worker.mjs`);
  const sqlite = new DatabaseSync(':memory:');
  let alarmAt = null, failSave = false, failAlarm = false;
  const legacy = await initialDb('admin-pass');
  const storage = {
    sql:{exec(query,...params){const statement=sqlite.prepare(query); const rows=statement.columns().length?statement.all(...params):(statement.run(...params),[]);return {toArray:()=>rows,one:()=>rows[0], [Symbol.iterator]:()=>rows[Symbol.iterator]()};}},
    transactionSync(callback){sqlite.exec('BEGIN');try {const result=callback(); if(failSave)throw new Error('injected save failure');sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}},
    async get(){return structuredClone(legacy);},
    async getAlarm(){return alarmAt;},
    async setAlarm(value){if(failAlarm)throw new Error('injected alarm failure');alarmAt=value;},
    async deleteAlarm(){alarmAt=null;}
  };
  const env={ADMIN_PASSWORD:'admin-pass',INTERNAL_CRON_SECRET:'secret',EQUIPMENT_OVERDUE_ACTIVATION_AT:'2026-01-01T00:00:00Z'};
  let owner=new GjuReserveDb({storage},env);
  const api=(path,method='GET',body,token='')=>owner.fetch(new Request(`https://test${path}`,{method,headers:{authorization:token?`Bearer ${token}`:'','content-type':'application/json'},body:body?JSON.stringify(body):undefined}));
  const bootstrap=await api('/api/bootstrap');assert.equal(bootstrap.status,200,await bootstrap.text());
  assert.ok(alarmAt>Date.now(),'first successful API arms pending activation');
  const firstAlarm=alarmAt;
  await api('/api/bootstrap');assert.equal(alarmAt,firstAlarm,'requests never postpone alarm');
  failSave=true;alarmAt=null;
  await assert.rejects(owner.alarm(),/injected save failure/);failSave=false;
  assert.equal(owner.db,null);assert.ok(alarmAt);
  const failedActivation=await owner.store.loadDb();
  assert.equal(failedActivation.settings.equipmentOverdueWarningsEnabled,false);
  assert.equal(Object.hasOwn(failedActivation.meta,'equipmentOverdueActivationApplied'),false);
  alarmAt=null;await owner.alarm();
  let db=await owner.store.loadDb();assert.equal(db.settings.equipmentOverdueWarningsEnabled,true);assert.ok(db.meta.equipmentOverdueActivationApplied);assert.ok(alarmAt>Date.now());
  const activatedAt=db.settings.equipmentOverdueWarningsEnabledAt;
  owner=new GjuReserveDb({storage},env);alarmAt=null;await owner.alarm();
  db=await owner.store.loadDb();assert.equal(db.settings.equipmentOverdueWarningsEnabledAt,activatedAt);assert.ok(alarmAt);
  const login=await (await api('/api/auth/login','POST',{loginId:'admin',password:'admin-pass'})).json();
  const token=login.data.token;
  assert.ok(token);
  assert.equal((await api('/api/admin/settings','PATCH',{equipmentOverdueWarningsEnabled:false},token)).status,200);
  assert.equal(alarmAt,null,'administrator stop removes alarm');
  await api('/api/bootstrap');assert.equal(alarmAt,null);
  await owner.alarm();assert.equal((await owner.store.loadDb()).settings.equipmentOverdueWarningsEnabled,false);assert.equal(alarmAt,null);
  await api('/api/admin/settings','PATCH',{equipmentOverdueWarningsEnabled:true},token);
  const fixture=await owner.loadDb();
  fixture.settings.equipmentOverdueWarningsEnabledAt='2026-01-01T00:00:00Z';
  fixture.users.push({id:'overdue-student',role:'student',warningCount:0});
  fixture.reservations.push({id:'overdue-reservation',userId:'overdue-student',type:'equipment',status:'checked_out',fields:{reservedDate:'2026-01-02',period:'당일',rentalTime:'09:00',returnTime:'17:00',equipmentItemIds:['fixture-equipment']}});
  await owner.saveDb();
  const before=await owner.store.loadDb();failSave=true;alarmAt=null;
  await assert.rejects(owner.alarm(),/injected save failure/);failSave=false;
  assert.equal(owner.db,null,'failed mutation discarded');assert.ok(alarmAt,'failure retains future alarm beyond platform retry limit');
  assert.deepEqual(await owner.store.loadDb(),before,'real SQLite transaction rolls back');
  const usersBefore=structuredClone(before.users),reservationsBefore=structuredClone(before.reservations);
  alarmAt=null;
  await Promise.all([owner.alarm(),owner.fetch(new Request('https://test/api/internal/equipment-overdue',{method:'POST',headers:{'x-internal-cron-secret':'secret'}}))]);
  db=await owner.store.loadDb();assert.deepEqual(db.users.filter(u=>u.id!=='overdue-student'),usersBefore.filter(u=>u.id!=='overdue-student'));assert.deepEqual(db.reservations,reservationsBefore);assert.equal(db.warnings.filter(w=>w.id==='equipment_overdue:overdue-reservation').length,1);assert.equal(db.users.find(u=>u.id==='overdue-student').warningCount,1);
  // Explicit stop before first ENV activation must be durable too.
  const pending=await owner.loadDb();
  pending.settings.equipmentOverdueWarningsEnabled=false;
  pending.settings.equipmentOverdueWarningsEnabledAt='';
  delete pending.meta.equipmentOverdueActivationApplied;
  await owner.saveDb();
  failSave=true;
  assert.ok((await api('/api/admin/settings','PATCH',{equipmentOverdueWarningsEnabled:false},token)).status>=400);
  failSave=false;
  assert.equal(Object.hasOwn((await owner.store.loadDb()).meta,'equipmentOverdueActivationApplied'),false,'failed stop does not persist its marker');
  assert.equal((await api('/api/admin/settings','PATCH',{equipmentOverdueWarningsEnabled:false},token)).status,200);
  assert.equal(alarmAt,null,'preactivation administrator stop cancels pending activation');
  owner=new GjuReserveDb({storage},env);
  await api('/api/bootstrap');await owner.alarm();
  const stopped=await owner.store.loadDb();
  assert.equal(stopped.settings.equipmentOverdueWarningsEnabled,false);
  assert.equal(stopped.settings.equipmentOverdueWarningsEnabledAt,'');
  assert.equal(Object.hasOwn(stopped.meta,'equipmentOverdueActivationApplied'),true);
  const stoppedMarker=stopped.meta.equipmentOverdueActivationApplied;
  await api('/api/admin/settings','PATCH',{equipmentOverdueWarningsEnabled:false},token);
  assert.equal((await owner.store.loadDb()).meta.equipmentOverdueActivationApplied,stoppedMarker,'repeat stop preserves original marker');
  await api('/api/admin/settings','PATCH',{equipmentOverdueWarningsEnabled:true},token);
  failAlarm=true;alarmAt=null;assert.equal((await api('/api/bootstrap')).status,200,'committed successful API survives alarm write failure');failAlarm=false;
  sqlite.close();console.log('PASS: actual Worker API/alarm, SQLite rollback, restart, stop, queue, arming failure');
} finally {await rm(directory,{recursive:true,force:true});}

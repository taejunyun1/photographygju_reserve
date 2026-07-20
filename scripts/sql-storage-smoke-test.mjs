import assert from "node:assert/strict";
import { initialDb } from "../core.mjs";
import { createSqlAppStore } from "../storage-sql.mjs";

class FakeCursor {
  constructor(rows = []) {
    this.rows = rows;
  }

  toArray() {
    return this.rows;
  }

  one() {
    return this.rows[0] || {};
  }
}

class FakeSql {
  constructor() {
    this.statements = [];
    this.records = {
      app_singletons: new Map(),
      users: new Map(),
      sessions: new Map(),
      equipment: new Map(),
      reservations: new Map(),
      reports: new Map(),
      lectures: new Map(),
      lecture_applications: new Map(),
      notices: new Map(),
      warnings: new Map(),
      audit_logs: new Map(),
      slack_logs: new Map(),
      import_batches: new Map()
    };
  }

  exec(sql, ...params) {
    const compactSql = sql.replace(/\s+/g, " ").trim();
    this.statements.push({ sql: compactSql, params });

    const tableCountMatch = compactSql.match(/^SELECT COUNT\(\*\) AS count FROM ([a-z_]+)/i);
    if (tableCountMatch) {
      return new FakeCursor([{ count: this.records[tableCountMatch[1]]?.size || 0 }]);
    }

    const selectDataMatch = compactSql.match(/^SELECT (?:name, )?data FROM ([a-z_]+)/i);
    if (selectDataMatch) {
      const table = selectDataMatch[1];
      const rows = [...(this.records[table] || new Map())].map(([id, row]) => ({ id, name: id, data: row.data }));
      return new FakeCursor(rows);
    }

    const deleteByIdMatch = compactSql.match(/^DELETE FROM ([a-z_]+) WHERE id = \?/i);
    if (deleteByIdMatch) {
      this.records[deleteByIdMatch[1]]?.delete(params[0]);
      return new FakeCursor();
    }

    const deleteMatch = compactSql.match(/^DELETE FROM ([a-z_]+)/i);
    if (deleteMatch) {
      this.records[deleteMatch[1]]?.clear();
      return new FakeCursor();
    }

    const insertMatch = compactSql.match(/^INSERT OR REPLACE INTO ([a-z_]+)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const key = params[0];
      const dataIndex = table === "app_singletons" ? 1 : params.length - 1;
      if (!this.records[table]) this.records[table] = new Map();
      this.records[table].set(key, { data: params[dataIndex] });
      return new FakeCursor();
    }
    return new FakeCursor();
  }
}

const sql = new FakeSql();
const store = createSqlAppStore(sql, { initialDb: () => initialDb("admin-pass") });
await store.initialize();

assert.ok(
  sql.statements.some((item) => item.sql.includes("CREATE TABLE IF NOT EXISTS reservations")),
  "reservations SQL table should be created"
);
assert.ok(
  sql.statements.some((item) => item.sql.includes("CREATE INDEX IF NOT EXISTS idx_reservations_type_status_date")),
  "reservation type/status/date index should be created"
);
assert.ok(
  sql.statements.some((item) => item.sql.includes("CREATE TABLE IF NOT EXISTS reports")),
  "reports SQL table should be created"
);
assert.ok(
  sql.statements.some((item) => item.sql.includes("CREATE INDEX IF NOT EXISTS idx_reports_submitted_at")),
  "reports submittedAt index should be created"
);

const db = await initialDb("admin-pass");
db.reservations.push({
  id: "res_sql_1",
  type: "print",
  status: "auto_confirmed",
  userId: "user_admin",
  fields: { reservedDate: "2026-07-01", startTime: "10:00", endTime: "11:00" },
  history: [],
  createdAt: "2026-06-24T00:00:00.000Z",
  updatedAt: "2026-06-24T00:00:00.000Z"
});
db.reports.push({
  id: "report_sql_1",
  type: "studio",
  reservationId: "res_sql_1",
  userId: "user_admin",
  fields: { participants: "1" },
  htmlSnapshot: "<article>ok</article>",
  submittedAt: "2026-06-24T00:00:00.000Z",
  expiresAt: "2026-12-24T00:00:00.000Z"
});

await store.saveDb(db);
const loaded = await store.loadDb();

assert.equal(sql.records.reservations.has("res_sql_1"), true);
assert.equal(sql.records.reports.has("report_sql_1"), true);
assert.equal(sql.records.app_singletons.has("reservations"), false, "reservations should not be stored as one JSON blob");
assert.equal(loaded.reservations.length, 1);
assert.equal(loaded.reservations[0].id, "res_sql_1");
assert.equal(loaded.reports.length, 1);
assert.equal(loaded.reports[0].id, "report_sql_1");
assert.equal(sql.records.app_singletons.has("coursePlanning"), true, "course planning must be persisted as a singleton");
assert.equal(loaded.coursePlanning.courses.some((course) => course.name === "현장실습4"), true, "loaded course planning data must retain special course rules");

const deleteCountBeforeNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
const insertCountBeforeNoopSave = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE")).length;
await store.saveDb(loaded);
const deleteCountAfterNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
const insertCountAfterNoopSave = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE")).length;
assert.equal(deleteCountAfterNoopSave, deleteCountBeforeNoopSave, "unchanged saves should not delete SQL rows");
assert.equal(insertCountAfterNoopSave, insertCountBeforeNoopSave, "unchanged saves should not upsert SQL rows");

const reservationTableClearCountBeforeUpdate = sql.statements.filter((item) => item.sql === "DELETE FROM reservations").length;
loaded.reservations[0].status = "completed";
loaded.reservations[0].updatedAt = "2026-06-24T02:00:00.000Z";
await store.saveDb(loaded);
const reservationTableClearCountAfterUpdate = sql.statements.filter((item) => item.sql === "DELETE FROM reservations").length;
assert.equal(
  reservationTableClearCountAfterUpdate,
  reservationTableClearCountBeforeUpdate,
  "changed reservation saves should upsert rows without clearing the reservations table"
);
assert.equal(sql.records.reservations.get("res_sql_1").data.includes("\"status\":\"completed\""), true);

const reservationInsertCountBeforeSettingsChange = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE INTO reservations")).length;
loaded.settings.appName = "GJU Reserve 운영";
await store.saveDb(loaded);
const reservationInsertCountAfterSettingsChange = sql.statements.filter((item) => item.sql.startsWith("INSERT OR REPLACE INTO reservations")).length;
assert.equal(
  reservationInsertCountAfterSettingsChange,
  reservationInsertCountBeforeSettingsChange,
  "settings-only saves should not upsert reservation rows"
);

const migrationSql = new FakeSql();
const migrationStore = createSqlAppStore(migrationSql, { initialDb: () => initialDb("admin-pass") });
await migrationStore.initialize();
const legacyDb = await initialDb("admin-pass");
legacyDb.reservations.push({
  id: "res_legacy_1",
  type: "studio",
  status: "auto_confirmed",
  userId: "user_admin",
  fields: { reservedDate: "2026-07-02", studioSpaces: ["Studio A Front"], timeSlots: ["10:30-12:00"] },
  history: [],
  createdAt: "2026-06-24T01:00:00.000Z",
  updatedAt: "2026-06-24T01:00:00.000Z"
});

await migrationStore.migrateLegacyDb(legacyDb);
const migrationMeta = JSON.parse(migrationSql.records.app_singletons.get("meta").data);
assert.equal(migrationMeta.storageMigration.from, "legacy-durable-object-db");
assert.equal(migrationMeta.storageMigration.preservedLegacyDb, true);
assert.equal(typeof migrationMeta.storageMigration.migratedAt, "string");
assert.equal(migrationMeta.storageMigration.collectionCounts.reservations, 1);
assert.equal(migrationMeta.storageMigration.collectionCounts.users > 0, true);
assert.equal("passwordHash" in migrationMeta.storageMigration, false);
assert.equal("phone" in migrationMeta.storageMigration, false);
const migrated = await migrationStore.loadDb();
assert.equal(migrationSql.records.reservations.has("res_legacy_1"), true);
assert.equal(migrated.reservations.some((item) => item.id === "res_legacy_1"), true);

const { ensureSqlStoreInitialized } = await import("../worker-storage.mjs");

class FakeDurableStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
    this.getCalls = [];
    this.deleteCalls = [];
  }

  async get(key) {
    this.getCalls.push(key);
    return this.entries.get(key);
  }

  async delete(key) {
    this.deleteCalls.push(key);
    this.entries.delete(key);
  }
}

function fakeInitStore({ hasSqlData, onMigrate = async () => {} }) {
  return {
    initialized: false,
    migrated: [],
    async initialize() {
      this.initialized = true;
    },
    hasSqlData() {
      return hasSqlData;
    },
    async migrateLegacyDb(db, detail) {
      this.migrated.push({ db, detail });
      await onMigrate(db, detail);
    }
  };
}

const preservedLegacyDb = await initialDb("admin-pass");
preservedLegacyDb.reservations.push({
  id: "res_preserved_legacy",
  type: "studio",
  status: "approved",
  userId: "user_admin",
  fields: { reservedDate: "2026-07-10", timeSlots: ["10:00-12:00"], studioSpaces: ["Studio A"] },
  history: [],
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z"
});

const legacyStorage = new FakeDurableStorage({ db: preservedLegacyDb });
const legacyStore = fakeInitStore({ hasSqlData: false });
const legacyInit = await ensureSqlStoreInitialized({ storage: legacyStorage, store: legacyStore });
assert.equal(legacyInit.source, "legacy");
assert.equal(legacyInit.migrated, true);
assert.equal(legacyInit.preservedLegacyDb, true);
assert.equal(legacyStore.initialized, true);
assert.equal(legacyStore.migrated.length, 1);
assert.equal(legacyStore.migrated[0].db.reservations.some((item) => item.id === "res_preserved_legacy"), true);
assert.equal(legacyStore.migrated[0].detail.from, "legacy-durable-object-db");
assert.equal(legacyStore.migrated[0].detail.preservedLegacyDb, true);
assert.deepEqual(legacyStorage.deleteCalls, [], "legacy Durable Object db must not be deleted during migration");

const singletonOnlySql = new FakeSql();
const singletonOnlyStore = createSqlAppStore(singletonOnlySql, { initialDb: () => initialDb("admin-pass") });
await singletonOnlyStore.initialize();
singletonOnlySql.exec(
  "INSERT OR REPLACE INTO app_singletons (name, data, updated_at) VALUES (?, ?, ?)",
  "meta",
  JSON.stringify({ partialWrite: true }),
  "2026-06-30T00:00:00.000Z"
);
const singletonOnlyLegacyDb = await initialDb("admin-pass");
singletonOnlyLegacyDb.reservations.push({
  id: "res_singleton_only_legacy",
  type: "print",
  status: "auto_confirmed",
  userId: "user_admin",
  fields: { reservedDate: "2026-07-11", startTime: "10:00", endTime: "11:00" },
  history: [],
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z"
});
const singletonOnlyStorage = new FakeDurableStorage({ db: singletonOnlyLegacyDb });
const singletonOnlyInit = await ensureSqlStoreInitialized({
  storage: singletonOnlyStorage,
  store: singletonOnlyStore
});
assert.equal(singletonOnlyInit.source, "legacy", "singleton-only SQL data should not block legacy migration");
assert.equal(singletonOnlyInit.migrated, true);
assert.equal(singletonOnlySql.records.reservations.has("res_singleton_only_legacy"), true);
assert.deepEqual(singletonOnlyStorage.deleteCalls, [], "singleton-only recovery must preserve legacy db");

const authoritativeSqlStorage = new FakeDurableStorage({ db: preservedLegacyDb });
const authoritativeSqlStore = fakeInitStore({ hasSqlData: true });
const sqlInit = await ensureSqlStoreInitialized({ storage: authoritativeSqlStorage, store: authoritativeSqlStore });
assert.equal(sqlInit.source, "sql");
assert.equal(sqlInit.migrated, false);
assert.deepEqual(authoritativeSqlStorage.getCalls, [], "legacy db must not be read when SQL already has data");
assert.deepEqual(authoritativeSqlStorage.deleteCalls, [], "legacy db must not be deleted when SQL already has data");

const overwriteGuardStorage = new FakeDurableStorage({
  db: {
    users: [],
    reservations: [{ id: "res_should_not_overwrite_sql", type: "print", status: "cancelled", fields: {}, history: [] }]
  }
});
let overwriteGuardMigrated = false;
const overwriteGuardStore = fakeInitStore({
  hasSqlData: true,
  onMigrate: async () => {
    overwriteGuardMigrated = true;
  }
});
const overwriteGuardInit = await ensureSqlStoreInitialized({
  storage: overwriteGuardStorage,
  store: overwriteGuardStore
});
assert.equal(overwriteGuardInit.source, "sql");
assert.equal(overwriteGuardMigrated, false);
assert.deepEqual(overwriteGuardStorage.getCalls, []);
assert.deepEqual(overwriteGuardStorage.deleteCalls, []);

const emptyStorage = new FakeDurableStorage();
const emptyStore = fakeInitStore({ hasSqlData: false });
const emptyInit = await ensureSqlStoreInitialized({ storage: emptyStorage, store: emptyStore });
assert.equal(emptyInit.source, "initial");
assert.equal(emptyInit.migrated, false);
assert.deepEqual(emptyStorage.deleteCalls, [], "empty initialization must not delete any Durable Object keys");

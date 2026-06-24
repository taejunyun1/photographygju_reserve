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

    const deleteMatch = compactSql.match(/^DELETE FROM ([a-z_]+)/i);
    if (deleteMatch) {
      this.records[deleteMatch[1]]?.clear();
      return new FakeCursor();
    }

    const insertMatch = compactSql.match(/^INSERT OR REPLACE INTO ([a-z_]+)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const key = params[0];
      if (!this.records[table]) this.records[table] = new Map();
      this.records[table].set(key, { data: params[params.length - 1] });
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

const deleteCountBeforeNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
await store.saveDb(loaded);
const deleteCountAfterNoopSave = sql.statements.filter((item) => item.sql.startsWith("DELETE FROM")).length;
assert.equal(deleteCountAfterNoopSave, deleteCountBeforeNoopSave, "unchanged saves should not rewrite SQL tables");

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
const migrated = await migrationStore.loadDb();
assert.equal(migrationSql.records.reservations.has("res_legacy_1"), true);
assert.equal(migrated.reservations.some((item) => item.id === "res_legacy_1"), true);

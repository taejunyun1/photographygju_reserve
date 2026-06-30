import { capLogs, initialDb as defaultInitialDb, normalizeDb } from "./core.mjs";

const SINGLETON_KEYS = ["meta", "settings", "darkroomChemicals"];

const COLLECTIONS = [
  {
    key: "users",
    table: "users",
    create: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT,
      username TEXT,
      email TEXT,
      student_id TEXT,
      approval_status TEXT,
      created_at TEXT,
      updated_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_users_role_approval ON users (role, approval_status)",
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)",
      "CREATE INDEX IF NOT EXISTS idx_users_student_id ON users (student_id)"
    ],
    params: (item, data) => [
      item.id,
      item.role || "",
      item.username || "",
      item.email || "",
      item.studentId || "",
      item.approvalStatus || "",
      item.createdAt || "",
      item.updatedAt || "",
      data
    ],
    insert: `INSERT OR REPLACE INTO users
      (id, role, username, email, student_id, approval_status, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  },
  {
    key: "sessions",
    table: "sessions",
    create: `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at TEXT,
      last_seen_at TEXT,
      expires_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions (user_id, expires_at)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at)"
    ],
    params: (item, data) => [
      item.id,
      item.userId || "",
      item.createdAt || "",
      item.lastSeenAt || "",
      item.expiresAt || "",
      data
    ],
    insert: `INSERT OR REPLACE INTO sessions
      (id, user_id, created_at, last_seen_at, expires_at, data)
      VALUES (?, ?, ?, ?, ?, ?)`
  },
  {
    key: "equipment",
    table: "equipment",
    create: `CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      source TEXT,
      category TEXT,
      status TEXT,
      active INTEGER,
      reservable INTEGER,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_equipment_source_category ON equipment (source, category)",
      "CREATE INDEX IF NOT EXISTS idx_equipment_status_active ON equipment (status, active)"
    ],
    params: (item, data) => [
      item.id,
      item.source || "",
      item.category || "",
      item.status || "",
      item.active === false ? 0 : 1,
      item.reservable === false ? 0 : 1,
      data
    ],
    insert: `INSERT OR REPLACE INTO equipment
      (id, source, category, status, active, reservable, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
  },
  {
    key: "reservations",
    table: "reservations",
    create: `CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      user_id TEXT,
      reserved_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_reservations_type_status_date ON reservations (type, status, reserved_date)",
      "CREATE INDEX IF NOT EXISTS idx_reservations_user_date ON reservations (user_id, reserved_date)",
      "CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations (created_at)"
    ],
    params: (item, data) => [
      item.id,
      item.type || "",
      item.status || "",
      item.userId || "",
      item.fields?.reservedDate || "",
      item.createdAt || "",
      item.updatedAt || "",
      data
    ],
    insert: `INSERT OR REPLACE INTO reservations
      (id, type, status, user_id, reserved_date, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  },
  {
    key: "reports",
    table: "reports",
    create: `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      type TEXT,
      reservation_id TEXT,
      user_id TEXT,
      submitted_at TEXT,
      expires_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_reports_submitted_at ON reports (submitted_at)",
      "CREATE INDEX IF NOT EXISTS idx_reports_reservation_id ON reports (reservation_id)",
      "CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports (user_id)"
    ],
    params: (item, data) => [
      item.id,
      item.type || "",
      item.reservationId || "",
      item.userId || "",
      item.submittedAt || "",
      item.expiresAt || "",
      data
    ],
    insert: `INSERT OR REPLACE INTO reports
      (id, type, reservation_id, user_id, submitted_at, expires_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
  },
  {
    key: "lectures",
    table: "lectures",
    create: `CREATE TABLE IF NOT EXISTS lectures (
      id TEXT PRIMARY KEY,
      status TEXT,
      lecture_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: ["CREATE INDEX IF NOT EXISTS idx_lectures_status_date ON lectures (status, lecture_date)"],
    params: (item, data) => [item.id, item.status || "", item.lectureDate || "", item.createdAt || "", item.updatedAt || "", data],
    insert: `INSERT OR REPLACE INTO lectures
      (id, status, lecture_date, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?)`
  },
  {
    key: "lectureApplications",
    table: "lecture_applications",
    create: `CREATE TABLE IF NOT EXISTS lecture_applications (
      id TEXT PRIMARY KEY,
      lecture_id TEXT,
      user_id TEXT,
      applied_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_lecture_apps_lecture_user ON lecture_applications (lecture_id, user_id)",
      "CREATE INDEX IF NOT EXISTS idx_lecture_apps_user ON lecture_applications (user_id)"
    ],
    params: (item, data) => [item.id, item.lectureId || "", item.userId || "", item.appliedAt || "", data],
    insert: `INSERT OR REPLACE INTO lecture_applications
      (id, lecture_id, user_id, applied_at, data)
      VALUES (?, ?, ?, ?, ?)`
  },
  {
    key: "notices",
    table: "notices",
    create: `CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      status TEXT,
      pinned INTEGER,
      created_at TEXT,
      updated_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: ["CREATE INDEX IF NOT EXISTS idx_notices_status_pinned ON notices (status, pinned, created_at)"],
    params: (item, data) => [item.id, item.status || "", item.pinned ? 1 : 0, item.createdAt || "", item.updatedAt || "", data],
    insert: `INSERT OR REPLACE INTO notices
      (id, status, pinned, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?)`
  },
  {
    key: "warnings",
    table: "warnings",
    create: `CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: ["CREATE INDEX IF NOT EXISTS idx_warnings_user_created ON warnings (user_id, created_at)"],
    params: (item, data) => [item.id, item.userId || "", item.createdAt || "", data],
    insert: `INSERT OR REPLACE INTO warnings
      (id, user_id, created_at, data)
      VALUES (?, ?, ?, ?)`
  },
  {
    key: "auditLogs",
    table: "audit_logs",
    create: `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT,
      target_id TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at)",
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)"
    ],
    params: (item, data) => [item.id, item.actorId || "", item.action || "", item.targetId || "", item.createdAt || "", data],
    insert: `INSERT OR REPLACE INTO audit_logs
      (id, actor_id, action, target_id, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?)`
  },
  {
    key: "slackLogs",
    table: "slack_logs",
    create: `CREATE TABLE IF NOT EXISTS slack_logs (
      id TEXT PRIMARY KEY,
      event TEXT,
      status TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: ["CREATE INDEX IF NOT EXISTS idx_slack_logs_created_at ON slack_logs (created_at)"],
    params: (item, data) => [item.id, item.event || "", item.status || "", item.createdAt || "", data],
    insert: `INSERT OR REPLACE INTO slack_logs
      (id, event, status, created_at, data)
      VALUES (?, ?, ?, ?, ?)`
  },
  {
    key: "importBatches",
    table: "import_batches",
    create: `CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      data TEXT NOT NULL
    )`,
    indexes: ["CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON import_batches (created_at)"],
    params: (item, data) => [item.id, item.createdAt || "", data],
    insert: `INSERT OR REPLACE INTO import_batches
      (id, created_at, data)
      VALUES (?, ?, ?)`
  }
];

function rowsFrom(cursor) {
  return cursor?.toArray ? cursor.toArray() : [];
}

function countFrom(cursor) {
  const row = cursor?.one ? cursor.one() : rowsFrom(cursor)[0];
  return Number(row?.count || 0);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function collectionId(collection, item, index) {
  return item?.id || `${collection.key}_${index}`;
}

function nowIso() {
  return new Date().toISOString();
}

function collectionCounts(db) {
  return Object.fromEntries(COLLECTIONS.map((collection) => [
    collection.key,
    Array.isArray(db[collection.key]) ? db[collection.key].length : 0
  ]));
}

function markLegacyMigration(db, detail = {}) {
  db.meta = {
    ...(db.meta || {}),
    storageMigration: {
      from: detail.from || "legacy-durable-object-db",
      legacyKey: detail.legacyKey || "db",
      migratedAt: nowIso(),
      preservedLegacyDb: detail.preservedLegacyDb !== false,
      collectionCounts: collectionCounts(db)
    }
  };
  return db;
}

export function createSqlAppStore(sql, options = {}) {
  const makeInitialDb = options.initialDb || (() => defaultInitialDb(options.adminPassword || "admin"));
  let lastSingletonSnapshot = "";
  const lastCollectionSnapshots = new Map();

  function exec(statement, ...params) {
    return sql.exec(statement, ...params);
  }

  async function initialize() {
    exec(`CREATE TABLE IF NOT EXISTS app_singletons (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    for (const collection of COLLECTIONS) {
      exec(collection.create);
      for (const indexSql of collection.indexes || []) exec(indexSql);
    }
  }

  function hasSqlData() {
    // Singleton rows alone may be left by an interrupted initialization. The
    // app is only recoverably initialized once collection rows exist.
    return COLLECTIONS.some((collection) => countFrom(exec(`SELECT COUNT(*) AS count FROM ${collection.table}`)) > 0);
  }

  function singletonSnapshot(db) {
    return JSON.stringify(SINGLETON_KEYS.map((key) => [key, db[key] ?? null]));
  }

  function collectionRows(collection, db) {
    const items = Array.isArray(db[collection.key]) ? db[collection.key] : [];
    return items.map((item, index) => {
      const rowItem = item?.id ? item : { ...item, id: collectionId(collection, item, index) };
      return { item: rowItem, data: JSON.stringify(rowItem) };
    });
  }

  function rememberDbSnapshot(db) {
    lastSingletonSnapshot = singletonSnapshot(db);
    for (const collection of COLLECTIONS) {
      const rows = collectionRows(collection, db);
      lastCollectionSnapshots.set(collection.key, new Map(rows.map((row) => [row.item.id, row.data])));
    }
  }

  function saveSingletons(db) {
    const snapshot = singletonSnapshot(db);
    if (snapshot === lastSingletonSnapshot) return;
    exec("DELETE FROM app_singletons");
    const at = nowIso();
    for (const key of SINGLETON_KEYS) {
      exec(
        "INSERT OR REPLACE INTO app_singletons (name, data, updated_at) VALUES (?, ?, ?)",
        key,
        JSON.stringify(db[key] ?? null),
        at
      );
    }
    lastSingletonSnapshot = snapshot;
  }

  function saveCollections(db) {
    for (const collection of COLLECTIONS) {
      const rows = collectionRows(collection, db);
      const previousRows = lastCollectionSnapshots.get(collection.key) || new Map();
      const nextRows = new Map(rows.map((row) => [row.item.id, row.data]));
      let changed = false;
      for (const id of previousRows.keys()) {
        if (!nextRows.has(id)) {
          exec(`DELETE FROM ${collection.table} WHERE id = ?`, id);
          changed = true;
        }
      }
      rows.forEach((row) => {
        if (previousRows.get(row.item.id) !== row.data) {
          exec(collection.insert, ...collection.params(row.item, row.data));
          changed = true;
        }
      });
      if (changed) lastCollectionSnapshots.set(collection.key, nextRows);
    }
  }

  async function saveDb(db) {
    normalizeDb(db);
    capLogs(db);
    const writeAll = () => {
      saveSingletons(db);
      saveCollections(db);
    };
    if (typeof options.transactionSync === "function") {
      options.transactionSync(writeAll);
      return;
    }
    if (typeof options.transaction === "function") {
      await options.transaction(writeAll);
      return;
    }
    writeAll();
  }

  async function migrateLegacyDb(db, detail = {}) {
    markLegacyMigration(db, detail);
    await saveDb(db);
  }

  async function loadDb() {
    await initialize();
    if (!hasSqlData()) {
      const db = await makeInitialDb();
      await saveDb(db);
      return db;
    }

    const singletonRows = rowsFrom(exec("SELECT name, data FROM app_singletons"));
    const db = {};
    for (const row of singletonRows) db[row.name] = parseJson(row.data, null);
    for (const collection of COLLECTIONS) {
      db[collection.key] = rowsFrom(exec(`SELECT data FROM ${collection.table} ORDER BY rowid`))
        .map((row) => parseJson(row.data, null))
        .filter(Boolean);
    }
    const normalized = normalizeDb(db);
    rememberDbSnapshot(normalized);
    return normalized;
  }

  return {
    initialize,
    loadDb,
    saveDb,
    migrateLegacyDb,
    hasSqlData
  };
}

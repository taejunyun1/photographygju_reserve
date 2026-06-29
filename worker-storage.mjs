export async function ensureSqlStoreInitialized({ storage, store, legacyKey = "db" }) {
  await store.initialize();

  if (store.hasSqlData()) {
    return {
      source: "sql",
      migrated: false,
      preservedLegacyDb: true
    };
  }

  const legacyDb = await storage.get(legacyKey);
  if (legacyDb) {
    await store.migrateLegacyDb(legacyDb, {
      from: "legacy-durable-object-db",
      legacyKey,
      preservedLegacyDb: true
    });
    return {
      source: "legacy",
      migrated: true,
      preservedLegacyDb: true
    };
  }

  return {
    source: "initial",
    migrated: false,
    preservedLegacyDb: true
  };
}

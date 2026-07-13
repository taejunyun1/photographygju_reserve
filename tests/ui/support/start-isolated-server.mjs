import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.GJU_E2E_DATA_DIR || join(tmpdir(), "gju-reserve-playwright-data");

rmSync(dataDir, { recursive: true, force: true });
process.env.GJU_DATA_DIR = dataDir;
process.env.PORT = process.env.GJU_E2E_PORT || "4179";
process.env.GJU_HOST = "127.0.0.1";
process.env.ADMIN_PASSWORD = "admin";

await import("../../../scripts/build-react-admin.mjs");
await import("../../../server.mjs");

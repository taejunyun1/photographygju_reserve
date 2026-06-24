import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initialDb, normalizeDb, capLogs, handleApiRequest } from "./core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function ensureDbInitialized() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(DB_PATH)) {
    writeDb(await initialDb(ADMIN_DEFAULT_PASSWORD));
  }
}

function readDb() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const beforeStatuses = JSON.stringify((db.reservations || []).map((item) => [item.id, item.type, item.status]));
  normalizeDb(db);
  const afterStatuses = JSON.stringify((db.reservations || []).map((item) => [item.id, item.type, item.status]));
  if (beforeStatuses !== afterStatuses) writeDb(db);
  return db;
}

function writeDb(db) {
  ensureDir(DATA_DIR);
  capLogs(db);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024 * 4) {
        reject(Object.assign(new Error("요청 본문이 너무 큽니다."), { status: 413 }));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  let result;
  try {
    const db = readDb();
    result = await handleApiRequest({
      method: req.method || "GET",
      pathname,
      authorization: req.headers.authorization || "",
      readText: () => readRawBody(req),
      db,
      saveDb: async () => writeDb(db),
      slackWebhook: process.env.SLACK_WEBHOOK_URL,
      clientIp: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0],
      userAgent: req.headers["user-agent"] || ""
    });
  } catch (error) {
    result = { status: error.status || 500, body: { ok: false, error: error.message || "서버 오류가 발생했습니다." } };
  }
  res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(result.body));
}

// The dev server reads/writes a single JSON file per request. Serialize API
// handling so concurrent reservations cannot race on read-modify-write.
let apiChain = Promise.resolve();
function handleApiSerialized(req, res, pathname) {
  const run = apiChain.then(() => handleApi(req, res, pathname));
  apiChain = run.catch(() => {});
  return run;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApiSerialized(req, res, url.pathname).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(error.status || 500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: error.message || "서버 오류가 발생했습니다." }));
      }
    });
    return;
  }
  serveStatic(req, res, url.pathname);
});

ensureDbInitialized().then(() => {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`GJU-reserve dev server running at http://localhost:${PORT}`);
    console.log("Admin login: admin / admin (development default; change before production)");
  });
});

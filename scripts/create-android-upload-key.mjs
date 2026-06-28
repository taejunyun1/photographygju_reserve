import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const androidDir = path.join(root, "android");
const keystorePath = path.join(androidDir, "gju-upload-key.p12");
const propertiesPath = path.join(androidDir, "release-signing.properties");
const alias = "gju-upload";
const androidStudioJbr = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
const javaHome = process.env.JAVA_HOME || (fs.existsSync(androidStudioJbr) ? androidStudioJbr : "");
const keytool = javaHome ? path.join(javaHome, "bin", "keytool") : "keytool";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function quotePropertiesValue(value) {
  return String(value).replace(/\\/g, "\\\\");
}

if (fs.existsSync(keystorePath) || fs.existsSync(propertiesPath)) {
  console.log("Android upload key already exists.");
  console.log(`Keystore: ${keystorePath}`);
  console.log(`Signing properties: ${propertiesPath}`);
  process.exit(0);
}

const storePassword = crypto.randomBytes(30).toString("base64url");
const keyPassword = storePassword;

fs.mkdirSync(androidDir, { recursive: true });

const result = spawnSync(keytool, [
  "-genkeypair",
  "-v",
  "-storetype", "PKCS12",
  "-keystore", keystorePath,
  "-storepass", storePassword,
  "-keypass", keyPassword,
  "-alias", alias,
  "-keyalg", "RSA",
  "-keysize", "4096",
  "-validity", "10000",
  "-dname", "CN=GJU Photography Reservation, OU=Photomedia, O=Gwangju University, L=Gwangju, ST=Gwangju, C=KR"
], { stdio: "inherit" });

if (result.status !== 0) {
  if (fs.existsSync(keystorePath)) fs.rmSync(keystorePath, { force: true });
  fail(`Android upload key creation failed with exit code ${result.status ?? 1}.`);
}

fs.writeFileSync(propertiesPath, [
  `GJU_ANDROID_KEYSTORE_PATH=${quotePropertiesValue(keystorePath)}`,
  `GJU_ANDROID_KEYSTORE_PASSWORD=${quotePropertiesValue(storePassword)}`,
  `GJU_ANDROID_KEY_ALIAS=${quotePropertiesValue(alias)}`,
  `GJU_ANDROID_KEY_PASSWORD=${quotePropertiesValue(keyPassword)}`,
  ""
].join("\n"), { mode: 0o600 });

fs.chmodSync(keystorePath, 0o600);
fs.chmodSync(propertiesPath, 0o600);

console.log("Created Android Play upload key.");
console.log(`Keystore: ${keystorePath}`);
console.log(`Signing properties: ${propertiesPath}`);
console.log("Back up both files. They are intentionally ignored by git.");

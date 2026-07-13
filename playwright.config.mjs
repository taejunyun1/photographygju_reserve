import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseURL = "http://127.0.0.1:4179";
const artifactRoot = join(tmpdir(), "gju-reserve-playwright-artifacts");

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "**/*.spec.mjs",
  globalSetup: "./tests/ui/support/global-setup.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: join(artifactRoot, "report") }]],
  outputDir: join(artifactRoot, "artifacts"),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  expect: {
    timeout: 5_000
  },
  webServer: {
    command: "node tests/ui/support/start-isolated-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 15_000
  },
  projects: [
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "mobile-430", use: { ...devices["Desktop Chrome"], viewport: { width: 430, height: 932 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }
  ]
});

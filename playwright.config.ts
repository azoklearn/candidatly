import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build and the linked Supabase project (no
// Docker on the development machine). They need the keys of .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", trace: "retain-on-failure" },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

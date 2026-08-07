import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E smoke suite for CreditOS.
 *
 * Targets the locally-running compose stack (see docs/E2E.md):
 *   docker compose up -d --build
 *   npm run test:e2e
 *
 * The web app is served on :3000 with the BFF proxy at /api; the API is
 * directly reachable on :3001. Tests exercise the public web surface through
 * the BFF only, plus API-level isolation checks via request contexts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

import { defineConfig, devices } from "@playwright/test";

const fixturePort = process.env.ROUTE_TEST_FIXTURE_PORT || "19010";
const appPort = process.env.ROUTE_TEST_APP_PORT || "13010";
const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
const appUrl = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "./node_modules/.cache/route-playwright-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: appUrl,
    storageState: "./output/playwright/oracle-sprint4-a.json",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/oracle-ui-fixture.mjs",
      url: `${fixtureUrl}/__stats`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { ORACLE_FIXTURE_PORT: fixturePort },
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${appPort}`,
      url: `${appUrl}/planner`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-playwright",
        NEXT_PUBLIC_API_URL: fixtureUrl,
        NEXT_PUBLIC_SUPABASE_URL: fixtureUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-playwright-anon-key",
      },
    },
  ],
});

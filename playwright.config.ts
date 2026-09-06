import { defineConfig, devices } from "@playwright/test";

// Lab 2 end-to-end and responsive suite (tests.md §2.5, §2.6). Playwright starts
// both the API and the Vite dev server itself, so the whole journey runs against
// a real Express server and a migrated + seeded PostgreSQL — never a mock.
//
// Chromium only, single worker, no parallelism: the specs create real Tickets in
// a shared database, so serial execution keeps ownership and count assertions
// deterministic and keeps the lab run time reasonable (tests.md §7).

const CLIENT_URL = "http://localhost:5173";
const SERVER_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/lab-02",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: CLIENT_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev",
      cwd: "server",
      url: `${SERVER_URL}/api/health`,
      // Reuse a locally running server in development; always start fresh in CI so
      // the run is hermetic (partner review point on reuseExistingServer).
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev",
      cwd: "client",
      url: CLIENT_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

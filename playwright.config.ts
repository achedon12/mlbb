import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (Playwright).
 *
 * In continuous integration, the app is built then served in production mode;
 * locally, the development server is reused if it is already running. The
 * tests target the user journey, not the pixel: they check that key pages
 * open and respond to interactions.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

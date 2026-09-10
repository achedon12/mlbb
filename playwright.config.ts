import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de navigateur (Playwright).
 *
 * En integration continue, l'application est construite puis servie en mode
 * production ; en local, on reutilise le serveur de developpement s'il tourne
 * deja. Les tests visent le parcours, pas le pixel : ils verifient que les
 * pages cles s'ouvrent et repondent aux interactions.
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

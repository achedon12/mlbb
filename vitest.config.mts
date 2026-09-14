import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit and functional tests (Vitest). Browser tests are separate, under
 * Playwright — see `playwright.config.ts`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,mts,mjs}", "tests/functional/**/*.test.{ts,mts,mjs}"],
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests unitaires et fonctionnels (Vitest). Les tests de navigateur sont a
 * part, sous Playwright — voir `playwright.config.ts`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,mts,mjs}", "tests/fonctionnels/**/*.test.{ts,mts,mjs}"],
  },
});

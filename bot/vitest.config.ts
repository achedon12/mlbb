import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The code under test logs its warnings on purpose; keep the output readable.
    env: { LOG_LEVEL: "error" },
  },
});

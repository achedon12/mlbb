import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The container applies the migrations with the Prisma command line of
 * `prisma/cli`, installed from its own lock file. It must be the version the
 * migrations were written with: the root lock file's.
 */
const lock = (path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as { packages: Record<string, { version?: string }> };

describe("migration command line", () => {
  it("pins the same prisma version as the root lock file", () => {
    const root = lock("package-lock.json").packages["node_modules/prisma"]?.version;
    const cli = lock("prisma/cli/package-lock.json").packages["node_modules/prisma"]?.version;
    expect(root).toBeTruthy();
    expect(cli).toBe(root);
  });
});

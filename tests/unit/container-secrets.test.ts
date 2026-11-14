import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * What the images and containers may hold of the secrets. Read from the
 * files as they are committed: a change to the build context or to the
 * compose file that lets a secret through fails here first.
 */

/** Root-level names the build context excludes, with `.dockerignore`'s last-match-wins rule. */
function ignored(file: string, name: string): boolean {
  let out = false;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const negated = line.startsWith("!");
    const pattern = new RegExp(`^${(negated ? line.slice(1) : line).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")}$`);
    if (pattern.test(name)) out = !negated;
  }
  return out;
}

describe("build context", () => {
  // `next build` loads .env.production and copies it into .next/standalone,
  // that is into the final image: every env file must stay out of the context.
  it.each([".dockerignore", "bot/.dockerignore"])("%s keeps every env file out, the template aside", (file) => {
    for (const name of [".env", ".env.production", ".env.local", ".env.production.local", ".env.development"]) {
      expect(ignored(file, name), name).toBe(true);
    }
    expect(ignored(file, ".env.example")).toBe(false);
  });
});

/** The lines of one service in docker-compose.yml, up to the next top-level service. */
function service(name: string): string {
  const lines = readFileSync("docker-compose.yml", "utf8").split("\n");
  const start = lines.indexOf(`  ${name}:`);
  expect(start, `service ${name}`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("compose", () => {
  // The site reads the whole .env (env_file), which also holds the bot's
  // token for the bot service's interpolation: the site, the process that
  // faces the internet, must get those values blanked.
  it("hands the site no bot-only secret", () => {
    const site = service("mlbb");
    expect(site).toMatch(/env_file:/);
    for (const name of ["DISCORD_TOKEN", "TOPGG_TOKEN", "DBL_TOKEN", "DBOTSGG_TOKEN", "POSTGRES_PASSWORD"]) {
      expect(site, name).toMatch(new RegExp(`^\\s+${name}: ""$`, "m"));
    }
  });

  it("publishes neither the bot's internal port nor the database", () => {
    expect(service("bot")).not.toMatch(/^\s+ports:/m);
    expect(service("postgres")).not.toMatch(/^\s+ports:/m);
  });
});

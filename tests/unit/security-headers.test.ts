import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The security headers live in `next.config.ts`. A later edit of that file
 * must not drop them silently.
 */
async function siteHeaders(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { default: config } = await import("../../next.config");
  const rules = await config.headers!();
  const rule = rules.find((r) => r.source === "/:chemin*");
  expect(rule).toBeDefined();
  return new Map(rule!.headers.map((h) => [h.key, h.value]));
}

function directives(policy: string) {
  return new Map(
    policy.split(";").map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name!, sources];
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers", () => {
  it("keeps the baseline headers", async () => {
    const headers = await siteHeaders({ NODE_ENV: "production" });
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("sends HSTS for two years, without preload", async () => {
    const headers = await siteHeaders({ NODE_ENV: "production" });
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("sends an enforcing Content Security Policy locked down outside scripts", async () => {
    const headers = await siteHeaders({ NODE_ENV: "production", NEXT_PUBLIC_MATOMO_URL: "https://stats.example.org/" });
    expect(headers.has("Content-Security-Policy-Report-Only")).toBe(false);
    const policy = directives(headers.get("Content-Security-Policy") ?? "");
    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.has("upgrade-insecure-requests")).toBe(true);
    expect(policy.get("script-src")).not.toContain("'unsafe-eval'");
    expect(policy.get("script-src")).toContain("https://stats.example.org");
    expect(policy.get("connect-src")).toEqual(["'self'", "https://stats.example.org"]);
    for (const sources of policy.values()) expect(sources).not.toContain("*");
  });

  it("allows no foreign host when Matomo is not configured", async () => {
    const headers = await siteHeaders({ NODE_ENV: "production", NEXT_PUBLIC_MATOMO_URL: "" });
    const policy = directives(headers.get("Content-Security-Policy") ?? "");
    expect(policy.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy.get("connect-src")).toEqual(["'self'"]);
  });
});

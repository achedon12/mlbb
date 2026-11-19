import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The error report route of the data pages, exercised as requests: anyone
 * may send one (same origin, a few a minute per address, sizes, honeypot),
 * nothing identifying is stored, and only a moderator may close one.
 */

const SESSION_SECRET = "b".repeat(64);
const MODERATOR = "222222222222222222";
const MEMBER = "333333333333333333";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: "a".repeat(64),
  BOT_SESSION_SECRET: SESSION_SECRET,
  BOT_INTERNAL_URL: "http://bot:3100",
  BOT_SUPER_ADMIN_IDS: MODERATOR,
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
});

/** The `DataReport` and `ModerationLog` tables, in memory. */
type Report = { id: number; path: string; locale: string; text: string; correction: string | null; source: string | null; createdAt: Date; resolvedAt: Date | null; resolvedBy: string | null };
const tables = vi.hoisted(() => ({ reports: [] as Report[], log: [] as Record<string, unknown>[], configured: true }));
const match = (row: Report, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => row[k as keyof Report] === v);
const dataReport = {
  count: async ({ where }: { where: Record<string, unknown> }) => tables.reports.filter((r) => match(r, where)).length,
  findFirst: async ({ where }: { where: Record<string, unknown> }) => tables.reports.find((r) => match(r, where)) ?? null,
  findMany: async ({ where }: { where: Record<string, unknown> }) => tables.reports.filter((r) => match(r, where)),
  create: async ({ data }: { data: Omit<Report, "id" | "createdAt" | "resolvedAt" | "resolvedBy"> }) => {
    const row = { id: tables.reports.length + 1, createdAt: new Date(), resolvedAt: null, resolvedBy: null, ...data };
    tables.reports.push(row);
    return row;
  },
  updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Report> }) => {
    const hit = tables.reports.filter((r) => match(r, where));
    for (const r of hit) Object.assign(r, data);
    return { count: hit.length };
  },
};
const moderationLog = { create: async ({ data }: { data: Record<string, unknown> }) => tables.log.push(data) };
vi.mock("@/lib/db", () => ({
  databaseConfigured: () => tables.configured,
  db: () => ({ dataReport, moderationLog, $transaction: async (task: (tx: unknown) => Promise<unknown>) => task({ dataReport, moderationLog }) }),
}));

const jar = vi.hoisted(() => ({ discord: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "mlbbdex_discord" && jar.discord ? { value: jar.discord } : undefined) }),
}));

const { sealSession } = await import("@/lib/bot/session");
const route = await import("@/app/api/data-reports/route");

const BASE = "http://mlbb:3001";
let address = 0;
function call(method: "POST" | "PATCH", body: unknown, { origin = "https://mlbbdex.com", from }: { origin?: string | null; from?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": from ?? `203.0.113.${++address % 250}` };
  if (origin) headers.origin = origin;
  return new Request(`${BASE}/api/data-reports`, { method, headers, body: JSON.stringify(body) });
}
const post = (body: unknown, options?: Parameters<typeof call>[2]) => route.POST(call("POST", body, options));
const patch = (body: unknown) => route.PATCH(call("PATCH", body));

const report = { path: "/heroes/layla", locale: "fr", text: "Le temps de recharge du sort 2 est faux." };

beforeEach(() => {
  tables.reports = [];
  tables.log = [];
  tables.configured = true;
  jar.discord = undefined;
});

describe("sending an error report", () => {
  it("stores the page, the language and the text, nothing else", async () => {
    const response = await post({ ...report, correction: "  8 s  ", source: "https://mobile-legends.fandom.com/wiki/Layla" });
    expect(response.status).toBe(201);
    expect(tables.reports).toHaveLength(1);
    const row = tables.reports[0]!;
    expect(row).toMatchObject({ ...report, correction: "8 s", source: "https://mobile-legends.fandom.com/wiki/Layla", resolvedAt: null });
    expect(Object.keys(row).sort()).toEqual(["correction", "createdAt", "id", "locale", "path", "resolvedAt", "resolvedBy", "source", "text"]);
    expect(JSON.stringify(row)).not.toContain("203.0.113.");
  });

  it("says whether reports are taken", async () => {
    expect(await route.GET().json()).toEqual({ open: true });
    tables.configured = false;
    expect(await route.GET().json()).toEqual({ open: false });
    expect((await post(report)).status).toBe(404);
  });

  it("refuses another origin, or none", async () => {
    expect((await post(report, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(report, { origin: null })).status).toBe(403);
    expect(tables.reports).toHaveLength(0);
  });

  it("refuses pages that take no report, and bad fields", async () => {
    for (const path of ["/community/general", "/heroes/../admin", "https://evil.example/heroes/x", "/heroes/"]) {
      expect((await post({ ...report, path })).status).toBe(400);
    }
    expect(await (await post({ ...report, locale: "xx" })).json()).toEqual({ error: "locale" });
    expect(await (await post({ ...report, text: "faux" })).json()).toEqual({ error: "text" });
    expect(await (await post({ ...report, text: "x".repeat(1001) })).json()).toEqual({ error: "text" });
    expect(await (await post({ ...report, correction: "x".repeat(301) })).json()).toEqual({ error: "correction" });
    expect(await (await post({ ...report, source: "javascript:alert(1)" })).json()).toEqual({ error: "source" });
    expect((await post({ ...report, email: "a@b.c" })).status).toBe(400);
    expect(tables.reports).toHaveLength(0);
  });

  it("keeps addresses in the source field", async () => {
    const response = await post({ ...report, text: "Voir https://exemple.com pour la bonne valeur" });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "links" });
  });

  it("drops a filled-in honeypot without a word", async () => {
    expect((await post({ ...report, website: "http://spam.example" })).status).toBe(201);
    expect(tables.reports).toHaveLength(0);
  });

  it("stores an identical open report once", async () => {
    await post(report);
    expect((await post(report)).status).toBe(201);
    expect(tables.reports).toHaveLength(1);
  });

  it("limits each address to a few reports a minute", async () => {
    const from = "198.51.100.77";
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await post({ ...report, text: `Erreur numéro ${i} sur la fiche` }, { from })).status);
    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  it("stops taking reports when too many are open", async () => {
    for (let i = 0; i < 500; i++) await dataReport.create({ data: { path: "/items/x", locale: "en", text: `t${i}`, correction: null, source: null } });
    const response = await post(report);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "full" });
  });
});

describe("closing an error report", () => {
  const login = (id: string) => {
    jar.discord = sealSession({ sessionSecret: SESSION_SECRET }, { id, name: "Mod", avatar: null });
  };

  it("is for moderators only, anyone else gets 404", async () => {
    await post(report);
    expect((await patch({ id: 1 })).status).toBe(404);
    login(MEMBER);
    expect((await patch({ id: 1 })).status).toBe(404);
    expect(tables.reports[0]!.resolvedAt).toBeNull();
  });

  it("closes the report and logs the decision", async () => {
    await post(report);
    login(MODERATOR);
    expect((await patch({ id: 1 })).status).toBe(200);
    expect(tables.reports[0]).toMatchObject({ resolvedBy: MODERATOR });
    expect(tables.reports[0]!.resolvedAt).toBeInstanceOf(Date);
    expect(tables.log).toEqual([expect.objectContaining({ moderatorId: MODERATOR, action: "resolve", kind: "data", targetId: 1 })]);
    // Already closed, or never existed.
    expect((await patch({ id: 1 })).status).toBe(404);
    expect((await patch({ id: 99 })).status).toBe(404);
    expect((await patch({ id: "1" })).status).toBe(400);
  });
});

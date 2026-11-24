import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The progress routes, against an in-memory stand-in for the two tables:
 * the gates (database, origin, sign-in, body type), the schema, and that a
 * request only ever reaches the row of the account its session proves. The
 * Postgres side (compare and set) is the same code as the collection's.
 */

type Row = { accountId: string; data: unknown; createdAt: Date; updatedAt: Date };
type ProfileRow = { accountId: string; slug: string; public: boolean; fields: string[]; displayName: string | null; avatar: string | null; updatedAt: Date };

const store = { sync: new Map<string, Row>(), profile: new Map<string, ProfileRow>() };
const signedIn = { player: { status: "none" } as { status: "ok"; id: string; name: string } | { status: "none" } };

const fakeDb = {
  playerSync: {
    findUnique: async ({ where }: { where: { accountId: string } }) => store.sync.get(where.accountId) ?? null,
    createManyAndReturn: async ({ data }: { data: Row[] }) => {
      const row = data[0];
      if (store.sync.has(row.accountId)) return [];
      store.sync.set(row.accountId, { ...row });
      return [row];
    },
    updateMany: async ({ where, data }: { where: { accountId: string; updatedAt: Date }; data: { data: unknown; updatedAt: Date } }) => {
      const row = store.sync.get(where.accountId);
      if (!row || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
      store.sync.set(where.accountId, { ...row, ...data });
      return { count: 1 };
    },
    deleteMany: async ({ where }: { where: { accountId: string } }) => ({ count: Number(store.sync.delete(where.accountId)) }),
  },
  playerProfile: {
    findUnique: async ({ where }: { where: { accountId?: string; slug?: string } }) => {
      const row = where.accountId ? store.profile.get(where.accountId) : [...store.profile.values()].find((r) => r.slug === where.slug);
      return row ?? null;
    },
    upsert: async ({ where, create, update }: { where: { accountId: string }; create: ProfileRow; update: Partial<ProfileRow> }) => {
      const existing = store.profile.get(where.accountId);
      const row = existing ? { ...existing, ...update } : { ...create };
      store.profile.set(where.accountId, row as ProfileRow);
      return { public: row.public, fields: row.fields, slug: row.slug };
    },
    deleteMany: async ({ where }: { where: { accountId: string } }) => ({ count: Number(store.profile.delete(where.accountId)) }),
  },
  $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
};

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/lib/community-builds-server", () => ({ currentPlayer: async () => signedIn.player }));
vi.mock("@/lib/log", () => ({ log: vi.fn(async () => {}), logError: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({ databaseConfigured: () => true, db: () => fakeDb }));
vi.mock("@/lib/session", () => ({ profileCurrent: async () => ({ name: "Player", avatar: "https://akmpicture.youngjoygame.com/dist/a.jpg" }) }));

const sync = await import("@/app/api/account/sync/route");
const profile = await import("@/app/api/account/profile/route");
const { readPublicProfile, syncInput } = await import("@/lib/account-sync-server");
const { emptyData } = await import("@/lib/account-sync");

const ORIGIN = "http://mlbb.test";
let address = 0;
const call = (url: string, method: string, body?: unknown, o: { origin?: string | null; type?: string } = {}) =>
  new Request(`${ORIGIN}${url}`, {
    method,
    headers: {
      ...(o.origin === null ? {} : { origin: o.origin ?? ORIGIN }),
      ...(body === undefined ? {} : { "content-type": o.type ?? "application/json" }),
      // A fresh address per request: the address rate is not what these tests are about.
      "x-forwarded-for": `198.51.100.${(address++ % 250) + 1}`,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const as = (id: string) => {
  signedIn.player = { status: "ok", id, name: `Player ${id.slice(-2)}` };
};
// Fresh accounts for every test: the per-account rates are not what these tests are about.
let accounts = 0;
let ACCOUNT_A = "";
let ACCOUNT_B = "";
const progress = (favourites: string[] = ["layla"]) => ({ ...emptyData(), favourites });

beforeEach(() => {
  ACCOUNT_A = (++accounts).toString(16).padStart(22, "0") + "aa";
  ACCOUNT_B = (++accounts).toString(16).padStart(22, "0") + "bb";
  store.sync.clear();
  store.profile.clear();
  signedIn.player = { status: "none" };
});

describe("progress sync route", () => {
  it("tells a visitor they are signed out, without touching any row", async () => {
    const r = await sync.GET(call("/api/account/sync", "GET"));
    expect(await r.json()).toEqual({ available: true, connected: false });
  });

  it("refuses a write without a sign-in", async () => {
    const r = await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }));
    expect(r.status).toBe(401);
    expect(store.sync.size).toBe(0);
  });

  it("refuses a cross-site write", async () => {
    as(ACCOUNT_A);
    const r = await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }, { origin: "https://evil.example" }));
    expect(r.status).toBe(403);
  });

  it("refuses a form post (not JSON)", async () => {
    as(ACCOUNT_A);
    const r = await sync.PUT(call("/api/account/sync", "PUT", "data=1", { type: "application/x-www-form-urlencoded" }));
    expect(r.status).toBe(415);
  });

  it.each([
    ["an account id in the body", { data: progress(), base: null, accountId: ACCOUNT_B }],
    ["an unknown key in the data", { data: { ...progress(), secret: 1 }, base: null }],
    ["a malformed slug", { data: progress(["<img src=x>"]), base: null }],
    ["too many favourites", { data: progress(Array.from({ length: 201 }, (_, i) => `hero-${i}`)), base: null }],
    ["a negative count", { data: { ...progress(), quiz: { ...emptyData().quiz, daily: { ...emptyData().quiz.daily, joues: -1 } } }, base: null }],
    ["a bad day", { data: { ...progress(), quiz: { ...emptyData().quiz, daily: { ...emptyData().quiz.daily, dernier: "yesterday" } } }, base: null }],
    ["a bad month", { data: { ...progress(), reminders: ["2026-13"] }, base: null }],
    ["a bad base", { data: progress(), base: "not a date" }],
  ])("refuses %s", async (_, body) => {
    as(ACCOUNT_A);
    const r = await sync.PUT(call("/api/account/sync", "PUT", body));
    expect(r.status).toBe(400);
    expect(store.sync.size).toBe(0);
  });

  it("drops a hero the site does not list rather than refusing the save", () => {
    const parsed = syncInput.safeParse({ data: progress(["layla", "not-a-hero-anymore"]), base: null });
    expect(parsed.success && parsed.data.data.favourites).toEqual(["layla"]);
  });

  it("saves on the signed-in account only, and reads it back", async () => {
    as(ACCOUNT_A);
    const put = await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }));
    expect(put.status).toBe(200);
    expect([...store.sync.keys()]).toEqual([ACCOUNT_A]);
    const got = (await (await sync.GET(call("/api/account/sync", "GET"))).json()) as { account: string; sync: { data: { favourites: string[] } } };
    expect(got.sync.data.favourites).toEqual(["layla"]);
    // The browser gets an opaque key, never the account id.
    expect(got.account).not.toContain(ACCOUNT_A);

    // Another player sees none of it.
    as(ACCOUNT_B);
    const other = (await (await sync.GET(call("/api/account/sync", "GET"))).json()) as { sync: unknown };
    expect(other.sync).toBeNull();
  });

  it("turns a write from a stale copy into a conflict with the current one", async () => {
    as(ACCOUNT_A);
    const first = (await (await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }))).json()) as { sync: { updatedAt: string } };
    const second = await sync.PUT(call("/api/account/sync", "PUT", { data: progress(["layla", "miya"]), base: first.sync.updatedAt }));
    expect(second.status).toBe(200);
    const stale = await sync.PUT(call("/api/account/sync", "PUT", { data: progress(["tigreal"]), base: first.sync.updatedAt }));
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { sync: { data: { favourites: string[] } } }).sync.data.favourites).toEqual(["layla", "miya"]);
  });

  it("deletes the signed-in account's copy and public page, and no other", async () => {
    as(ACCOUNT_B);
    await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }));
    as(ACCOUNT_A);
    await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }));
    await profile.PUT(call("/api/account/profile", "PUT", { public: true, fields: ["quiz"] }));
    const r = await sync.DELETE(call("/api/account/sync", "DELETE"));
    expect(r.status).toBe(204);
    expect([...store.sync.keys()]).toEqual([ACCOUNT_B]);
    expect(store.profile.size).toBe(0);
  });

  it("refuses a delete without a sign-in, or from another site", async () => {
    expect((await sync.DELETE(call("/api/account/sync", "DELETE"))).status).toBe(401);
    as(ACCOUNT_A);
    expect((await sync.DELETE(call("/api/account/sync", "DELETE", undefined, { origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("public profile route", () => {
  it("needs a sign-in to read or change the settings", async () => {
    expect((await profile.GET(call("/api/account/profile", "GET"))).status).toBe(401);
    expect((await profile.PUT(call("/api/account/profile", "PUT", { public: true, fields: [] }))).status).toBe(401);
  });

  it("is off by default", async () => {
    as(ACCOUNT_A);
    expect(await (await profile.GET(call("/api/account/profile", "GET"))).json()).toEqual({ public: false, fields: [], slug: null });
  });

  it.each([
    ["a field it does not know", { public: true, fields: ["rank"] }],
    ["a name from the body", { public: true, fields: [], displayName: "Admin" }],
    ["a picture from the body", { public: true, fields: ["avatar"], avatar: "https://evil.example/x.png" }],
    ["a slug from the body", { public: true, fields: [], slug: "chosen-by-me" }],
    ["a non-boolean switch", { public: "yes", fields: [] }],
  ])("refuses %s", async (_, body) => {
    as(ACCOUNT_A);
    expect((await profile.PUT(call("/api/account/profile", "PUT", body))).status).toBe(400);
  });

  it("turned on: a random slug, the session's name, only the chosen fields", async () => {
    as(ACCOUNT_A);
    await sync.PUT(call("/api/account/sync", "PUT", { data: progress(), base: null }));
    const r = (await (await profile.PUT(call("/api/account/profile", "PUT", { public: true, fields: ["quiz", "favourites"] }))).json()) as {
      slug: string;
    };
    expect(r.slug).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(r.slug).not.toContain(ACCOUNT_A.slice(-8));
    const row = await readPublicProfile(r.slug);
    expect(row).toMatchObject({ name: "Player aa", fields: ["favourites", "quiz"], avatar: null });
    expect(row?.data?.favourites).toEqual(["layla"]);
  });

  it("shows the picture only when chosen", async () => {
    as(ACCOUNT_A);
    const r = (await (await profile.PUT(call("/api/account/profile", "PUT", { public: true, fields: ["avatar"] }))).json()) as { slug: string };
    expect((await readPublicProfile(r.slug))?.avatar).toBe("https://akmpicture.youngjoygame.com/dist/a.jpg");
  });

  it("turned off: the link shows nothing, the name is forgotten, the slug is kept", async () => {
    as(ACCOUNT_A);
    const on = (await (await profile.PUT(call("/api/account/profile", "PUT", { public: true, fields: ["quiz"] }))).json()) as { slug: string };
    const off = (await (await profile.PUT(call("/api/account/profile", "PUT", { public: false, fields: ["quiz"] }))).json()) as { slug: string };
    expect(off.slug).toBe(on.slug);
    expect(await readPublicProfile(on.slug)).toBeNull();
    expect(store.profile.get(ACCOUNT_A)?.displayName).toBeNull();
  });

  it("each player only changes their own page", async () => {
    as(ACCOUNT_A);
    const a = (await (await profile.PUT(call("/api/account/profile", "PUT", { public: true, fields: ["quiz"] }))).json()) as { slug: string };
    as(ACCOUNT_B);
    await profile.PUT(call("/api/account/profile", "PUT", { public: false, fields: [] }));
    expect((await readPublicProfile(a.slug))?.name).toBe("Player aa");
  });

  it("an unknown or malformed slug reads as nothing", async () => {
    expect(await readPublicProfile("nope")).toBeNull();
    expect(await readPublicProfile("../../etc/passwd")).toBeNull();
    expect(await readPublicProfile("AAAAAAAAAAAA")).toBeNull();
  });
});

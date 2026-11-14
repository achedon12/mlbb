import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The collection kept on the game account, against a real Postgres: the
 * routes' gates, the catalogue check, and the compare-and-set that turns a
 * write from a stale device into a conflict to merge.
 *
 * Needs a migrated, disposable database, for instance:
 *   docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=t postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:t@127.0.0.1:55432/postgres npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://postgres:t@127.0.0.1:55432/postgres npx vitest run tests/functional/collection-database.test.ts
 * Skipped without TEST_DATABASE_URL. The collection table is emptied first.
 */
const url = process.env.TEST_DATABASE_URL?.trim();

const signedIn = { player: { status: "none" } as { status: "ok"; id: string; name: string } | { status: "none" } };

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/lib/community-builds-server", () => ({ currentPlayer: async () => signedIn.player }));
vi.mock("@/lib/log", () => ({ log: vi.fn(async () => {}), logError: vi.fn(async () => {}) }));

const account = (n: number) => n.toString(16).padStart(24, "0");

describe.skipIf(!url)("collection on the account", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db");
  const { knownIds, saveCollection, readCollection } = await import("@/lib/collection-account");
  const route = await import("@/app/api/collection/route");

  const ids = knownIds();
  const [s1, s2, s3] = [...ids.skins].slice(0, 3);
  const [h1] = [...ids.heroes];

  const ORIGIN = "http://mlbb.test";
  let address = 0;
  const call = (method: string, body?: unknown, origin: string | null = ORIGIN) =>
    new Request(`${ORIGIN}/api/collection`, {
      method,
      headers: {
        ...(origin ? { origin } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        // A fresh address per request: the address rate is not what these tests are about.
        "x-forwarded-for": `203.0.113.${(address++ % 250) + 1}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const as = (n: number) => {
    signedIn.player = { status: "ok", id: account(n), name: `Player ${n}` };
  };

  beforeAll(async () => {
    await db().skinCollection.deleteMany();
  });
  beforeEach(() => {
    signedIn.player = { status: "none" };
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  it("tells a visitor apart from a signed-in player with no copy yet", async () => {
    expect(await (await route.GET(call("GET"))).json()).toEqual({ available: true, connected: false });
    as(1);
    const body = await (await route.GET(call("GET"))).json();
    expect(body).toMatchObject({ available: true, connected: true, collection: null });
    expect(body.account).toMatch(/^[\w-]{16}$/);
    expect(body.account).not.toContain(account(1));
  });

  it("guards the write: origin, session, then the catalogue", async () => {
    const body = { heroes: [h1], skins: [s1], base: null };
    expect((await route.PUT(call("PUT", body, "https://evil.example"))).status).toBe(403);
    expect((await route.PUT(call("PUT", body))).status).toBe(401);
    as(2);
    expect((await route.PUT(call("PUT", { ...body, skins: ["999999"] }))).status).toBe(400);
    expect((await route.PUT(call("PUT", { ...body, heroes: ["nobody"] }))).status).toBe(400);
    expect((await route.PUT(call("PUT", { ...body, extra: 1 }))).status).toBe(400);
    expect((await route.PUT(call("PUT", { ...body, skins: Array(5000).fill(s1) }))).status).toBe(400);
    expect(await readCollection(account(2))).toBeNull();
  });

  it("saves, then only accepts a write based on the current version", async () => {
    as(3);
    const first = await route.PUT(call("PUT", { heroes: [h1], skins: [s2, s1, s1], base: null }));
    expect(first.status).toBe(200);
    const saved = (await first.json()).collection;
    expect(saved).toMatchObject({ heroes: [h1], skins: [s1, s2].sort() });

    // A second device that never saw this copy: refused, handed the current one.
    const stale = await route.PUT(call("PUT", { heroes: [], skins: [s3], base: null }));
    expect(stale.status).toBe(409);
    expect((await stale.json()).collection).toEqual(saved);

    const next = await route.PUT(call("PUT", { heroes: [], skins: [s3], base: saved.updatedAt }));
    expect(next.status).toBe(200);
    const after = (await next.json()).collection;
    expect(after.updatedAt > saved.updatedAt).toBe(true);

    // The first version again: stale now.
    expect((await route.PUT(call("PUT", { heroes: [], skins: [], base: saved.updatedAt }))).status).toBe(409);
    expect(await readCollection(account(3))).toEqual(after);
  });

  it("keeps two saves in the same millisecond as distinct versions", async () => {
    const created = await saveCollection(account(4), { heroes: [], skins: [s1], base: null }, 1_000);
    expect(created.ok).toBe(true);
    const base = created.ok ? created.collection.updatedAt : "";
    const second = await saveCollection(account(4), { heroes: [], skins: [s2], base }, 1_000);
    expect(second.ok && second.collection.updatedAt).not.toBe(base);
    expect((await saveCollection(account(4), { heroes: [], skins: [s3], base }, 1_000)).ok).toBe(false);
  });

  it("keeps every account's copy to itself", async () => {
    as(5);
    expect((await (await route.GET(call("GET"))).json()).collection).toBeNull();
  });
});

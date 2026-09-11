import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_BUILD, type CodeCatalog } from "@/lib/build-code";
import {
  INDEX_THRESHOLD,
  LIMITS,
  NOTES_MAX,
  TITLE_MAX,
  WEEK_MS,
  canPublish,
  cleanText,
  hasLink,
  isIndexable,
  isSameOrigin,
  sortBuilds,
  toPublic,
  toggleVote,
  validatePublication,
  weekVotes,
  type StoredBuild,
} from "@/lib/community-builds";
import { StorageError, deleteBuild, getBuild, listBuilds, publishBuild, voteBuild } from "@/lib/community-builds-store";

// The journal would write to `logs/`, the session would read cookies and ask
// the game's login service: all three are replaced for the route tests.
const session = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("@/lib/journal", () => ({ journaliser: vi.fn(async () => {}), journaliserErreur: vi.fn(async () => {}) }));
vi.mock("@/lib/session", () => ({ jetonCourant: async () => session.token }));
vi.mock("@/lib/mlbb-auth", () => ({
  profil: async (token: string) =>
    token.startsWith("player-")
      ? { etat: "ok", donnees: { roleId: Number(token.slice(7)), zoneId: 7, name: `Player ${token.slice(7)}` } }
      : { etat: "expire" },
}));

/**
 * Community builds: text cleaning and link refusal, publication rules,
 * votes and order, same-origin check, then the JSON storage on a temporary
 * folder (never the real volume).
 */

const catalog: CodeCatalog = {
  heroes: new Set(["aamon", "layla"]),
  items: new Set(["genius-wand", "holy-crystal"]),
  emblems: new Set(["mage"]),
  tiers: [new Set(["rupture"]), new Set(["weapon-master"]), new Set(["killing-spree"])],
  spells: new Set(["retribution"]),
};

const goodBuild = { hero: "aamon", level: 15, items: ["genius-wand", "holy-crystal"], emblem: "mage", talents: ["rupture", null, "killing-spree"], spell: "retribution" };

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-09-11T12:00:00Z");

const stored = (id: string, over: Partial<StoredBuild> = {}): StoredBuild => ({
  id,
  title: `Build ${id}`,
  notes: "",
  build: { ...EMPTY_BUILD, hero: "aamon", items: ["genius-wand"] },
  author: { id: "author", name: "Author" },
  createdAt: new Date(NOW - DAY).toISOString(),
  votes: [],
  ...over,
});

describe("text", () => {
  it("removes invisible characters and normalises whitespace", () => {
    expect(cleanText("  Burst\u200B  mage\u202E build  ", false)).toBe("Burst mage build");
    expect(cleanText("Line one  \r\n\r\n\r\n\tLine two\n", true)).toBe("Line one\n\nLine two");
    expect(cleanText("Cafe\u0301", false)).toBe("Caf\u00E9");
  });

  it("spots links, bare domains and disguised ones", () => {
    for (const text of [
      "see https://example.org/x",
      "www.example.org",
      "join discord.gg/abc",
      "mlbb-guides . com",
      "example[.]net",
      "example dot com",
      "HTTP://SHOUT.IO",
    ]) {
      expect(hasLink(text), text).toBe(true);
    }
    for (const text of ["Lv. 15 core, e.g. Holy Crystal first", "3.5 sec cooldown", "Blade of Despair. Then Malefic Roar.", "Go gold lane"]) {
      expect(hasLink(text), text).toBe(false);
    }
  });
});

describe("publication", () => {
  it("accepts a clean publication and cleans its text", () => {
    const r = validatePublication({ title: "  Burst  jungle ", notes: "Rush Genius Wand.\n\n\n\nThen Holy Crystal.", build: goodBuild }, catalog);
    expect(r).toEqual({
      ok: true,
      value: { title: "Burst jungle", notes: "Rush Genius Wand.\n\nThen Holy Crystal.", build: goodBuild },
    });
    expect(validatePublication({ title: "No notes", build: goodBuild }, catalog)).toMatchObject({ ok: true, value: { notes: "" } });
  });

  it("refuses bad titles, notes, links and builds", () => {
    const base = { title: "Burst jungle", notes: "", build: goodBuild };
    expect(validatePublication({ ...base, title: "ab" }, catalog)).toEqual({ ok: false, error: "title" });
    expect(validatePublication({ ...base, title: "x".repeat(TITLE_MAX + 1) }, catalog)).toEqual({ ok: false, error: "title" });
    expect(validatePublication({ ...base, title: "x".repeat(TITLE_MAX) }, catalog).ok).toBe(true);
    // An emoji counts as one character.
    expect(validatePublication({ ...base, title: "\u{1F525}".repeat(TITLE_MAX) }, catalog).ok).toBe(true);
    expect(validatePublication({ ...base, notes: "n".repeat(NOTES_MAX + 1) }, catalog)).toEqual({ ok: false, error: "notes" });
    expect(validatePublication({ ...base, notes: 42 }, catalog)).toEqual({ ok: false, error: "notes" });
    expect(validatePublication({ ...base, notes: "full guide at www.example.org" }, catalog)).toEqual({ ok: false, error: "link" });
    expect(validatePublication({ ...base, title: "visit example.com" }, catalog)).toEqual({ ok: false, error: "link" });
    expect(validatePublication({ ...base, build: { ...goodBuild, hero: "unknown" } }, catalog)).toEqual({ ok: false, error: "build" });
    expect(validatePublication({ ...base, extra: true }, catalog)).toEqual({ ok: false, error: "invalid" });
    expect(validatePublication("title", catalog)).toEqual({ ok: false, error: "invalid" });
  });

  it("caps publications per account and in total", () => {
    const recent = Array.from({ length: LIMITS.perAccountPerDay }, (_, i) => stored(`r${i}`, { createdAt: new Date(NOW - 3600_000).toISOString() }));
    expect(canPublish(recent, "author", NOW)).toBe("day");
    expect(canPublish(recent, "someone-else", NOW)).toBe("ok");
    const old = Array.from({ length: LIMITS.perAccountTotal }, (_, i) => stored(`o${i}`, { createdAt: new Date(NOW - 30 * DAY).toISOString() }));
    expect(canPublish(old, "author", NOW)).toBe("total");
  });
});

describe("votes and order", () => {
  it("toggles one vote per account", () => {
    const b = stored("a");
    const first = toggleVote(b, "v1", NOW);
    expect(first.voted).toBe(true);
    expect(first.build.votes).toEqual([{ voter: "v1", at: NOW }]);
    const second = toggleVote(first.build, "v1", NOW + 1);
    expect(second.voted).toBe(false);
    expect(second.build.votes).toEqual([]);
  });

  it("counts the week's votes and sorts three ways", () => {
    const old = stored("old", { votes: [1, 2, 3].map((i) => ({ voter: `v${i}`, at: NOW - WEEK_MS - i })), createdAt: new Date(NOW - 20 * DAY).toISOString() });
    const hot = stored("hot", { votes: [{ voter: "v1", at: NOW - DAY }, { voter: "v2", at: NOW - DAY }] });
    const fresh = stored("fresh", { createdAt: new Date(NOW - 60_000).toISOString() });
    expect(weekVotes(old, NOW)).toBe(0);
    expect(weekVotes(hot, NOW)).toBe(2);
    expect(sortBuilds([fresh, hot, old], "votes", NOW).map((b) => b.id)).toEqual(["old", "hot", "fresh"]);
    expect(sortBuilds([old, hot, fresh], "recent", NOW).map((b) => b.id)).toEqual(["fresh", "hot", "old"]);
    expect(sortBuilds([old, fresh, hot], "week", NOW).map((b) => b.id)).toEqual(["hot", "old", "fresh"]);
  });

  it("shows no ids to the public, only the viewer's own flags", () => {
    const b = stored("a", { votes: [{ voter: "v1", at: NOW }] });
    const seen = toPublic(b, "v1", NOW);
    expect(seen).toMatchObject({ votes: 1, weekVotes: 1, voted: true, own: false, authorName: "Author", code: "h=aamon&i=genius-wand" });
    expect(JSON.stringify(seen)).not.toContain("v1\"");
    expect(toPublic(b, null, NOW)).toMatchObject({ voted: false, own: false });
    expect(toPublic(b, "author", NOW).own).toBe(true);
  });

  it("indexes a build page from the vote threshold", () => {
    expect(isIndexable(INDEX_THRESHOLD - 1)).toBe(false);
    expect(isIndexable(INDEX_THRESHOLD)).toBe(true);
  });
});

describe("same origin", () => {
  const headers = (h: Record<string, string>) => new Headers(h);
  it("accepts the site itself and non-browser callers", () => {
    expect(isSameOrigin(headers({ origin: "http://localhost:3001", host: "localhost:3001", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(headers({ origin: "https://mlbbdex.com", host: "app:3000" }), ["mlbbdex.com"])).toBe(true);
    expect(isSameOrigin(headers({ origin: "https://mlbbdex.com", host: "app:3000", "x-forwarded-host": "mlbbdex.com" }))).toBe(true);
    expect(isSameOrigin(headers({ host: "localhost:3001" }))).toBe(true);
  });
  it("refuses other sites", () => {
    expect(isSameOrigin(headers({ origin: "https://evil.example", host: "mlbbdex.com" }), ["mlbbdex.com"])).toBe(false);
    expect(isSameOrigin(headers({ "sec-fetch-site": "cross-site", host: "mlbbdex.com" }))).toBe(false);
    expect(isSameOrigin(headers({ "sec-fetch-site": "same-site", origin: "https://www.mlbbdex.com", host: "mlbbdex.com" }))).toBe(false);
    expect(isSameOrigin(headers({ origin: "null", host: "mlbbdex.com" }))).toBe(false);
  });
});

describe("storage", () => {
  let folder: string;
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "mlbb-builds-"));
    process.env.DONNEES_DIR = folder;
  });
  const publication = { title: "Burst jungle", notes: "Rush it.", build: { ...goodBuild, talents: ["rupture", null, "killing-spree"] as [string | null, string | null, string | null] } };
  const fileContent = () => JSON.parse(readFileSync(join(folder, "community-builds.json"), "utf8")) as { builds: StoredBuild[] };

  it("publishes, lists and reads back from the file", async () => {
    expect(await listBuilds()).toEqual([]);
    const r = await publishBuild(publication, { id: "acc1", name: "Player" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.build.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(await getBuild(r.build.id)).toMatchObject({ title: "Burst jungle", author: { id: "acc1", name: "Player" }, votes: [] });
    expect(fileContent().builds).toHaveLength(1);
    // Atomic write: no temporary file left behind.
    expect(readdirSync(folder)).toEqual(["community-builds.json"]);
  });

  it("toggles votes, refuses one's own and unknown builds", async () => {
    const r = await publishBuild(publication, { id: "acc1", name: "Player" }, NOW);
    if (!r.ok) throw new Error("publish failed");
    expect(await voteBuild(r.build.id, "acc2", NOW)).toEqual({ ok: true, votes: 1, voted: true });
    expect(await voteBuild(r.build.id, "acc3", NOW)).toEqual({ ok: true, votes: 2, voted: true });
    expect(await voteBuild(r.build.id, "acc2", NOW)).toEqual({ ok: true, votes: 1, voted: false });
    expect(await voteBuild(r.build.id, "acc1", NOW)).toEqual({ ok: false, reason: "own" });
    expect(await voteBuild("unknownid123", "acc2", NOW)).toEqual({ ok: false, reason: "unknown" });
    expect(fileContent().builds[0].votes).toEqual([{ voter: "acc3", at: NOW }]);
  });

  it("lets only the author or the administrator delete", async () => {
    const r = await publishBuild(publication, { id: "acc1", name: "Player" }, NOW);
    if (!r.ok) throw new Error("publish failed");
    expect(await deleteBuild(r.build.id, { authorId: "acc2", admin: false })).toBe("forbidden");
    expect(await deleteBuild(r.build.id, { authorId: null, admin: false })).toBe("forbidden");
    expect(await deleteBuild(r.build.id, { authorId: "acc1", admin: false })).toBe("ok");
    expect(await deleteBuild(r.build.id, { authorId: "acc1", admin: false })).toBe("unknown");
    const r2 = await publishBuild(publication, { id: "acc1", name: "Player" }, NOW);
    if (!r2.ok) throw new Error("publish failed");
    expect(await deleteBuild(r2.build.id, { authorId: null, admin: true })).toBe("ok");
    expect(await listBuilds()).toEqual([]);
  });

  it("enforces the per-account daily cap", async () => {
    for (let i = 0; i < LIMITS.perAccountPerDay; i += 1) {
      expect((await publishBuild(publication, { id: "acc1", name: "Player" }, NOW + i)).ok).toBe(true);
    }
    expect(await publishBuild(publication, { id: "acc1", name: "Player" }, NOW + 100)).toEqual({ ok: false, reason: "day" });
    expect((await publishBuild(publication, { id: "acc2", name: "Other" }, NOW + 100)).ok).toBe(true);
  });

  it("refuses to work on a corrupted file instead of starting over", async () => {
    writeFileSync(join(folder, "community-builds.json"), "{ not json");
    await expect(listBuilds()).rejects.toBeInstanceOf(StorageError);
    await expect(publishBuild(publication, { id: "acc1", name: "Player" }, NOW)).rejects.toBeInstanceOf(StorageError);
    expect(readFileSync(join(folder, "community-builds.json"), "utf8")).toBe("{ not json");
  });
});

describe("API routes", () => {
  let folder: string;
  // The first import of the routes loads the whole game catalog: seconds, not a hang.
  beforeAll(async () => {
    await Promise.all([
      import("@/app/api/builds/route"),
      import("@/app/api/builds/[id]/route"),
      import("@/app/api/builds/[id]/vote/route"),
    ]);
  }, 60_000);
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "mlbb-builds-api-"));
    process.env.DONNEES_DIR = folder;
    session.token = null;
  });

  const request = (path: string, init: RequestInit = {}) =>
    new Request(`http://localhost:3001${path}`, {
      ...init,
      headers: { host: "localhost:3001", origin: "http://localhost:3001", "sec-fetch-site": "same-origin", ...init.headers },
    });
  const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  const body = {
    title: "Burst jungle",
    notes: "Rush Genius Wand.",
    build: { hero: "aamon", level: 15, items: ["genius-wand", "holy-crystal"], emblem: "mage", talents: ["rupture", "weapon-master", "killing-spree"], spell: "retribution" },
  };

  it("publishes, lists, toggles votes and deletes through the routes", async () => {
    const list = await import("@/app/api/builds/route");
    const one = await import("@/app/api/builds/[id]/route");
    const vote = await import("@/app/api/builds/[id]/vote/route");

    expect((await list.POST(request("/api/builds", json(body)))).status).toBe(401);

    session.token = "player-1";
    expect((await list.POST(request("/api/builds", json({ ...body, notes: "guide on www.example.org" })))).status).toBe(400);
    const created = await list.POST(request("/api/builds", json(body)));
    expect(created.status).toBe(201);
    const { id, hero } = (await created.json()) as { id: string; hero: string };
    expect(hero).toBe("aamon");

    const listed = (await (await list.GET(request("/api/builds?hero=aamon"))).json()) as { total: number; builds: Record<string, unknown>[] };
    expect(listed.total).toBe(1);
    expect(listed.builds[0]).toMatchObject({ id, title: "Burst jungle", authorName: "Player 1", own: true, votes: 0, voted: false });
    // No account id leaves the server.
    expect(JSON.stringify(listed)).not.toMatch(/"author"|"voter"/);

    expect((await vote.POST(request(`/api/builds/${id}/vote`, { method: "POST" }), context(id))).status).toBe(403);

    session.token = "player-2";
    const first = await vote.POST(request(`/api/builds/${id}/vote`, { method: "POST" }), context(id));
    expect(await first.json()).toEqual({ votes: 1, voted: true });
    const second = await vote.POST(request(`/api/builds/${id}/vote`, { method: "POST" }), context(id));
    expect(await second.json()).toEqual({ votes: 0, voted: false });
    await vote.POST(request(`/api/builds/${id}/vote`, { method: "POST" }), context(id));
    const seen = (await (await one.GET(request(`/api/builds/${id}`), context(id))).json()) as Record<string, unknown>;
    expect(seen).toMatchObject({ votes: 1, voted: true, own: false });

    expect((await one.DELETE(request(`/api/builds/${id}`, { method: "DELETE" }), context(id))).status).toBe(403);
    session.token = "player-1";
    expect((await one.DELETE(request(`/api/builds/${id}`, { method: "DELETE" }), context(id))).status).toBe(204);
    expect((await one.GET(request(`/api/builds/${id}`), context(id))).status).toBe(404);
  });

  it("lets the administrator delete with the token, and only with it", async () => {
    const list = await import("@/app/api/builds/route");
    const one = await import("@/app/api/builds/[id]/route");
    session.token = "player-3";
    const { id } = (await (await list.POST(request("/api/builds", json(body)))).json()) as { id: string };
    session.token = null;
    process.env.BUILDS_ADMIN_TOKEN = "admin-token-for-tests-0123456789";
    const admin = (token: string) => request(`/api/builds/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    expect((await one.DELETE(admin("wrong-token-for-tests-012345678"), context(id))).status).toBe(403);
    expect((await one.DELETE(admin("admin-token-for-tests-0123456789"), context(id))).status).toBe(204);
    delete process.env.BUILDS_ADMIN_TOKEN;
  });

  it("refuses other origins before anything else", async () => {
    const list = await import("@/app/api/builds/route");
    session.token = "player-4";
    const foreign = new Request("http://localhost:3001/api/builds", {
      ...json(body),
      headers: { host: "localhost:3001", origin: "https://evil.example", "content-type": "application/json" },
    });
    expect((await list.POST(foreign)).status).toBe(403);
    expect(readdirSync(folder)).toEqual([]);
  });
});


import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardInput, Category } from "@/lib/community/rules";

/**
 * The community (forum, votes, reports, moderation, teammate cards) against
 * a real Postgres: the guarded writes, the caps, the full-text search and
 * its GIN indexes, the moderation queue and log, and the routes' gates.
 *
 * Needs a migrated, disposable database, for instance:
 *   docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=t postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:t@127.0.0.1:55432/postgres npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://postgres:t@127.0.0.1:55432/postgres npx vitest run tests/functional/community-database.test.ts
 * Skipped without TEST_DATABASE_URL. Every community table is emptied first.
 */
const url = process.env.TEST_DATABASE_URL?.trim();

const MODERATOR = "123456789012345678";
const session = { cookie: null as string | null };
const signedIn = { player: { status: "none" } as { status: "ok"; id: string; name: string } | { status: "none" } };

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "mlbbdex_discord" && session.cookie ? { value: session.cookie } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/community-builds-server", () => ({ currentPlayer: async () => signedIn.player }));
vi.mock("@/lib/log", () => ({ log: vi.fn(async () => {}), logError: vi.fn(async () => {}) }));

const account = (n: number) => n.toString(16).padStart(24, "0");
const author = (n: number) => ({ id: account(n), name: `Player ${n}` });
const DAY = 24 * 3600_000;

describe.skipIf(!url)("community database paths", async () => {
  if (!url) return;
  Object.assign(process.env, {
    DATABASE_URL: url,
    BOT_API_SECRET: "a".repeat(64),
    BOT_SESSION_SECRET: "b".repeat(64),
    BOT_INTERNAL_URL: "http://bot:3100",
    DISCORD_CLIENT_ID: "123456789012345670",
    DISCORD_CLIENT_SECRET: "c".repeat(32),
    BOT_SUPER_ADMIN_IDS: MODERATOR,
  });
  const { db } = await import("@/lib/db");
  const store = await import("@/lib/community/store");
  const { sealSession } = await import("@/lib/bot/session");
  const threadsRoute = await import("@/app/api/community/threads/route");
  const votesRoute = await import("@/app/api/community/votes/route");
  const moderationRoute = await import("@/app/api/community/moderation/route");
  const teammatesRoute = await import("@/app/api/community/teammates/route");

  const ORIGIN = "http://mlbb.test";
  const call = (path: string, method: string, body?: unknown, origin: string | null = ORIGIN) =>
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: { ...(origin ? { origin } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), "x-forwarded-for": "203.0.113.9" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /** A member seen long ago: past the new-account limits. */
  async function veteran(n: number) {
    await db().communityMember.upsert({
      where: { accountId: account(n) },
      create: { accountId: account(n), name: `Player ${n}`, firstSeenAt: new Date(Date.now() - 30 * DAY) },
      update: { firstSeenAt: new Date(Date.now() - 30 * DAY), bannedAt: null, banUntil: null },
    });
  }

  const thread = (title: string, body = "A body long enough to post.", category: Category = "general", heroes: string[] = []) => ({ category, title, body, heroes });

  beforeAll(async () => {
    await db().$transaction([
      db().forumVote.deleteMany(),
      db().communityReport.deleteMany(),
      db().moderationLog.deleteMany(),
      db().forumPost.deleteMany(),
      db().forumThread.deleteMany(),
      db().teammateCard.deleteMany(),
      db().communityMember.deleteMany(),
    ]);
  });
  beforeEach(() => {
    signedIn.player = { status: "none" };
    session.cookie = null;
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  it("starts a thread through the route, behind the origin and the session", async () => {
    const body = { category: "heroes-builds", title: "Ling jungle in Mythic", body: "Which emblem do you run on **Ling**?", heroes: ["ling", "nobody"] };
    expect((await threadsRoute.POST(call("/api/community/threads", "POST", body))).status).toBe(401);
    signedIn.player = { status: "ok", ...author(1) };
    expect((await threadsRoute.POST(call("/api/community/threads", "POST", body, "https://evil.example"))).status).toBe(403);
    expect((await threadsRoute.POST(call("/api/community/threads", "POST", body, null))).status).toBe(403);
    expect((await threadsRoute.POST(call("/api/community/threads", "POST", { ...body, title: "x" }))).status).toBe(400);

    const created = await threadsRoute.POST(call("/api/community/threads", "POST", body));
    expect(created.status).toBe(201);
    const { id, path } = (await created.json()) as { id: number; path: string };
    expect(path).toBe(`/community/heroes-builds/${id}-ling-jungle-in-mythic`);
    const stored = await db().forumThread.findUniqueOrThrow({ where: { id } });
    // Unknown hero slugs are dropped; the account hash and the name are kept.
    expect(stored).toMatchObject({ heroes: ["ling"], authorId: account(1), authorName: "Player 1", replyCount: 0, score: 0 });
    expect((await db().communityMember.findUniqueOrThrow({ where: { accountId: account(1) } })).name).toBe("Player 1");
  });

  it("holds new accounts to lower caps and no links, refuses repeats and filtered words", async () => {
    const newcomer = author(2);
    expect(await store.createThread(thread("First question here"), newcomer)).toMatchObject({ ok: true });
    expect(await store.createThread(thread("First question here"), newcomer)).toEqual({ ok: false, reason: "duplicate" });
    expect(await store.createThread(thread("A link for you", "see https://example.com"), newcomer)).toEqual({ ok: false, reason: "newAccountLinks" });
    expect(await store.createThread(thread("Second question", "Another body, long enough."), newcomer)).toMatchObject({ ok: true });
    expect(await store.createThread(thread("Third question", "Yet another body to post."), newcomer)).toEqual({ ok: false, reason: "day" });

    await veteran(3);
    expect(await store.createThread(thread("Guide link", "my guide https://example.com/guide"), author(3))).toMatchObject({ ok: true });
    expect(await store.createThread(thread("Cheap stuff", "FREE DIAMONDS click"), author(3))).toEqual({ ok: false, reason: "spam" });
    expect(await store.createThread(thread("You retard", "A body long enough to post."), author(3))).toEqual({ ok: false, reason: "blocked" });
  });

  it("replies, counts and orders them, and refuses a locked thread", async () => {
    await veteran(4);
    const created = await store.createThread(thread("Replies test"), author(4));
    if (!created.ok) throw new Error("thread");
    const id = created.value.id;
    const first = await store.createReply(id, "First reply", author(5), Date.now() - 1000);
    const second = await store.createReply(id, "Second reply", author(6));
    expect(first).toMatchObject({ ok: true, value: { index: 1 } });
    expect(second).toMatchObject({ ok: true, value: { index: 2 } });
    const { posts, total } = await store.listReplies(id, 1);
    expect(total).toBe(2);
    expect(posts.map((p) => p.body)).toEqual(["First reply", "Second reply"]);
    expect((await store.getThread(id))?.replyCount).toBe(2);

    await db().forumThread.update({ where: { id }, data: { locked: true } });
    expect(await store.createReply(id, "Too late", author(5))).toEqual({ ok: false, reason: "locked" });
    expect(await store.createReply(999_999, "Nowhere", author(5))).toEqual({ ok: false, reason: "unknown" });
  });

  it("lets authors edit for an hour and delete for a day, nobody else", async () => {
    await veteran(7);
    const created = await store.createThread(thread("Edit me"), author(7));
    if (!created.ok) throw new Error("thread");
    const id = created.value.id;
    const edit = { title: "Edited title", body: "An edited body, long enough.", heroes: [] };
    expect(await store.editThread(id, edit, author(8))).toBe("forbidden");
    expect(await store.editThread(id, edit, author(7), Date.now() + 2 * 3600_000)).toBe("window");
    expect(await store.editThread(id, edit, author(7))).toBe("ok");
    expect((await store.getThread(id))?.editedAt).not.toBeNull();

    const reply = await store.createReply(id, "A reply to delete", author(8));
    if (!reply.ok) throw new Error("reply");
    expect(await store.deleteReply(reply.value.id, author(7))).toBe("forbidden");
    expect(await store.deleteReply(reply.value.id, author(8), Date.now() + 2 * DAY)).toBe("window");
    expect(await store.deleteReply(reply.value.id, author(8))).toBe("ok");
    const deleted = await db().forumPost.findUniqueOrThrow({ where: { id: reply.value.id } });
    expect(deleted.body).toBe("");
    expect((await store.getThread(id))?.replyCount).toBe(0);

    expect(await store.deleteThread(id, author(7))).toBe("ok");
    expect((await store.listThreads({ sort: "latest", page: 1 })).threads.some((t) => t.id === id)).toBe(false);
  });

  it("toggles one upvote per account, never one's own, and sorts by them", async () => {
    await veteran(9);
    const created = await store.createThread(thread("Vote for me", "A body long enough to post.", "esports"), author(9));
    if (!created.ok) throw new Error("thread");
    const id = created.value.id;
    signedIn.player = { status: "ok", ...author(10) };
    const vote = () => votesRoute.POST(call("/api/community/votes", "POST", { kind: "thread", id }));
    expect(await (await vote()).json()).toEqual({ score: 1, voted: true });
    expect(await (await vote()).json()).toEqual({ score: 0, voted: false });
    expect(await (await vote()).json()).toEqual({ score: 1, voted: true });
    expect(await store.toggleVote("thread", id, author(9))).toEqual({ ok: false, reason: "own" });
    expect(await store.votedBy(account(10), "thread", [id, 12345])).toEqual(new Set([id]));

    const other = await store.createThread(thread("Newer, no votes", "Another body long enough to post.", "esports"), author(9));
    expect(other.ok).toBe(true);
    const top = await store.listThreads({ category: "esports", sort: "top", page: 1 });
    const latest = await store.listThreads({ category: "esports", sort: "latest", page: 1 });
    expect(top.threads[0]?.id).toBe(id);
    expect(latest.threads[0]?.title).toBe("Newer, no votes");
  });

  it("finds threads by their words or their replies' words, never hidden ones", async () => {
    await veteran(11);
    const a = await store.createThread(thread("Fanny cables explained", "How to chain the cables with Fanny.", "guides", ["fanny"]), author(11));
    const b = await store.createThread(thread("Turtle timing", "When should the jungler take it?", "ranked-help"), author(11));
    if (!a.ok || !b.ok) throw new Error("threads");
    await store.createReply(b.value.id, "Take the turtle after a Retribution duel", author(12));

    expect((await store.searchThreads("cables", null, 1)).threads.map((t) => t.id)).toEqual([a.value.id]);
    expect((await store.searchThreads("retribution", null, 1)).threads.map((t) => t.id)).toEqual([b.value.id]);
    expect((await store.searchThreads("retribution", "guides", 1)).total).toBe(0);
    expect((await store.searchThreads('"chain the cables"', "guides", 1)).total).toBe(1);
    expect((await store.searchThreads("fanny -cables", null, 1)).total).toBe(0);
    await db().forumThread.update({ where: { id: a.value.id }, data: { hiddenAt: new Date() } });
    expect((await store.searchThreads("cables", null, 1)).total).toBe(0);

    // The queries can use the GIN indexes of the migration.
    const indexes = await db().$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE indexname LIKE '%search_idx'`;
    expect(indexes.map((i) => i.indexname).sort()).toEqual(["ForumPost_search_idx", "ForumThread_search_idx"]);
  });

  it("hides a post after three reports, queues it, and logs the moderator's decision", async () => {
    await veteran(13);
    const created = await store.createThread(thread("Reported thread"), author(13));
    if (!created.ok) throw new Error("thread");
    const id = created.value.id;
    const report = (n: number) => store.reportTarget({ kind: "thread", id, reason: "spam" }, author(n));
    expect(await store.reportTarget({ kind: "thread", id, reason: "spam" }, author(13))).toBe("own");
    expect(await report(14)).toBe("ok");
    expect(await report(14)).toBe("duplicate");
    expect(await report(15)).toBe("ok");
    expect((await store.getThread(id))?.hiddenAt).toBeNull();
    expect(await report(16)).toBe("ok");
    expect((await store.getThread(id))?.hiddenAt).not.toBeNull();
    expect(await store.reportTarget({ kind: "post", id: 999_999, reason: "spam" }, author(14))).toBe("unknown");

    const queue = await store.moderationQueue();
    const entry = queue.find((e) => e.kind === "thread" && e.id === id);
    expect(entry).toMatchObject({ hidden: true, authorId: account(13), title: "Reported thread" });
    expect(entry?.reports).toHaveLength(3);

    // Not a moderator: the same 404 as no route at all.
    const decide = (body: unknown) => moderationRoute.POST(call("/api/community/moderation", "POST", body));
    expect((await decide({ action: "unhide", kind: "thread", id })).status).toBe(404);
    session.cookie = sealSession({ sessionSecret: "b".repeat(64) }, { id: "223456789012345678", name: "Someone", avatar: null });
    expect((await decide({ action: "unhide", kind: "thread", id })).status).toBe(404);

    session.cookie = sealSession({ sessionSecret: "b".repeat(64) }, { id: MODERATOR, name: "Moderator", avatar: null });
    expect((await decide({ action: "lock", kind: "card", id })).status).toBe(400);
    expect((await decide({ action: "unhide", kind: "thread", id: 999_999 })).status).toBe(404);
    expect((await decide({ action: "unhide", kind: "thread", id, note: "false alarm" })).status).toBe(200);
    expect((await store.getThread(id))?.hiddenAt).toBeNull();
    expect(await db().communityReport.count({ where: { kind: "thread", targetId: id, resolvedAt: null } })).toBe(0);
    expect((await store.moderationQueue()).some((e) => e.kind === "thread" && e.id === id)).toBe(false);
    expect((await decide({ action: "pin", kind: "thread", id })).status).toBe(200);
    expect((await store.getThread(id))?.pinned).toBe(true);

    const log = await store.recentLog();
    expect(log[0]).toMatchObject({ action: "pin", moderatorId: MODERATOR, kind: "thread", targetId: id });
    expect(log[1]).toMatchObject({ action: "unhide", note: "false alarm", accountId: account(13) });
  });

  it("bans an author from everything until the ban is lifted or runs out", async () => {
    await veteran(17);
    const created = await store.createThread(thread("Soon banned"), author(17));
    if (!created.ok) throw new Error("thread");
    await store.saveCard({ region: "eu", rank: "epic", lanes: ["Mid"], heroes: [], languages: ["en"], playTimes: [], note: null, gameId: null, discord: null }, author(17));
    const moderator = { id: MODERATOR, name: "Moderator" };
    expect(await store.moderate({ action: "ban", kind: "thread", id: created.value.id, days: 7, note: "spam" }, moderator)).toBe("ok");

    expect(await store.createReply(created.value.id, "Still here?", author(17))).toEqual({ ok: false, reason: "banned" });
    expect(await store.toggleVote("thread", created.value.id, author(17))).toEqual({ ok: false, reason: "own" });
    expect(await store.memberAllowed(author(17))).toBe(false);
    expect(await store.ownCard(account(17))).toBeNull();
    expect((await store.bannedMembers()).map((m) => m.accountId)).toContain(account(17));
    // Seven days later the ban has run out on its own.
    expect(await store.memberAllowed(author(17), Date.now() + 8 * DAY)).toBe(true);

    expect(await store.moderate({ action: "unban", accountId: account(17) }, moderator)).toBe("ok");
    expect(await store.memberAllowed(author(17))).toBe(true);
    expect(await store.moderate({ action: "unban", accountId: account(999) }, moderator)).toBe("unknown");
  });

  it("keeps one teammate card per account, filters them and lets them expire", async () => {
    const card = { region: "ph", rank: "mythic", lanes: ["Jungle", "Roam"], heroes: ["ling"], languages: ["en", "tl"], playTimes: ["night"], note: "Duo for ranked", gameId: "12345678 (1234)", discord: "ling.main" } as CardInput;
    signedIn.player = { status: "ok", ...author(20) };
    const put = (body: unknown) => teammatesRoute.PUT(call("/api/community/teammates", "PUT", body));
    expect((await put({ ...card, gameId: "nope" })).status).toBe(400);
    expect((await put(card)).status).toBe(200);
    expect((await put({ ...card, rank: "legend" })).status).toBe(200);
    expect(await db().teammateCard.count({ where: { accountId: account(20) } })).toBe(1);
    expect((await store.ownCard(account(20)))?.rank).toBe("legend");

    await store.saveCard({ ...card, region: "eu", lanes: ["Gold"], languages: ["fr"], note: null }, author(21));
    const all = await store.listCards({}, 1);
    expect(all.total).toBeGreaterThanOrEqual(2);
    expect((await store.listCards({ region: "ph", lane: "Roam", language: "tl" }, 1)).cards.map((c) => c.accountId)).toEqual([account(20)]);
    expect((await store.listCards({ lane: "Exp" }, 1)).total).toBe(0);

    // Hidden by a moderator: saving again does not bring it back.
    const id = (await store.ownCard(account(21)))!.id;
    expect(await store.moderate({ action: "hide", kind: "card", id }, { id: MODERATOR, name: "Moderator" })).toBe("ok");
    expect(await store.saveCard({ ...card, note: null }, author(21))).toEqual({ ok: false, reason: "hidden" });

    expect((await teammatesRoute.DELETE(call("/api/community/teammates", "DELETE"))).status).toBe(204);
    expect((await teammatesRoute.DELETE(call("/api/community/teammates", "DELETE"))).status).toBe(404);

    // Eight days on, no card is listed any more (and the expired ones are purged).
    await store.saveCard({ ...card, note: null }, author(22));
    expect((await store.listCards({}, 1)).total).toBe(1);
    expect((await store.listCards({}, 1, Date.now() + 8 * DAY)).total).toBe(0);
    expect(await db().teammateCard.count({ where: { accountId: account(22) } })).toBe(0);
  });

  const moderator = { id: MODERATOR, name: "Moderator" };
  const card = { region: "eu", rank: "epic", lanes: ["Mid"], heroes: [], languages: ["en"], playTimes: [], note: "Hi", gameId: null, discord: "spam.account" } as CardInput;

  it("keeps a hidden card's account from listing one again, even after deleting it", async () => {
    await store.saveCard(card, author(30));
    const id = (await store.ownCard(account(30)))!.id;
    expect(await store.moderate({ action: "hide", kind: "card", id }, moderator)).toBe("ok");
    expect(await store.deleteCard(account(30))).toBe(true);
    expect(await store.saveCard(card, author(30))).toEqual({ ok: false, reason: "hidden" });

    // Three reports hide a card the same way.
    await store.saveCard(card, author(31));
    const other = (await store.ownCard(account(31)))!.id;
    for (const n of [32, 33, 34]) await store.reportTarget({ kind: "card", id: other, reason: "spam" }, author(n));
    await store.deleteCard(account(31));
    expect(await store.saveCard(card, author(31))).toEqual({ ok: false, reason: "hidden" });

    // The deleted card stays in the queue, from its snapshot, and its author can still be banned.
    const entry = (await store.moderationQueue()).find((e) => e.kind === "card" && e.id === other);
    expect(entry).toMatchObject({ deleted: true, authorId: account(31), snapshot: "Hi\nDiscord: spam.account", count: 3 });
    expect(await store.moderate({ action: "ban", kind: "card", id: other, days: 1 }, moderator)).toBe("ok");
    expect(await store.memberAllowed(author(31))).toBe(false);
    expect(await store.moderate({ action: "lock", kind: "card", id: other }, moderator)).toBe("invalid");

    // Shown again by a moderator: the account may list a card again.
    expect(await store.moderate({ action: "unhide", kind: "card", id }, moderator)).toBe("ok");
    expect(await store.saveCard(card, author(30))).toMatchObject({ ok: true });
  });

  it("freezes hidden posts for their authors and keeps what was reported", async () => {
    await veteran(35);
    const created = await store.createThread(thread("Freeze me", "The original reported text."), author(35));
    if (!created.ok) throw new Error("thread");
    const id = created.value.id;
    const reply = await store.createReply(id, "A reply in it", author(35));
    if (!reply.ok) throw new Error("reply");

    // Reported once, not hidden: the author may still edit, the report keeps the original.
    expect(await store.reportTarget({ kind: "thread", id, reason: "abuse" }, author(36))).toBe("ok");
    expect(await store.editThread(id, { title: "Freeze me", body: "Innocent text now.", heroes: [] }, author(35))).toBe("ok");
    const entry = (await store.moderationQueue()).find((e) => e.kind === "thread" && e.id === id);
    expect(entry).toMatchObject({ snapshot: "Freeze me\n\nThe original reported text.", body: "Innocent text now.", deleted: false });

    await store.moderate({ action: "hide", kind: "thread", id }, moderator);
    const edit = { title: "Freeze me", body: "Trying to clean it up.", heroes: [] };
    expect(await store.editThread(id, edit, author(35))).toBe("hidden");
    expect(await store.deleteThread(id, author(35))).toBe("hidden");
    // A reply of a hidden thread is frozen too.
    expect(await store.editReply(reply.value.id, "Changed", author(35))).toBe("hidden");
    expect(await store.deleteReply(reply.value.id, author(35))).toBe("hidden");
    expect((await store.getThread(id))?.body).toBe("Innocent text now.");

    await store.moderate({ action: "unhide", kind: "thread", id }, moderator);
    await store.moderate({ action: "hide", kind: "post", id: reply.value.id }, moderator);
    expect(await store.editReply(reply.value.id, "Changed", author(35))).toBe("hidden");
    expect(await store.deleteReply(reply.value.id, author(35))).toBe("hidden");

    // A locked thread takes no edit from its author either.
    await store.moderate({ action: "lock", kind: "thread", id }, moderator);
    expect(await store.editThread(id, edit, author(35))).toBe("locked");
  });

  it("caps open reports per account and never lets a flood bury a new report", async () => {
    await db().communityReport.updateMany({ where: { resolvedAt: null }, data: { resolvedAt: new Date() } });
    await veteran(40);
    const ids: number[] = [];
    for (let i = 0; i < 22; i++) {
      const at = new Date(Date.now() - (22 - i) * 60_000);
      const created = await db().forumThread.create({
        data: { category: "general", title: `Flood target ${i}`, body: "Flood body", authorId: account(40), authorName: "Player 40", createdAt: at, lastPostAt: at },
      });
      ids.push(created.id);
    }
    // One account files the most it may: the 21st waits until some are closed.
    for (const id of ids.slice(0, 20)) expect(await store.reportTarget({ kind: "thread", id, reason: "spam" }, author(41))).toBe("ok");
    expect(await store.reportTarget({ kind: "thread", id: ids[20]!, reason: "spam" }, author(41))).toBe("limit");

    // A newer report from someone else, and a target reported twice.
    expect(await store.reportTarget({ kind: "thread", id: ids[21]!, reason: "abuse" }, author(42))).toBe("ok");
    expect(await store.reportTarget({ kind: "thread", id: ids[5]!, reason: "abuse" }, author(42))).toBe("ok");
    const queue = await store.moderationQueue(3);
    expect(queue.map((e) => e.id)).toEqual([ids[5], ids[21], ids[19]]);
    expect(queue[0]!.count).toBe(2);
  });
});

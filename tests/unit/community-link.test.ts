import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Linking a Discord member to a game account, and moderation on linked
 * members, against an in-memory stand-in for the Prisma client: just the
 * calls `linkAccounts`, `unlinkAccounts` and `moderate` make, with plain
 * `where` matching.
 */

type Row = Record<string, unknown>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("not" in c) return value !== c.not;
      if ("gte" in c) return (value as Date) >= (c.gte as Date);
      if ("lte" in c) return (value as Date) <= (c.lte as Date);
      if ("gt" in c) return (value as Date) > (c.gt as Date);
      return false;
    }
    return value === cond;
  });
}

function apply(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      const v = value as { increment?: number; decrement?: number };
      row[key] = (row[key] as number) + (v.increment ?? 0) - (v.decrement ?? 0);
    } else row[key] = value;
  }
}

function table(defaults: (data: Row) => Row = (d) => d) {
  const rows: Row[] = [];
  let nextId = 1;
  return {
    rows,
    insert(data: Row) {
      const row = defaults({ id: nextId++, ...data });
      rows.push(row);
      return row;
    },
    async findUnique({ where }: { where: Row }) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async findFirst({ where }: { where?: Row }) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async findMany({ where }: { where?: Row } = {}) {
      return rows.filter((r) => matches(r, where));
    },
    async create({ data }: { data: Row }) {
      return this.insert(data);
    },
    async update({ where, data }: { where: Row; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error("not found");
      apply(row, data);
      return row;
    },
    async updateMany({ where, data }: { where?: Row; data: Row }) {
      const hit = rows.filter((r) => matches(r, where));
      for (const row of hit) apply(row, data);
      return { count: hit.length };
    },
    async deleteMany({ where }: { where?: Row }) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
    async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (row) {
        apply(row, update);
        return row;
      }
      return this.insert(create);
    },
  };
}

const memberDefaults = (d: Row): Row => ({
  firstSeenAt: new Date(0),
  bannedAt: null,
  banUntil: null,
  banReason: null,
  bannedBy: null,
  cardHiddenAt: null,
  provider: "game",
  linkedTo: null,
  linkedAt: null,
  ...d,
});

function fakeClient() {
  const client = {
    communityMember: table(memberDefaults),
    forumThread: table((d) => ({ score: 0, hiddenAt: null, deletedAt: null, ...d })),
    forumPost: table((d) => ({ score: 0, hiddenAt: null, deletedAt: null, ...d })),
    forumVote: table(),
    communityReport: table((d) => ({ resolvedAt: null, ...d })),
    teammateCard: table(),
    moderationLog: table(),
    skinCollection: table(),
    $transaction: async <T,>(work: (tx: unknown) => Promise<T>) => work(client),
  };
  return client;
}

let fake = fakeClient();
vi.mock("@/lib/db", () => ({ databaseConfigured: () => true, db: () => fake }));

const { linkAccounts, moderate, unlinkAccounts } = await import("@/lib/community/store");
const { isBanned } = await import("@/lib/community/constants");

const NOW = Date.UTC(2026, 10, 15, 12);
const DAY = 24 * 3600_000;
const GAME = { id: "g".repeat(24), name: "Ling Main", provider: "game" as const };
const DISCORD = { id: "d".repeat(24), name: "Leo", provider: "discord" as const };
const MOD = { id: "123456789012345678", name: "Mod" };

const member = (accountId: string) => fake.communityMember.rows.find((r) => r.accountId === accountId)!;

beforeEach(() => {
  fake = fakeClient();
});

describe("linkAccounts", () => {
  it("moves the moderation history and every row keyed on the Discord member", async () => {
    fake.communityMember.insert({ accountId: GAME.id, name: GAME.name, firstSeenAt: new Date(NOW - 30 * DAY) });
    fake.communityMember.insert({ accountId: DISCORD.id, name: DISCORD.name, provider: "discord", firstSeenAt: new Date(NOW - 60 * DAY) });
    fake.forumThread.insert({ authorId: DISCORD.id, title: "t", body: "b" });
    fake.forumPost.insert({ authorId: DISCORD.id, threadId: 1, body: "b" });
    fake.moderationLog.insert({ action: "hide", kind: "post", targetId: 1, accountId: DISCORD.id });
    fake.moderationLog.insert({ action: "dismiss", kind: "thread", targetId: 7, accountId: "o".repeat(24) });
    fake.teammateCard.insert({ accountId: DISCORD.id });
    fake.skinCollection.insert({ accountId: DISCORD.id });
    fake.communityReport.insert({ kind: "post", targetId: 4, reporterId: "o".repeat(24), authorId: DISCORD.id });

    expect(await linkAccounts(GAME, DISCORD, NOW)).toBe("ok");

    expect(fake.moderationLog.rows.map((r) => r.accountId)).toEqual([GAME.id, "o".repeat(24)]);
    expect(fake.forumThread.rows[0].authorId).toBe(GAME.id);
    expect(fake.forumPost.rows[0].authorId).toBe(GAME.id);
    expect(fake.teammateCard.rows[0].accountId).toBe(GAME.id);
    expect(fake.skinCollection.rows[0].accountId).toBe(GAME.id);
    expect(fake.communityReport.rows[0].authorId).toBe(GAME.id);
    for (const t of [fake.forumThread, fake.forumPost, fake.forumVote, fake.communityReport, fake.teammateCard, fake.moderationLog, fake.skinCollection]) {
      expect(JSON.stringify(t.rows)).not.toContain(DISCORD.id);
    }
    expect(member(DISCORD.id).linkedTo).toBe(GAME.id);
    // The earlier first-seen date is kept.
    expect(member(GAME.id).firstSeenAt).toEqual(new Date(NOW - 60 * DAY));
  });

  it("merges votes and reports in bulk, dropping the ones on one's own posts", async () => {
    fake.communityMember.insert({ accountId: GAME.id, name: GAME.name });
    fake.communityMember.insert({ accountId: DISCORD.id, name: DISCORD.name, provider: "discord" });
    const own = fake.forumThread.insert({ authorId: GAME.id, title: "mine", body: "b", score: 1 });
    const other = fake.forumThread.insert({ authorId: "o".repeat(24), title: "theirs", body: "b", score: 2 });
    fake.forumVote.insert({ kind: "thread", targetId: own.id, voterId: DISCORD.id });
    fake.forumVote.insert({ kind: "thread", targetId: other.id, voterId: DISCORD.id });
    fake.forumVote.insert({ kind: "thread", targetId: other.id, voterId: GAME.id });
    fake.communityReport.insert({ kind: "thread", targetId: own.id, reporterId: DISCORD.id, authorId: GAME.id });

    expect(await linkAccounts(GAME, DISCORD, NOW)).toBe("ok");
    expect(fake.forumVote.rows).toEqual([expect.objectContaining({ targetId: other.id, voterId: GAME.id })]);
    expect(own.score).toBe(0);
    expect(other.score).toBe(1);
    expect(fake.communityReport.rows).toEqual([]);
  });

  it("refuses a banned Discord row, so a ban cannot be washed by linking", async () => {
    fake.communityMember.insert({ accountId: GAME.id, name: GAME.name });
    fake.communityMember.insert({ accountId: DISCORD.id, name: DISCORD.name, provider: "discord", bannedAt: new Date(NOW - DAY) });
    fake.forumThread.insert({ authorId: DISCORD.id, title: "t", body: "b" });

    expect(await linkAccounts(GAME, DISCORD, NOW)).toBe("banned");
    expect(member(DISCORD.id).linkedTo).toBeNull();
    expect(fake.forumThread.rows[0].authorId).toBe(DISCORD.id);
  });
});

describe("moderation on linked members", () => {
  it("a ban aimed at a linked Discord id bans the game account it acts as", async () => {
    fake.communityMember.insert({ accountId: GAME.id, name: GAME.name });
    fake.communityMember.insert({ accountId: DISCORD.id, name: DISCORD.name, provider: "discord", linkedTo: GAME.id });
    // A report written before the link still names the Discord member; its target is gone.
    fake.communityReport.insert({ kind: "post", targetId: 99, reporterId: "o".repeat(24), authorId: DISCORD.id });

    expect(await moderate({ action: "ban", kind: "post", id: 99, note: "spam", days: 7 }, MOD, NOW)).toBe("ok");
    expect(isBanned(member(GAME.id) as never, NOW)).toBe(true);
    // The log names the account the decision landed on.
    expect(fake.moderationLog.rows.at(-1)).toMatchObject({ action: "ban", accountId: GAME.id });

    // And lifting it, from the Discord id, lifts it on the game account.
    expect(await moderate({ action: "unban", accountId: DISCORD.id }, MOD, NOW)).toBe("ok");
    expect(isBanned(member(GAME.id) as never, NOW)).toBe(false);
  });

  it("a card hide aimed at a linked Discord id lands on the game account", async () => {
    fake.communityMember.insert({ accountId: GAME.id, name: GAME.name });
    fake.communityMember.insert({ accountId: DISCORD.id, name: DISCORD.name, provider: "discord", linkedTo: GAME.id });
    fake.communityReport.insert({ kind: "card", targetId: 5, reporterId: "o".repeat(24), authorId: DISCORD.id });

    expect(await moderate({ action: "hide", kind: "card", id: 5 }, MOD, NOW)).toBe("ok");
    expect(member(GAME.id).cardHiddenAt).toEqual(new Date(NOW));
  });
});

describe("unlinkAccounts", () => {
  /** A Discord member linked to GAME after merging some activity of its own, as `linkAccounts` leaves them. */
  async function linked() {
    fake.communityMember.insert({ accountId: GAME.id, name: GAME.name, firstSeenAt: new Date(NOW - 90 * DAY) });
    fake.communityMember.insert({ accountId: DISCORD.id, name: DISCORD.name, provider: "discord", firstSeenAt: new Date(NOW - 60 * DAY) });
    fake.forumThread.insert({ authorId: DISCORD.id, title: "t", body: "b" });
    fake.forumVote.insert({ kind: "thread", targetId: 42, voterId: DISCORD.id });
    fake.teammateCard.insert({ accountId: DISCORD.id });
    expect(await linkAccounts(GAME, DISCORD, NOW - 10 * DAY)).toBe("ok");
  }

  it("makes the Discord login a new member with no history; what was merged stays with the game account", async () => {
    await linked();
    expect(await unlinkAccounts(GAME, DISCORD, NOW)).toBe("ok");

    expect(member(DISCORD.id)).toMatchObject({ linkedTo: null, linkedAt: null, provider: "discord" });
    // A new member again: the new-account period starts over.
    expect(member(DISCORD.id).firstSeenAt).toEqual(new Date(NOW));
    // Nothing moves back.
    expect(fake.forumThread.rows[0].authorId).toBe(GAME.id);
    expect(fake.forumVote.rows[0].voterId).toBe(GAME.id);
    expect(fake.teammateCard.rows[0].accountId).toBe(GAME.id);
    expect(member(GAME.id).firstSeenAt).toEqual(new Date(NOW - 90 * DAY));

    // Unlinking again finds nothing to undo.
    expect(await unlinkAccounts(GAME, DISCORD, NOW)).toBe("notLinked");
  });

  it("is refused while the game account is banned, so the ban cannot be left behind", async () => {
    await linked();
    member(GAME.id).bannedAt = new Date(NOW - DAY);
    expect(await unlinkAccounts(GAME, DISCORD, NOW)).toBe("banned");
    expect(member(DISCORD.id).linkedTo).toBe(GAME.id);

    // Once the ban has run out, it goes through.
    member(GAME.id).banUntil = new Date(NOW - 1);
    expect(await unlinkAccounts(GAME, DISCORD, NOW)).toBe("ok");
  });

  it("only undoes a link between these two accounts", async () => {
    await linked();
    const other = { id: "o".repeat(24), name: "Other", provider: "game" as const };
    fake.communityMember.insert({ accountId: other.id, name: other.name });
    expect(await unlinkAccounts(other, DISCORD, NOW)).toBe("notLinked");
    expect(member(DISCORD.id).linkedTo).toBe(GAME.id);
    expect(await unlinkAccounts(GAME, { ...DISCORD, id: "e".repeat(24) }, NOW)).toBe("notLinked");
  });

  it("keeps a moderator's card hide on the Discord member it leaves", async () => {
    await linked();
    member(GAME.id).cardHiddenAt = new Date(NOW - DAY);
    expect(await unlinkAccounts(GAME, DISCORD, NOW)).toBe("ok");
    expect(member(DISCORD.id).cardHiddenAt).toEqual(new Date(NOW - DAY));
  });

  it("moderation aimed at the Discord member no longer lands on the game account", async () => {
    await linked();
    expect(await unlinkAccounts(GAME, DISCORD, NOW)).toBe("ok");
    // Posted with the Discord login alone after unlinking: its own member's post.
    const post = fake.forumPost.insert({ authorId: DISCORD.id, threadId: 1, body: "b" });

    expect(await moderate({ action: "ban", kind: "post", id: post.id as number, note: "spam", days: 7 }, MOD, NOW)).toBe("ok");
    expect(isBanned(member(DISCORD.id) as never, NOW)).toBe(true);
    expect(isBanned(member(GAME.id) as never, NOW)).toBe(false);
    expect(fake.moderationLog.rows.at(-1)).toMatchObject({ action: "ban", accountId: DISCORD.id });

    // An unban aimed at the Discord member lifts its own ban only.
    member(GAME.id).bannedAt = new Date(NOW - DAY);
    expect(await moderate({ action: "unban", accountId: DISCORD.id }, MOD, NOW)).toBe("ok");
    expect(isBanned(member(DISCORD.id) as never, NOW)).toBe(false);
    expect(isBanned(member(GAME.id) as never, NOW)).toBe(true);
  });
});

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  AUTO_HIDE_REPORTS,
  CARD_TTL_MS,
  CARDS_PER_PAGE,
  DAILY_LIMITS,
  REPLIES_PER_PAGE,
  THREADS_PER_PAGE,
  canDelete,
  canEdit,
  isBanned,
  isNewAccount,
  threadPath,
  type Category,
  type ReportReason,
  type Sort,
  type TargetKind,
} from "./constants";
import { screenText, type FilterVerdict } from "./filter";
import type { CardInput, ThreadEdit, ThreadInput } from "./rules";

/**
 * Community storage, in Postgres through Prisma (see docs/community.md).
 *
 * Every write that a rule guards (daily caps, locks, edit windows, one vote
 * per account) reads and writes in one transaction or one conditional
 * statement, so two requests at once cannot both slip past a check.
 */

export interface Author {
  /** Account hash (`accountId`), never the in-game id. */
  id: string;
  name: string;
}

const DAY_MS = 24 * 3600 * 1000;
const DUPLICATE_MS = 10 * 60_000;

// -- Members ---------------------------------------------------------------

export type PostingRefusal = "banned" | "day" | "duplicate" | Exclude<FilterVerdict, "ok">;

/** The member row of an account, created on its first action; its name follows the game's. */
export async function touchMember(author: Author) {
  return db().communityMember.upsert({
    where: { accountId: author.id },
    create: { accountId: author.id, name: author.name },
    update: { name: author.name },
  });
}

/** Can this account vote, report or list a card? Only a ban stops it. */
export async function memberAllowed(author: Author, now = Date.now()): Promise<boolean> {
  return !isBanned(await touchMember(author), now);
}

/**
 * Everything that may stop a post before it is written: a ban, the daily
 * cap (lower for new accounts), the same text posted again within ten
 * minutes, and the word and link filter (no link at all for new accounts).
 */
async function checkPosting(
  tx: Prisma.TransactionClient,
  author: Author,
  kind: "threads" | "replies",
  text: string,
  now: number,
): Promise<PostingRefusal | null> {
  const member = await tx.communityMember.upsert({
    where: { accountId: author.id },
    create: { accountId: author.id, name: author.name, firstSeenAt: new Date(now) },
    update: { name: author.name },
  });
  if (isBanned(member, now)) return "banned";
  const fresh = isNewAccount(member.firstSeenAt, now);
  const verdict = screenText(text, { newAccount: fresh });
  if (verdict !== "ok") return verdict;

  const since = new Date(now - DAY_MS);
  const where = { authorId: author.id, createdAt: { gte: since } };
  const recent =
    kind === "threads"
      ? await tx.forumThread.findMany({ where, select: { body: true, createdAt: true }, orderBy: { createdAt: "desc" } })
      : await tx.forumPost.findMany({ where, select: { body: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  const cap = fresh ? DAILY_LIMITS[kind].newAccount : DAILY_LIMITS[kind].regular;
  if (recent.length >= cap) return "day";
  if (recent.some((r) => r.body === text && now - r.createdAt.getTime() < DUPLICATE_MS)) return "duplicate";
  return null;
}

/** Serializable transaction, retried once on a write conflict. */
async function serial<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db().$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!conflict || attempt >= 2) throw error;
    }
  }
}

// -- Threads ---------------------------------------------------------------

const SUMMARY = {
  id: true,
  category: true,
  title: true,
  heroes: true,
  authorName: true,
  score: true,
  replyCount: true,
  pinned: true,
  locked: true,
  createdAt: true,
  lastPostAt: true,
} satisfies Prisma.ForumThreadSelect;

export type ThreadSummary = Prisma.ForumThreadGetPayload<{ select: typeof SUMMARY }>;

const visible = { hiddenAt: null, deletedAt: null } as const;

export async function listThreads(o: { category?: Category; sort: Sort; page: number }): Promise<{ threads: ThreadSummary[]; total: number }> {
  const where: Prisma.ForumThreadWhereInput = { ...visible, ...(o.category ? { category: o.category } : {}) };
  const order: Prisma.ForumThreadOrderByWithRelationInput[] = [
    ...(o.category ? [{ pinned: "desc" as const }] : []),
    o.sort === "top" ? { score: "desc" } : { lastPostAt: "desc" },
    { id: "desc" },
  ];
  const [threads, total] = await Promise.all([
    db().forumThread.findMany({ where, select: SUMMARY, orderBy: order, skip: (o.page - 1) * THREADS_PER_PAGE, take: THREADS_PER_PAGE }),
    db().forumThread.count({ where }),
  ]);
  return { threads, total };
}

/** Per category: visible threads and the last activity. */
export async function categoryStats(): Promise<Map<string, { threads: number; lastPostAt: Date | null }>> {
  const rows = await db().forumThread.groupBy({ by: ["category"], where: visible, _count: { _all: true }, _max: { lastPostAt: true } });
  return new Map(rows.map((r) => [r.category, { threads: r._count._all, lastPostAt: r._max.lastPostAt }]));
}

export const getThread = (id: number) => db().forumThread.findUnique({ where: { id } });
export type Thread = NonNullable<Awaited<ReturnType<typeof getThread>>>;

export async function listReplies(threadId: number, page: number) {
  const where = { threadId };
  const [posts, total] = await Promise.all([
    db().forumPost.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * REPLIES_PER_PAGE,
      take: REPLIES_PER_PAGE,
    }),
    db().forumPost.count({ where }),
  ]);
  return { posts, total };
}
export type Reply = Awaited<ReturnType<typeof listReplies>>["posts"][number];

export type CreateResult<T> = { ok: true; value: T } | { ok: false; reason: PostingRefusal | "unknown" | "locked" };

export function createThread(input: ThreadInput, author: Author, now = Date.now()): Promise<CreateResult<{ id: number; title: string; category: string }>> {
  return serial(async (tx) => {
    const refusal = await checkPosting(tx, author, "threads", input.body, now);
    if (refusal) return { ok: false, reason: refusal };
    const screenedTitle = screenText(input.title, { newAccount: false });
    if (screenedTitle === "blocked" || screenedTitle === "spam") return { ok: false, reason: screenedTitle };
    const at = new Date(now);
    const thread = await tx.forumThread.create({
      data: { ...input, authorId: author.id, authorName: author.name, createdAt: at, lastPostAt: at },
      select: { id: true, title: true, category: true },
    });
    return { ok: true, value: thread };
  });
}

export type ChangeResult = "ok" | "unknown" | "forbidden" | "window" | "locked" | "hidden" | PostingRefusal;

export function editThread(id: number, input: ThreadEdit, author: Author, now = Date.now()): Promise<ChangeResult> {
  return serial(async (tx) => {
    const thread = await tx.forumThread.findUnique({ where: { id } });
    if (!thread || thread.deletedAt) return "unknown";
    if (thread.authorId !== author.id) return "forbidden";
    // Hidden: what was reported stays as it is until a moderator decides.
    if (thread.hiddenAt) return "hidden";
    if (thread.locked) return "locked";
    if (!canEdit(thread.createdAt, now)) return "window";
    const member = await tx.communityMember.findUnique({ where: { accountId: author.id } });
    if (isBanned(member, now)) return "banned";
    const fresh = member ? isNewAccount(member.firstSeenAt, now) : true;
    for (const text of [input.title, input.body]) {
      const verdict = screenText(text, { newAccount: fresh });
      if (verdict !== "ok") return verdict;
    }
    await tx.forumThread.update({ where: { id }, data: { ...input, editedAt: new Date(now) } });
    return "ok";
  });
}

export async function deleteThread(id: number, author: Author, now = Date.now()): Promise<ChangeResult> {
  const thread = await db().forumThread.findUnique({ where: { id }, select: { authorId: true, createdAt: true, deletedAt: true, hiddenAt: true } });
  if (!thread || thread.deletedAt) return "unknown";
  if (thread.authorId !== author.id) return "forbidden";
  if (thread.hiddenAt) return "hidden";
  if (!canDelete(thread.createdAt, now)) return "window";
  await db().forumThread.update({ where: { id }, data: { deletedAt: new Date(now), body: "" } });
  return "ok";
}

// -- Replies ---------------------------------------------------------------

export function createReply(threadId: number, body: string, author: Author, now = Date.now()): Promise<CreateResult<{ id: number; index: number }>> {
  return serial(async (tx) => {
    const thread = await tx.forumThread.findUnique({ where: { id: threadId }, select: { locked: true, hiddenAt: true, deletedAt: true } });
    if (!thread || thread.hiddenAt || thread.deletedAt) return { ok: false, reason: "unknown" };
    if (thread.locked) return { ok: false, reason: "locked" };
    const refusal = await checkPosting(tx, author, "replies", body, now);
    if (refusal) return { ok: false, reason: refusal };
    const at = new Date(now);
    const post = await tx.forumPost.create({
      data: { threadId, body, authorId: author.id, authorName: author.name, createdAt: at },
      select: { id: true },
    });
    await tx.forumThread.update({ where: { id: threadId }, data: { replyCount: { increment: 1 }, lastPostAt: at } });
    // Position in the thread, for the page the new reply lands on.
    const index = await tx.forumPost.count({ where: { threadId, OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lte: post.id } }] } });
    return { ok: true, value: { id: post.id, index } };
  });
}

export function editReply(id: number, body: string, author: Author, now = Date.now()): Promise<ChangeResult> {
  return serial(async (tx) => {
    const post = await tx.forumPost.findUnique({ where: { id }, include: { thread: { select: { locked: true, hiddenAt: true } } } });
    if (!post || post.deletedAt) return "unknown";
    if (post.authorId !== author.id) return "forbidden";
    if (post.hiddenAt || post.thread.hiddenAt) return "hidden";
    if (post.thread.locked) return "locked";
    if (!canEdit(post.createdAt, now)) return "window";
    const member = await tx.communityMember.findUnique({ where: { accountId: author.id } });
    if (isBanned(member, now)) return "banned";
    const verdict = screenText(body, { newAccount: member ? isNewAccount(member.firstSeenAt, now) : true });
    if (verdict !== "ok") return verdict;
    await tx.forumPost.update({ where: { id }, data: { body, editedAt: new Date(now) } });
    return "ok";
  });
}

export function deleteReply(id: number, author: Author, now = Date.now()): Promise<ChangeResult> {
  return serial(async (tx) => {
    const post = await tx.forumPost.findUnique({ where: { id }, include: { thread: { select: { hiddenAt: true } } } });
    if (!post || post.deletedAt) return "unknown";
    if (post.authorId !== author.id) return "forbidden";
    if (post.hiddenAt || post.thread.hiddenAt) return "hidden";
    if (!canDelete(post.createdAt, now)) return "window";
    await removeReply(tx, post.id, post.threadId, now);
    return "ok";
  });
}

async function removeReply(tx: Prisma.TransactionClient, id: number, threadId: number, now: number) {
  await tx.forumPost.update({ where: { id }, data: { deletedAt: new Date(now), body: "" } });
  await tx.forumThread.updateMany({ where: { id: threadId, replyCount: { gt: 0 } }, data: { replyCount: { decrement: 1 } } });
}

// -- Votes -----------------------------------------------------------------

export type VoteResult = { ok: true; score: number; voted: boolean } | { ok: false; reason: "unknown" | "own" | "banned" };

/** One upvote per account and target: a second call takes it back. */
export function toggleVote(kind: "thread" | "post", targetId: number, voter: Author, now = Date.now()): Promise<VoteResult> {
  return serial(async (tx) => {
    const target =
      kind === "thread"
        ? await tx.forumThread.findUnique({ where: { id: targetId }, select: { authorId: true, hiddenAt: true, deletedAt: true } })
        : await tx.forumPost.findUnique({ where: { id: targetId }, select: { authorId: true, hiddenAt: true, deletedAt: true } });
    if (!target || target.hiddenAt || target.deletedAt) return { ok: false, reason: "unknown" };
    if (target.authorId === voter.id) return { ok: false, reason: "own" };
    const member = await tx.communityMember.upsert({
      where: { accountId: voter.id },
      create: { accountId: voter.id, name: voter.name, firstSeenAt: new Date(now) },
      update: {},
    });
    if (isBanned(member, now)) return { ok: false, reason: "banned" };

    const key = { kind_targetId_voterId: { kind, targetId, voterId: voter.id } };
    const had = await tx.forumVote.findUnique({ where: key });
    if (had) await tx.forumVote.delete({ where: key });
    else await tx.forumVote.create({ data: { kind, targetId, voterId: voter.id, createdAt: new Date(now) } });
    const change = { score: { increment: had ? -1 : 1 } };
    const { score } =
      kind === "thread"
        ? await tx.forumThread.update({ where: { id: targetId }, data: change, select: { score: true } })
        : await tx.forumPost.update({ where: { id: targetId }, data: change, select: { score: true } });
    return { ok: true, score, voted: !had };
  });
}

/** Which of these targets the viewer upvoted. */
export async function votedBy(voterId: string | null, kind: "thread" | "post", ids: number[]): Promise<Set<number>> {
  if (!voterId || ids.length === 0) return new Set();
  const rows = await db().forumVote.findMany({ where: { kind, voterId, targetId: { in: ids } }, select: { targetId: true } });
  return new Set(rows.map((r) => r.targetId));
}

// -- Search ----------------------------------------------------------------

/**
 * Threads whose title or text, or one of whose replies, match the words
 * (Postgres full text, `websearch_to_tsquery`: "quoted phrases", -excluded).
 * The expressions are those of the migration's GIN indexes.
 */
export async function searchThreads(query: string, category: Category | null, page: number): Promise<{ threads: ThreadSummary[]; total: number }> {
  const rows = await db().$queryRaw<{ id: number; total: bigint }[]>`
    WITH q AS (SELECT websearch_to_tsquery('simple', ${query}) AS query)
    SELECT t."id", count(*) OVER () AS total
    FROM "ForumThread" t, q
    WHERE t."hiddenAt" IS NULL AND t."deletedAt" IS NULL
      AND (${category}::text IS NULL OR t."category" = ${category}::text)
      AND (
        to_tsvector('simple', t."title" || ' ' || t."body") @@ q.query
        OR EXISTS (
          SELECT 1 FROM "ForumPost" p
          WHERE p."threadId" = t."id" AND p."hiddenAt" IS NULL AND p."deletedAt" IS NULL
            AND to_tsvector('simple', p."body") @@ q.query
        )
      )
    ORDER BY ts_rank(to_tsvector('simple', t."title" || ' ' || t."body"), q.query) DESC, t."lastPostAt" DESC
    LIMIT ${THREADS_PER_PAGE} OFFSET ${(page - 1) * THREADS_PER_PAGE}`;
  if (rows.length === 0) return { threads: [], total: 0 };
  const found = await db().forumThread.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: SUMMARY });
  const byId = new Map(found.map((t) => [t.id, t]));
  return { threads: rows.flatMap((r) => byId.get(r.id) ?? []), total: Number(rows[0]!.total) };
}

// -- Reports ---------------------------------------------------------------

export type ReportResult = "ok" | "duplicate" | "unknown" | "own" | "banned" | "limit";

/** Open reports one account may have waiting at once: a flood cannot bury the others'. */
export const OPEN_REPORTS_PER_ACCOUNT = 20;
const SNAPSHOT_MAX = 12_000;

/** The author of a target (account hash), or null when it does not exist. */
async function authorOf(tx: Prisma.TransactionClient, kind: TargetKind, id: number): Promise<string | null> {
  return (await targetOf(tx, kind, id))?.author ?? null;
}

const cardText = (c: { note: string | null; discord: string | null; gameId: string | null }) =>
  [c.note, c.discord && `Discord: ${c.discord}`, c.gameId && `ID: ${c.gameId}`].filter(Boolean).join("\n");

/** A target's author and what it says (title and text, or a card's free fields), or null. */
async function targetOf(tx: Prisma.TransactionClient, kind: TargetKind, id: number): Promise<{ author: string; text: string } | null> {
  if (kind === "thread") {
    const t = await tx.forumThread.findUnique({ where: { id }, select: { authorId: true, title: true, body: true } });
    return t && { author: t.authorId, text: `${t.title}\n\n${t.body}` };
  }
  if (kind === "post") {
    const p = await tx.forumPost.findUnique({ where: { id }, select: { authorId: true, body: true } });
    return p && { author: p.authorId, text: p.body };
  }
  const card = await tx.teammateCard.findUnique({ where: { id } });
  return card && { author: card.accountId, text: cardText(card) };
}

async function setHidden(tx: Prisma.TransactionClient, kind: TargetKind, id: number, hiddenAt: Date | null) {
  const data = { hiddenAt };
  if (kind === "thread") await tx.forumThread.updateMany({ where: { id }, data });
  else if (kind === "post") await tx.forumPost.updateMany({ where: { id }, data });
  else await tx.teammateCard.updateMany({ where: { id }, data });
}

/**
 * One report per account and target. From `AUTO_HIDE_REPORTS` open reports
 * by different accounts, the target is hidden until a moderator decides.
 */
export function reportTarget(
  input: { kind: TargetKind; id: number; reason: ReportReason; note?: string | null },
  reporter: Author,
  now = Date.now(),
): Promise<ReportResult> {
  return serial(async (tx) => {
    const target = await targetOf(tx, input.kind, input.id);
    if (!target) return "unknown";
    if (target.author === reporter.id) return "own";
    const member = await tx.communityMember.upsert({
      where: { accountId: reporter.id },
      create: { accountId: reporter.id, name: reporter.name, firstSeenAt: new Date(now) },
      update: {},
    });
    if (isBanned(member, now)) return "banned";
    const key = { kind_targetId_reporterId: { kind: input.kind, targetId: input.id, reporterId: reporter.id } };
    if (await tx.communityReport.findUnique({ where: key })) return "duplicate";
    if ((await tx.communityReport.count({ where: { reporterId: reporter.id, resolvedAt: null } })) >= OPEN_REPORTS_PER_ACCOUNT) return "limit";
    await tx.communityReport.create({
      data: {
        kind: input.kind,
        targetId: input.id,
        reporterId: reporter.id,
        authorId: target.author,
        reason: input.reason,
        note: input.note || null,
        // What was reported, whatever its author does with it afterwards.
        snapshot: [...target.text].slice(0, SNAPSHOT_MAX).join(""),
        createdAt: new Date(now),
      },
    });
    const open = await tx.communityReport.count({ where: { kind: input.kind, targetId: input.id, resolvedAt: null } });
    if (open >= AUTO_HIDE_REPORTS) {
      await setHidden(tx, input.kind, input.id, new Date(now));
      if (input.kind === "card") await tx.communityMember.updateMany({ where: { accountId: target.author }, data: { cardHiddenAt: new Date(now) } });
    }
    return "ok";
  });
}

// -- Teammate cards --------------------------------------------------------

export interface CardFilters {
  region?: string;
  rank?: string;
  lane?: string;
  language?: string;
}

let lastPurge = 0;

/** Expired cards are deleted, at most once an hour, on the way. */
async function purgeExpired(now: number) {
  if (now - lastPurge < 3600_000) return;
  lastPurge = now;
  await db().teammateCard.deleteMany({ where: { expiresAt: { lte: new Date(now) } } });
}

export async function listCards(filters: CardFilters, page: number, now = Date.now()) {
  await purgeExpired(now).catch(() => undefined);
  const where: Prisma.TeammateCardWhereInput = {
    hiddenAt: null,
    expiresAt: { gt: new Date(now) },
    ...(filters.region ? { region: filters.region } : {}),
    ...(filters.rank ? { rank: filters.rank } : {}),
    ...(filters.lane ? { lanes: { has: filters.lane } } : {}),
    ...(filters.language ? { languages: { has: filters.language } } : {}),
  };
  const [cards, total] = await Promise.all([
    db().teammateCard.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * CARDS_PER_PAGE, take: CARDS_PER_PAGE }),
    db().teammateCard.count({ where }),
  ]);
  return { cards, total };
}
export type Card = Awaited<ReturnType<typeof listCards>>["cards"][number];

/** The account's card while it is listed (hidden ones included: the owner still sees it). */
export function ownCard(accountId: string, now = Date.now()) {
  return db().teammateCard.findFirst({ where: { accountId, expiresAt: { gt: new Date(now) } } });
}

export type CardResult = { ok: true; id: number } | { ok: false; reason: "banned" | "hidden" | Exclude<FilterVerdict, "ok"> };

/**
 * Publishes the account's card, or replaces it: one card per account, and
 * every save lists it for 7 more days. Once the account's card was hidden
 * (by a moderator or by reports), it cannot list one again - deleting the
 * card first changes nothing, the decision is kept on the member - until a
 * moderator shows it again.
 */
export function saveCard(input: CardInput, author: Author, now = Date.now()): Promise<CardResult> {
  return serial(async (tx) => {
    const member = await tx.communityMember.upsert({
      where: { accountId: author.id },
      create: { accountId: author.id, name: author.name, firstSeenAt: new Date(now) },
      update: { name: author.name },
    });
    if (isBanned(member, now)) return { ok: false, reason: "banned" };
    if (member.cardHiddenAt) return { ok: false, reason: "hidden" };
    if (input.note) {
      const verdict = screenText(input.note, { newAccount: false });
      if (verdict !== "ok") return { ok: false, reason: verdict };
    }
    if (input.discord && screenText(input.discord, { newAccount: false }) === "blocked") return { ok: false, reason: "blocked" };
    const data = { ...input, authorName: author.name, createdAt: new Date(now), expiresAt: new Date(now + CARD_TTL_MS), hiddenAt: null };
    const card = await tx.teammateCard.upsert({
      where: { accountId: author.id },
      create: { accountId: author.id, ...data },
      update: data,
      select: { id: true },
    });
    return { ok: true, id: card.id };
  });
}

export async function deleteCard(accountId: string): Promise<boolean> {
  return (await db().teammateCard.deleteMany({ where: { accountId } })).count > 0;
}

// -- Moderation ------------------------------------------------------------

export const MODERATION_ACTIONS = ["hide", "unhide", "delete", "lock", "unlock", "pin", "unpin", "ban", "unban", "dismiss"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface Moderator {
  /** Discord id. */
  id: string;
  name: string;
}

export type ModerationResult = "ok" | "unknown" | "invalid";

/**
 * A moderator's decision on a target: applied, the target's open reports
 * closed, and a line written to the log, all in one transaction. `ban`
 * bans the target's author (`days` null: for good); `unban` takes an
 * account id directly, from the banned list.
 */
export function moderate(
  o: { action: ModerationAction; kind?: TargetKind; id?: number; accountId?: string; note?: string | null; days?: number | null },
  moderator: Moderator,
  now = Date.now(),
): Promise<ModerationResult> {
  return serial(async (tx) => {
    const at = new Date(now);
    const { kind, id } = o;
    const threadOnly = o.action === "lock" || o.action === "unlock" || o.action === "pin" || o.action === "unpin";
    if (threadOnly && kind !== "thread") return "invalid";
    if (o.action === "unban" ? !o.accountId : !kind || !id) return "invalid";
    let accountId: string | null = o.accountId ?? null;
    let gone = false;
    if (kind && id) {
      accountId = await authorOf(tx, kind, id);
      if (!accountId) {
        // Deleted by its author since (a card is deleted for good): the
        // reports still name the author, for a ban or a dismissal.
        const reported =
          (await tx.communityReport.findFirst({ where: { kind, targetId: id }, select: { authorId: true } }))?.authorId ??
          (await tx.moderationLog.findFirst({ where: { kind, targetId: id, accountId: { not: null } }, select: { accountId: true } }))?.accountId;
        if (!reported || !["dismiss", "ban", "hide", "unhide", "delete"].includes(o.action)) return "unknown";
        accountId = reported;
        gone = true;
      }
    }

    switch (o.action) {
      case "hide":
      case "unhide":
        if (!gone) await setHidden(tx, kind!, id!, o.action === "hide" ? at : null);
        // A card's hiding follows its account, not the row (see saveCard).
        if (kind === "card") {
          await tx.communityMember.updateMany({ where: { accountId: accountId! }, data: { cardHiddenAt: o.action === "hide" ? at : null } });
        }
        break;
      case "delete":
        if (gone) break;
        if (kind === "thread") await tx.forumThread.update({ where: { id }, data: { deletedAt: at, body: "" } });
        else if (kind === "post") {
          const post = await tx.forumPost.findUniqueOrThrow({ where: { id }, select: { threadId: true, deletedAt: true } });
          if (!post.deletedAt) await removeReply(tx, id!, post.threadId, now);
        } else await tx.teammateCard.delete({ where: { id } });
        break;
      case "lock":
      case "unlock":
        await tx.forumThread.update({ where: { id }, data: { locked: o.action === "lock" } });
        break;
      case "pin":
      case "unpin":
        await tx.forumThread.update({ where: { id }, data: { pinned: o.action === "pin" } });
        break;
      case "ban": {
        const until = o.days ? new Date(now + o.days * 24 * 3600 * 1000) : null;
        const ban = { bannedAt: at, banUntil: until, banReason: o.note || null, bannedBy: moderator.id };
        await tx.communityMember.upsert({ where: { accountId: accountId! }, create: { accountId: accountId!, name: "?", ...ban }, update: ban });
        // A banned account's card goes with it.
        await tx.teammateCard.deleteMany({ where: { accountId: accountId! } });
        break;
      }
      case "unban":
        if (!accountId) return "invalid";
        if ((await tx.communityMember.updateMany({ where: { accountId }, data: { bannedAt: null, banUntil: null, banReason: null, bannedBy: null } })).count === 0) {
          return "unknown";
        }
        break;
      case "dismiss":
        break;
    }
    if (kind && id) {
      await tx.communityReport.updateMany({ where: { kind, targetId: id, resolvedAt: null }, data: { resolvedAt: at, resolvedBy: moderator.id } });
    }
    await tx.moderationLog.create({
      data: {
        moderatorId: moderator.id,
        moderatorName: moderator.name.slice(0, 64),
        action: o.action,
        kind: kind ?? null,
        targetId: id ?? null,
        accountId,
        note: o.note || null,
        createdAt: at,
      },
    });
    return "ok";
  });
}

export interface QueueEntry {
  kind: TargetKind;
  id: number;
  /** Open reports on it (the most recent ones are listed in `reports`). */
  count: number;
  reports: { reason: string; note: string | null; createdAt: Date }[];
  /** What the target said when it was first reported. */
  snapshot: string | null;
  /** What the target says now, as stored (Markdown for posts); empty once deleted. */
  title: string | null;
  body: string;
  authorId: string;
  authorName: string;
  hidden: boolean;
  /** Deleted by its author since it was reported. */
  deleted: boolean;
  /** Where to see it: the thread's path, or the teammate page. */
  path: string;
  threadLocked: boolean;
  threadPinned: boolean;
  authorBanned: boolean;
}

const REPORTS_SHOWN = 10;

/**
 * Open reports, one entry per target: the most reported first, then the
 * most recently reported. Grouped and counted by the database, so a flood
 * on one target (each reporter is capped at `OPEN_REPORTS_PER_ACCOUNT` open
 * reports anyway) never pushes the others out of the queue.
 */
export async function moderationQueue(limit = 50, now = Date.now()): Promise<QueueEntry[]> {
  const groups = await db().communityReport.groupBy({
    by: ["kind", "targetId"],
    where: { resolvedAt: null },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: [{ _count: { id: "desc" } }, { _max: { createdAt: "desc" } }],
    take: limit,
  });
  if (groups.length === 0) return [];
  const targets = groups.map((g) => ({ kind: g.kind, targetId: g.targetId }));
  const reports = await db().communityReport.findMany({
    where: { resolvedAt: null, OR: targets },
    orderBy: { createdAt: "desc" },
    take: limit * 50,
  });
  const ids = (kind: TargetKind) => groups.filter((g) => g.kind === kind).map((g) => g.targetId);
  const [threads, posts, cards] = await Promise.all([
    db().forumThread.findMany({ where: { id: { in: ids("thread") } } }),
    db().forumPost.findMany({ where: { id: { in: ids("post") } }, include: { thread: { select: { id: true, title: true, category: true, locked: true, pinned: true } } } }),
    db().teammateCard.findMany({ where: { id: { in: ids("card") } } }),
  ]);
  const authors = [...new Set(reports.map((r) => r.authorId))];
  const members = await db().communityMember.findMany({ where: { accountId: { in: authors } } });
  const banned = new Set(members.filter((m) => isBanned(m, now)).map((m) => m.accountId));
  const names = new Map(members.map((m) => [m.accountId, m.name]));

  return groups.map((g): QueueEntry => {
    const kind = g.kind as TargetKind;
    const own = reports.filter((r) => r.kind === g.kind && r.targetId === g.targetId);
    const first = own.at(-1);
    const authorId = first?.authorId ?? "";
    const base = {
      kind,
      id: g.targetId,
      count: g._count._all,
      reports: own.slice(0, REPORTS_SHOWN).map((r) => ({ reason: r.reason, note: r.note, createdAt: r.createdAt })),
      snapshot: first?.snapshot ?? null,
      authorId,
      authorName: names.get(authorId) ?? "?",
      authorBanned: banned.has(authorId),
      title: null,
      body: "",
      hidden: false,
      deleted: true,
      path: kind === "card" ? "/community/teammates" : "/community",
      threadLocked: false,
      threadPinned: false,
    };
    if (kind === "thread") {
      const t = threads.find((x) => x.id === g.targetId);
      if (!t) return base;
      return { ...base, title: t.title, body: t.body, authorName: t.authorName, hidden: Boolean(t.hiddenAt), deleted: Boolean(t.deletedAt), path: threadPath(t), threadLocked: t.locked, threadPinned: t.pinned };
    }
    if (kind === "post") {
      const p = posts.find((x) => x.id === g.targetId);
      if (!p) return base;
      return { ...base, title: p.thread.title, body: p.body, authorName: p.authorName, hidden: Boolean(p.hiddenAt), deleted: Boolean(p.deletedAt), path: `${threadPath(p.thread)}#post-${p.id}`, threadLocked: p.thread.locked, threadPinned: p.thread.pinned };
    }
    const card = cards.find((x) => x.id === g.targetId);
    if (!card) return base;
    return { ...base, body: cardText(card), authorName: card.authorName, hidden: Boolean(card.hiddenAt), deleted: false };
  });
}

/** The moderation log, newest first. */
export async function recentLog(limit = 40) {
  return db().moderationLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function bannedMembers(now = Date.now()) {
  const rows = await db().communityMember.findMany({ where: { bannedAt: { not: null } }, orderBy: { bannedAt: "desc" }, take: 100 });
  return rows.filter((m) => isBanned(m, now));
}

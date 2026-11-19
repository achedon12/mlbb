import { db } from "@/lib/db";
import { keptSince } from "./access";
import { readSnapshot, type ProfileSnapshot } from "./snapshot";

/**
 * Storage of the profile cards (`ProfileCard`). One row per Discord account
 * and per game account: linking moves the card, it never duplicates it.
 */

export interface StoredCard {
  discordKey: string;
  accountId: string;
  public: boolean;
  showId: boolean;
  snapshot: ProfileSnapshot | null;
  snapshotAt: Date;
}

const select = { discordKey: true, accountId: true, public: true, showId: true, snapshot: true, snapshotAt: true } as const;

function toCard(row: { discordKey: string; accountId: string; public: boolean; showId: boolean; snapshot: unknown; snapshotAt: Date } | null): StoredCard | null {
  return row ? { ...row, snapshot: readSnapshot(row.snapshot) } : null;
}

export async function cardByDiscord(discordKey: string): Promise<StoredCard | null> {
  return toCard(await db().profileCard.findUnique({ where: { discordKey }, select }));
}

export async function cardByAccount(accountId: string): Promise<StoredCard | null> {
  return toCard(await db().profileCard.findUnique({ where: { accountId }, select }));
}

/**
 * Links this Discord account to this game account, with a fresh snapshot.
 * Both were proven on the same request: any earlier link of either one is
 * replaced (a player moving the card to another Discord account, or linking
 * another game account). The settings carry over when the pair stays the same.
 */
export async function linkCard(o: { discordKey: string; accountId: string; snapshot: ProfileSnapshot; now?: Date }): Promise<void> {
  const now = o.now ?? new Date();
  await db().$transaction(async (tx) => {
    const same = await tx.profileCard.findUnique({ where: { discordKey: o.discordKey }, select: { accountId: true } });
    if (same?.accountId === o.accountId) {
      await tx.profileCard.update({ where: { discordKey: o.discordKey }, data: { snapshot: o.snapshot, snapshotAt: now } });
      return;
    }
    await tx.profileCard.deleteMany({ where: { OR: [{ discordKey: o.discordKey }, { accountId: o.accountId }] } });
    await tx.profileCard.create({ data: { discordKey: o.discordKey, accountId: o.accountId, snapshot: o.snapshot, snapshotAt: now, linkedAt: now } });
  });
}

/** New figures for the game account's card; false when it has none. */
export async function refreshCard(accountId: string, snapshot: ProfileSnapshot, now = new Date()): Promise<boolean> {
  const { count } = await db().profileCard.updateMany({ where: { accountId }, data: { snapshot, snapshotAt: now } });
  return count > 0;
}

export async function setCardOptions(accountId: string, options: { public?: boolean; showId?: boolean }): Promise<boolean> {
  const { count } = await db().profileCard.updateMany({ where: { accountId }, data: options });
  return count > 0;
}

/** Unlinks and deletes the card: nothing of it is kept. */
export async function deleteCard(accountId: string): Promise<boolean> {
  const { count } = await db().profileCard.deleteMany({ where: { accountId } });
  return count > 0;
}

/** Retention: cards whose figures are older than 30 days. */
export async function purgeStaleCards(now = Date.now()): Promise<number> {
  const { count } = await db().profileCard.deleteMany({ where: { snapshotAt: { lt: keptSince(now) } } });
  return count;
}

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
export async function linkCard(o: { discordKey: string; accountId: string; snapshot: ProfileSnapshot; token?: string | null; now?: Date }): Promise<void> {
  const now = o.now ?? new Date();
  const token = o.token ?? null;
  await db().$transaction(async (tx) => {
    const same = await tx.profileCard.findUnique({ where: { discordKey: o.discordKey }, select: { accountId: true } });
    if (same?.accountId === o.accountId) {
      await tx.profileCard.update({ where: { discordKey: o.discordKey }, data: { snapshot: o.snapshot, snapshotAt: now, token } });
      return;
    }
    await tx.profileCard.deleteMany({ where: { OR: [{ discordKey: o.discordKey }, { accountId: o.accountId }] } });
    await tx.profileCard.create({ data: { discordKey: o.discordKey, accountId: o.accountId, snapshot: o.snapshot, snapshotAt: now, token, linkedAt: now } });
  });
}

/**
 * New figures for the game account's card; false when it has none. `token`
 * (sealed) replaces the kept one when given; left out, the kept one stays.
 */
export async function refreshCard(accountId: string, snapshot: ProfileSnapshot, now = new Date(), token?: string | null): Promise<boolean> {
  const data = token === undefined ? { snapshot, snapshotAt: now } : { snapshot, snapshotAt: now, token };
  const { count } = await db().profileCard.updateMany({ where: { accountId }, data });
  return count > 0;
}

/** The sealed game token kept with this Discord account's card, or null. */
export async function cardToken(discordKey: string): Promise<string | null> {
  const row = await db().profileCard.findUnique({ where: { discordKey }, select: { token: true } });
  return row?.token ?? null;
}

/** Keeps a new sealed token for the game account's card (a new sign-in), or forgets it (null). */
export async function setCardToken(accountId: string, token: string | null): Promise<void> {
  await db().profileCard.updateMany({ where: { accountId }, data: { token } });
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

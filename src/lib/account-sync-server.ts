import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { allHeroes } from "@/lib/data";
import {
  cleanData,
  DAY,
  HERO_SLUG,
  MAX_COUNT,
  MAX_DISTRIBUTION,
  MAX_FAVOURITES,
  MAX_REMINDER_MONTHS,
  MONTH,
  PUBLIC_FIELDS,
  SLUG,
  type SyncData,
} from "@/lib/account-sync";

/**
 * Server side of the progress kept on the account: the request schemas, the
 * storage, and the public profile. One `PlayerSync` row per account, the
 * whole copy at once: a write only lands on the version it was based on
 * (compare and set on `updatedAt`), so a stale tab cannot silently overwrite
 * a newer save. Every read and write is keyed on the account the request
 * proves (`guardOwner`), never on an id from the request: a player only ever
 * reaches their own row. The public page is read by its random slug and
 * shows only the fields its owner turned on.
 */

let heroSlugs: Set<string> | null = null;
/** Slugs a favourite may hold: the site's heroes. */
export function knownHeroes(): Set<string> {
  heroSlugs ??= new Set(allHeroes.map((h) => h.slug));
  return heroSlugs;
}

const counter = z.number().int().min(0).max(MAX_COUNT);
const stats = z
  .object({
    joues: counter,
    serie: counter,
    meilleure: counter,
    dernier: z.string().regex(DAY).nullable(),
    distribution: z.array(counter).max(MAX_DISTRIBUTION),
  })
  .strict();

export const syncDataShape = z
  .object({
    // A hero the site no longer lists is dropped, not refused: a favourite
    // kept from long ago must not block every later save.
    favourites: z
      .array(z.string().regex(HERO_SLUG))
      .max(MAX_FAVOURITES)
      .transform((ids) => ids.filter((id) => knownHeroes().has(id))),
    quiz: z.object({ daily: stats, practice: z.object({ meilleure: counter, jouees: counter, reussies: counter }).strict() }).strict(),
    mlbbdle: z
      .object({
        classic: stats,
        skill: stats,
        practice: z.object({ found: counter, guesses: counter, best: z.number().int().min(1).max(MAX_COUNT).nullable() }).strict(),
      })
      .strict(),
    reminders: z.array(z.string().regex(MONTH)).max(MAX_REMINDER_MONTHS),
  })
  .strict();

export const syncInput = z
  .object({
    data: syncDataShape,
    /** `updatedAt` of the copy this write replaces; null when the browser knows none. */
    base: z.iso.datetime().nullable(),
  })
  .strict()
  // Cleaned once more (duplicates, a streak with no day, past months): what is stored is always canonical.
  .transform((v) => ({ data: cleanData(v.data), base: v.base }));
export type SyncInput = z.infer<typeof syncInput>;

export const profileInput = z
  .object({
    public: z.boolean(),
    fields: z.array(z.enum(PUBLIC_FIELDS)).max(PUBLIC_FIELDS.length),
  })
  .strict()
  .transform((v) => ({ public: v.public, fields: [...new Set(v.fields)].sort() }));
export type ProfileInput = z.infer<typeof profileInput>;

export interface SavedSync {
  data: SyncData;
  updatedAt: string;
}

const shown = (row: { data: unknown; updatedAt: Date }): SavedSync => ({ data: cleanData(row.data), updatedAt: row.updatedAt.toISOString() });

/**
 * Opaque key of the account for the browser: tells it which account its copy
 * was synced with, without handing it the id the community stores.
 */
export const syncAccountKey = (accountId: string) => createHash("sha256").update(`mlbb-progress:${accountId}`).digest("base64url").slice(0, 16);

export async function readSync(accountId: string): Promise<SavedSync | null> {
  const row = await db().playerSync.findUnique({ where: { accountId } });
  return row ? shown(row) : null;
}

export type SaveResult = { ok: true; sync: SavedSync } | { ok: false; current: SavedSync | null };

/**
 * Writes the copy if the stored one is still the one it was based on.
 * Otherwise nothing is written and the current copy comes back, for the
 * browser to merge and try again.
 */
export async function saveSync(accountId: string, input: SyncInput, now = Date.now()): Promise<SaveResult> {
  const data = input.data as unknown as object;
  if (input.base === null) {
    const created = await db().playerSync.createManyAndReturn({
      data: [{ accountId, data, createdAt: new Date(now), updatedAt: new Date(now) }],
      skipDuplicates: true,
    });
    if (created[0]) return { ok: true, sync: shown(created[0]) };
    return { ok: false, current: await readSync(accountId) };
  }
  const base = new Date(input.base);
  // Always later than the version replaced, so two saves in one millisecond stay distinct versions.
  const updatedAt = new Date(Math.max(now, base.getTime() + 1));
  const { count } = await db().playerSync.updateMany({ where: { accountId, updatedAt: base }, data: { data, updatedAt } });
  if (count === 1) return { ok: true, sync: { data: input.data, updatedAt: updatedAt.toISOString() } };
  return { ok: false, current: await readSync(accountId) };
}

/** Everything the account keeps of the player's progress, and the public page with it. */
export async function deleteSync(accountId: string): Promise<void> {
  await db().$transaction([
    db().playerSync.deleteMany({ where: { accountId } }),
    db().playerProfile.deleteMany({ where: { accountId } }),
  ]);
}

// ── Public profile ─────────────────────────────────────────────────

export interface ProfileSettings {
  public: boolean;
  fields: string[];
  /** Null until the page is first turned on. */
  slug: string | null;
}

export async function readProfileSettings(accountId: string): Promise<ProfileSettings> {
  const row = await db().playerProfile.findUnique({ where: { accountId }, select: { public: true, fields: true, slug: true } });
  return row ?? { public: false, fields: [], slug: null };
}

/** 12 random characters (72 bits): a link nobody can guess or derive from an id. */
export const newSlug = () => randomBytes(9).toString("base64url");

/** Pictures a profile may show: the game's avatar CDN and Discord's, as the rest of the site does. */
const AVATAR = /^https:\/\/(akmpicture\.youngjoygame\.com|cdn\.discordapp\.com\/avatars)\/[A-Za-z0-9/._?=&-]{1,160}$/;
export const safeAvatar = (url: string | null | undefined) => (url && url.length <= 200 && AVATAR.test(url) ? url : null);

/**
 * Turns the page on or off and sets its fields. On: the slug is created the
 * first time, and the name and picture are copied. Off: they are cleared,
 * the slug stays for next time.
 */
export async function saveProfileSettings(
  accountId: string,
  input: ProfileInput,
  identity: { name: string; avatar: string | null },
  now = Date.now(),
): Promise<ProfileSettings> {
  const shownName = input.public ? identity.name.slice(0, 40) : null;
  const avatar = input.public && input.fields.includes("avatar") ? safeAvatar(identity.avatar) : null;
  const values = { public: input.public, fields: input.fields, displayName: shownName, avatar, updatedAt: new Date(now) };
  const row = await db().playerProfile.upsert({
    where: { accountId },
    create: { accountId, slug: newSlug(), ...values },
    update: values,
    select: { public: true, fields: true, slug: true },
  });
  return row;
}

export interface PublicRow {
  name: string;
  avatar: string | null;
  fields: string[];
  data: SyncData | null;
}

/** A public page by its slug: null when there is none, or when its owner turned it off. */
export async function readPublicProfile(slug: string): Promise<PublicRow | null> {
  if (!SLUG.test(slug)) return null;
  const profile = await db().playerProfile.findUnique({ where: { slug } });
  if (!profile || !profile.public || !profile.displayName) return null;
  const sync = await db().playerSync.findUnique({ where: { accountId: profile.accountId }, select: { data: true } });
  const known = knownHeroes();
  const data = sync ? cleanData(sync.data) : null;
  if (data) data.favourites = data.favourites.filter((s) => known.has(s));
  return {
    name: profile.displayName,
    avatar: safeAvatar(profile.avatar),
    fields: profile.fields.filter((f) => (PUBLIC_FIELDS as readonly string[]).includes(f)),
    data,
  };
}

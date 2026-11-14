import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { skinsCollectible } from "@/lib/collection";
import { HERO_ID, MAX_HEROES, MAX_SKINS, SKIN_ID } from "@/lib/collection-sync";
import { catalogSkins } from "@/lib/skin-catalog-server";

/**
 * Server side of the collection kept on the game account: the request
 * schema, checked against the catalogue, and the storage. One row per
 * account, the whole set at once: the browser sends everything it has, and
 * a write only lands on the version it was based on (compare and set on
 * `updatedAt`), so a stale tab cannot silently overwrite a newer save.
 */

let known: { heroes: Set<string>; skins: Set<string> } | null = null;

/** Ids a collection may hold: the catalogue's heroes, and the skins the tool lets a player tick. */
export function knownIds() {
  if (known) return known;
  const c = catalogSkins();
  known = { heroes: new Set(c.heroes.map((h) => h.slug)), skins: new Set(skinsCollectible(c).map((s) => s.id)) };
  return known;
}

const unique = (values: string[]) => [...new Set(values)].sort();

export const collectionInput = z
  .object({
    heroes: z
      .array(z.string().regex(HERO_ID))
      .max(MAX_HEROES)
      .refine((ids) => ids.every((id) => knownIds().heroes.has(id)), { message: "unknown hero" }),
    skins: z
      .array(z.string().regex(SKIN_ID))
      .max(MAX_SKINS)
      .refine((ids) => ids.every((id) => knownIds().skins.has(id)), { message: "unknown skin" }),
    /** `updatedAt` of the copy this write replaces; null when the browser knows none. */
    base: z.iso.datetime().nullable(),
  })
  .strict()
  .transform((v) => ({ heroes: unique(v.heroes), skins: unique(v.skins), base: v.base }));
export type CollectionInput = z.infer<typeof collectionInput>;

export interface SavedCollection {
  heroes: string[];
  skins: string[];
  updatedAt: string;
}

const shown = (row: { heroes: string[]; skins: string[]; updatedAt: Date }): SavedCollection => ({
  heroes: row.heroes,
  skins: row.skins,
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Opaque key of the account for the browser: tells it which account its
 * copy was synced with, without handing it the id the community stores.
 */
export const accountKey = (accountId: string) =>
  createHash("sha256").update(`mlbb-collection:${accountId}`).digest("base64url").slice(0, 16);

export async function readCollection(accountId: string): Promise<SavedCollection | null> {
  const row = await db().skinCollection.findUnique({ where: { accountId } });
  return row ? shown(row) : null;
}

export type SaveResult = { ok: true; collection: SavedCollection } | { ok: false; current: SavedCollection | null };

/**
 * Writes the set if the stored copy is still the one it was based on.
 * Otherwise nothing is written and the current copy comes back, for the
 * browser to merge and try again.
 */
export async function saveCollection(accountId: string, input: CollectionInput, now = Date.now()): Promise<SaveResult> {
  const data = { heroes: input.heroes, skins: input.skins };
  if (input.base === null) {
    const created = await db().skinCollection.createManyAndReturn({
      data: [{ accountId, ...data, createdAt: new Date(now), updatedAt: new Date(now) }],
      skipDuplicates: true,
    });
    if (created[0]) return { ok: true, collection: shown(created[0]) };
    return { ok: false, current: await readCollection(accountId) };
  }
  const base = new Date(input.base);
  // Always later than the version replaced, so two saves in one millisecond stay distinct versions.
  const updatedAt = new Date(Math.max(now, base.getTime() + 1));
  const { count } = await db().skinCollection.updateMany({ where: { accountId, updatedAt: base }, data: { ...data, updatedAt } });
  if (count === 1) return { ok: true, collection: { ...data, updatedAt: updatedAt.toISOString() } };
  return { ok: false, current: await readCollection(accountId) };
}

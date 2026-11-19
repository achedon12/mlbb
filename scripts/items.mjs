/**
 * Items: which ones are still in the game, and what the other sources call
 * them.
 *
 * The wiki module (`Module:Equipment/data`) keeps the items that left the
 * game and writes their status in the `availability` field ("Removed"), the
 * same field that otherwise says who may buy the item ("All heroes",
 * "Floryn"). It is also wrong both ways: Bud of Hope and Shimmering Lantern,
 * Floryn's items, are marked removed. So the status is decided apart:
 *
 * - Liquipedia's `status=Removed` on the item page settles it;
 * - otherwise the wiki's "Removed" counts only when the official item
 *   catalogue (the community API's `/academy/equipment`) no longer lists the
 *   item. Without that catalogue, the wiki's word is taken.
 *
 * The renaming rules mirror `src/lib/item-names.ts`, which the site uses; the
 * table itself is shared, in `src/data/item-names.json`.
 */
import { readFileSync } from "node:fs";

const NAMES = JSON.parse(readFileSync(new URL("../src/data/item-names.json", import.meta.url), "utf8"));
const RENAMED = new Map(Object.entries(NAMES.renamed).map(([from, to]) => [from.toLowerCase(), to]));
const BLESSING = /^(?:Ice|Flame|Behemoth) Hunter's\s+/i;
const ENCHANT = /\s*-\s*(Favor|Encourage|Conceal|Dire Hit)\s*$/i;

/** The catalogue item behind a name: "Ice Hunter's Magic Boots" → "Magic Shoes". */
export function baseItemName(name) {
  const trimmed = String(name ?? "").trim();
  const whole = RENAMED.get(trimmed.toLowerCase());
  if (whole) return whole;
  const rest = trimmed.replace(BLESSING, "");
  const enchant = ENCHANT.exec(rest);
  const base = (enchant ? rest.slice(0, enchant.index) : rest).trim();
  return RENAMED.get(base.toLowerCase()) ?? base;
}

/** Title of the item's Liquipedia page, which keeps some older names. */
export const liquipediaItemTitle = (name) => NAMES.liquipediaTitles[name] ?? name;

/**
 * True when the item is out of the game. `availability` is the wiki field,
 * `liquipedia` the parsed infobox (or null), `official` the set of the
 * official catalogue's names brought back to the site's (or null when the
 * catalogue did not answer).
 */
export function itemRemoved({ name, availability, liquipedia, official }) {
  if (liquipedia?.status === "removed") return true;
  if (liquipedia?.status === "available") return false;
  if (!/^removed$/i.test(String(availability ?? "").trim())) return false;
  return official ? !official.has(name) : true;
}

/** Official catalogue names, as the site names the items. */
export function officialItemNames(records) {
  return new Set(
    (records ?? [])
      .map((r) => String(r?.data?.equipname ?? ""))
      // "Twilight Armor (Discarded)": kept by the game for old records, not sold.
      .filter((n) => n && !/\(discarded\)/i.test(n))
      .map(baseItemName),
  );
}

/**
 * Items whose price differs between the wiki and Liquipedia. Neither source
 * is official: the site keeps the wiki's (its module was edited after
 * Liquipedia's item pages, in September 2026) and the sync lists the gaps,
 * to be checked in game.
 */
export function priceGaps(items, liquipediaByName) {
  return items.flatMap((o) => {
    const lp = liquipediaByName.get(o.name);
    return lp?.price != null && o.price != null && lp.price !== o.price ? [{ name: o.name, wiki: o.price, liquipedia: lp.price }] : [];
  });
}

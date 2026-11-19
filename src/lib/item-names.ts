import names from "@/data/item-names.json";

/**
 * Item names as the other sources spell them, brought back to the catalogue.
 *
 * The site's item catalogue is the wiki's. The stats API, whose builds and
 * guides the site shows, names some items differently: an old name kept
 * after a renaming ("Athena's Shield", now "Valkyrie's Shield"), boots under
 * another word ("Magic Boots" for "Magic Shoes"), boots carrying a jungle
 * blessing ("Ice Hunter's Tough Boots") or a roaming enchantment ("Demon
 * Boots - Favor", sometimes "Rapid Boots- Conceal"). Every place that turns a
 * name into an item goes through here, so a renaming is written once, in
 * `src/data/item-names.json`. `scripts/items.mjs` mirrors these rules for
 * the sync, which cannot import TypeScript.
 */

const RENAMED = new Map(Object.entries(names.renamed).map(([from, to]) => [from.toLowerCase(), to]));
/** Jungle blessing on boots: the boots stay the item. */
const BLESSING = /^(?:Ice|Flame|Behemoth) Hunter's\s+/i;
/** Roaming enchantment on boots, written with or without a space before the dash. */
const ENCHANT = /\s*-\s*(Favor|Encourage|Conceal|Dire Hit)\s*$/i;

function parts(name: string) {
  const trimmed = name.trim();
  const prefix = BLESSING.exec(trimmed)?.[0] ?? "";
  const rest = trimmed.slice(prefix.length);
  const enchant = ENCHANT.exec(rest);
  const base = (enchant ? rest.slice(0, enchant.index) : rest).trim();
  return { prefix, base: RENAMED.get(base.toLowerCase()) ?? base, enchant: enchant?.[1] ?? null };
}

/**
 * The name the catalogue uses today, blessing and enchantment kept:
 * "Athena's Shield" → "Valkyrie's Shield", "Demon Boots - Favor" →
 * "Demon Shoes - Favor", "Rapid Boots- Conceal" → "Rapid Boots - Conceal".
 */
export function currentItemName(name: string): string {
  const whole = RENAMED.get(name.trim().toLowerCase());
  if (whole) return whole;
  const { prefix, base, enchant } = parts(name);
  return `${prefix}${base}${enchant ? ` - ${enchant}` : ""}`;
}

/** The catalogue item behind a name: "Ice Hunter's Magic Boots" → "Magic Shoes". */
export function baseItemName(name: string): string {
  return RENAMED.get(name.trim().toLowerCase()) ?? parts(name).base;
}

/**
 * Finds the catalogue item a name designates, whatever the source's
 * spelling; undefined for a name that is no item of the catalogue.
 */
export function itemFinder<T extends { name: string }>(items: readonly T[]): (name: string) => T | undefined {
  const byName = new Map(items.map((o) => [o.name.toLowerCase(), o]));
  return (name) => byName.get(currentItemName(name).toLowerCase()) ?? byName.get(baseItemName(name).toLowerCase());
}

/** Item slug, as the sync builds it (`slugify` in scripts/heroes.mjs). */
export function itemSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The page an old item address now leads to: "/items/athena-s-shield" was
 * the shield's page before its renaming, and links to it still circulate.
 * Null when the slug is no former name.
 */
export function renamedItemSlug(slug: string): string | null {
  for (const [from, to] of Object.entries(names.renamed)) {
    if (itemSlug(from) === slug && itemSlug(to) !== slug) return itemSlug(to);
  }
  return null;
}

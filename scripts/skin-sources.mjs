/**
 * Skin catalogue: one list per hero, from four sources weighed together.
 *
 * - `Module:Skin/data` on the Fandom wiki: ids, rarities, prices, dates. The
 *   richest source, but edited by hand, and it stopped following the game on
 *   5 October 2026: the StarLight skin of November, Kagura's "Feast of
 *   Eternity" and the Naruto collaboration are missing from it.
 * - The "Avatar icons" gallery of each Fandom hero page, still kept up to
 *   date: skin id and name, nothing else (`extractAvatarIcons`).
 * - The Liquipedia gallery of each hero (`Kagura/Gallery`), which lists the
 *   skins of the live game: it confirms a skin is out.
 * - The StarLight and Collector pages of the Fandom wiki, which date each
 *   skin of these series to its month (`scripts/events.mjs`).
 *
 * A skin is listed only once it is out (see `skinRelease` in
 * `release.mjs`): one the hero page shows but no source dates or confirms
 * stays out, like the module's skins marked "Upcoming" or dated "202X".
 * Kept apart from `sync.mjs` so the merge can be tested on fixtures.
 */
import { normalizeNameSkin } from "./gallery.mjs";
import { skinRelease } from "./release.mjs";

/**
 * Skins of a Liquipedia hero gallery page: one `{{Skin |name= |type=
 * |availability= }}` template each.
 */
export function parseLiquipediaSkins(wikitext) {
  const skins = [];
  for (const block of String(wikitext).matchAll(/\{\{\s*Skin\s*\n([\s\S]*?)\n\s*\}\}/gi)) {
    const field = (name) =>
      block[1].match(new RegExp(`^\\s*\\|\\s*${name}\\s*=[ \\t]*(.*)$`, "im"))?.[1]?.trim() || null;
    const name = field("name");
    if (name) skins.push({ name, type: field("type"), availability: field("availability") });
  }
  return skins;
}

/** Availability as the module words it, from Liquipedia's wording. */
function availabilityFrom(liquipedia) {
  if (!liquipedia) return null;
  if (/store|shop/i.test(liquipedia)) return "Available";
  return "Limited";
}

/**
 * The released skins of each hero, and what the merge did.
 *
 * - `moduleSkins`: `{ slug: Skin[] }`, the normalized module (see
 *   `normalizeSkins` in `sync.mjs`);
 * - `avatars`: `{ slug: { id, name }[] }`, the hero pages' icon galleries;
 * - `liquipedia`: `{ slug: { name, type, availability }[] }`, or null when
 *   Liquipedia did not answer: nothing is confirmed then, the dates decide;
 * - `events`: StarLight and Collector entries `{ hero, skin, id, month,
 *   series }`, `series` being the label to give a skin the module lacks;
 * - `heroes`: the released heroes, whose id is also their default skin's.
 *
 * Returns `skins` (`{ slug: Skin[] }`, each with `released: true`), `added`
 * (skins the module lacks, taken from the hero pages) and `hidden` (skins
 * left out as not released yet), the last two as `{ hero, id, name }`.
 */
export function mergeSkins({ moduleSkins, avatars = {}, liquipedia = null, events = [], heroes, now = Date.now() }) {
  // A series entry, found by skin id or by name.
  const byId = new Map();
  const byName = new Map();
  for (const e of events) {
    if (e.none || !e.month || !e.hero) continue;
    if (e.id) byId.set(`${e.hero}:${e.id}`, e);
    if (e.skin) byName.set(`${e.hero}:${normalizeNameSkin(e.skin)}`, e);
  }

  const takenIds = new Set(Object.values(moduleSkins).flat().map((s) => s.id));
  const skins = {};
  const added = [];
  const hidden = [];

  for (const hero of heroes) {
    const slug = hero.slug;
    const listedOnLiquipedia = liquipedia?.[slug]
      ? new Map(liquipedia[slug].map((s) => [normalizeNameSkin(s.name), s]))
      : null;
    const event = (s) => byId.get(`${slug}:${s.id}`) ?? byName.get(`${slug}:${normalizeNameSkin(s.name)}`) ?? null;

    const fromModule = moduleSkins[slug] ?? [];
    const names = new Set(fromModule.map((s) => normalizeNameSkin(s.name)));
    const ids = new Set(fromModule.map((s) => s.id));

    // Skins the module lacks: same id or same name means the same skin
    // (the gallery sometimes spells it differently: "Soryu Maiden").
    const fromPage = (avatars[slug] ?? [])
      .filter((a) => !ids.has(a.id) && !names.has(normalizeNameSkin(a.name)) && !takenIds.has(a.id))
      .map((a) => {
        const lp = listedOnLiquipedia?.get(normalizeNameSkin(a.name));
        return {
          id: a.id,
          name: a.name,
          release: null,
          availability: availabilityFrom(lp?.availability),
          rarity: null,
          label: event(a)?.series ?? lp?.type ?? null,
          price: {},
          fromPage: true,
        };
      });

    const list = [];
    for (const s of [...fromModule, ...fromPage]) {
      const { fromPage: isNew, ...skin } = s;
      const verdict = skinRelease(skin, {
        confirmed: listedOnLiquipedia?.has(normalizeNameSkin(skin.name)) ?? false,
        month: event(skin)?.month ?? null,
        base: skin.id === hero.id,
        now,
      });
      const entry = { hero: slug, id: skin.id, name: skin.name };
      if (!verdict.released) {
        hidden.push(entry);
        continue;
      }
      if (isNew) added.push(entry);
      list.push({ ...skin, release: verdict.release, released: true });
    }
    list.sort((a, b) => a.id.localeCompare(b.id));
    if (list.length) skins[slug] = list;
  }

  return { skins, added, hidden };
}

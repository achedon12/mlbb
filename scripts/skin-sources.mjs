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
 *
 * The module's own fields are checked against the other sources on the way:
 * ids against the hero page, dates against the monthly pages and the hero's
 * release, seasons against Liquipedia, and known misspellings. A short table
 * of corrections covers what no rule can tell. Kept apart from `sync.mjs` so
 * the merge can be tested on fixtures.
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

/**
 * Misspellings and variant spellings of the module, fixed in the free text
 * the site shows (availability, label, acquisition): "Avaliable via the Bang
 * Bang Card" (Mathilda's "Arcane Verdict"), "Annual Starlight" next to
 * "Annual StarLight", "Obtain via" next to "Obtained via".
 */
const TYPOS = [
  [/\bAvaliable\b/g, "Available"],
  [/\bavaliable\b/g, "available"],
  [/\bAvailible\b/g, "Available"],
  [/\bStarlight\b/g, "StarLight"],
  [/\bObtain via\b/g, "Obtained via"],
];

/** A free-text field with the known misspellings fixed; other values as they are. */
export function fixTypos(value) {
  if (typeof value !== "string") return value;
  return TYPOS.reduce((text, [pattern, fixed]) => text.replace(pattern, fixed), value);
}

/**
 * Corrections no rule can make, each checked against a source. One applies
 * only while the module still holds the wrong value (`from`): once the wiki
 * is fixed, it does nothing. `to: null` removes a value known to be wrong
 * when the right one is not known.
 */
export const SKIN_CORRECTIONS = [
  {
    // Basic skin sold since Sora came out (18 December 2025); the module
    // dates it 18 December 2026. The rule on dates to come fixes it until
    // that day, this entry keeps it right afterwards.
    // Evidence: https://liquipedia.net/mobilelegends/Sora/Gallery (Basic,
    // In-Game Store, 269 diamonds) and https://mobilelegends.fandom.com/wiki/Sora
    hero: "sora",
    id: "1312",
    field: "release",
    from: "2026-12-18",
    to: "2025-12-18",
  },
  {
    // Season 39 skin dated 18 December 2026, the same wrong year as Sora's
    // skin above. Its exact date is not documented: no date rather than a
    // wrong one once 18 December 2026 has passed.
    // Evidence: https://liquipedia.net/mobilelegends/Balmond/Gallery
    // ("Ironhide Berserker", Seasonal, availability "Season 39").
    hero: "balmond",
    id: "100210",
    field: "release",
    from: "2026-12-18",
    to: null,
  },
];

/** A skin with the corrections of the table applied, and those applied. */
export function applyCorrections(hero, skin, corrections = SKIN_CORRECTIONS) {
  let fixed = skin;
  const applied = [];
  for (const c of corrections) {
    if (c.hero !== hero || c.id !== skin.id || fixed[c.field] !== c.from) continue;
    fixed = { ...fixed, [c.field]: c.to };
    applied.push(c);
  }
  return { skin: fixed, applied };
}

/**
 * Module ids checked against the hero page's "Avatar icons" gallery, whose
 * files carry the game's ids ("Hero1304-icon.png"). When the gallery gives a
 * module skin's id to a skin the module lacks, and lists the module skin
 * under another free id, the module mixed the two up: the gallery's id is
 * kept, and the skin owning the module's id is then added from the gallery
 * like any skin the module lacks.
 *
 * Obsidia's module lists "Imperatrix Arashi" as 1303 and lacks "Magitech
 * Wraith"; the hero page, the StarLight page and the portrait files give 1303
 * to "Magitech Wraith" (StarLight, May 2026) and 1304 to "Imperatrix Arashi".
 *
 * Returns the module list with fixed ids, and the changes `{ name, from, to }`.
 */
export function reconcileIds(fromModule, gallery = []) {
  const nameById = new Map(gallery.map((a) => [a.id, normalizeNameSkin(a.name)]));
  const idByName = new Map(gallery.map((a) => [normalizeNameSkin(a.name), a.id]));
  const moduleIds = new Set(fromModule.map((s) => s.id));
  const moduleNames = new Set(fromModule.map((s) => normalizeNameSkin(s.name)));
  const changes = [];
  const skins = fromModule.map((s) => {
    const name = normalizeNameSkin(s.name);
    const owner = nameById.get(s.id);
    const galleryId = idByName.get(name);
    // Someone else at this id, missing from the module; and a free id for this skin.
    if (!owner || owner === name || moduleNames.has(owner)) return s;
    if (!galleryId || galleryId === s.id || moduleIds.has(galleryId)) return s;
    changes.push({ name: s.name, from: s.id, to: galleryId });
    return { ...s, id: galleryId };
  });
  return { skins, changes };
}

const seasonOf = (text, pattern) => {
  const m = String(text ?? "").trim().match(pattern);
  return m ? Number(m[1]) : null;
};

/**
 * Label and acquisition text of a season skin checked against each other:
 * the label "S39" and the text "Season 31" cannot both be right (Balmond's
 * "Ironhide Berserker"). Liquipedia's availability ("Season 39") settles it
 * when it agrees with one of them; otherwise the text, the less structured
 * of the two, is dropped rather than shown against the label.
 *
 * Returns the skin and a description of the change, or null when they agree.
 */
export function checkSeason(skin, liquipediaAvailability = null) {
  const label = seasonOf(skin.label, /^S(\d+)$/i);
  const text = seasonOf(skin.price?.other, /^Season\s+(\d+)$/i);
  if (label == null || text == null || label === text) return { skin, change: null };
  const lp = seasonOf(liquipediaAvailability, /^Season\s+(\d+)$/i);
  if (lp === text) {
    return { skin: { ...skin, label: `S${text}` }, change: `label S${label} → S${text} (Liquipedia: Season ${lp})` };
  }
  const price = { ...skin.price };
  if (lp === label) {
    price.other = `Season ${label}`;
    return { skin: { ...skin, price }, change: `"Season ${text}" → "Season ${label}" (label S${label}, Liquipedia: Season ${lp})` };
  }
  delete price.other;
  return { skin: { ...skin, price }, change: `"Season ${text}" dropped (label S${label}, no source settles it)` };
}

/** "2026/05 Starlight Member", Liquipedia's availability of a StarLight skin, as "2026-05". */
export function liquipediaMonth(availability) {
  const m = String(availability ?? "").match(/^(\d{4})\/(\d{2})\s+starlight\b/i);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** "2025/11 StarLight Member" moved to another month ("2025-12"). */
const withMonth = (text, month) =>
  typeof text === "string" && /^\d{4}-\d{2}$/.test(month ?? "")
    ? text.replace(/^\d{4}\/\d{2}(?=\s+StarLight\b)/, month.replace("-", "/"))
    : text;

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
 * - `heroes`: the released heroes, whose id is also their default skin's,
 *   and whose `release` tells a wrong year on a skin's date.
 *
 * Returns `skins` (`{ slug: Skin[] }`, each with `released: true`), `added`
 * (skins the module lacks, taken from the hero pages) and `hidden` (skins
 * left out as not released yet), both as `{ hero, id, name }`, and `fixes`,
 * the changes made to the module's fields, `{ hero, id, name, fix }`, for the
 * sync's log.
 */
export function mergeSkins({ moduleSkins, avatars = {}, liquipedia = null, events = [], heroes, now = Date.now() }) {
  // A series entry, found by skin name, or by id when no other skin has that name.
  const byId = new Map();
  const byName = new Map();
  for (const e of events) {
    if (e.none || !e.month || !e.hero) continue;
    if (e.id) byId.set(`${e.hero}:${e.id}`, e);
    if (e.skin) byName.set(`${e.hero}:${normalizeNameSkin(e.skin)}`, e);
  }

  const skins = {};
  const added = [];
  const hidden = [];
  const fixes = [];

  // Ids first, for every hero: the ids taken below must be the right ones.
  const reconciled = {};
  for (const [slug, list] of Object.entries(moduleSkins)) {
    const { skins: fixed, changes } = reconcileIds(list, avatars[slug]);
    reconciled[slug] = fixed;
    for (const c of changes) fixes.push({ hero: slug, id: c.to, name: c.name, fix: `id ${c.from} → ${c.to} (hero page gallery)` });
  }
  const takenIds = new Set(Object.values(reconciled).flat().map((s) => s.id));

  for (const hero of heroes) {
    const slug = hero.slug;
    const listedOnLiquipedia = liquipedia?.[slug]
      ? new Map(liquipedia[slug].map((s) => [normalizeNameSkin(s.name), s]))
      : null;

    const fromModule = reconciled[slug] ?? [];
    const names = new Set(fromModule.map((s) => normalizeNameSkin(s.name)));
    const ids = new Set(fromModule.map((s) => s.id));
    const known = new Set([...names, ...(avatars[slug] ?? []).map((a) => normalizeNameSkin(a.name))]);

    // An id match is trusted unless the entry names another skin of the hero:
    // a wrong id must not give a skin the month of another one.
    const event = (s) => {
      const name = normalizeNameSkin(s.name);
      const named = byName.get(`${slug}:${name}`);
      if (named) return named;
      const e = byId.get(`${slug}:${s.id}`);
      if (!e) return null;
      const entryName = normalizeNameSkin(e.skin ?? "");
      return entryName !== name && known.has(entryName) ? null : e;
    };

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
      const { fromPage: isNew, ...raw } = s;
      const note = (fix) => fixes.push({ hero: slug, id: raw.id, name: raw.name, fix });
      const lp = listedOnLiquipedia?.get(normalizeNameSkin(raw.name)) ?? null;

      const corrected = applyCorrections(slug, raw);
      for (const c of corrected.applied) note(`${c.field} ${c.from} → ${c.to ?? "none"} (corrections table)`);
      const season = checkSeason(corrected.skin, lp?.availability);
      if (season.change) note(season.change);
      const skin = {
        ...season.skin,
        availability: fixTypos(season.skin.availability),
        label: fixTypos(season.skin.label),
        price: Object.fromEntries(Object.entries(season.skin.price ?? {}).map(([k, v]) => [k, fixTypos(v)])),
      };
      if (JSON.stringify(skin) !== JSON.stringify(season.skin)) note("misspelling fixed");

      const verdict = skinRelease(skin, {
        confirmed: Boolean(lp),
        month: event(skin)?.month ?? liquipediaMonth(lp?.availability),
        base: skin.id === hero.id,
        heroRelease: hero.release ?? null,
        now,
      });
      const entry = { hero: slug, id: skin.id, name: skin.name };
      if (!verdict.released) {
        hidden.push(entry);
        continue;
      }
      if (verdict.dateFix) note(`release ${skin.release} → ${verdict.release ?? "none"} (${verdict.dateFix})`);
      // The acquisition text names the StarLight month too: it follows the date.
      const price =
        verdict.dateFix === "series month" && skin.price?.other
          ? { ...skin.price, other: withMonth(skin.price.other, verdict.release) }
          : skin.price;
      if (isNew) added.push(entry);
      list.push({ ...skin, price, release: verdict.release, released: true });
    }
    list.sort((a, b) => a.id.localeCompare(b.id));
    if (list.length) skins[slug] = list;
  }

  return { skins, added, hidden, fixes };
}

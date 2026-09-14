/**
 * Hero catalogue normalization.
 *
 * Turns the `Module:Hero/data` table read from the wiki into the list written
 * to `src/data/game/heroes.json`. Kept apart from `sync.mjs`, which runs the
 * whole synchronization as soon as it is imported, so the rules deciding
 * which heroes make it into the catalogue can be tested on saved fixtures.
 */

/** Wiki lane names mapped to the site's lane tokens. */
const LANES = {
  "Gold Lane": "Gold",
  "EXP Lane": "Exp",
  "Mid Lane": "Mid",
  Jungle: "Jungle",
  Roaming: "Roam",
};

/** A stable URL identifier, insensitive to accents and punctuation. */
export function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Apostrophes and dots separate words: "Chang'e" becomes "chang-e" and
    // "X.Borg" becomes "x-borg", rather than gluing the pieces into one
    // unreadable block.
    .replace(/['’.]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The wiki leaves fields set to `<name>` in its templates: that is not a value. */
export const empty = (v) => !v || String(v).startsWith("<") || String(v).trim() === "";
export const clean = (v) => (empty(v) ? null : String(v).trim());
const list = (...v) => v.map(clean).filter(Boolean);

export function count(v) {
  if (empty(v)) return null;
  const n = Number(String(v).replace(",", "."));
  // `|| null` is tempting, but it would turn a legitimate zero into a missing
  // value: in JavaScript, 0 is falsy.
  return Number.isFinite(n) ? n : null;
}

function extractYear(date) {
  const found = String(date ?? "").match(/\b(20\d{2})\b/);
  return found ? found[1] : null;
}

function normalizeStats(stats) {
  const keep = [
    "hp1", "hp15", "hp_regen1", "mana1", "mana15",
    "physical_atk1", "physical_atk15", "physical_def1", "physical_def15",
    "magic_def1", "magic_def15", "movement_spd", "basic_atk_range",
  ];
  const output = {};
  for (const key of keep) if (!empty(stats[key])) output[key] = String(stats[key]);
  return Object.keys(output).length ? output : null;
}

function normalizeHero(h) {
  return {
    slug: slugify(h.name),
    name: String(h.name),
    id: String(h.id).trim(),
    title: clean(h.title),
    roles: list(h.role1, h.role2),
    lanes: list(h.lane1, h.lane2).map((l) => LANES[l] ?? l),
    specialties: list(h.specialty1, h.specialty2),
    release: clean(h.release_date),
    year: clean(h.release_year) ?? extractYear(h.release_date),
    resource: clean(h.resource),
    damageType: clean(h.dmg_type),
    attackType: clean(h.atk_type),
    region: clean(h.region),
    ratings: {
      offense: count(h.ratings?.offense),
      durability: count(h.ratings?.durability),
      abilityEffects: count(h.ratings?.control_effect ?? h.ratings?.ability_effects),
      difficulty: count(h.ratings?.difficulty),
    },
    stats: h.stats && typeof h.stats === "object" ? normalizeStats(h.stats) : null,
  };
}

/**
 * The hero list, from the module table.
 *
 * The module is edited by hand, and a single edit can blank a hero's entry
 * (the game id stays, every other field is emptied) or delete it: Argus's
 * entry stayed blank for a week in September 2026, and every sync in that
 * window silently dropped him, with his pages, counters and sitemap entries.
 * A hero, once released, does not leave the game. So `previous`, the
 * catalogue written by the last sync, stands in for such an entry, matched
 * by game id, and `warn` reports it. A blank entry with no previous record
 * (a template row, an announced hero not filled in yet) is still left out.
 */
export function normalizeHeroes(raw, previous = [], warn = console.warn) {
  const before = new Map((Array.isArray(previous) ? previous : []).map((h) => [h.id, h]));
  const heroes = [];

  for (const [key, h] of Object.entries(raw)) {
    if (key === "Mystery Hero" || !h || typeof h !== "object" || empty(h.id)) continue;
    if (!empty(h.name)) {
      heroes.push(normalizeHero(h));
      continue;
    }
    const kept = before.get(String(h.id).trim());
    if (kept) {
      warn(`Module:Hero/data: entry "${key}" (id ${h.id}) has no name, previous record kept`);
      heroes.push(kept);
    } else {
      warn(`Module:Hero/data: entry "${key}" (id ${h.id}) has no name, left out`);
    }
  }

  const ids = new Set(heroes.map((h) => h.id));
  const slugs = new Set(heroes.map((h) => h.slug));
  for (const h of before.values()) {
    // A renamed hero keeps its id; a slug already taken means the same hero
    // under another id: neither is kept twice.
    if (ids.has(h.id) || slugs.has(h.slug)) continue;
    warn(`Module:Hero/data: ${h.name} (id ${h.id}) missing from the module, previous record kept`);
    heroes.push(h);
  }

  return heroes.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

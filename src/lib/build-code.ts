/**
 * Build code in the simulator URL.
 *
 * A shared build lives entirely in the query string of `/tools/build`: no
 * storage, no id to resolve, and a link pasted in a chat stays readable.
 * Every parameter is optional and their order does not matter:
 *
 * | param | content                                                        | example                      |
 * |-------|----------------------------------------------------------------|------------------------------|
 * | `h`   | hero slug                                                      | `h=aamon`                    |
 * | `l`   | level, 1 to 15; absent means 15                                | `l=12`                       |
 * | `i`   | up to six item slugs, purchase order, comma separated; the     | `i=genius-wand,holy-crystal` |
 * |       | same item may repeat (the game lets you buy it twice)          |                              |
 * | `e`   | emblem set (`common`, `tank`, `mage`...)                       | `e=mage`                     |
 * | `t`   | three talents, one per tier, comma separated; a tier may be    | `t=rupture,,killing-spree`   |
 * |       | left empty                                                     |                              |
 * | `s`   | battle spell                                                   | `s=flicker`                  |
 *
 * Full example:
 * `/en/tools/build?h=aamon&i=genius-wand,holy-crystal&e=mage&t=rupture,weapon-master,killing-spree&s=retribution`.
 *
 * Two readers: `decodeBuild`, lenient, for a URL - whatever it does not
 * recognise is dropped and reported, the rest still shows; `validateBuild`,
 * strict, for a request body - a single unknown value rejects the whole
 * build. Both check every slug against the catalog they are given: this
 * module loads no data, the browser and the server pass their own.
 */

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 15;
export const MAX_ITEMS = 6;
export const TIERS = 3;

/** Beyond this, the site did not produce the URL: no point reading it. */
const MAX_LENGTH = 800;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 48;

export const PARAMS = { hero: "h", level: "l", items: "i", emblem: "e", talents: "t", spell: "s" } as const;

export type Talents = [string | null, string | null, string | null];

export interface BuildCode {
  hero: string | null;
  level: number;
  items: string[];
  emblem: string | null;
  talents: Talents;
  spell: string | null;
}

export interface CodeCatalog {
  heroes: ReadonlySet<string>;
  items: ReadonlySet<string>;
  emblems: ReadonlySet<string>;
  /** Talents allowed on each tier, in order. */
  tiers: readonly [ReadonlySet<string>, ReadonlySet<string>, ReadonlySet<string>];
  spells: ReadonlySet<string>;
}

export const EMPTY_BUILD: BuildCode = {
  hero: null,
  level: LEVEL_MAX,
  items: [],
  emblem: null,
  talents: [null, null, null],
  spell: null,
};

const isSlug = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_SLUG && SLUG.test(v);

/** Query string of the build, without `?`; empty parts are left out. */
export function encodeBuild(b: BuildCode): string {
  const parts: string[] = [];
  // Slugs are [a-z0-9-]: nothing to escape, and commas stay readable.
  if (b.hero) parts.push(`${PARAMS.hero}=${b.hero}`);
  if (b.level !== LEVEL_MAX) parts.push(`${PARAMS.level}=${b.level}`);
  if (b.items.length) parts.push(`${PARAMS.items}=${b.items.join(",")}`);
  if (b.emblem) parts.push(`${PARAMS.emblem}=${b.emblem}`);
  if (b.talents.some(Boolean)) parts.push(`${PARAMS.talents}=${b.talents.map((t) => t ?? "").join(",")}`);
  if (b.spell) parts.push(`${PARAMS.spell}=${b.spell}`);
  return parts.join("&");
}

type Input = URLSearchParams | string | Record<string, string | string[] | undefined>;

function reader(input: Input): (key: string) => string | null {
  if (typeof input === "string") {
    const text = input.length > MAX_LENGTH ? "" : input.replace(/^\?/, "");
    const p = new URLSearchParams(text);
    return (key) => p.get(key);
  }
  if (input instanceof URLSearchParams) return (key) => input.get(key);
  return (key) => {
    const v = input[key];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
}

export interface DecodedBuild {
  build: BuildCode;
  /** Dropped parameters, so the visitor can be told the link was damaged. */
  ignored: (keyof typeof PARAMS)[];
}

/**
 * Lenient reading of a URL. An unknown item disappears without taking the
 * others with it; a talent on the wrong tier leaves that tier empty.
 */
export function decodeBuild(input: Input, catalog: CodeCatalog): DecodedBuild {
  const read = reader(input);
  const ignored = new Set<keyof typeof PARAMS>();
  const build: BuildCode = { ...EMPTY_BUILD, talents: [null, null, null] };

  const h = read(PARAMS.hero);
  if (h !== null) {
    if (isSlug(h) && catalog.heroes.has(h)) build.hero = h;
    else ignored.add("hero");
  }

  const l = read(PARAMS.level);
  if (l !== null) {
    const level = /^\d{1,2}$/.test(l) ? Number(l) : Number.NaN;
    if (level >= LEVEL_MIN && level <= LEVEL_MAX) build.level = level;
    else ignored.add("level");
  }

  const i = read(PARAMS.items);
  if (i !== null && i !== "") {
    const slugs = i.split(",");
    const valid = slugs.filter((s) => isSlug(s) && catalog.items.has(s));
    if (valid.length !== slugs.length || valid.length > MAX_ITEMS) ignored.add("items");
    build.items = valid.slice(0, MAX_ITEMS);
  }

  const e = read(PARAMS.emblem);
  if (e !== null) {
    if (isSlug(e) && catalog.emblems.has(e)) build.emblem = e;
    else ignored.add("emblem");
  }

  const t = read(PARAMS.talents);
  if (t !== null && t !== "") {
    const slots = t.split(",");
    if (slots.length > TIERS) ignored.add("talents");
    for (let tier = 0; tier < TIERS; tier += 1) {
      const s = slots[tier];
      if (!s) continue;
      if (isSlug(s) && catalog.tiers[tier].has(s)) build.talents[tier] = s;
      else ignored.add("talents");
    }
  }

  const s = read(PARAMS.spell);
  if (s !== null) {
    if (isSlug(s) && catalog.spells.has(s)) build.spell = s;
    else ignored.add("spell");
  }

  return { build, ignored: [...ignored] };
}

/**
 * Strict reading of a build sent as JSON (`{ hero, level, items, emblem,
 * talents, spell }`): null on any unknown, mistyped or out-of-catalog field.
 * The hero is required, and at least one item.
 */
export function validateBuild(raw: unknown, catalog: CodeCatalog): (BuildCode & { hero: string }) | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const allowed = new Set(["hero", "level", "items", "emblem", "talents", "spell"]);
  if (Object.keys(b).some((k) => !allowed.has(k))) return null;

  if (!isSlug(b.hero) || !catalog.heroes.has(b.hero)) return null;
  if (typeof b.level !== "number" || !Number.isInteger(b.level) || b.level < LEVEL_MIN || b.level > LEVEL_MAX) return null;
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_ITEMS) return null;
  if (!b.items.every((o) => isSlug(o) && catalog.items.has(o))) return null;
  if (b.emblem !== null && (!isSlug(b.emblem) || !catalog.emblems.has(b.emblem))) return null;
  if (!Array.isArray(b.talents) || b.talents.length !== TIERS) return null;
  const talents = b.talents as unknown[];
  if (!talents.every((t, tier) => t === null || (isSlug(t) && catalog.tiers[tier].has(t)))) return null;
  if (b.spell !== null && (!isSlug(b.spell) || !catalog.spells.has(b.spell))) return null;

  return {
    hero: b.hero,
    level: b.level,
    items: [...(b.items as string[])],
    emblem: (b.emblem as string | null) ?? null,
    talents: [...talents] as Talents,
    spell: (b.spell as string | null) ?? null,
  };
}

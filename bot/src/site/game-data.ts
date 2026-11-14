import { z } from "zod";
import { TtlCache } from "../cache.js";
import { LOCALES, type Locale } from "../i18n/index.js";
import { NotFoundError, requestJson, type FetchLike } from "./http.js";

/**
 * Game data, read from the site's public API (`/api/v1/*`), the same one any
 * third party may use. The bot holds no copy of the data files: it would go
 * stale at the next sync.
 *
 * Shapes follow `src/app/api/v1/**` in the site. Unknown fields are stripped
 * by the schemas, which keeps the cached objects small. Some endpoints
 * (`counters`, `builds`, `emblems`, `skins`...) are read as optional: on a
 * 404 the command falls back to a link to the page on the site.
 * `tests/unit/bot-api-contract.test.ts` (site side) runs this client against
 * the site's route handlers, so a path or a shape cannot drift unnoticed.
 */

const envelope = <T extends z.ZodType>(data: T) => z.object({ data });

const nullableString = z.string().nullable().catch(null);
const nullableNumber = z.number().nullable().catch(null);

export const RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"] as const;
export type Rank = (typeof RANKS)[number];
export const LANES = ["Gold", "Exp", "Mid", "Jungle", "Roam"] as const;
export type Lane = (typeof LANES)[number];
export const ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"] as const;
export type Role = (typeof ROLES)[number];

const heroSummary = z.object({
  slug: z.string(),
  name: z.string(),
  title: nullableString,
  roles: z.array(z.string()),
  lanes: z.array(z.string()),
  release: nullableString,
});
export type HeroSummary = z.infer<typeof heroSummary>;

const build = z.object({
  name: z.string(),
  context: z.string().catch(""),
  items: z.array(z.string()),
  emblem: z.string().catch(""),
  talent: z.string().catch(""),
  spell: z.string().catch(""),
});

const skin = z.object({
  id: z.string(),
  name: z.string(),
  release: nullableString,
  rarity: nullableString,
});

const heroDetail = heroSummary.extend({
  damageType: nullableString,
  attackType: nullableString,
  ratings: z
    .object({ difficulty: nullableNumber })
    .catch({ difficulty: null }),
  skills: z.array(z.object({ name: z.string() }).nullable()).catch([]),
  skins: z.array(skin).catch([]),
  images: z
    .object({ portrait: nullableString, icon: nullableString, skins: z.record(z.string(), z.string()).catch({}) })
    .catch({ portrait: null, icon: null, skins: {} }),
  /** Full-size artwork (1280×720) per skin name, the original skin first, as the site orders it. */
  illustrations: z.record(z.string(), z.string()).catch({}).optional(),
  analysis: z
    .object({
      summary: z.string().catch(""),
      strongAgainst: z.array(z.string()).catch([]),
      weakAgainst: z.array(z.string()).catch([]),
      builds: z.array(build).catch([]),
    })
    .nullable()
    .catch(null),
});
export type HeroDetail = z.infer<typeof heroDetail>;

const item = z.object({
  slug: z.string(),
  name: z.string(),
  summary: nullableString,
  category: z.string(),
  price: nullableNumber,
  bonus: nullableString,
  unique: nullableString,
  passive: nullableString,
  active: nullableString,
  recipe: z.array(z.string()).catch([]),
});
export type Item = z.infer<typeof item>;

const patch = z.object({ version: z.string(), title: z.string(), link: z.string() });
export type Patch = z.infer<typeof patch>;

const rankingEntry = z.object({
  slug: z.string(),
  name: z.string(),
  tier: z.string(),
  winRate: nullableNumber,
  banRate: nullableNumber,
  pickRate: nullableNumber,
  score: nullableNumber,
});
export type RankingEntry = z.infer<typeof rankingEntry>;
const rankings = z.object({
  measuredAt: nullableString,
  /** Present only when the site honours `?rank=`: the bot then knows the figures are per rank. */
  rank: z.string().optional(),
  heroes: z.array(rankingEntry),
});
export type Rankings = z.infer<typeof rankings>;

const counterFigure = z.object({ slug: z.string(), advantage: z.number() });
const heroCounters = z.object({
  strong: z.array(counterFigure).catch([]),
  weak: z.array(counterFigure).catch([]),
  winRate: nullableNumber.optional(),
});
const countersByRank = z.record(z.string(), heroCounters);
export type CountersByRank = z.infer<typeof countersByRank>;

const buildPlayed = z.object({
  items: z.array(z.string()),
  emblem: nullableString,
  talents: z.array(z.string()).catch([]),
  spell: nullableString,
  winRate: nullableNumber,
  pickRate: nullableNumber,
});
export type BuildPlayed = z.infer<typeof buildPlayed>;
const buildsHero = z.record(z.string(), z.record(z.string(), z.array(buildPlayed)));
export type BuildsHero = z.infer<typeof buildsHero>;

const namedEntry = z.object({
  slug: z.string(),
  name: z.string(),
  description: nullableString.optional(),
  cooldown: nullableNumber.optional(),
});
export type NamedEntry = z.infer<typeof namedEntry>;

const patchDetail = z.object({
  version: z.string(),
  title: z.string(),
  date: nullableString.optional(),
  balance: z.object({ buff: z.number(), nerf: z.number(), adjust: z.number() }).optional(),
  adjustments: z
    .array(z.object({ name: z.string(), slug: z.string(), type: nullableString }))
    .catch([])
    .optional(),
});
export type PatchDetail = z.infer<typeof patchDetail>;

const skinEntry = z.object({
  hero: z.string(),
  id: z.string(),
  name: z.string(),
  release: nullableString,
  rarity: nullableString.optional(),
  image: nullableString.optional(),
});
export type SkinEntry = z.infer<typeof skinEntry>;

const eventEntry = z.object({
  name: z.string(),
  start: nullableString,
  end: nullableString,
  image: nullableString.optional(),
  link: nullableString.optional(),
});
export type EventEntry = z.infer<typeof eventEntry>;

/** One hour: the data only changes at the nightly sync. */
const TTL_MS = 60 * 60 * 1000;

export class GameData {
  // One cache per shape keeps the typing simple; sizes are capped so a burst
  // of lookups on every hero cannot grow a shard's memory without bound.
  private readonly lists = new TtlCache<unknown>(TTL_MS, 50);
  private readonly details = new TtlCache<unknown>(TTL_MS, 80);

  constructor(
    private readonly siteUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private get<T>(cache: TtlCache<unknown>, path: string, schema: z.ZodType<T>): Promise<T> {
    return cache.getOrLoad(path, () =>
      requestJson(this.fetchImpl, `${this.siteUrl}/api/v1${path}`, envelope(schema), {
        headers: { accept: "application/json", "user-agent": "MLBBDexBot (+https://mlbbdex.com/en/bot)" },
      }).then((r) => r.data),
    ) as Promise<T>;
  }

  /** Null on a 404: an optional endpoint the site does not serve (yet), or an unknown slug. */
  private async optional<T>(cache: TtlCache<unknown>, path: string, schema: z.ZodType<T>): Promise<T | null> {
    try {
      return await this.get(cache, path, schema);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  heroes(): Promise<HeroSummary[]> {
    return this.get(this.lists, "/heroes", z.array(heroSummary));
  }

  hero(slug: string): Promise<HeroDetail | null> {
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return Promise.resolve(null);
    return this.optional(this.details, `/heroes/${slug}`, heroDetail);
  }

  items(locale: Locale): Promise<Item[]> {
    return this.get(this.lists, `/items?locale=${locale}`, z.array(item));
  }

  patches(): Promise<Patch[]> {
    return this.get(this.lists, "/patches", z.array(patch));
  }

  rankings(rank: Rank = "all"): Promise<Rankings> {
    return this.get(this.lists, rank === "all" ? "/rankings" : `/rankings?rank=${rank}`, rankings);
  }

  counters(slug: string): Promise<CountersByRank | null> {
    return this.optional(this.details, `/heroes/${slug}/counters`, countersByRank);
  }

  builds(slug: string): Promise<BuildsHero | null> {
    return this.optional(this.details, `/heroes/${slug}/builds`, buildsHero);
  }

  emblems(locale: Locale): Promise<NamedEntry[] | null> {
    return this.optional(this.lists, `/emblems?locale=${locale}`, z.array(namedEntry));
  }

  spells(locale: Locale): Promise<NamedEntry[] | null> {
    return this.optional(this.lists, `/spells?locale=${locale}`, z.array(namedEntry));
  }

  patch(version: string, locale: Locale): Promise<PatchDetail | null> {
    if (!/^\d+(\.\d+){1,3}$/.test(version)) return Promise.resolve(null);
    return this.optional(this.details, `/patches/${version}?locale=${locale}`, patchDetail);
  }

  newestSkins(): Promise<SkinEntry[] | null> {
    return this.optional(this.lists, "/skins?limit=10", z.array(skinEntry));
  }

  events(locale: Locale): Promise<EventEntry[] | null> {
    return this.optional(this.lists, `/events?locale=${locale}`, z.array(eventEntry));
  }

  /**
   * Loads the lists most commands read (heroes, rankings, patches, items in
   * every language), so the first commands after a start, or after an
   * entry expired, do not wait on the site. Returns how many loads failed;
   * a failure is not fatal: the command that needs it loads it again.
   */
  async warm(): Promise<number> {
    const loads: Promise<unknown>[] = [this.heroes(), this.rankings(), this.patches(), ...LOCALES.map((l) => this.items(l))];
    const results = await Promise.allSettled(loads);
    return results.filter((r) => r.status === "rejected").length;
  }
}

/** Cache warm-ups: often enough that an expired list is reloaded before a command asks for it. */
export const WARM_INTERVAL_MS = 10 * 60 * 1000;

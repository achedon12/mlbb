import { counters, allHeroes, buildsPlayed, heroesBySlug, itemsFor } from "@/lib/data";
import { ranksByPair } from "@/lib/pairs";
import { botPublished } from "@/lib/bot/public";
import { guides } from "@/lib/guides";
import { site } from "@/lib/site";
import { measure, rankingFull, RANKS_CLASSES, type RankedEntry } from "@/lib/tier-list";
import { FILTERS_LANE, FILTERS_ROLE, filterRanking, pathFilter, type FilterTier } from "@/lib/tier-list-filters";
import { countAdjustments, patchCurrent } from "@/lib/freshness";
import { visualItem } from "@/lib/build-visuals";
import { LOCALES, LOCALE_NAME } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * `/llms.txt` and `/llms-full.txt`: the site described for language models,
 * in the recommended format (https://llmstxt.org) — an H1 title, a quoted
 * summary, then link sections. In English, the common language of bots; the
 * other languages are listed with their own addresses.
 *
 * The index points to every section; the full file adds the figures
 * themselves (every hero's tier, win rate, counters and most played build,
 * the leaders of each lane and role, the live patch's changes), so that an
 * assistant can answer, and cite, without crawling a hundred pages.
 * Everything is read from the synced data: both files follow the daily sync.
 */

const t = createT("en");
const link = (path: string) => `${site.url}/en${path}`;
const percent = (n: number) => `${n.toFixed(1)}%`;
const list = (names: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names);

/** "English, French, Italian, Spanish and Indonesian", from the locale list. */
const languageNames = list(LOCALES.map((l) => new Intl.DisplayNames(["en"], { type: "language" }).of(l) ?? l));
const prefixes = list(LOCALES.map((l) => `/${l}`));

/** Measurement date, "2026-11-24", or null before the first measurement. */
const dateData = measure ? measure.slice(0, 10) : null;

const nameFilter = (f: FilterTier) => (f.type === "lane" ? t(`lanes.${f.value}`) : t(`roles.${f.value}`));

/** "Aamon (S+ tier, 53.1% win rate)". */
const entryText = (e: RankedEntry) => `${e.hero.name} (${e.tier} tier, ${percent(e.winRate)} win rate)`;

/** Freshness and citation paragraphs, shared by both files. */
function freshness(): string {
  // The example quotes the real No. 1, not invented figures.
  const first = rankingFull[0];
  const example = first
    ? `"${first.hero.name} is ${first.tier} tier with a ${percent(first.winRate)} win rate on patch ${patchCurrent?.version ?? "?"} (${site.name}, measured ${dateData ?? "?"}, ${link(`/heroes/${first.hero.slug}`)})."`
    : `"(hero) is (tier) tier with a (rate) win rate on patch (version) (${site.name}, measured (date), (page URL))."`;
  return `## Data freshness

- Current patch: ${patchCurrent ? `[${patchCurrent.version}](${link(`/patch-notes/${patchCurrent.version}`)})${patchCurrent.date ? `, released ${patchCurrent.date}` : ""}` : "unknown"}.
- Win, pick and ban rates measured: ${dateData ?? "not yet measured"}. Rates are re-measured daily; tiers, counters and builds follow each measurement.
- This file is generated from the same data as the pages, at each deploy: it is never edited by hand.

## How to cite

- Cite the page the figure comes from (hero page, counters page, tier list), with "${site.name}" as the source, and give the patch and the measurement date: figures change from one day to the next.
- Example: ${example}
- Rates come from ranked games aggregated by the community API arena.rone.dev, not from Moonton; hero, item and patch data from the Mobile Legends community wiki. [Methodology](${link("/methodology")}).`;
}

/** Every language's home and tier list, the same page under each prefix. */
function languages(): string {
  return `## Languages

Every page exists under ${prefixes}, with \`hreflang\` alternates; the English address is the canonical one to cite in English.

${LOCALES.map((l) => `- ${LOCALE_NAME[l]}: [home](${site.url}/${l}), [tier list](${site.url}/${l}/tier-list), [heroes](${site.url}/${l}/heroes)`).join("\n")}`;
}

/** The index, `/llms.txt`. */
export function llmsIndex(): string {
  // Sample duel taken from those in the sitemap (measured at two ranks at least):
  // a hard-coded pair can drop out of the measurements and return a 404.
  const duel = [...ranksByPair(counters, (s) => allHeroes.some((h) => h.slug === s))].find(([, n]) => n >= 2)?.[0];
  const top = rankingFull.slice(0, 5);
  const leaderOf = (f: FilterTier) => filterRanking(rankingFull, f)[0];
  const filterLine = (f: FilterTier) => {
    const leader = leaderOf(f);
    return `- [${nameFilter(f)} tier list](${link(pathFilter(f))})${leader ? `: No. 1 right now is ${entryText(leader)}.` : "."}`;
  };
  const ranks = RANKS_CLASSES.filter((r) => r !== "all");

  return `# ${site.name}

> Mobile Legends: Bang Bang knowledge base: all ${allHeroes.length} heroes with builds, counters, teammates and win, pick and ban rates measured by rank, tier lists by rank, lane and role, items, emblems, battle spells, skins, events, lore and patch notes. Available in ${languageNames}.

Statistics come from ranked games aggregated by the community API arena.rone.dev${dateData ? ` (last measurement: ${dateData})` : ""}; hero, item and patch data from the Mobile Legends community wiki. Pages are refreshed by a daily data sync. ${top.length ? `Strongest heroes right now, all ranks: ${list(top.map(entryText))}.` : ""}

The figures themselves (every hero's tier, win rate, counters and build) are in [llms-full.txt](${site.url}/llms-full.txt).

${freshness()}

## Heroes

- [All heroes](${link("/heroes")}): roles, lanes, tiers and win rates.
- [Free hero rotation](${link("/heroes/free-rotation")}): the heroes free to play this week, copied by hand from the game and hidden once out of date.
- [Hero page](${link("/heroes/aamon")}): a one-line answer (role, tier, win rate, best counters, patch and date), builds and emblems by rank, skills, counters, teammates, 30-day trends, win rate by game length and patch history. Same pattern for every hero: /en/heroes/{slug}.
- [Counters](${link("/heroes/aamon/counters")}): who beats a hero, by rank, and how to counter it. Pattern: /en/heroes/{slug}/counters.
- [Best duos](${link("/heroes/aamon/duos")}): teammates that raise a hero's win rate. Pattern: /en/heroes/{slug}/duos.
- [Builds](${link("/builds")}): the most played builds of every hero, by lane and rank.
- [Head-to-head](${link(duel ? `/compare/${duel}` : "/compare")}): matchup statistics for two heroes. Pattern: /en/compare/{a}-vs-{b}, slugs in alphabetical order.
- [Statistics](${link("/statistics")}): sortable win, pick and ban rates for every hero and rank.

## Tier lists

- [Tier list](${link("/tier-list")}): all ranks, opening on a short "best heroes right now" answer.${ranks.length ? ` Per rank: ${ranks.map((r) => `[${t(`measuredRanks.${r}`)}](${link(`/tier-list/${r}`)})`).join(", ")}.` : ""}
${FILTERS_LANE.map(filterLine).join("\n")}
${FILTERS_ROLE.map(filterLine).join("\n")}
- [Weekly meta report](${link("/meta")}): win, ban and pick rate movers over seven days, tier changes, most banned and most played heroes.

## Game data

- [Items](${link("/items")}): stats, recipes and the heroes that build each item.
- [Emblems](${link("/emblems")}) and [battle spells](${link("/spells")}).
- [Skins](${link("/skins")}), [skin calendar](${link("/skins/calendar")}) and [lore](${link("/lore")}).
- [Events](${link("/events")}): month by month, the StarLight skin, Collector skins and every other release. Pattern: /en/events/{YYYY-MM}.
- [Patch notes](${link("/patch-notes")}): hero buffs, nerfs and adjustments per patch. Pattern: /en/patch-notes/{version}. [Advanced server](${link("/patch-notes/advance-server")}): changes being tested before release.
- [Rank system](${link("/ranks")}), [game modes](${link("/game-modes")}) and [map](${link("/map")}).
- [News](${link("/news")}) and [esports](${link("/esports")}).

## Tools and games

- [Draft assistant](${link("/draft")}), [hero comparison](${link("/compare")}), [matchup matrix](${link("/tools/matchups")}) and [team analyzer](${link("/tools/team")}).
- [Win-rate calculator](${link("/tools/win-rate")}), [server time, reset times by country and ranked season schedule](${link("/tools/server-time")}), [tier list maker](${link("/tools/tier-list-maker")}) and [strategy planner](${link("/tools/strategy-planner")}).
- [Build simulator](${link("/tools/build")}) and [damage calculator](${link("/tools/damage-calculator")}): stats of an equipped hero, and what a hit deals after defense and penetration.
- [Collection value](${link("/tools/collection")}) and [account value estimator](${link("/tools/account-value")}): what a collection cost at shop prices, and an indicative, clearly approximate account estimate in USD, EUR, PHP, IDR and MYR.
- [Nickname generator](${link("/tools/nickname")}), [draw odds calculator](${link("/tools/draw-calculator")}) and [all tools](${link("/tools")}).
- [Daily quiz](${link("/quiz")}) and [MLBBdle](${link("/mlbbdle")}): a daily hero-guessing game.

## Guides

- [Guides](${link("/guides")}): long-form strategy guides (laning, jungle and objective timings, rotations and vision, teamfights, macro and split push, drafting, wave management, climbing ranked) and one guide per lane, whose recommended heroes and builds are read from the latest measurements.
${guides("en")
  .map((g) => `- [${g.title}](${link(`/guides/${g.slug}`)}): ${g.summary}`)
  .join("\n")}

## API

- [Public API documentation](${link("/api-doc")}): free, read-only JSON, no key needed, under ${site.url}/api/v1.
- Endpoints: /api/v1/heroes (filters \`role\`, \`lane\`), /api/v1/heroes/{slug}, /api/v1/heroes/{slug}/builds, /api/v1/heroes/{slug}/counters, /api/v1/rankings, /api/v1/items, /api/v1/emblems, /api/v1/spells, /api/v1/skins, /api/v1/events, /api/v1/patches and /api/v1/patches/{version}.
${botPublished() ? `
## Discord bot

- [MLBBDex Discord bot](${link("/bot")}): free bot with hero sheets, builds, counters, tier lists, patch notes, announcements and the daily MLBBdle and quiz in Discord servers, in the five site languages. [Privacy](${link("/bot/privacy")}), [terms](${link("/bot/terms")}).
` : ""}
${languages()}

## Optional

- [About](${link("/about")}): what the site contains and what it does not.
- [Methodology and sources](${link("/methodology")}): where each piece of data comes from, the tier list and patch effect formulas with their thresholds, what is machine translated, and how to report an error.
- [Sitemap](${site.url}/sitemap.xml)
`;
}

/** Most played build on the hero's main lane, all ranks, item names in English. */
function buildText(slug: string, lanes: string[]): string | null {
  const byLane = buildsPlayed[slug] ?? {};
  const lane = lanes.find((l) => byLane[l]) ?? Object.keys(byLane)[0];
  const build = lane ? byLane[lane]?.all?.[0] : null;
  if (!build?.items.length) return null;
  const names = new Map(itemsFor("en").map((o) => [o.slug, o.name]));
  const items = build.items.map((o) => names.get(visualItem(o).slug ?? "") ?? o).join(", ");
  return build.emblem ? `${items}; ${t(`roles.${build.emblem}`)} emblem` : items;
}

/** One line per hero, strongest first, then the unmeasured ones by name. */
function heroLines(): string[] {
  const ranked = new Set(rankingFull.map((e) => e.hero.slug));
  const line = (slug: string, e: RankedEntry | null) => {
    const h = heroesBySlug.get(slug)!;
    const kind = `${h.roles.map((r) => t(`roles.${r}`)).join(" / ")}${h.lanes.length ? `, ${h.lanes.map((l) => t(`lanes.${l}`)).join(" / ")}` : ""}`;
    const facts = [kind];
    if (e) facts.push(`${e.tier} tier`, `win ${percent(e.winRate)}`, `pick ${percent(e.pickRate)}`, `ban ${percent(e.banRate)}`);
    const weak = (counters[slug]?.all?.weak ?? []).filter((c) => heroesBySlug.has(c.slug)).slice(0, 3);
    if (weak.length) facts.push(`countered by ${list(weak.map((c) => heroesBySlug.get(c.slug)!.name))}`);
    const build = buildText(slug, h.lanes);
    if (build) facts.push(`most played build: ${build}`);
    // The counters page, only where the sitemap lists it (measured counters).
    const page = counters[slug] ? ` [Counters](${link(`/heroes/${slug}/counters`)}).` : "";
    return `- [${h.name}](${link(`/heroes/${slug}`)}): ${facts.join(" · ")}.${page}`;
  };
  return [
    ...rankingFull.map((e) => line(e.hero.slug, e)),
    ...[...allHeroes]
      .filter((h) => !ranked.has(h.slug))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((h) => line(h.slug, null)),
  ];
}

/** The full file, `/llms-full.txt`: the index's description, then the figures. */
export function llmsFull(): string {
  const leaders = (f: FilterTier) => {
    const top = filterRanking(rankingFull, f).slice(0, 5);
    return `- [${nameFilter(f)}](${link(pathFilter(f))}): ${top.length ? list(top.map(entryText)) : "not measured yet"}.`;
  };
  const patch = patchCurrent;
  const changes = patch
    ? (() => {
        const { buffs, nerfs, others } = countAdjustments(patch.adjustments);
        const byType = (type: string) =>
          [...new Set(patch.adjustments.filter((a) => (a.type ?? "other") === type).map((a) => heroesBySlug.get(a.slug)?.name ?? a.name))];
        const row = (label: string, names: string[]) => (names.length ? `- ${label}: ${list(names)}.` : null);
        return [
          `Patch ${patch.version}${patch.date ? ` (${patch.date})` : ""}: ${buffs} buffs, ${nerfs} nerfs, ${others} other adjustments. [Full notes](${link(`/patch-notes/${patch.version}`)}).`,
          "",
          ...[row("Buffed", byType("buff")), row("Nerfed", byType("nerf")), row("Adjusted", byType("adjust")), row("Other", byType("other"))].filter(Boolean),
        ].join("\n");
      })()
    : "No patch data.";

  return `# ${site.name}: full data

> Every Mobile Legends: Bang Bang hero's tier, win, pick and ban rates, best counters and most played build, all ranks combined, as measured ${dateData ?? "(not yet measured)"} on patch ${patch?.version ?? "unknown"}. The site index, with every section, is [llms.txt](${site.url}/llms.txt).

${freshness()}

## Tier list leaders, all ranks

The full ranking is on the [tier list](${link("/tier-list")}). Tiers go S+, S, A, B, C, from a score of win rate and ban rate (pick rate only flags small samples): [how it is computed](${link("/methodology")}).

### By lane

${FILTERS_LANE.map(leaders).join("\n")}

### By role

${FILTERS_ROLE.map(leaders).join("\n")}

## Current patch

${changes}

## Heroes

One line per hero, strongest first: roles and lanes, tier, rates, the three heroes that counter it best and its most played build (all ranks, main lane). Each hero page has the same figures rank by rank.

${heroLines().join("\n")}
`;
}

import { counters, allHeroes } from "@/lib/data";
import { ranksByPair } from "@/lib/pairs";
import { site } from "@/lib/site";
import { measure } from "@/lib/tier-list";
import { LOCALES } from "@/i18n/config";

/**
 * /llms.txt: site overview for language models, in the recommended
 * format (https://llmstxt.org) — an H1 title, a quoted summary, then
 * link sections. In English, the common language of bots; the other
 * languages are mentioned once.
 */
export const dynamic = "force-static";

const link = (path: string) => `${site.url}/en${path}`;

/** "English, French, Italian, Spanish and Indonesian", from the locale list. */
const languageNames = new Intl.ListFormat("en", { type: "conjunction" }).format(
  LOCALES.map((l) => new Intl.DisplayNames(["en"], { type: "language" }).of(l) ?? l),
);
const prefixes = new Intl.ListFormat("en", { type: "conjunction" }).format(LOCALES.map((l) => `/${l}`));
const count = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][LOCALES.length] ?? String(LOCALES.length);

export function GET() {
  const date = measure ? measure.slice(0, 10) : null;
  // Sample duel taken from those in the sitemap (measured at two ranks at least):
  // a hard-coded pair can drop out of the measurements and return a 404.
  const duel = [...ranksByPair(counters, (s) => allHeroes.some((h) => h.slug === s))].find(([, n]) => n >= 2)?.[0];
  const text = `# ${site.name}

> Mobile Legends: Bang Bang knowledge base: all ${allHeroes.length} heroes with builds, counters, teammates and win, pick and ban rates measured by rank, tier lists by rank, lane and role, items, emblems, battle spells, skins, lore and patch notes. Available in ${languageNames}.

Statistics come from ranked games aggregated by the community API arena.rone.dev${date ? ` (last measurement: ${date})` : ""}; hero, item and patch data from the Mobile Legends community wiki. Pages are refreshed by a daily data sync. Each page exists in ${count} languages under ${prefixes}.

## Heroes

- [All heroes](${link("/heroes")}): roles, lanes, tiers and win rates.
- [Hero page](${link("/heroes/aamon")}): builds and emblems by rank, skills, counters, teammates, 30-day trends, win rate by game length and patch history. Same pattern for every hero: /en/heroes/{slug}.
- [Counters](${link("/heroes/aamon/counters")}): who beats a hero, by rank, and how to counter it. Pattern: /en/heroes/{slug}/counters.
- [Best duos](${link("/heroes/aamon/duos")}): teammates that raise a hero's win rate. Pattern: /en/heroes/{slug}/duos.
- [Head-to-head](${link(duel ? `/compare/${duel}` : "/compare")}): matchup statistics for two heroes. Pattern: /en/compare/{a}-vs-{b}, slugs in alphabetical order.
- [Statistics](${link("/statistics")}): sortable win, pick and ban rates for every hero and rank.

## Tier lists

- [Tier list](${link("/tier-list")}): all ranks; per rank at /en/tier-list/{epic|legend|mythic|honor|glory}.
- [By lane](${link("/tier-list/lane/jungle")}) and [by role](${link("/tier-list/role/marksman")}).
- [Weekly meta report](${link("/meta")}): risers, fallers, bans and picks.

## Game data

- [Items](${link("/items")}): stats, recipes and the heroes that build each item.
- [Emblems](${link("/emblems")}) and [battle spells](${link("/spells")}).
- [Skins](${link("/skins")}), [skin calendar](${link("/skins/calendar")}) and [lore](${link("/lore")}).
- [Patch notes](${link("/patch-notes")}): hero buffs, nerfs and adjustments per patch.
- [Rank system](${link("/ranks")}) and [game modes](${link("/game-modes")}).

## Tools

- [Draft assistant](${link("/draft")}), [hero comparison](${link("/compare")}) and [team analyzer](${link("/tools/team")}).
- [Win-rate calculator](${link("/tools/win-rate")}), [server time](${link("/tools/server-time")}) and [tier list maker](${link("/tools/tier-list-maker")}).

## API

- [Public API documentation](${link("/api-doc")}): read-only JSON endpoints for heroes, rankings and counters.

## Optional

- [About](${link("/about")}): sources, methodology and what the site does not contain.
- [Sitemap](${site.url}/sitemap.xml)
`;
  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

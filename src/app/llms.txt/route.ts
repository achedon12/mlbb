import { counters, allHeroes } from "@/lib/data";
import { ranksByPair } from "@/lib/pairs";
import { site } from "@/lib/site";
import { measure } from "@/lib/tier-list";

/**
 * /llms.txt : presentation du site pour les modeles de langage, au format
 * recommande (https://llmstxt.org) — un titre H1, un resume en citation, puis
 * des sections de liens. En anglais, langue commune des robots ; les autres
 * langues sont signalees une fois.
 */
export const dynamic = "force-static";

const link = (path: string) => `${site.url}/en${path}`;

export function GET() {
  const date = measure ? measure.slice(0, 10) : null;
  // Exemple de duel pris parmi ceux du sitemap (mesures a deux rangs au moins) :
  // une paire ecrite en dur peut disparaitre des mesures et renvoyer une 404.
  const duel = [...ranksByPair(counters, (s) => allHeroes.some((h) => h.slug === s))].find(([, n]) => n >= 2)?.[0];
  const text = `# ${site.name}

> Mobile Legends: Bang Bang knowledge base: all ${allHeroes.length} heroes with builds, counters, teammates and win, pick and ban rates measured by rank, tier lists by rank, lane and role, items, emblems, battle spells, skins, lore and patch notes. Available in English, French, Italian and Spanish.

Statistics come from ranked games aggregated by the community API arena.rone.dev${date ? ` (last measurement: ${date})` : ""}; hero, item and patch data from the Mobile Legends community wiki. Pages are refreshed by a daily data sync. Each page exists in four languages under /en, /fr, /it and /es.

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

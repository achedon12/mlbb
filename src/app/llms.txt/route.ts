import { heros } from "@/lib/donnees";
import { site } from "@/lib/site";
import { mesureLe } from "@/lib/tier-list";

/**
 * /llms.txt : presentation du site pour les modeles de langage, au format
 * recommande (https://llmstxt.org) — un titre H1, un resume en citation, puis
 * des sections de liens. En anglais, langue commune des robots ; les autres
 * langues sont signalees une fois.
 */
export const dynamic = "force-static";

const lien = (chemin: string) => `${site.url}/en${chemin}`;

export function GET() {
  const date = mesureLe ? mesureLe.slice(0, 10) : null;
  const texte = `# ${site.nom}

> Mobile Legends: Bang Bang knowledge base: all ${heros.length} heroes with builds, counters, teammates and win, pick and ban rates measured by rank, tier lists by rank, lane and role, items, emblems, battle spells, skins, lore and patch notes. Available in English, French, Italian and Spanish.

Statistics come from ranked games aggregated by the community API arena.rone.dev${date ? ` (last measurement: ${date})` : ""}; hero, item and patch data from the Mobile Legends community wiki. Pages are refreshed by a daily data sync. Each page exists in four languages under /en, /fr, /it and /es.

## Heroes

- [All heroes](${lien("/heroes")}): roles, lanes, tiers and win rates.
- [Hero page](${lien("/heroes/aamon")}): builds and emblems by rank, skills, counters, teammates, 30-day trends, win rate by game length and patch history. Same pattern for every hero: /en/heroes/{slug}.
- [Counters](${lien("/heroes/aamon/counters")}): who beats a hero, by rank, and how to counter it. Pattern: /en/heroes/{slug}/counters.
- [Best duos](${lien("/heroes/aamon/duos")}): teammates that raise a hero's win rate. Pattern: /en/heroes/{slug}/duos.
- [Head-to-head](${lien("/compare/aamon-vs-gloo")}): matchup statistics for two heroes. Pattern: /en/compare/{a}-vs-{b}, slugs in alphabetical order.
- [Statistics](${lien("/statistics")}): sortable win, pick and ban rates for every hero and rank.

## Tier lists

- [Tier list](${lien("/tier-list")}): all ranks; per rank at /en/tier-list/{epic|legend|mythic|honor|glory}.
- [By lane](${lien("/tier-list/lane/jungle")}) and [by role](${lien("/tier-list/role/marksman")}).
- [Weekly meta report](${lien("/meta")}): risers, fallers, bans and picks.

## Game data

- [Items](${lien("/items")}): stats, recipes and the heroes that build each item.
- [Emblems](${lien("/emblems")}) and [battle spells](${lien("/spells")}).
- [Skins](${lien("/skins")}), [skin calendar](${lien("/skins/calendar")}) and [lore](${lien("/lore")}).
- [Patch notes](${lien("/patch-notes")}): hero buffs, nerfs and adjustments per patch.
- [Rank system](${lien("/ranks")}) and [game modes](${lien("/game-modes")}).

## Tools

- [Draft assistant](${lien("/draft")}), [hero comparison](${lien("/compare")}) and [team analyzer](${lien("/tools/team")}).
- [Win-rate calculator](${lien("/tools/win-rate")}), [server time](${lien("/tools/server-time")}) and [tier list maker](${lien("/tools/tier-list-maker")}).

## API

- [Public API documentation](${lien("/api-doc")}): read-only JSON endpoints for heroes, rankings and counters.

## Optional

- [About](${lien("/about")}): sources, methodology and what the site does not contain.
- [Sitemap](${site.url}/sitemap.xml)
`;
  return new Response(texte, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

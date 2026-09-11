import eventsData from "@/data/jeu/events.json";
import { catalogueSkins, dateReference, skinsSortis } from "./catalogue-skins-serveur";
import { herosParSlug } from "./donnees";
import { buildMonths, isMonth, monthOfRelease, type EventMonth, type EventSkin, type ListEntry } from "./events";
import { ancresGalerie, galerieHeros } from "./skins-heros";
import { normaliserNomSkin } from "./utils";

/**
 * Events calendar, server side: the wiki's monthly lists (`scripts/events.mjs`)
 * resolved against the skin catalogue, then completed with the other skins
 * released that month.
 */

type WikiList = "starlight" | "collector";

interface RawEntry {
  month: string;
  none?: boolean;
  heroName?: string;
  skin?: string;
  id?: string | null;
  hero?: string | null;
}

export interface ListSource {
  title: string;
  url: string;
  revision: number;
  /** Last edit of the page on the wiki, ISO. */
  modified: string;
}

interface EventsFile {
  updated: string;
  sources: Record<WikiList, ListSource>;
  starlight: RawEntry[];
  collector: RawEntry[];
}

const data = eventsData as unknown as EventsFile;

export const eventSources = data.sources;
/** Data date: "this month" and "released" are judged against it, not against the build date. */
export const referenceDate = dateReference;

/** Label the series carries in the catalogue, for a skin only the list knows. */
const SERIES: Record<WikiList, string> = { starlight: "StarLight", collector: "Collector" };

/**
 * Skin of a list entry: the catalogue's (by id, else by name), with the
 * list's month; otherwise the lone illustration from the hero's gallery,
 * without rarity or price, which the catalogue does not have yet.
 */
function resolve(e: RawEntry, list: WikiList): EventSkin | null {
  if (!e.hero || !e.skin) return null;
  const hero = herosParSlug.get(e.hero);
  if (!hero) return null;
  const name = normaliserNomSkin(e.skin);
  const known = catalogueSkins().skins.find(
    (s) => s.heros === e.hero && ((e.id && s.id === e.id) || normaliserNomSkin(s.nom) === name),
  );
  if (known) {
    return {
      ...known,
      serie: known.serie ?? SERIES[list],
      sortie: monthOfRelease(known.sortie) === e.month ? known.sortie : e.month,
      // "2025/XX StarLight Member": the module did not know the month yet, the list does.
      obtention: /\/XX\b/i.test(known.obtention ?? "") ? null : known.obtention,
    };
  }
  const gallery = galerieHeros(hero);
  const i = gallery.autres.findIndex((a) => normaliserNomSkin(a.nom) === name);
  return {
    id: e.id ?? "",
    nom: e.skin,
    heros: e.hero,
    rarete: 0,
    serie: SERIES[list],
    sortie: e.month,
    dispo: null,
    prix: {},
    obtention: null,
    image: i >= 0 ? gallery.autres[i].illustration : null,
    ancre: i >= 0 ? ancresGalerie(gallery)[gallery.skins.length + i] : "",
    notInCatalogue: true,
  };
}

let cache: EventMonth[] | null = null;

/** Months with at least one skin, newest first; an upcoming month is only there when a list announces it. */
export function eventMonths(): EventMonth[] {
  if (cache) return cache;
  const lists: ListEntry[] = [];
  for (const list of ["starlight", "collector"] as const) {
    for (const e of data[list]) {
      const skin = e.none ? null : resolve(e, list);
      if (skin) lists.push({ mode: list, month: e.month, skin });
    }
  }
  cache = buildMonths({
    released: skinsSortis(),
    lists,
    noCollector: data.collector.filter((e) => e.none).map((e) => e.month),
  });
  return cache;
}

/** Keys of the months that have a page, newest first: "2026-08". For the sitemap too. */
export const monthKeys = () => eventMonths().map((m) => m.month);

export function monthByKey(key: string): EventMonth | null {
  return isMonth(key) ? (eventMonths().find((m) => m.month === key) ?? null) : null;
}

/** Sources to cite for a month: the lists that say something about it, "no Collector" included. */
export function sourcesForMonth(month: string): ListSource[] {
  return (["starlight", "collector"] as const)
    .filter((l) => data[l].some((e) => e.month === month))
    .map((l) => eventSources[l]);
}

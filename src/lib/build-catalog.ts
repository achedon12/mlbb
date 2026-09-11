import herosGenere from "@/data/jeu/heros.json";
import visuels from "@/data/jeu/visuels.json";
import { emblemes } from "@/data/emblemes";
import { EMBLEM_SETS, TALENT_FIGURES } from "@/data/emblem-attributes";
import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { CodeCatalog } from "./build-code";
import {
  namesFrom,
  prepareEmblem,
  prepareHero,
  prepareItem,
  prepareTalent,
  type BuildNames,
  type MeasuredCore,
  type SimCatalog,
  type SimulatorData,
} from "./build-simulator";
import { buildsJoues, heros, objets } from "./donnees";
import { imageTalent, nomTalent, sortsFiches, texteChoix } from "./fiches-usage";
import { RANGS_MESURE } from "./rangs-mesure";
import type { HerosGenere } from "./types";
import { visuelObjet } from "./visuels-build";

/**
 * Simulator catalog, prepared once on the server: the page hands it to the
 * browser, the community build routes validate every slug against it, and
 * their pages compute stats with it.
 *
 * Offered items: the ones that can be bought. Floryn's items have no price
 * (the hero gives them away) and potions are two-minute consumables - their
 * text says so ("one potion effect at a time").
 */

const V = visuels as unknown as Record<"objets" | "emblemes", Record<string, string>>;

const isPurchasable = (o: { prix: number | null; passif: string | null }) =>
  o.prix !== null && !/one potion effect/i.test(o.passif ?? "");

const englishItems = objets("en").filter(isPurchasable);

export const simCatalog: SimCatalog = {
  heroes: new Map((herosGenere as unknown as HerosGenere[]).map((h) => [h.slug, prepareHero(h)])),
  items: new Map(englishItems.map((o) => [o.slug, prepareItem(o)])),
  emblems: new Map(EMBLEM_SETS.map((e) => [e.key, prepareEmblem(e.key, e.attributes)])),
  talents: new Map(TALENT_FIGURES.map((t) => [t.key, prepareTalent(t)])),
};

const tier = (n: 0 | 1 | 2) => new Set(TALENT_FIGURES.filter((t) => t.tier === n).map((t) => t.key));

export const codeCatalog: CodeCatalog = {
  heroes: new Set(simCatalog.heroes.keys()),
  items: new Set(simCatalog.items.keys()),
  emblems: new Set(simCatalog.emblems.keys()),
  tiers: [tier(0), tier(1), tier(2)],
  spells: new Set(sortsFiches.map((s) => s.slug)),
};

// -- Names and images, per language -----------------------------------------

/** "tank" to its record in `src/data/emblemes.ts`, which carries the image and the translated name. */
const emblemRecord = (key: string) => emblemes.find((e) => e.cle === `${key}-emblem`);

export function emblemName(t: T, key: string): string {
  const record = emblemRecord(key);
  return record ? texteChoix(t, record.cle, "nom", record.nom)! : t("pages.buildSimulator.commonEmblem");
}

export function emblemImage(key: string): string | null {
  const record = emblemRecord(key);
  return record ? (V.emblemes[record.cle] ?? null) : null;
}

export function spellName(t: T, key: string): string {
  const s = sortsFiches.find((x) => x.slug === key);
  return texteChoix(t, key, "nom", s?.nom ?? key)!;
}

export const spellImage = (key: string): string | null => sortsFiches.find((x) => x.slug === key)?.image ?? null;
export const itemImage = (slug: string): string | null => V.objets[slug] ?? null;
export const talentName = nomTalent;
export const talentImage = imageTalent;

export function simulatorData(locale: Langue, t: T): SimulatorData {
  const translated = new Map(objets(locale).map((o) => [o.slug, o]));
  return {
    heroes: heros
      .filter((h) => simCatalog.heroes.has(h.slug))
      .map((h) => ({
        slug: h.slug,
        name: h.nom,
        lanes: h.lanes,
        roles: h.roles,
        icon: h.visuels.icone,
        sim: simCatalog.heroes.get(h.slug)!,
      })),
    items: [...simCatalog.items.values()].map((o) => {
      const tr = translated.get(o.slug);
      const text = [tr?.bonus, tr?.unique].filter((x) => x && x !== "None").join(", ");
      return { ...o, name: tr?.nom ?? o.name, image: itemImage(o.slug), text: text || null };
    }),
    categories: [...new Set(englishItems.map((o) => o.categorie))],
    emblems: [...simCatalog.emblems.values()].map((e) => ({ ...e, name: emblemName(t, e.key), image: emblemImage(e.key) })),
    talents: [...simCatalog.talents.values()].map((tl) => ({ ...tl, name: nomTalent(t, tl.key), image: imageTalent(tl.key) })),
    spells: sortsFiches.map((s) => ({ key: s.slug, name: spellName(t, s.slug), image: s.image })),
  };
}

/** Display names of the whole catalog, for pages that show builds without the simulator. */
export function buildNames(locale: Langue, t: T): BuildNames {
  const translated = new Map(objets(locale).map((o) => [o.slug, o.nom]));
  return namesFrom({
    items: [...simCatalog.items.values()].map((o) => ({ slug: o.slug, name: translated.get(o.slug) ?? o.name })),
    emblems: [...simCatalog.emblems.keys()].map((key) => ({ key, name: emblemName(t, key) })),
    talents: [...simCatalog.talents.keys()].map((key) => ({ key, name: nomTalent(t, key) })),
  });
}

// -- Measured builds --------------------------------------------------------

/**
 * Cores actually played by a hero, every lane and rank, items as slugs. An
 * item name the catalog does not know is dropped: the core stays comparable
 * on what is left of it.
 */
export function measuredCores(slug: string): MeasuredCore[] {
  const byLane = buildsJoues[slug] ?? {};
  return Object.entries(byLane).flatMap(([lane, byRank]) =>
    RANGS_MESURE.flatMap((rank) =>
      (byRank[rank] ?? []).map((b) => ({
        lane,
        rank,
        items: b.objets.flatMap((name) => visuelObjet(name).slug ?? []),
        winRate: b.victoire,
        pickRate: b.selection,
      })),
    ),
  );
}

import visuels from "@/data/jeu/visuels.json";
import { emblemes, slugEmbleme, sortsDeCombat } from "@/data/emblemes";
import type { BuildResolu, GuideResolu, ObjetResolu, VisuelResolu } from "@/components/builds-par-rang";
import { objets, type BuildJoue, type GuideJoueur } from "./donnees";
import { cleRecherche } from "./utils";
import { rangLisible } from "./rangs";

/**
 * Visuels des choix d'un build : objets, embleme, talents et sort.
 *
 * Les images sont rangees sous le nom anglais du jeu, passe en slug.
 */
const V = visuels as unknown as Record<"items" | "emblems" | "talents" | "spells", Record<string, string>>;

const cle = (nom: string) =>
  cleRecherche(nom).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Graphies divergentes d'un meme talent. Les builds rediges emploient les noms
 * anglais du jeu, comme l'API : pas de traduction a tenir.
 */
const ALIAS: Record<string, string> = {
  // L'API ecrit « Weapons Master », le wiki « Weapon Master ».
  "weapons-master": "weapon-master",
  execution: "execute",
  inspiration: "inspire",
};

/**
 * Cle unique d'un talent ou d'un sort, graphies divergentes rapprochees : celle
 * des textes (`emblemesData`) et des pages de sorts.
 */
export function cleChoix(nom: string): string {
  const k = cle(nom);
  return ALIAS[k] ?? k;
}

function resoudre(table: Record<string, string>, nom: string): VisuelResolu {
  const k = cle(nom);
  return { nom, image: table[k] ?? table[ALIAS[k]] ?? null };
}

export const visuelTalent = (nom: string) => resoudre(V.talents, nom);
/**
 * Un sort mene a sa page quand elle existe : sorts decrits a la main et sorts
 * que les builds joues citent avec un visuel (voir `sortsFiches`, src/lib/fiches-usage.ts).
 */
export function visuelSort(nom: string): VisuelResolu {
  const visuel = resoudre(V.spells, nom);
  const k = cleChoix(nom);
  return sortsDeCombat.some((s) => s.key === k) || V.spells[k] ? { ...visuel, href: `/spells/${k}` } : visuel;
}

/** L'API nomme l'embleme par son role (« Marksman »), les builds rediges en toutes lettres. */
export function visuelEmbleme(nom: string): VisuelResolu {
  const e = emblemes.find((x) => x.name === nom || x.role === nom);
  return e ? { nom, image: V.emblems[e.key] ?? null, href: `/emblems/${slugEmbleme(e)}` } : { nom, image: null };
}

const OBJETS_PAR_NOM = new Map(objets("en").map((o) => [o.name, o]));

export function visuelObjet(nom: string): ObjetResolu {
  // Les bottes portent parfois leur enchantement (« Swift Boots - Encourage ») :
  // le visuel est celui des bottes.
  const o = OBJETS_PAR_NOM.get(nom) ?? OBJETS_PAR_NOM.get(nom.split(" - ")[0]);
  return { nom, slug: o?.slug ?? null, image: o ? (V.items[o.slug] ?? null) : null };
}

export function resoudreBuild(b: BuildJoue): BuildResolu {
  return {
    objets: b.items.map(visuelObjet),
    embleme: b.emblem ? visuelEmbleme(b.emblem) : null,
    talents: b.talents.map(visuelTalent),
    sort: b.spell ? visuelSort(b.spell) : null,
    victoire: b.winRate,
    selection: b.pickRate,
  };
}

export function resoudreGuide(g: GuideJoueur): GuideResolu {
  const rang = g.authorRank > 0 ? rangLisible(g.authorRank) : null;
  return {
    objets: g.items.map(visuelObjet),
    embleme: g.emblem ? visuelEmbleme(g.emblem) : null,
    talents: g.talents.map(visuelTalent),
    sort: g.spell ? visuelSort(g.spell) : null,
    auteur: rang ? { cle: rang.cle, division: rang.division } : null,
    votes: g.votes,
  };
}

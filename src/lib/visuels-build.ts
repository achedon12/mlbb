import visuels from "@/data/jeu/visuels.json";
import { emblemes } from "@/data/emblemes";
import type { BuildResolu, GuideResolu, ObjetResolu, VisuelResolu } from "@/components/builds-par-rang";
import { objets, type BuildJoue, type GuideJoueur } from "./donnees";
import { rangLisible } from "./rangs";

/**
 * Visuels des choix d'un build : objets, embleme, talents et sort.
 *
 * Les images sont rangees sous le nom anglais du jeu, passe en slug. Deux
 * sources nomment ces choix : l'API, en anglais, et les builds rediges, en
 * francais — d'ou une table de passage pour ces derniers.
 */
const V = visuels as unknown as Record<"objets" | "emblemes" | "talents" | "sorts", Record<string, string>>;

const cle = (nom: string) =>
  nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Noms des builds rediges vers la cle du visuel. Recoupes avec les builds
 * reellement joues : les tanks prennent Concussive Blast, les mages Lethal
 * Ignition, les soutiens Focusing Mark.
 */
const ALIAS: Record<string, string> = {
  chasseur: "seasoned-hunter",
  sauveur: "focusing-mark",
  choc: "concussive-blast",
  "feu-magique": "lethal-ignition",
  festin: "festival-of-blood",
  // L'API ecrit « Weapons Master », le wiki « Weapon Master ».
  "weapons-master": "weapon-master",
  execution: "execute",
  inspiration: "inspire",
};

function resoudre(table: Record<string, string>, nom: string): VisuelResolu {
  const k = cle(nom);
  return { nom, image: table[k] ?? table[ALIAS[k]] ?? null };
}

export const visuelTalent = (nom: string) => resoudre(V.talents, nom);
export const visuelSort = (nom: string) => resoudre(V.sorts, nom);

/** L'API nomme l'embleme par son role (« Marksman »), les builds rediges en toutes lettres. */
export function visuelEmbleme(nom: string): VisuelResolu {
  const e = emblemes.find((x) => x.nom === nom || x.role === nom);
  return { nom, image: e ? (V.emblemes[e.cle] ?? null) : null };
}

const OBJETS_PAR_NOM = new Map(objets("en").map((o) => [o.nom, o]));

export function visuelObjet(nom: string): ObjetResolu {
  // Les bottes portent parfois leur enchantement (« Swift Boots - Encourage ») :
  // le visuel est celui des bottes.
  const o = OBJETS_PAR_NOM.get(nom) ?? OBJETS_PAR_NOM.get(nom.split(" - ")[0]);
  return { nom, slug: o?.slug ?? null, image: o ? (V.objets[o.slug] ?? null) : null };
}

export function resoudreBuild(b: BuildJoue): BuildResolu {
  return {
    objets: b.objets.map(visuelObjet),
    embleme: b.embleme ? visuelEmbleme(b.embleme) : null,
    talents: b.talents.map(visuelTalent),
    sort: b.sort ? visuelSort(b.sort) : null,
    victoire: b.victoire,
    selection: b.selection,
  };
}

export function resoudreGuide(g: GuideJoueur): GuideResolu {
  const rang = g.rangAuteur > 0 ? rangLisible(g.rangAuteur) : null;
  return {
    objets: g.objets.map(visuelObjet),
    embleme: g.embleme ? visuelEmbleme(g.embleme) : null,
    talents: g.talents.map(visuelTalent),
    sort: g.sort ? visuelSort(g.sort) : null,
    auteur: rang ? { cle: rang.cle, division: rang.division } : null,
    votes: g.votes,
  };
}

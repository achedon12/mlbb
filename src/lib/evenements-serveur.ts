import evenementsGenere from "@/data/jeu/evenements.json";
import { catalogueSkins, dateReference, skinsSortis } from "./catalogue-skins-serveur";
import { herosParSlug } from "./donnees";
import {
  assemblerMois,
  estMois,
  moisDeSortie,
  type EntreeListe,
  type MoisEvenements,
  type SkinEvenement,
} from "./evenements";
import { ancresGalerie, galerieHeros } from "./skins-heros";
import { normaliserNomSkin } from "./utils";

/**
 * Calendrier des evenements cote serveur : les listes mensuelles du wiki
 * (`scripts/evenements.mjs`) rattachees au catalogue des skins, puis
 * completees par les autres sorties datees du mois.
 */

type ListeWiki = "starlight" | "collector";

interface EntreeBrute {
  mois: string;
  aucun?: boolean;
  nomHeros?: string;
  skin?: string;
  id?: string | null;
  heros?: string | null;
}

export interface SourceListe {
  titre: string;
  url: string;
  revision: number;
  /** Derniere modification de la page sur le wiki, ISO. */
  modifie: string;
}

interface FichierEvenements {
  maj: string;
  sources: Record<ListeWiki, SourceListe>;
  starlight: EntreeBrute[];
  collector: EntreeBrute[];
}

const donnees = evenementsGenere as unknown as FichierEvenements;

export const sourcesEvenements = donnees.sources;
export { dateReference };

/** Etiquette que porte la serie dans le catalogue, pour un skin que seule la liste connait. */
const SERIE: Record<ListeWiki, string> = { starlight: "StarLight", collector: "Collector" };

/**
 * Skin d'une entree de liste : celui du catalogue (par identifiant, a defaut
 * par nom), avec le mois de la liste ; sinon l'illustration seule de la
 * galerie du heros, sans rarete ni prix, que le catalogue n'a pas encore.
 */
function resoudre(e: EntreeBrute, liste: ListeWiki): SkinEvenement | null {
  if (!e.heros || !e.skin) return null;
  const h = herosParSlug.get(e.heros);
  if (!h) return null;
  const nom = normaliserNomSkin(e.skin);
  const connu = catalogueSkins().skins.find(
    (s) => s.heros === e.heros && ((e.id && s.id === e.id) || normaliserNomSkin(s.nom) === nom),
  );
  if (connu) {
    return {
      ...connu,
      serie: connu.serie ?? SERIE[liste],
      sortie: moisDeSortie(connu.sortie) === e.mois ? connu.sortie : e.mois,
    };
  }
  const g = galerieHeros(h);
  const i = g.autres.findIndex((a) => normaliserNomSkin(a.nom) === nom);
  return {
    id: e.id ?? "",
    nom: e.skin,
    heros: e.heros,
    rarete: 0,
    serie: SERIE[liste],
    sortie: e.mois,
    dispo: null,
    prix: {},
    obtention: null,
    image: i >= 0 ? g.autres[i].illustration : null,
    ancre: i >= 0 ? ancresGalerie(g)[g.skins.length + i] : "",
    horsCatalogue: true,
  };
}

let cache: MoisEvenements[] | null = null;

/** Mois qui ont au moins un skin, du plus recent au plus ancien ; un mois a venir n'y est que si une liste l'annonce. */
export function moisEvenements(): MoisEvenements[] {
  if (cache) return cache;
  const listes: EntreeListe[] = [];
  for (const liste of ["starlight", "collector"] as const) {
    for (const e of donnees[liste]) {
      const skin = e.aucun ? null : resoudre(e, liste);
      if (skin) listes.push({ mode: liste, mois: e.mois, skin });
    }
  }
  cache = assemblerMois({
    sortis: skinsSortis(),
    listes,
    sansCollector: donnees.collector.filter((e) => e.aucun).map((e) => e.mois),
  });
  return cache;
}

/** Cles des mois qui ont une page, du plus recent au plus ancien : « 2026-08 ». */
export const clesMois = () => moisEvenements().map((m) => m.mois);

export function moisDe(cle: string): MoisEvenements | null {
  return estMois(cle) ? (moisEvenements().find((m) => m.mois === cle) ?? null) : null;
}

/** Sources a citer pour un mois : les listes qui en disent quelque chose, « aucun Collector » compris. */
export function sourcesDuMois(mois: string): SourceListe[] {
  return (["starlight", "collector"] as const)
    .filter((l) => donnees[l].some((e) => e.mois === mois))
    .map((l) => sourcesEvenements[l]);
}

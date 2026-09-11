import type { Langue } from "@/i18n/config";
import { LOCALE_HTML } from "@/i18n/config";
import { heros, synchro } from "./donnees";
import { RARETES } from "./raretes";
import { site } from "./site";
import { galerieHeros } from "./skins-heros";
import {
  DISPOS,
  MONNAIES_CHIFFREES,
  ancresDe,
  estOrigine,
  estSorti,
  lireSortie,
  type Catalogue,
  type Dispo,
  type Prix,
  type SkinCatalogue,
} from "./catalogue-skins";

/**
 * Catalogue des skins cote serveur : jointure du module de skins du wiki et
 * des portraits de boutique, en objets `SkinCatalogue`. Les pages du
 * calendrier le lisent directement ; l'index compact en est l'encodage.
 */

/** Date des donnees : « ce mois-ci » et « sorti » se jugent a cette date, pas a celle du build. */
export const dateReference = synchro.date.slice(0, 10);

/** Retire les liens du wiki : « [[MLBB × Naruto|MLBB X Naruto]] » garde son libelle. */
export function nettoyerObtention(texte: string | undefined): string | null {
  if (!texte) return null;
  const propre = texte
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return propre || null;
}

/** Prix chiffres ; une valeur illisible est ignoree plutot que comptee pour zero. */
export function lirePrix(brut: Record<string, string>): Prix {
  const prix: Prix = {};
  for (const m of MONNAIES_CHIFFREES) {
    const n = Number(brut[m]);
    if (brut[m] && Number.isFinite(n) && n > 0) prix[m] = n;
  }
  return prix;
}

/**
 * Le wiki ecrit parfois la meme serie avec deux casses (« Annual StarLight »,
 * « Annual Starlight ») : elles se rangent sous la graphie la plus courante.
 */
function graphiesSeries(valeurs: (string | null)[]): Map<string, string> {
  const comptes = new Map<string, Map<string, number>>();
  for (const v of valeurs) {
    if (!v) continue;
    const cle = v.toLowerCase();
    const graphies = comptes.get(cle) ?? new Map<string, number>();
    graphies.set(v, (graphies.get(v) ?? 0) + 1);
    comptes.set(cle, graphies);
  }
  return new Map(
    [...comptes].map(([cle, graphies]) => [cle, [...graphies].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]),
  );
}

let cache: Catalogue | null = null;

export function catalogueSkins(): Catalogue {
  if (cache) return cache;
  // Un heros sans aucun skin recense (annonce, pas encore sorti) ne peut pas etre possede.
  const avecSkins = heros.filter((h) => h.skins.length > 0);
  const series = graphiesSeries(avecSkins.flatMap((h) => h.skins.map((s) => s.etiquette)));
  const skins: SkinCatalogue[] = avecSkins.flatMap((h) => {
    const galerie = galerieHeros(h).skins;
    const ancres = ancresDe(galerie.map((s) => s.nom));
    return galerie.map((s, i) => ({
      id: s.id,
      nom: s.nom,
      heros: h.slug,
      // Une rarete inconnue compte comme la plus commune plutot que de passer pour un skin d'origine.
      rarete: s.rarete ? (RARETES[s.rarete]?.rang ?? 1) : 0,
      serie: s.etiquette ? (series.get(s.etiquette.toLowerCase()) ?? s.etiquette) : null,
      sortie: s.sortie,
      dispo: (DISPOS as readonly string[]).includes(s.disponibilite ?? "") ? (s.disponibilite as Dispo) : null,
      prix: lirePrix(s.prix),
      obtention: nettoyerObtention(s.prix.other),
      image: s.portrait ?? s.illustration,
      ancre: ancres[i],
    }));
  });
  cache = {
    maj: dateReference,
    heros: avecSkins.map((h) => ({ slug: h.slug, nom: h.nom, roles: h.roles, icone: h.visuels.icone ?? h.visuels.portrait })),
    skins,
  };
  return cache;
}

/** Skins du calendrier : sortis a la date des donnees, sans les skins d'origine (ce sont des sorties de heros). */
export function skinsSortis(): SkinCatalogue[] {
  return catalogueSkins().skins.filter((s) => !estOrigine(s) && estSorti(s, dateReference));
}

/** Annees qui ont au moins un skin sorti, de la plus recente a la plus ancienne. */
export function anneesCalendrier(): number[] {
  return [...new Set(skinsSortis().map((s) => lireSortie(s.sortie)!.annee))].sort((a, b) => b - a);
}

/** Heros indexes par slug, pour les filtres et les liens. */
export function herosDuCatalogue() {
  return new Map(catalogueSkins().heros.map((h) => [h.slug, h]));
}

/**
 * Donnees structurees d'une page qui liste des skins ou des pages de skins :
 * la page, sa date de mise a jour et sa liste ordonnee.
 */
export function donneesListeSkins(
  locale: Langue,
  o: { nom: string; description: string; chemin: string; elements: { nom: string; chemin: string }[] },
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: o.nom,
    description: o.description,
    url: `${site.url}/${locale}${o.chemin}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateReference,
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    mainEntity: {
      "@type": "ItemList",
      name: o.nom,
      numberOfItems: o.elements.length,
      itemListElement: o.elements.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.nom,
        url: `${site.url}/${locale}${e.chemin}`,
      })),
    },
  };
}

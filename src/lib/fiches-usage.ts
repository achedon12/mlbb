import { emblemes, slugEmbleme, sortsDeCombat, type Embleme } from "@/data/emblemes";
import visuels from "@/data/jeu/visuels.json";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { buildsJoues, type BuildJoue } from "./donnees";
import { dateMesure } from "./fraicheur";
import { RANGS_MESURE, type RangMesure } from "./rangs-mesure";
import { site } from "./site";
import {
  partsParChoix,
  resumeParRang,
  usageParChoix,
  type Extraire,
  type PartChoix,
  type ResumeRang,
  type UsageHeros,
} from "./usage-builds";
import { cleChoix, visuelObjet } from "./visuels-build";

/**
 * Donnees des pages d'objet, d'embleme et de sort : qui prend quoi, d'apres
 * les builds reellement joues (`buildsJoues`), et les listes qui fixent leurs
 * adresses. Calculs faits une fois par type et par rang, au build.
 */

const V = visuels as unknown as Record<"items" | "emblems" | "talents" | "spells", Record<string, string>>;

export const emblemesFiches = emblemes.map((e) => ({
  slug: slugEmbleme(e),
  embleme: e,
  image: V.emblems[e.key] ?? null,
}));

/** L'API nomme l'embleme par son role (« Marksman ») ; « All », l'embleme commun, n'a pas de fiche. */
function emblemeDuBuild(nom: string | null): Embleme | undefined {
  return nom ? emblemes.find((e) => e.role === nom || e.name === nom) : undefined;
}

/** Toutes les graphies vues dans les builds joues, par cle : le repli des noms sans traduction. */
const nomsJoues = new Map<string, string>();
for (const parLane of Object.values(buildsJoues)) {
  for (const parRang of Object.values(parLane)) {
    for (const liste of Object.values(parRang)) {
      for (const b of liste ?? []) {
        if (b.spell) nomsJoues.set(cleChoix(b.spell), b.spell);
        for (const talent of b.talents) nomsJoues.set(cleChoix(talent), talent);
      }
    }
  }
}

export interface SortFiche {
  slug: string;
  /** Nom anglais du jeu. */
  nom: string;
  recharge: number | null;
  image: string | null;
}

/** Sorts decrits a la main, completes de ceux que les builds joues citent sans description. */
export const sortsFiches: SortFiche[] = [
  ...new Set([...sortsDeCombat.map((s) => s.key), ...[...nomsJoues.keys()].filter((k) => V.spells[k])]),
]
  .map((slug) => {
    const s = sortsDeCombat.find((x) => x.key === slug);
    return { slug, nom: s?.name ?? nomsJoues.get(slug) ?? slug, recharge: s?.cooldown ?? null, image: V.spells[slug] ?? null };
  })
  .sort((a, b) => a.nom.localeCompare(b.nom));

export type TypeChoix = "objet" | "embleme" | "sort";

const EXTRAIRE: Record<TypeChoix, Extraire> = {
  objet: (b) => b.items.flatMap((nom) => visuelObjet(nom).slug ?? []),
  embleme: (b) => {
    const e = emblemeDuBuild(b.emblem);
    return e ? [slugEmbleme(e)] : [];
  },
  sort: (b) => (b.spell ? [cleChoix(b.spell)] : []),
};

const contient = (type: TypeChoix, cle: string) => (b: BuildJoue) => [...EXTRAIRE[type](b)].includes(cle);

const usages = new Map<string, Map<string, UsageHeros[]>>();

/** Heros qui prennent ce choix au rang demande, le plus engage d'abord. */
export function usage(type: TypeChoix, cle: string, rang: RangMesure = "all"): UsageHeros[] {
  const k = `${type}|${rang}`;
  let parChoix = usages.get(k);
  if (!parChoix) {
    parChoix = usageParChoix(buildsJoues, EXTRAIRE[type], rang);
    usages.set(k, parChoix);
  }
  return parChoix.get(cle) ?? [];
}

export function resumeRangs(type: TypeChoix, cle: string): ResumeRang[] {
  return resumeParRang(Object.fromEntries(RANGS_MESURE.map((r) => [r, usage(type, cle, r)])));
}

/** Talents pris avec un embleme, etage par etage (deux attributs, puis le talent decisif). */
export function talentsAvecEmbleme(slug: string): PartChoix[][] {
  return [0, 1, 2].map((etage) =>
    partsParChoix(buildsJoues, contient("embleme", slug), (b) => (b.talents[etage] ? [cleChoix(b.talents[etage])] : [])),
  );
}

/** Repartition d'un autre type de choix parmi les builds qui contiennent celui-ci. */
export function partsAvec(type: TypeChoix, cle: string, autre: TypeChoix): PartChoix[] {
  return partsParChoix(buildsJoues, contient(type, cle), EXTRAIRE[autre]);
}

/** Texte d'un embleme, talent ou sort (`emblemData`), ou le repli fourni. */
export function texteChoix(t: T, cle: string, champ: string, repli: string | null = null): string | null {
  const k = `emblemData.${cle}.${champ}`;
  const v = t(k);
  return v === k ? repli : v;
}

export const nomTalent = (t: T, cle: string) => texteChoix(t, cle, "name", nomsJoues.get(cle) ?? cle)!;
export const imageTalent = (cle: string) => V.talents[cle] ?? null;

const absolue = (chemin: string) => (/^https?:/.test(chemin) ? chemin : `${site.url}${chemin}`);

/**
 * Donnees structurees d'une page d'objet, d'embleme ou de sort : la page, la
 * chose qu'elle decrit, et la liste ordonnee des heros qui la prennent le plus.
 */
export function donneesFiche(
  locale: Langue,
  o: {
    titre: string;
    description: string;
    chemin: string;
    nom: string;
    resume?: string | null;
    image: string | null;
    listeNom: string;
    heros: { nom: string; slug: string }[];
  },
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: o.titre,
    description: o.description,
    url: `${site.url}/${locale}${o.chemin}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateMesure,
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    ...(o.image ? { primaryImageOfPage: { "@type": "ImageObject", url: absolue(o.image) } } : {}),
    about: {
      "@type": "Thing",
      name: o.nom,
      ...(o.resume ? { description: o.resume } : {}),
      ...(o.image ? { image: absolue(o.image) } : {}),
    },
    ...(o.heros.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            name: o.listeNom,
            numberOfItems: o.heros.length,
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            itemListElement: o.heros.map((h, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: h.nom,
              url: `${site.url}/${locale}/heroes/${h.slug}`,
            })),
          },
        }
      : {}),
  };
}

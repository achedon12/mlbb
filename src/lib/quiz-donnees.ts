import visuelsGenere from "@/data/jeu/visuels.json";
import type { Langue } from "@/i18n/config";
import { libelleHeros } from "@/i18n/donnees-heros";
import { creerT } from "@/i18n/traductions";
import { competences, heros, histoires, illustrations, objets, synchro, visuelsCompetences } from "./donnees";
import {
  couper,
  genererDefi,
  hacher,
  MASQUE,
  masquerNom,
  type CompetenceQuiz,
  type Defi,
  type HerosQuiz,
  type ObjetQuiz,
  type ObjetRoster,
  type PoolQuiz,
  type SkinQuiz,
} from "./quiz";
import { classementComplet, mesureLe } from "./tier-list";
import type { Heros } from "./types";

/**
 * Vivier du quiz, prepare cote serveur dans chaque langue : competences,
 * extraits d'histoire, skins, objets et taux de victoire, deja reduits a ce que
 * les manches affichent, noms des heros masques. Le catalogue complet pese
 * plusieurs megaoctets ; le vivier, une centaine de Ko, et le defi du jour
 * quelques Ko.
 */

const ICONES_OBJETS = (visuelsGenere as unknown as { items: Record<string, string> }).items;

/**
 * Par heros : de quoi varier l'entrainement sans alourdir le vivier. Trois
 * competences et deux extraits de 340 caracteres le ramenaient de 400 a 250 Ko.
 */
const SKINS_PAR_HEROS = 3;
const COMPETENCES_PAR_HEROS = 3;
const EXTRAITS_PAR_HEROS = 2;
const LONGUEUR_EXTRAIT = 340;
const LONGUEUR_DESCRIPTION = 150;
const LONGUEUR_PASSIF = 200;

/**
 * Restes de modeles du wiki dans les descriptions : « Passif|e », « Prowler|e »,
 * « Mark|mark ». Le mot garde, la suite du tube part.
 */
function nettoyerWiki(texte: string): string {
  return texte.replace(/\|[\p{L}-]*/gu, "").replace(/\s{2,}/g, " ");
}

/** Nom du heros et nom complet de son histoire (« Aamon Paxley ») : a masquer partout. */
function nomsDe(h: Heros, locale: Langue): string[] {
  const complet = histoires(locale)[h.slug]?.profile?.fullName;
  return complet ? [h.name, complet] : [h.name];
}

function herosQuiz(locale: Langue): HerosQuiz[] {
  const t = creerT(locale);
  return heros.map((h) => ({
    slug: h.slug,
    nom: h.name,
    icone: h.images.icon ?? h.images.portrait,
    roles: h.roles,
    lanes: h.lanes,
    annee: Number(h.year) || null,
    region: libelleHeros(t, "region", h.region),
  }));
}

function competencesQuiz(h: Heros, locale: Langue): CompetenceQuiz[] {
  const icones = visuelsCompetences[h.slug] ?? {};
  const noms = nomsDe(h, locale);
  return (competences(locale)[h.slug] ?? [])
    .flatMap((c) =>
      c && icones[c.name]
        ? [
            {
              nom: masquerNom(c.name, noms),
              icone: icones[c.name],
              extrait: c.description
                ? couper(masquerNom(nettoyerWiki(c.description), noms), LONGUEUR_DESCRIPTION)
                : null,
            },
          ]
        : [],
    )
    .sort((a, b) => hacher(`${h.slug}:${a.icone}`) - hacher(`${h.slug}:${b.icone}`))
    .slice(0, COMPETENCES_PAR_HEROS);
}

/**
 * Paragraphes du recit, titres et accroche exclus. Ceux ou le nom du heros
 * apparaissait passent en tete : ils parlent de lui, pas d'un personnage
 * secondaire.
 */
function extraitsHistoire(h: Heros, locale: Langue): string[] {
  const histoire = histoires(locale)[h.slug];
  if (!histoire) return [];
  const noms = nomsDe(h, locale);
  const extraits = histoire.lore
    .filter((p) => !p.startsWith("=") && p.length >= 90 && p !== histoire.tagline)
    .map((p) => couper(masquerNom(nettoyerWiki(p), noms), LONGUEUR_EXTRAIT));
  return [...extraits.filter((e) => e.includes(MASQUE)), ...extraits.filter((e) => !e.includes(MASQUE))].slice(
    0,
    EXTRAITS_PAR_HEROS,
  );
}

/** Quelques illustrations par heros, toujours les memes d'une construction a l'autre. */
function skinsQuiz(h: Heros, locale: Langue): SkinQuiz[] {
  const noms = nomsDe(h, locale);
  return Object.entries(illustrations[h.slug] ?? {})
    .sort(([a], [b]) => hacher(`${h.slug}:${a}`) - hacher(`${h.slug}:${b}`))
    .slice(0, SKINS_PAR_HEROS)
    .map(([nom, image]) => ({ nom: masquerNom(nom, noms), image }));
}

function objetsQuiz(locale: Langue): ObjetQuiz[] {
  const t = creerT(locale);
  const liste = objets(locale);
  const parSlug = new Map(liste.map((o) => [o.slug, o]));
  // Les recettes citent les composants par leur nom anglais.
  const slugParNom = new Map([...objets("en"), ...liste].map((o) => [o.name, o.slug]));
  return liste
    .filter((o) => o.price && o.bonus)
    .map((o) => {
      const categorie = t(`categories.${o.category}`);
      const passif = o.passive ?? o.unique ?? o.active;
      return {
        slug: o.slug,
        nom: o.name,
        icone: ICONES_OBJETS[o.slug] ?? null,
        prix: o.price,
        categorie: categorie === `categories.${o.category}` ? o.category : categorie,
        bonus: o.bonus!,
        recette: o.recipe.map((nom) => {
          const slug = slugParNom.get(nom);
          return { nom: (slug && parSlug.get(slug)?.name) || nom, icone: (slug && ICONES_OBJETS[slug]) || null };
        }),
        passif: passif ? couper(masquerNom(nettoyerWiki(passif), [o.name]), LONGUEUR_PASSIF) : null,
      };
    });
}

const POOLS = new Map<Langue, PoolQuiz>();

export function poolQuiz(locale: Langue): PoolQuiz {
  let pool = POOLS.get(locale);
  if (!pool) {
    const avec = <T>(f: (h: Heros) => T[]) =>
      Object.fromEntries(heros.flatMap((h) => {
        const liste = f(h);
        return liste.length ? [[h.slug, liste]] : [];
      }));
    pool = {
      version: hacher(`${synchro.date}|${mesureLe}`).toString(36),
      mesure: mesureLe,
      heros: herosQuiz(locale),
      competences: avec((h) => competencesQuiz(h, locale)),
      histoires: avec((h) => extraitsHistoire(h, locale)),
      skins: avec((h) => skinsQuiz(h, locale)),
      objets: objetsQuiz(locale),
      victoires: Object.fromEntries(
        classementComplet.filter((e) => !e.lowSample).map((e) => [e.hero.slug, e.winRate]),
      ),
    };
    POOLS.set(locale, pool);
  }
  return pool;
}

/** Ce que la page envoie d'emblee : de quoi proposer et comparer les reponses. */
export function rosterQuiz(locale: Langue): { heros: HerosQuiz[]; objets: ObjetRoster[] } {
  const pool = poolQuiz(locale);
  return {
    heros: pool.heros,
    objets: pool.objets.map(({ slug, nom, icone, prix, categorie }) => ({ slug, nom, icone, prix, categorie })),
  };
}

export function defiDuJour(locale: Langue, jour: string): Defi {
  return genererDefi(poolQuiz(locale), jour);
}

import type { Langue } from "@/i18n/config";
import { cleValeur, libelleHeros, valeurWiki, type ChampHeros } from "@/i18n/donnees-heros";
import { creerT } from "@/i18n/traductions";
import { heros, histoires } from "./donnees";
import {
  dateEligibilite,
  EPOQUE,
  numeroMlbbdle,
  tirerSecrets,
  type CandidatMlbbdle,
  type DefiMlbbdle,
  type EnigmeCompetence,
  type Genre,
  type HerosMlbbdle,
  type SecretsJour,
} from "./mlbbdle";
import { decalerJour, hacher } from "./quiz";
import { poolQuiz } from "./quiz-donnees";

/**
 * Donnees de MLBBdle, preparees cote serveur : le roster compare (traits en
 * cles independantes de la langue, libelles a part) et le defi de chaque jour.
 *
 * Les competences viennent du vivier du quiz : memes icones, noms et extraits
 * deja masques, et l'entrainement du mode competence reprend le fichier que
 * le navigateur a peut-etre deja en cache (`/quiz/<langue>.json`).
 */

/**
 * Le genre n'est pas dans l'infobox de jeu : il vient de la fiche d'histoire,
 * lue en anglais pour que la cle ne depende pas de la traduction.
 */
function genreDe(slug: string): Genre | null {
  const brut = histoires("en")[slug]?.fiche?.genre?.trim().toLowerCase() ?? "";
  if (/^(man|male)$/.test(brut)) return "homme";
  if (/^(wom[ae]n|female)$/.test(brut)) return "femme";
  if (brut.startsWith("genderless")) return "aucun";
  return null;
}

const cle = (valeur: string | null) => (valeur ? cleValeur(valeur) : null);

const ROSTERS = new Map<Langue, { heros: HerosMlbbdle[]; libelles: Record<string, string> }>();

/**
 * Roster de la page et libelles de chaque valeur, sous `<colonne>.<cle>`
 * (`degats.magic`, `roles.Tank`). Envoyer un dictionnaire plutot qu'un libelle
 * par heros garde la page legere.
 */
export function rosterMlbbdle(locale: Langue): { heros: HerosMlbbdle[]; libelles: Record<string, string> } {
  const garde = ROSTERS.get(locale);
  if (garde) return garde;
  const t = creerT(locale);
  const libelles: Record<string, string> = {};
  const noter = (colonne: string, champ: ChampHeros, brut: string | null) => {
    const k = cle(brut);
    if (brut && k) libelles[`${colonne}.${k}`] = libelleHeros(t, champ, brut) ?? brut;
    return k;
  };

  const liste = heros
    .map((h): HerosMlbbdle => {
      const genre = genreDe(h.slug);
      if (genre) libelles[`genre.${genre}`] = t(`pages.mlbbdleUI.genres.${genre}`);
      for (const r of h.roles) libelles[`roles.${r}`] = t(`roles.${r}`);
      for (const l of h.lanes) libelles[`lanes.${l}`] = t(`lanes.${l}`);
      return {
        slug: h.slug,
        nom: h.nom,
        icone: h.visuels.icone ?? h.visuels.portrait,
        genre,
        roles: h.roles,
        lanes: h.lanes,
        specialites: h.specialites.flatMap((s) => {
          const k = noter("specialites", "specialite", s);
          return k ? [k] : [];
        }),
        degats: noter("degats", "degats", h.typeDegats),
        attaque: noter("attaque", "attaque", h.typeAttaque),
        ressource: noter("ressource", "ressource", h.ressource),
        region: noter("region", "region", h.region),
        annee: Number(h.annee) || null,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const roster = { heros: liste, libelles };
  ROSTERS.set(locale, roster);
  return roster;
}

/** Candidats du tirage : independants de la langue, pour que tout le monde ait le meme secret. */
export function candidatsMlbbdle(): CandidatMlbbdle[] {
  const competences = poolQuiz("en").competences;
  return heros.map((h) => ({
    slug: h.slug,
    depuis: dateEligibilite(h.sortie ? valeurWiki(h.sortie) : null),
    competence: Boolean(competences[h.slug]?.length),
  }));
}

/** Secrets deroules depuis l'epoque, gardes d'une requete a l'autre. */
let historique: SecretsJour[] = [];

function secretsDu(jour: string): SecretsJour | undefined {
  if (jour < EPOQUE) return tirerSecrets(candidatsMlbbdle(), jour, jour)[0];
  if (!historique.length || historique.at(-1)!.jour < jour) historique = tirerSecrets(candidatsMlbbdle(), jour);
  return historique[numeroMlbbdle(jour) - 1];
}

/**
 * Competence du jour : choisie dans le vivier anglais par son icone, puis
 * relue dans la langue demandee. Les quatre langues montrent la meme icone.
 */
function enigmeCompetence(slug: string, jour: string, locale: Langue): EnigmeCompetence | null {
  const liste = poolQuiz("en").competences[slug];
  if (!liste?.length) return null;
  const choisie = liste[hacher(`mlbbdle:competence:${jour}:${slug}`) % liste.length];
  const traduite = poolQuiz(locale).competences[slug]?.find((c) => c.icone === choisie.icone) ?? choisie;
  return { reponse: slug, nom: traduite.nom, icone: choisie.icone, extrait: traduite.extrait };
}

export function defiMlbbdle(locale: Langue, jour: string): DefiMlbbdle | null {
  const secrets = secretsDu(jour);
  if (!secrets?.classique) return null;
  const veille = decalerJour(jour, -1);
  const hier = veille >= EPOQUE ? secretsDu(veille) : undefined;
  return {
    jour,
    numero: numeroMlbbdle(jour),
    classique: secrets.classique,
    competence: secrets.competence ? enigmeCompetence(secrets.competence, jour, locale) : null,
    hier: hier ? { classique: hier.classique, competence: hier.competence } : null,
  };
}

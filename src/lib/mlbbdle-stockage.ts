import type { Langue } from "@/i18n/config";
import type { DefiMlbbdle } from "./mlbbdle";
import { STATS_VIDES, type StatsQuiz } from "./quiz";

/**
 * Memoire de MLBBdle dans le navigateur : statistiques par mode, essais du
 * jour, record de l'entrainement et dernier defi recu. Rien ne quitte
 * l'appareil.
 *
 * Le stockage peut manquer (navigation privee, quota) : chaque acces echoue en
 * silence et le jeu tient alors le temps de la visite.
 */
export type ModeJour = "classique" | "competence";

const CLES = {
  stats: (mode: ModeJour) => `mlbbdle_stats_${mode}`,
  partie: "mlbbdle_partie",
  defi: "mlbbdle_defi",
  entrainement: "mlbbdle_entrainement",
} as const;

function lire<T>(cle: string): T | null {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage plein ou refuse : la visite continue sans memoire */
  }
}

export function lireStats(mode: ModeJour): StatsQuiz {
  const s = lire<StatsQuiz>(CLES.stats(mode));
  return s && typeof s.joues === "number" && Array.isArray(s.distribution) ? s : STATS_VIDES;
}

export function ecrireStats(mode: ModeJour, stats: StatsQuiz) {
  ecrire(CLES.stats(mode), stats);
}

export type EssaisJour = Record<ModeJour, string[]>;
const ESSAIS_VIDES: EssaisJour = { classique: [], competence: [] };

/** Essais du jour, en slugs : changer de langue en cours de partie la reprend ou elle en etait. */
export function lirePartie(jour: string): EssaisJour {
  const p = lire<{ jour: string } & Partial<EssaisJour>>(CLES.partie);
  if (p?.jour !== jour) return ESSAIS_VIDES;
  return {
    classique: Array.isArray(p.classique) ? p.classique : [],
    competence: Array.isArray(p.competence) ? p.competence : [],
  };
}

export function ecrirePartie(jour: string, essais: EssaisJour) {
  ecrire(CLES.partie, { jour, ...essais });
}

export interface RecordEntrainement {
  trouves: number;
  essais: number;
  /** Moins d'essais pour une manche trouvee. */
  meilleur: number | null;
}

export function lireEntrainement(): RecordEntrainement {
  const r = lire<RecordEntrainement>(CLES.entrainement);
  return r && typeof r.trouves === "number" ? r : { trouves: 0, essais: 0, meilleur: null };
}

export function ecrireEntrainement(r: RecordEntrainement) {
  ecrire(CLES.entrainement, r);
}

/** Defi du jour : relu sur l'appareil s'il a deja ete recu aujourd'hui, demande au serveur sinon. */
export async function chargerDefi(langue: Langue, jour: string): Promise<DefiMlbbdle> {
  const garde = lire<{ langue: Langue; defi: DefiMlbbdle }>(CLES.defi);
  if (garde?.langue === langue && garde.defi?.jour === jour && garde.defi.classique) return garde.defi;
  const reponse = await fetch(`/mlbbdle/jour/${langue}-${jour}.json`);
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  const defi = (await reponse.json()) as DefiMlbbdle;
  ecrire(CLES.defi, { langue, defi });
  return defi;
}

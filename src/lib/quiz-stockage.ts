import type { Langue } from "@/i18n/config";
import { genererDefi, STATS_VIDES, type Defi, type PoolQuiz, type StatsQuiz } from "./quiz";

/**
 * Memoire du quiz dans le navigateur : statistiques, partie du jour en cours,
 * record de l'entrainement, et derniers defi et vivier recus — de quoi jouer
 * hors ligne une fois la page visitee. Rien ne quitte l'appareil.
 *
 * Le stockage peut manquer (navigation privee, quota) : chaque acces echoue
 * en silence, et le quiz fonctionne alors le temps de la visite.
 */
const CLES = {
  stats: "mlbb_quiz_stats",
  partie: "mlbb_quiz_partie",
  defi: "mlbb_quiz_defi",
  vivier: "mlbb_quiz_vivier",
  entrainement: "mlbb_quiz_entrainement",
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

export function lireStats(): StatsQuiz {
  const s = lire<StatsQuiz>(CLES.stats);
  return s && typeof s.joues === "number" && Array.isArray(s.distribution) ? s : STATS_VIDES;
}

export function ecrireStats(stats: StatsQuiz) {
  ecrire(CLES.stats, stats);
}

/**
 * Essais de la partie du jour. Ils ne dependent pas de la langue (des slugs) :
 * changer de langue en cours de partie la reprend ou elle en etait.
 */
export function lirePartie(jour: string): string[][] | null {
  const p = lire<{ jour: string; essais: string[][] }>(CLES.partie);
  return p?.jour === jour && Array.isArray(p.essais) ? p.essais : null;
}

export function ecrirePartie(jour: string, essais: string[][]) {
  ecrire(CLES.partie, { jour, essais });
}

export interface RecordEntrainement {
  meilleure: number;
  jouees: number;
  reussies: number;
}

export function lireEntrainement(): RecordEntrainement {
  return lire<RecordEntrainement>(CLES.entrainement) ?? { meilleure: 0, jouees: 0, reussies: 0 };
}

export function ecrireEntrainement(r: RecordEntrainement) {
  ecrire(CLES.entrainement, r);
}

async function json<T>(url: string): Promise<T> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return (await reponse.json()) as T;
}

/** Vivier deja demande pendant la visite, par langue. */
const viviers = new Map<Langue, Promise<PoolQuiz>>();

/** Vivier de l'entrainement : le reseau d'abord, la derniere copie gardee sinon. */
export function chargerPool(langue: Langue): Promise<PoolQuiz> {
  let requete = viviers.get(langue);
  if (!requete) {
    requete = json<PoolQuiz>(`/quiz/${langue}.json`).then(
      (pool) => {
        // Une seule langue gardee : quatre viviers peseraient pour rien.
        ecrire(CLES.vivier, { langue, pool });
        return pool;
      },
      (erreur) => {
        viviers.delete(langue);
        const garde = lire<{ langue: Langue; pool: PoolQuiz }>(CLES.vivier);
        if (garde?.langue === langue && garde.pool?.heros) return garde.pool;
        throw erreur;
      },
    );
    viviers.set(langue, requete);
  }
  return requete;
}

/**
 * Defi du jour. Deja recu aujourd'hui : relu sur l'appareil. Sinon demande au
 * serveur ; sans reseau, tire du vivier garde, par le meme calcul que le
 * serveur (`local` le signale).
 */
export async function chargerDefi(langue: Langue, jour: string): Promise<{ defi: Defi; local: boolean }> {
  const garde = lire<{ langue: Langue; defi: Defi }>(CLES.defi);
  if (garde?.langue === langue && garde.defi?.jour === jour) return { defi: garde.defi, local: false };
  try {
    const defi = await json<Defi>(`/quiz/jour/${langue}-${jour}.json`);
    ecrire(CLES.defi, { langue, defi });
    return { defi, local: false };
  } catch {
    const pool = await chargerPool(langue);
    return { defi: genererDefi(pool, jour), local: true };
  }
}

import type { Locale } from "@/i18n/config";
import { generateChallenge, ORDER_CHALLENGE, STATS_EMPTY, type Challenge, type PoolQuiz, type StatsQuiz } from "./quiz";

/**
 * Memoire du quiz dans le navigateur : statistiques, partie du jour en cours,
 * record de l'entrainement, et derniers defi et vivier recus — de quoi jouer
 * hors ligne une fois la page visitee. Rien ne quitte l'appareil.
 *
 * Le stockage peut manquer (navigation privee, quota) : chaque acces echoue
 * en silence, et le quiz fonctionne alors le temps de la visite.
 */
const KEYS = {
  stats: "mlbb_quiz_stats",
  match: "mlbb_quiz_partie",
  challenge: "mlbb_quiz_defi",
  pool: "mlbb_quiz_vivier",
  practice: "mlbb_quiz_entrainement",
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou refuse : la visite continue sans memoire */
  }
}

export function readStats(): StatsQuiz {
  const s = read<StatsQuiz>(KEYS.stats);
  return s && typeof s.joues === "number" && Array.isArray(s.distribution) ? s : STATS_EMPTY;
}

export function writeStats(stats: StatsQuiz) {
  write(KEYS.stats, stats);
}

/**
 * Essais de la partie du jour. Ils ne dependent pas de la langue (des slugs) :
 * changer de langue en cours de partie la reprend ou elle en etait.
 */
export function readMatch(day: string): string[][] | null {
  const p = read<{ jour: string; essais: string[][] }>(KEYS.match);
  return p?.jour === day && Array.isArray(p.essais) ? p.essais : null;
}

export function writeMatch(day: string, attempts: string[][]) {
  write(KEYS.match, { jour: day, essais: attempts });
}

export interface RecordPractice {
  meilleure: number;
  jouees: number;
  reussies: number;
}

export function readPractice(): RecordPractice {
  return read<RecordPractice>(KEYS.practice) ?? { meilleure: 0, jouees: 0, reussies: 0 };
}

export function writePractice(r: RecordPractice) {
  write(KEYS.practice, r);
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Vivier deja demande pendant la visite, par langue. */
const pools = new Map<Locale, Promise<PoolQuiz>>();

/** Vivier de l'entrainement : le reseau d'abord, la derniere copie gardee sinon. */
export function loadPool(locale: Locale): Promise<PoolQuiz> {
  let request = pools.get(locale);
  if (!request) {
    request = json<PoolQuiz>(`/quiz/${locale}.json`).then(
      (pool) => {
        // Une seule langue gardee : quatre viviers peseraient pour rien.
        write(KEYS.pool, { langue: locale, pool });
        return pool;
      },
      (error) => {
        pools.delete(locale);
        const keep = read<{ langue: Locale; pool: PoolQuiz }>(KEYS.pool);
        if (keep?.langue === locale && keep.pool?.heros) return keep.pool;
        throw error;
      },
    );
    pools.set(locale, request);
  }
  return request;
}

/**
 * Defi du jour. Deja recu aujourd'hui : relu sur l'appareil. Sinon demande au
 * serveur ; sans reseau, tire du vivier garde, par le meme calcul que le
 * serveur (`local` le signale).
 */
export async function loadChallenge(locale: Locale, day: string): Promise<{ challenge: Challenge; local: boolean }> {
  const keep = read<{ langue: Locale; defi: Challenge }>(KEYS.challenge);
  const current = keep?.defi?.manches?.every((m) => ORDER_CHALLENGE.includes(m.type)) ?? false;
  if (current && keep?.langue === locale && keep.defi?.jour === day) return { challenge: keep!.defi, local: false };
  try {
    const challenge = await json<Challenge>(`/quiz/day/${locale}-${day}.json`);
    write(KEYS.challenge, { langue: locale, defi: challenge });
    return { challenge, local: false };
  } catch {
    const pool = await loadPool(locale);
    return { challenge: generateChallenge(pool, day), local: true };
  }
}

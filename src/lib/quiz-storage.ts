import type { Locale } from "@/i18n/config";
import { signalProgress } from "./progress-signal";
import { generateChallenge, ORDER_CHALLENGE, STATS_EMPTY, type Challenge, type PoolQuiz, type StatsQuiz } from "./quiz";

/**
 * Quiz memory in the browser: statistics, today's game in progress,
 * practice record, and the latest challenge and pool received — enough to play
 * offline once the page has been visited. Signed out, nothing leaves the
 * device; signed in, the stats and the practice record are also kept on the
 * account (`account-sync-client.ts`), which `signalProgress` tells.
 *
 * Storage may be unavailable (private browsing, quota): each access fails
 * silently, and the quiz then works for the duration of the visit.
 */
const KEYS = {
  stats: "mlbb_quiz_stats",
  match: "mlbb_quiz_partie",
  challenge: "mlbb_quiz_defi",
  pool: "mlbb_quiz_vivier",
  practice: "mlbb_quiz_entrainement",
  duel: "mlbb_quiz_duel",
  name: "mlbb_quiz_nom",
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
    /* storage full or denied: the visit continues without memory */
  }
}

export function readStats(): StatsQuiz {
  const s = read<StatsQuiz>(KEYS.stats);
  return s && typeof s.joues === "number" && Array.isArray(s.distribution) ? s : STATS_EMPTY;
}

export function writeStats(stats: StatsQuiz) {
  write(KEYS.stats, stats);
  signalProgress();
}

/**
 * Attempts of today's game. They do not depend on the language (slugs):
 * switching language mid-game resumes where it left off.
 */
export function readMatch(day: string): string[][] | null {
  const p = read<{ jour: string; essais: string[][] }>(KEYS.match);
  return p?.jour === day && Array.isArray(p.essais) ? p.essais : null;
}

export function writeMatch(day: string, attempts: string[][]) {
  write(KEYS.match, { jour: day, essais: attempts });
}

/**
 * Attempts at a past challenge opened from a friend's link: kept apart from
 * today's game, and never counted in the stats or the streak.
 */
export function readDuelMatch(day: string): string[][] | null {
  const p = read<{ jour: string; essais: string[][] }>(KEYS.duel);
  return p?.jour === day && Array.isArray(p.essais) ? p.essais : null;
}

export function writeDuelMatch(day: string, attempts: string[][]) {
  write(KEYS.duel, { jour: day, essais: attempts });
}

/** The name a player puts on their challenge links, if any. */
export function readName(): string {
  const n = read<string>(KEYS.name);
  return typeof n === "string" ? n : "";
}

export function writeName(name: string) {
  write(KEYS.name, name);
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
  signalProgress();
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Pool already requested during the visit, per language. */
const pools = new Map<Locale, Promise<PoolQuiz>>();

/** Practice pool: network first, otherwise the last saved copy. */
export function loadPool(locale: Locale): Promise<PoolQuiz> {
  let request = pools.get(locale);
  if (!request) {
    request = json<PoolQuiz>(`/quiz/${locale}.json`).then(
      (pool) => {
        // Only one language kept: four pools would weigh for nothing.
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
 * Daily challenge. Already received today: read back from the device. Otherwise requested from
 * the server; offline, drawn from the saved pool, with the same computation as the
 * server (`local` flags it). A past challenge (a friend's link) is not kept:
 * it would push today's out of the offline copy.
 */
export async function loadChallenge(
  locale: Locale,
  day: string,
  { save = true }: { save?: boolean } = {},
): Promise<{ challenge: Challenge; local: boolean }> {
  const keep = read<{ langue: Locale; defi: Challenge }>(KEYS.challenge);
  const current = keep?.defi?.manches?.every((m) => ORDER_CHALLENGE.includes(m.type)) ?? false;
  if (current && keep?.langue === locale && keep.defi?.jour === day) return { challenge: keep!.defi, local: false };
  try {
    const challenge = await json<Challenge>(`/quiz/day/${locale}-${day}.json`);
    if (save) write(KEYS.challenge, { langue: locale, defi: challenge });
    return { challenge, local: false };
  } catch {
    const pool = await loadPool(locale);
    return { challenge: generateChallenge(pool, day), local: true };
  }
}

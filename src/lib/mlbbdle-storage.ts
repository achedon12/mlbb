import type { Langue } from "@/i18n/config";
import type { MlbbdlePuzzle } from "./mlbbdle";
import { STATS_VIDES, type StatsQuiz } from "./quiz";

/**
 * MLBBdle memory in the browser: stats per mode, today's guesses, the
 * practice record and the last puzzle received. Nothing leaves the device.
 *
 * Storage may be missing (private browsing, quota): every access fails
 * silently and the game then lasts for the visit.
 */
export type DailyMode = "classic" | "skill";

const KEYS = {
  stats: (mode: DailyMode) => `mlbbdle_stats_${mode}`,
  game: "mlbbdle_game",
  puzzle: "mlbbdle_puzzle",
  practice: "mlbbdle_practice",
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
    /* storage full or refused: the visit goes on without memory */
  }
}

export function readStats(mode: DailyMode): StatsQuiz {
  const s = read<StatsQuiz>(KEYS.stats(mode));
  return s && typeof s.joues === "number" && Array.isArray(s.distribution) ? s : STATS_VIDES;
}

export function writeStats(mode: DailyMode, stats: StatsQuiz) {
  write(KEYS.stats(mode), stats);
}

export type DailyGuesses = Record<DailyMode, string[]>;
const NO_GUESSES: DailyGuesses = { classic: [], skill: [] };

/** Today's guesses, as slugs: switching language mid-game picks up where it was. */
export function readGame(day: string): DailyGuesses {
  const g = read<{ day: string } & Partial<DailyGuesses>>(KEYS.game);
  if (g?.day !== day) return NO_GUESSES;
  return {
    classic: Array.isArray(g.classic) ? g.classic : [],
    skill: Array.isArray(g.skill) ? g.skill : [],
  };
}

export function writeGame(day: string, guesses: DailyGuesses) {
  write(KEYS.game, { day, ...guesses });
}

export interface PracticeRecord {
  found: number;
  guesses: number;
  /** Fewest guesses for a hero found. */
  best: number | null;
}

export function readPractice(): PracticeRecord {
  const r = read<PracticeRecord>(KEYS.practice);
  return r && typeof r.found === "number" ? r : { found: 0, guesses: 0, best: null };
}

export function writePractice(r: PracticeRecord) {
  write(KEYS.practice, r);
}

/** Today's puzzle: read back from the device if already received today, asked from the server otherwise. */
export async function loadPuzzle(language: Langue, day: string): Promise<MlbbdlePuzzle> {
  const kept = read<{ language: Langue; puzzle: MlbbdlePuzzle }>(KEYS.puzzle);
  if (kept?.language === language && kept.puzzle?.day === day && kept.puzzle.classic) return kept.puzzle;
  const response = await fetch(`/mlbbdle/day/${language}-${day}.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const puzzle = (await response.json()) as MlbbdlePuzzle;
  write(KEYS.puzzle, { language, puzzle });
  return puzzle;
}

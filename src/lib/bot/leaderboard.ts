import { shiftDay } from "@/lib/quiz";
import type { DailyGame } from "./settings";

/**
 * Server leaderboards of the daily games. Pure: the rows come from the
 * database, the ranking is tested on its own.
 *
 * - MLBBdle (both modes): fewer guesses is better. Over several days, the
 *   most days solved first, then the lowest average; `score` is that
 *   average, rounded to a tenth.
 * - Quiz: points add up; `score` is the total.
 *
 * Ties share a rank (1, 2, 2, 4), and the name breaks no tie: the order of
 * equals is by Discord id, stable from one call to the next.
 */

export const PERIODS = ["day", "week", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const LEADERBOARD_SIZE = 10;

export interface ResultRow {
  discordUserId: string;
  discordUserName: string;
  day: string;
  score: number;
}

export interface Entry {
  rank: number;
  discordUserId: string;
  discordUserName: string;
  score: number;
  plays: number;
}

/** First day counted by a period ending on `day`; null for all time. */
export function periodStart(period: Period, day: string): string | null {
  if (period === "day") return day;
  if (period === "week") return shiftDay(day, -6);
  return null;
}

export function rank(game: DailyGame, rows: ResultRow[], size = LEADERBOARD_SIZE): Entry[] {
  const byUser = new Map<string, { name: string; latest: string; plays: number; total: number }>();
  for (const r of rows) {
    const user = byUser.get(r.discordUserId) ?? { name: r.discordUserName, latest: r.day, plays: 0, total: 0 };
    user.plays += 1;
    user.total += r.score;
    // The latest name wins: a renamed player shows under their current name.
    if (r.day >= user.latest) {
      user.latest = r.day;
      user.name = r.discordUserName;
    }
    byUser.set(r.discordUserId, user);
  }
  const quiz = game === "quiz";
  const list = [...byUser].map(([id, u]) => ({
    discordUserId: id,
    discordUserName: u.name,
    plays: u.plays,
    score: quiz ? u.total : Math.round((u.total / u.plays) * 10) / 10,
  }));
  const better = (a: (typeof list)[number], b: (typeof list)[number]) =>
    quiz ? b.score - a.score : b.plays - a.plays || a.score - b.score;
  list.sort((a, b) => better(a, b) || (a.discordUserId < b.discordUserId ? -1 : 1));

  const out: Entry[] = [];
  for (const [i, e] of list.slice(0, size).entries()) {
    const previous = out[i - 1];
    const tied = previous && better(previous, e) === 0;
    out.push({ ...e, rank: tied ? previous.rank : i + 1 });
  }
  return out;
}

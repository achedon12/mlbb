import type { Locale } from "@/i18n/config";
import { EPOCH } from "@/lib/mlbbdle";
import { mlbbdlePuzzle, mlbbdleRoster } from "@/lib/mlbbdle-data";
import { dayUtc, isValidDay, shiftDay } from "@/lib/quiz";
import { challengeOfDay, rosterQuiz } from "@/lib/quiz-data";

/**
 * Daily games for the bot: the same functions as the site's own
 * `/mlbbdle/day/*.json` and `/quiz/day/*.json`, so a server plays exactly
 * the hero and the rounds of the site on that UTC day, in every language.
 *
 * The bot also gets the rosters it needs to check guesses (MLBBdle compares
 * traits) and to offer answers (quiz buttons): image paths stay
 * site-relative, the bot prefixes the public address.
 */

/** Same range as the site: from the first day, up to tomorrow (a fast clock). */
export function dailyDayAllowed(day: string, now = new Date()): boolean {
  return isValidDay(day) && day >= EPOCH && day <= shiftDay(dayUtc(now), 1);
}

export function dailyPayload(locale: Locale, day: string) {
  const puzzle = mlbbdlePuzzle(locale, day);
  if (!puzzle) return null;
  const { heroes, labels } = mlbbdleRoster(locale);
  const quiz = challengeOfDay(locale, day);
  const roster = rosterQuiz(locale);
  return {
    day,
    number: puzzle.number,
    mlbbdle: {
      classic: puzzle.classic,
      skill: puzzle.skill,
      yesterday: puzzle.yesterday,
      roster: heroes,
      labels,
    },
    quiz,
    quizRoster: {
      heroes: roster.heroes.map((h) => ({ slug: h.slug, nom: h.nom })),
      items: roster.items.map((i) => ({ slug: i.slug, nom: i.nom })),
    },
  };
}

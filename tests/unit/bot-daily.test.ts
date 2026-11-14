import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { dailyDayAllowed, dailyPayload } from "@/lib/bot/daily";
import { GET as mlbbdleRoute } from "@/app/mlbbdle/day/[file]/route";
import { GET as quizRoute } from "@/app/quiz/day/[file]/route";
import { dayUtc, shiftDay } from "@/lib/quiz";

/**
 * Discord and the site must play the same puzzle: the bot's daily payload is
 * compared with what the site's own day files serve, in every language.
 */
const site = async (route: typeof mlbbdleRoute, file: string) =>
  (await route(new Request(`http://localhost/${file}`), { params: Promise.resolve({ file }) })).json();

describe("daily games for the bot", () => {
  const today = dayUtc(new Date());

  it("serves the site's MLBBdle secret and quiz rounds, in every language", async () => {
    for (const locale of LOCALES) {
      const payload = dailyPayload(locale, today)!;
      const puzzle = await site(mlbbdleRoute, `${locale}-${today}.json`);
      const quiz = await site(quizRoute, `${locale}-${today}.json`);
      expect(payload.mlbbdle.classic).toBe(puzzle.classic);
      expect(payload.mlbbdle.skill).toEqual(puzzle.skill);
      expect(payload.number).toBe(puzzle.number);
      expect(JSON.parse(JSON.stringify(payload.quiz))).toEqual(quiz);
    }
  });

  it("draws the same hero in every language", () => {
    const secrets = new Set(LOCALES.map((l) => dailyPayload(l, today)!.mlbbdle.classic));
    expect(secrets.size).toBe(1);
  });

  it("sends a roster that contains the secret, and answer lists for the quiz", () => {
    const payload = dailyPayload("en", today)!;
    expect(payload.mlbbdle.roster.some((h) => h.slug === payload.mlbbdle.classic)).toBe(true);
    expect(payload.quizRoster.heroes.length).toBeGreaterThan(100);
    expect(payload.quizRoster.items.length).toBeGreaterThan(10);
  });

  it("keeps the site's day range: from the first day up to tomorrow", () => {
    expect(dailyDayAllowed(today)).toBe(true);
    expect(dailyDayAllowed(shiftDay(today, 1))).toBe(true);
    expect(dailyDayAllowed(shiftDay(today, 2))).toBe(false);
    expect(dailyDayAllowed("2026-09-10")).toBe(false);
    expect(dailyDayAllowed("2026-13-01")).toBe(false);
    expect(dailyDayAllowed("not a day")).toBe(false);
  });
});

import type { Daily, QuizRound } from "../site/schemas.js";

/**
 * The daily quiz in Discord.
 *
 * The rounds are the site's (`challengeOfDay`), so every server plays the
 * same challenge as mlbbdex.com. What differs is the answer form: the site
 * has a search field with several attempts, Discord gets buttons. Each
 * guessing round offers the answer and three other heroes (or items), one
 * click; each duel pair is a choice between two heroes. Points follow the
 * site: one per round found, one per duel pair right.
 */

/** 32-bit FNV-1a, the site's hash: the same draw everywhere, no dependency. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Choice {
  slug: string;
  label: string;
}

export type Step =
  | { kind: "guess"; round: Exclude<QuizRound, { type: "duel" }>; answer: string; choices: Choice[] }
  | { kind: "duel"; answer: string; choices: [Choice, Choice]; pair: number; pairs: number };

export const CHOICES = 4;

/** The `count` entries with the smallest hash: stable, and the same for every player. */
function drawDistinct<T extends { slug: string }>(pool: T[], seed: string, count: number, exclude: string): T[] {
  return pool
    .filter((x) => x.slug !== exclude)
    .map((x) => ({ x, v: hash(`${seed}|${x.slug}`) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, count)
    .map((e) => e.x);
}

export function buildSteps(daily: Daily): Step[] {
  const quiz = daily.quiz;
  if (!quiz) return [];
  const heroes = daily.quizRoster.heroes.map((h) => ({ slug: h.slug, label: h.nom }));
  const items = daily.quizRoster.items.map((i) => ({ slug: i.slug, label: i.nom }));
  const heroName = new Map(heroes.map((h) => [h.slug, h.label]));
  const steps: Step[] = [];

  quiz.manches.forEach((round, index) => {
    if (round.type === "duel") {
      round.paires.forEach(([a, b], pair) => {
        steps.push({
          kind: "duel",
          // Same rule as the site: a tie goes to the first hero.
          answer: a.victoire >= b.victoire ? a.slug : b.slug,
          choices: [
            { slug: a.slug, label: heroName.get(a.slug) ?? a.slug },
            { slug: b.slug, label: heroName.get(b.slug) ?? b.slug },
          ],
          pair,
          pairs: round.paires.length,
        });
      });
      return;
    }
    const pool = round.type === "item" ? items : heroes;
    const answer = pool.find((p) => p.slug === round.reponse);
    if (!answer) return; // A roster out of step with the rounds: skip rather than show a wrong answer.
    const seed = `quiz:${daily.day}:${index}`;
    const choices = [answer, ...drawDistinct(pool, seed, CHOICES - 1, answer.slug)].sort(
      (a, b) => hash(`${seed}:order|${a.slug}`) - hash(`${seed}:order|${b.slug}`),
    );
    steps.push({ kind: "guess", round, answer: answer.slug, choices });
  });
  return steps;
}

export interface QuizProgress {
  step: number;
  points: number;
  /** Set once the result is sent, so a double click never posts it twice. */
  finished: boolean;
}

/** Applies an answer; returns whether it was right, or null for a stale or repeated click. */
export function answer(progress: QuizProgress, steps: Step[], stepIndex: number, choice: string): boolean | null {
  if (progress.finished || stepIndex !== progress.step) return null;
  const step = steps[stepIndex];
  if (!step) return null;
  const right = step.answer === choice;
  progress.points += right ? 1 : 0;
  progress.step += 1;
  if (progress.step >= steps.length) progress.finished = true;
  return right;
}

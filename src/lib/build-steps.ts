/**
 * Steps of the build simulator.
 *
 * The order is the one the game itself imposes: nothing can be computed
 * without a hero, items carry most of the figures, the emblem and its talents
 * adjust them, and the battle spell changes no statistic at all — it comes
 * last on purpose.
 *
 * Kept out of the component so the order, and the moves between steps, can be
 * read and tested without a browser.
 */
export const BUILD_STEPS = ["hero", "items", "emblem", "spell"] as const;
export type BuildStep = (typeof BUILD_STEPS)[number];

/** Step reached from `step` by moving one step back (-1) or forward (1); the ends hold. */
export function stepBy(step: BuildStep, move: -1 | 1): BuildStep {
  const index = BUILD_STEPS.indexOf(step);
  return BUILD_STEPS[Math.min(BUILD_STEPS.length - 1, Math.max(0, index + move))];
}

export const isFirstStep = (step: BuildStep): boolean => step === BUILD_STEPS[0];
export const isLastStep = (step: BuildStep): boolean => step === BUILD_STEPS[BUILD_STEPS.length - 1];

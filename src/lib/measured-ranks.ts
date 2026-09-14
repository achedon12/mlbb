/**
 * Ranks for which the game publishes its measurements, in API order.
 *
 * `all` aggregates every match; the others isolate one band of the ranking,
 * from Epic to Mythic Glory. Dependency-free module: client components
 * import it without bundling the data.
 */
export const MEASURED_RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"] as const;
export type MeasuredRank = (typeof MEASURED_RANKS)[number];

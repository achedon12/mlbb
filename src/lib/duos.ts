import duosGenerated from "@/data/game/duos.json";
import type { MeasuredRank } from "./measured-ranks";

/**
 * Duos measured by the game (`/heroes/{h}/compatibility`), per hero then per
 * rank: the partners that raise its win rate the most, those that lower it
 * the most, and the duo's win rate per match duration bucket. Read only by
 * the duos and head-to-head pages: the file stays out of pages that do not
 * need it.
 */

export interface Duo {
  slug: string;
  /** Change in the hero's win rate with this partner, in points. */
  advantage: number;
  /**
   * Duo win rate per duration bucket, in %, aligned on
   * STARTS_BUCKETS_DUO (src/lib/pairs.ts); null for an empty bucket.
   */
  phases?: (number | null)[];
}

export interface DuosRank {
  /** Hero's win rate at this rank, in %. */
  winRate: number | null;
  best: Duo[];
  worst: Duo[];
}

/** A missing rank was not measured for this hero. */
export type DuosByRank = Partial<Record<MeasuredRank, DuosRank>>;

const D = duosGenerated as unknown as { days?: number; heroes?: Record<string, DuosByRank> };

/** Duo measurement window, in days. */
export const DAYS_DUOS = D.days ?? 30;

export const duos: Record<string, DuosByRank> = D.heroes ?? {};

export const duosOf = (slug: string): DuosByRank => duos[slug] ?? {};

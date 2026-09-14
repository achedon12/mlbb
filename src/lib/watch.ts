import generatedWatch from "@/data/game/watch.json";

/**
 * Automatic news watch.
 *
 * The site aggregates public feeds and only shows what an aggregator can
 * legitimately show: a title, a date, a short excerpt and a link to
 * the source. The full content is never copied — readers are sent to
 * the original publisher.
 *
 * No network request at runtime: the snapshot is taken upstream
 * by `scripts/watch.mjs` (in CI, at regular intervals) and read here from
 * `src/data/game/watch.json`. The site depends on no external service.
 */

export interface Source {
  slug: string;
  name: string;
  /** Home page of the source, shown as credit. */
  site: string;
}

export const sources: Source[] = [
  { slug: "reddit", name: "r/MobileLegendsGame", site: "https://www.reddit.com/r/MobileLegendsGame/" },
  { slug: "esports-gg", name: "Esports.gg", site: "https://esports.gg/" },
];

export interface News {
  title: string;
  link: string;
  date: string;
  excerpt: string;
  source: string;
  sourceSlug: string;
}

interface Snapshot {
  measuredAt: string;
  news: News[];
}

const snapshot = generatedWatch as unknown as Snapshot;

/** Snapshot date (last feed collection). */
export const measureWatch = snapshot.measuredAt;

/** News items of the snapshot, already sorted from most recent to oldest. */
export function watch(limit = 40): News[] {
  return snapshot.news.slice(0, limit);
}

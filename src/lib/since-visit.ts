/**
 * "Since your last visit": what changed on the site between a returning
 * visitor's previous visit and today.
 *
 * Pure module, used in the browser: the home page sends a compact digest of
 * recent changes (`SinceDigest`, built server side), the browser keeps the
 * date of the last visit, and `sinceVisit` crosses the two.
 */

/** Two visits less than this apart are one visit: browsing pages does not reset the reference. */
export const SESSION_GAP_MS = 30 * 60_000;
/** A visit older than this is too far back for a "since" strip: the home page itself says it all. */
export const MAX_AWAY_DAYS = 60;

export interface SinceDigest {
  /** Day of the tier list's latest measurement, YYYY-MM-DD. */
  measured: string;
  patches: { version: string; date: string }[];
  /** Released skins, newest first: date (day, or month as YYYY-MM-01), name, hero name, link. */
  skins: { date: string; name: string; hero: string; href: string }[];
  /**
   * Tier changes against today's tier list, per past day: on `date`, `n`
   * heroes sat in another tier than today; `top` names the biggest moves.
   */
  tiers: { date: string; n: number; top: { slug: string; name: string; before: string; after: string }[] }[];
  /** Months of events that opened, or were announced, with the date they became news. */
  events: { month: string; date: string; announced: boolean }[];
}

export interface SinceItems {
  patch: { version: string } | null;
  skins: { n: number; latest: { name: string; hero: string; href: string } } | null;
  tiers: { n: number; top: SinceDigest["tiers"][number]["top"] } | null;
  events: { month: string; announced: boolean } | null;
}

/** What changed after `lastDay` (YYYY-MM-DD), up to the data. Empty when nothing did. */
export function sinceVisit(digest: SinceDigest, lastDay: string): SinceItems {
  const patch = digest.patches.find((p) => p.date > lastDay) ?? null;
  const skins = digest.skins.filter((s) => s.date > lastDay);
  // The tier list as it stood on the last visit: the closest day at or before it, else the oldest kept.
  const sorted = [...digest.tiers].sort((a, b) => b.date.localeCompare(a.date));
  const tier = sorted.find((d) => d.date <= lastDay) ?? sorted.at(-1) ?? null;
  const events = digest.events.filter((e) => e.date > lastDay).sort((a, b) => b.month.localeCompare(a.month))[0] ?? null;
  return {
    patch: patch ? { version: patch.version } : null,
    skins: skins.length ? { n: skins.length, latest: skins[0] } : null,
    // Seen after the latest measurement: today's tier list is the one already seen.
    tiers: tier && tier.n > 0 && lastDay < digest.measured ? { n: tier.n, top: tier.top } : null,
    events: events ? { month: events.month, announced: events.announced } : null,
  };
}

export const isEmpty = (s: SinceItems) => !s.patch && !s.skins && !s.tiers && !s.events;

// ── Visit memory ───────────────────────────────────────────────────

const STORAGE = "mlbb_visit";

interface VisitMemory {
  /** Last activity of the previous visit, ISO; null on a first visit. */
  last: string | null;
  /** Last activity of this visit, ISO. */
  seen: string;
}

/**
 * Notes activity now and returns the end of the previous visit (ISO), or
 * null on a first visit or without storage. Within one visit, every call
 * returns the same date.
 */
export function touchVisit(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    const parsed = raw ? (JSON.parse(raw) as Partial<VisitMemory>) : null;
    const seen = typeof parsed?.seen === "string" && !Number.isNaN(Date.parse(parsed.seen)) ? parsed.seen : null;
    let last = typeof parsed?.last === "string" && !Number.isNaN(Date.parse(parsed.last)) ? parsed.last : null;
    if (seen && now - Date.parse(seen) > SESSION_GAP_MS) last = seen;
    localStorage.setItem(STORAGE, JSON.stringify({ last, seen: new Date(now).toISOString() } satisfies VisitMemory));
    return last;
  } catch {
    return null;
  }
}

import { trendsOf } from "@/lib/evolution";
import { eventMonths, eventSources, referenceDate } from "@/lib/events-server";
import { recentPatches } from "@/lib/patch-tracking";
import { linkSkin } from "@/lib/skin-catalog";
import { catalogHeroes, releasedSkins } from "@/lib/skin-catalog-server";
import { measure, rankingFull, ruleTierList } from "@/lib/tier-list";
import { daysBetween, shiftDate } from "@/lib/trends";
import { MAX_AWAY_DAYS, type SinceDigest } from "@/lib/since-visit";
import type { Tier } from "@/lib/types";

/**
 * Digest of recent changes for the "Since your last visit" strip, from the
 * data the site already has: patches, released skins, the daily rate history
 * behind the tier list, and the events lists. A few kilobytes, computed once
 * per build like the rest of the home page.
 */

/** Days of tier history kept: past that, the visitor gets the oldest. */
const TIER_DAYS = 30;
/** A missing day takes the closest measured one before it, within this many days. */
const TOLERANCE = 2;
const TOP = 3;
const ORDER: Tier[] = ["S+", "S", "A", "B", "C"];

function tierDigest(): SinceDigest["tiers"] {
  const today = measure.slice(0, 10);
  const scoreAt = (series: { start: string; winRate: (number | null)[]; banRate: (number | null)[] }, day: string) => {
    const at = daysBetween(series.start, day);
    for (let i = Math.min(at, series.winRate.length - 1); i >= 0 && i >= at - TOLERANCE; i -= 1) {
      const w = series.winRate[i];
      const b = series.banRate[i];
      if (typeof w === "number" && typeof b === "number") return ruleTierList.score({ winRate: w, banRate: b });
    }
    return null;
  };

  const heroes = rankingFull.flatMap((e) => {
    const series = trendsOf(e.hero.slug).all;
    if (!series) return [];
    const now = scoreAt(series, today);
    // Rounded series against the unrounded ranking: a hero on a boundary is left out.
    if (now === null || ruleTierList.tier(now) !== e.tier) return [];
    return [{ slug: e.hero.slug, name: e.hero.name, tier: e.tier, series }];
  });

  return Array.from({ length: TIER_DAYS }, (_, k) => {
    const date = shiftDate(today, -(k + 1));
    const moves = heroes.flatMap((h) => {
      const then = scoreAt(h.series, date);
      if (then === null) return [];
      const before = ruleTierList.tier(then);
      return before === h.tier ? [] : [{ slug: h.slug, name: h.name, before, after: h.tier, gap: ORDER.indexOf(before) - ORDER.indexOf(h.tier) }];
    });
    moves.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || b.gap - a.gap || a.slug.localeCompare(b.slug));
    return { date, n: moves.length, top: moves.slice(0, TOP).map(({ slug, name, before, after }) => ({ slug, name, before, after })) };
  });
}

let cache: SinceDigest | null = null;

export function sinceDigest(): SinceDigest {
  if (cache) return cache;
  const oldest = shiftDate(referenceDate, -MAX_AWAY_DAYS);
  const heroes = catalogHeroes();
  const skins = releasedSkins()
    .flatMap((s) => {
      if (!s.release || s.release.length < 7) return [];
      const date = s.release.length >= 10 ? s.release.slice(0, 10) : `${s.release.slice(0, 7)}-01`;
      if (date < oldest) return [];
      return [{ date, name: s.name, hero: heroes.get(s.hero)?.name ?? s.hero, href: s.anchor ? linkSkin(s) : `/heroes/${s.hero}/skins` }];
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "en"));

  const current = referenceDate.slice(0, 7);
  const listed = [eventSources.starlight.modified, eventSources.collector.modified].map((d) => d.slice(0, 10)).sort().at(-1) ?? referenceDate;
  const events = eventMonths().flatMap((m) => {
    if (m.month === current) return [{ month: m.month, date: `${m.month}-01`, announced: false }];
    if (m.month > current) return [{ month: m.month, date: listed, announced: true }];
    return [];
  });

  cache = {
    measured: measure.slice(0, 10),
    patches: recentPatches.flatMap((p) => (p.date && p.date >= oldest ? [{ version: p.version, date: p.date.slice(0, 10) }] : [])).slice(0, 3),
    skins: skins.slice(0, 60),
    tiers: tierDigest(),
    events,
  };
  return cache;
}

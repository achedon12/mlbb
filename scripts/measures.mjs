import { removeTags } from "./tags.mjs";
/**
 * Pure computations of the measures sync: daily series, cumulative compacted
 * history, choice of player guides and skill combos. Kept apart from the
 * script so they can be tested without network access.
 */

const DAY = 86400000;
export const numberDay = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
export const dateOfDay = (n) => new Date(n * DAY).toISOString().slice(0, 10);
export const rounded = (v, decimals) =>
  typeof v === "number" ? Math.round(v * 10 ** decimals) / 10 ** decimals : null;

/** Monday of a day number's week: day 0, January 1st 1970, was a Thursday. */
const monday = (n) => n - ((((n + 3) % 7) + 7) % 7);

/**
 * Series aligned on a shared start date, one point every `step` days
 * (1: daily, 7: weekly). A missing point stays a gap (null) rather than
 * shifting the following ones.
 */
export function dailyStreak(points, step = 1) {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = numberDay(sorted[0].date);
  const n = (numberDay(sorted.at(-1).date) - first) / step + 1;
  const series = {
    start: sorted[0].date,
    winRate: Array(n).fill(null),
    banRate: Array(n).fill(null),
    pickRate: Array(n).fill(null),
  };
  for (const p of sorted) {
    const k = (numberDay(p.date) - first) / step;
    series.winRate[k] = p.winRate;
    series.banRate[k] = p.banRate;
    series.pickRate[k] = p.pickRate;
  }
  return series;
}

/** Inverse of dailyStreak: one point per measured day (or week). */
export function pointsOf(series, step = 1) {
  if (!series?.winRate) return [];
  const start = numberDay(series.start);
  return series.winRate.flatMap((v, k) =>
    v == null
      ? []
      : [{
          date: dateOfDay(start + k * step),
          winRate: v,
          banRate: series.banRate?.[k] ?? null,
          pickRate: series.pickRate?.[k] ?? null,
        }],
  );
}

/** Days kept at daily precision in the history; beyond that, one average per week. */
export const DAILY_DAYS = 90;

/** Precision of weekly averages, matching the game's measures. */
const DECIMALS = { winRate: 1, banRate: 1, pickRate: 2 };

function average(values, decimals) {
  const measured = values.filter((v) => typeof v === "number");
  return measured.length ? rounded(measured.reduce((a, b) => a + b, 0) / measured.length, decimals) : null;
}

/**
 * A hero's stored series: the last `days` days at daily precision, older
 * weeks as averages, stored under `weeks` (dated by their Monday, one point
 * every seven days). The cutoff falls on a Monday: only whole weeks are
 * averaged, and a compacted week never moves again. If an already compacted
 * week still receives days (shortened window, backfill), the existing
 * average wins: it carried more measures.
 */
export function compactHistory(points, weeksExisting = [], days = DAILY_DAYS) {
  if (points.length === 0) return null;
  const last = Math.max(...points.map((p) => numberDay(p.date)));
  const cutoff = monday(last - days + 1);
  const recent = points.filter((p) => numberDay(p.date) >= cutoff);

  const byWeek = new Map();
  for (const p of points) {
    const n = numberDay(p.date);
    if (n >= cutoff) continue;
    const key = dateOfDay(monday(n));
    byWeek.set(key, [...(byWeek.get(key) ?? []), p]);
  }
  const weeks = new Map(
    [...byWeek].map(([date, ps]) => [
      date,
      {
        date,
        winRate: average(ps.map((p) => p.winRate), DECIMALS.winRate),
        banRate: average(ps.map((p) => p.banRate), DECIMALS.banRate),
        pickRate: average(ps.map((p) => p.pickRate), DECIMALS.pickRate),
      },
    ]),
  );
  for (const s of weeksExisting) weeks.set(s.date, s);

  const series = dailyStreak(recent);
  const weekly = dailyStreak([...weeks.values()], 7);
  return weekly ? { ...series, weeks: weekly } : series;
}

/**
 * Long history, all ranks combined. The API only goes back thirty days: each
 * sync pours its own in here, and the file grows patch after patch — one
 * average per week beyond DAILY_DAYS, to stay compact. An already known day
 * takes the most recent measure. A file from before compaction, all at daily
 * precision, is read as is.
 */
export function mergeHistory(existing, trends, days = DAILY_DAYS) {
  const output = {};
  for (const slug of new Set([...Object.keys(existing), ...Object.keys(trends)])) {
    const byDate = new Map();
    for (const p of [...pointsOf(existing[slug]), ...pointsOf(trends[slug]?.all)]) byDate.set(p.date, p);
    const series = compactHistory([...byDate.values()], pointsOf(existing[slug]?.weeks, 7), days);
    if (series) output[slug] = series;
  }
  return output;
}

/**
 * Per-hero measures of this run, completed with the previous run's heroes it
 * did not serve. The academy API sometimes answers for only part of the
 * roster (rate limits, upstream errors): writing that answer as is erased the
 * builds and guides of every hero it skipped. A hero served this run always
 * takes the new values; heroes keep the previous order, new ones come last.
 * Returns the merged table and the slugs kept from the previous run.
 */
export function keepUnservedHeroes(previous = {}, next = {}) {
  const slugs = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const merged = {};
  const kept = [];
  for (const slug of slugs) {
    if (slug in next) merged[slug] = next[slug];
    else {
      merged[slug] = previous[slug];
      kept.push(slug);
    }
  }
  return { merged, kept };
}

/**
 * rank_level thresholds of guide authors, on the scale of
 * src/lib/ranks.ts: Epic from 76, Legend from 106, then the
 * mythic stars from 136 — Honor at 25 stars, Glory at 50. The
 * published level is the best rank the author has reached.
 */
export const AUTHOR_BANDS = {
  all: [0, Infinity],
  epic: [76, 106],
  legend: [106, 136],
  mythic: [136, 161],
  honor: [161, 186],
  glory: [186, Infinity],
};

/**
 * Guide picked for a rank: the most voted among authors of that rank; failing
 * that, from a higher rank. Null when no author reaches the rank.
 */
export function chooseGuide(candidates, rank) {
  const [bottom, top] = AUTHOR_BANDS[rank];
  const byVotes = (a, b) => b.votes - a.votes || b.views - a.views;
  return (
    candidates.filter((g) => g.authorRank >= bottom && g.authorRank < top).sort(byVotes)[0] ??
    candidates.filter((g) => g.authorRank >= bottom).sort(byVotes)[0] ??
    null
  );
}

/**
 * Duo duration buckets, in minutes: the same as a hero's duration curve
 * (evolution.json), from 10 to 20 minutes and more. The API also publishes
 * "under 6", "6-8" and "8-10": surrendered games or samples too thin (a duo
 * at 92% between 6 and 8 minutes), dropped.
 */
export const BUCKETS_DUO = [
  ["min_win_rate10_12", 10],
  ["min_win_rate12_14", 12],
  ["min_win_rate14_16", 14],
  ["min_win_rate16_18", 16],
  ["min_win_rate18_20", 18],
  ["min_win_rate20", 20],
];

/**
 * A hero's duos in a rank, from `/heroes/{h}/compatibility`: the partners
 * that raise its win rate the most (`sub_hero`) and those that lower it the
 * most (`sub_hero_last`), five on each side.
 * `increase_win_rate` becomes a gap in points; the duo's rate per duration
 * bucket, a percentage — null when the bucket is empty (exactly 0).
 * Null when the API knows no partner for this rank.
 */
export function duosOfRank(block, byId, slug, max = 10) {
  const phases = (a) => {
    const values = BUCKETS_DUO.map(([key]) => (typeof a[key] === "number" && a[key] > 0 ? rounded(a[key] * 100, 1) : null));
    return values.some((v) => v !== null) ? values : null;
  };
  const partners = (list) =>
    (Array.isArray(list) ? list : [])
      .map((a) => ({ a, slug: byId.get(a?.heroid) }))
      .filter(({ a, slug: s }) => s && s !== slug && typeof a.increase_win_rate === "number")
      .map(({ a, slug: s }) => {
        const p = phases(a);
        return { slug: s, advantage: Math.round(a.increase_win_rate * 1000) / 10, ...(p ? { phases: p } : {}) };
      });
  const best = partners(block?.sub_hero).filter((d) => d.advantage > 0).sort((a, b) => b.advantage - a.advantage);
  const worst = partners(block?.sub_hero_last).filter((d) => d.advantage < 0).sort((a, b) => a.advantage - b.advantage);
  if (best.length === 0 && worst.length === 0) return null;
  return {
    winRate: typeof block.main_hero_win_rate === "number" ? rounded(block.main_hero_win_rate * 100, 1) : null,
    best: best.slice(0, max),
    worst: worst.slice(0, max),
  };
}

/**
 * Duos from the existing file topped up by a new read, rank by rank: a rank
 * the API did not serve this time keeps its previous measure.
 */
export function mergeDuos(existing, incoming) {
  const output = {};
  for (const slug of new Set([...Object.keys(existing ?? {}), ...Object.keys(incoming ?? {})])) {
    output[slug] = { ...(existing?.[slug] ?? {}), ...(incoming?.[slug] ?? {}) };
  }
  return output;
}

/** duos.json: measurement window, then one hero per line, in slug order. */
export function serializeDuos(days, heroes) {
  const rows = Object.keys(heroes)
    .sort()
    .map((slug) => `    ${JSON.stringify(slug)}: ${JSON.stringify(heroes[slug])}`);
  return `{\n  "days": ${days},\n  "heroes": ${rows.length > 0 ? `{\n${rows.join(",\n")}\n  }` : "{}"}\n}\n`;
}

const normalizeName = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ORDER_COMBOS = ["laning", "teamfight"];

/** "LANING COMBOS" → laning; null for an unknown title. */
const typeCombo = (title) => ORDER_COMBOS.find((t) => normalizeName(title).startsWith(t)) ?? null;

/**
 * A hero's combos, from the API records (`skill-combos`).
 *
 * Each skill arrives there as a game identifier. The hero's API sheet
 * (`skills`: id, name) gives its name, which maps to the name shown by the
 * site (`skillsSite`, the wiki) and to its local icon (`icons`, by name). A
 * transformed form reuses a skill's name under another identifier: it keeps
 * the CDN icon, which tells it apart. The basic attack, missing from the
 * sheets, has a round identifier (the hero's followed by 00).
 */
export function heroCombos(records, skills, skillsSite, icons) {
  const namesSite = new Map(skillsSite.filter((c) => c?.name).map((c) => [normalizeName(c.name), c.name]));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const firstId = new Map();
  for (const s of skills) if (!firstId.has(normalizeName(s.name))) firstId.set(normalizeName(s.name), s.id);

  const toSkill = (raw) => {
    const id = raw?.data?.skillid;
    const remote = raw?.data?.skillicon ? String(raw.data.skillicon) : null;
    const skill = byId.get(id);
    if (!skill) return id % 100 === 0 ? { name: null, icon: remote, basicAttack: true } : { name: null, icon: remote };
    const key = normalizeName(skill.name);
    const name = namesSite.get(key) ?? (skill.name || null);
    if (firstId.get(key) === id && name && icons[name]) return { name, icon: icons[name] };
    return { name, icon: remote ?? skill.icon ?? null };
  };

  const rank = (c) => (c.type ? ORDER_COMBOS.indexOf(c.type) : ORDER_COMBOS.length);
  return records
    .map((r) => r?.data)
    .filter((d) => d?.desc && Array.isArray(d.skill_id) && d.skill_id.length > 0)
    .map((d) => ({
      type: typeCombo(d.title),
      description: removeTags(d.desc).replace(/\s+/g, " ").trim(),
      skills: d.skill_id.map(toSkill),
    }))
    .sort((a, b) => rank(a) - rank(b));
}

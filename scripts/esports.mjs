/**
 * Esports sync: World Championships (M-series), MSC and the current MPL
 * seasons, read from Liquipedia.
 *
 *     node scripts/esports.mjs            only re-reads pages that changed
 *     node scripts/esports.mjs --force    ignores the cache
 *
 * Writes `src/data/jeu/esports.json`. Liquipedia content is licensed under
 * CC BY-SA 3.0: every page showing it credits it, with links to the source
 * pages. Teams stay plain text: no logo, no photo.
 *
 * The API terms are followed to the letter: descriptive User-Agent with a
 * contact, gzip, one request at a time, two seconds between requests and
 * thirty seconds between renders (`expandtemplates` is treated like
 * `action=parse`, even though only the latter is named). The cache keeps, per
 * page, the revision read and its analysis: a re-run only downloads what
 * changed.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  analyzePage,
  buildTournament,
  createHeroResolver,
  readAliasTable,
  STAGE_ORDER,
  stageKey,
  teamKey,
} from "./esports-analysis.mjs";

const API = "https://liquipedia.net/mobilelegends/api.php";
const WIKI = "https://liquipedia.net/mobilelegends/";
const USER_AGENT = "MLBBDex/1.0 (+https://mlbbdex.com; contact@leoderoin.fr)";
const OUTPUT = "src/data/jeu/esports.json";
const CACHE = "scripts/esports-cache.json";
const HEROES = "src/data/jeu/heros.json";
const HERO_MODULE = "Module:HeroNames";

/** Bump when the analysis changes: cached pages are then read again. */
const ANALYSIS_VERSION = 2;
const INTERVAL = 2100;
const RENDER_INTERVAL = 31000;
/** Titles per request: the API caps at 50, and page contents add up fast. */
const CONTENT_BATCH = 10;
const TITLE_BATCH = 50;
const DRAFTS = 10;

const FORCE = process.argv.includes("--force");

/**
 * Tracked series. Each edition points to the next one in its infobox
 * (`next=`): from these seeds, the script finds the season that starts on its
 * own, without touching this list. Adding a league takes one line.
 */
const SERIES = [
  { id: "m", pattern: /^M(\d+) World Championship$/, slug: (n) => `m${n}-world-championship`, short: (n) => `M${n}`, seed: "M7 World Championship" },
  { id: "msc", pattern: /^MSC\/(\d{4})$/, slug: (n) => `msc-${n}`, short: (n) => `MSC ${n}`, seed: "MSC/2026" },
  { id: "mpl-id", region: "id", pattern: /^MPL\/Indonesia\/Season (\d+)$/, slug: (n) => `mpl-id-season-${n}`, short: (n) => `MPL ID S${n}`, seed: "MPL/Indonesia/Season 18" },
  { id: "mpl-ph", region: "ph", pattern: /^MPL\/Philippines\/Season (\d+)$/, slug: (n) => `mpl-ph-season-${n}`, short: (n) => `MPL PH S${n}`, seed: "MPL/Philippines/Season 18" },
  { id: "mpl-my", region: "my", pattern: /^MPL\/Malaysia\/Season (\d+)$/, slug: (n) => `mpl-my-season-${n}`, short: (n) => `MPL MY S${n}`, seed: "MPL/Malaysia/Season 18" },
];

// ─────────────────────────────────────────────────────────────
// API access, one request at a time
// ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
let lastRender = 0;
let requestCount = 0;

async function api(parameters, { render = false } = {}) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...parameters, format: "json", formatversion: "2" })) url.searchParams.set(k, v);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const wait = Math.max(lastRequest + INTERVAL - Date.now(), render ? lastRender + RENDER_INTERVAL - Date.now() : 0);
    if (wait > 0) await sleep(wait);
    let response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" },
        signal: AbortSignal.timeout(60000),
      });
    } finally {
      lastRequest = Date.now();
      if (render) lastRender = lastRequest;
      requestCount += 1;
    }
    if (response.ok) {
      const json = await response.json();
      if (json.error) throw new Error(`Liquipedia: ${json.error.code} — ${json.error.info}`);
      return json;
    }
    // 429 or outage: back off clearly rather than insist.
    const delay = Number(response.headers.get("retry-after")) * 1000 || 60000 * attempt;
    console.warn(`  HTTP ${response.status}, retrying in ${Math.round(delay / 1000)} s`);
    await sleep(delay);
  }
  throw new Error(`Liquipedia unreachable: ${url}`);
}

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** Title as the wiki uses it, after normalization and redirects. */
function resolver(query) {
  const to = new Map();
  for (const n of [...(query.normalized ?? []), ...(query.redirects ?? [])]) to.set(n.from, n.to);
  return (title) => {
    let t = title;
    for (let i = 0; i < 3 && to.has(t); i += 1) t = to.get(t);
    return t;
  };
}

/** Latest revision of each title; `null` for a missing page. */
async function revisions(titles) {
  const out = new Map();
  for (const batch of chunks([...new Set(titles)], TITLE_BATCH)) {
    const { query } = await api({ action: "query", prop: "revisions", rvprop: "ids|timestamp", redirects: "1", titles: batch.join("|") });
    const resolve = resolver(query);
    const byTitle = new Map(query.pages.map((p) => [p.title, p]));
    for (const title of batch) {
      const p = byTitle.get(resolve(title));
      const r = p && !p.missing ? p.revisions?.[0] : null;
      out.set(title, r ? { title: p.title, revid: r.revid, timestamp: r.timestamp } : null);
    }
  }
  return out;
}

/** Wikitext of the given titles (already resolved). */
async function contents(titles) {
  const out = new Map();
  for (const batch of chunks(titles, CONTENT_BATCH)) {
    const { query } = await api({ action: "query", prop: "revisions", rvprop: "ids|timestamp|content", rvslots: "main", titles: batch.join("|") });
    for (const p of query.pages) {
      const r = p.revisions?.[0];
      if (r) out.set(p.title, { revid: r.revid, timestamp: r.timestamp, text: r.slots.main.content });
    }
  }
  return out;
}

async function subpages(page) {
  const list = [];
  let next;
  do {
    const res = await api({ action: "query", list: "allpages", apprefix: `${page}/`, aplimit: "100", ...(next ? { apcontinue: next } : {}) });
    list.push(...res.query.allpages.map((p) => p.title));
    next = res.continue?.apcontinue;
  } while (next);
  return list;
}

/**
 * Official team names: pages write "rrq", "srg.og" or "ae", aliases that
 * Liquipedia resolves through an extension with no readable page. A single
 * `{{TeamPage|…}}` render for every alias not known yet, kept in the cache.
 */
async function resolveTeams(keys, cache) {
  const unknown = [...keys].filter((k) => !(k in cache.teams));
  for (const batch of chunks(unknown, 50)) {
    console.log(`  ${batch.length} team names to resolve`);
    const text = batch.map((k) => `{{TeamPage|1=${k}}}`).join("\n");
    const res = await api({ action: "expandtemplates", prop: "wikitext", text }, { render: true });
    const lines = res.expandtemplates.wikitext.split("\n");
    if (lines.length !== batch.length) {
      console.warn("  inconsistent team resolution, names kept as they are");
      continue;
    }
    batch.forEach((k, i) => {
      const name = lines[i].trim();
      cache.teams[k] = name && !/[[\]{}<>|]/.test(name) ? name : k;
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────

async function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : fallback;
}

const emptyCache = () => ({ version: ANALYSIS_VERSION, pages: {}, subpages: {}, teams: {}, heroNames: null });

/**
 * Analysis of each title, re-read only when its revision changed. Returns,
 * per requested title, `{ title, timestamp, analysis }` or `null` (missing).
 */
async function analyses(titles, cache) {
  const revs = await revisions(titles);
  const toRead = [];
  for (const r of revs.values()) if (r && cache.pages[r.title]?.revid !== r.revid) toRead.push(r.title);
  if (toRead.length) console.log(`  ${toRead.length} page(s) to read: ${toRead.join(", ")}`);
  for (const [title, c] of await contents([...new Set(toRead)])) {
    cache.pages[title] = { revid: c.revid, timestamp: c.timestamp, analysis: analyzePage(c.text) };
  }
  return new Map([...revs].map(([asked, r]) => [asked, r && cache.pages[r.title] ? { title: r.title, ...cache.pages[r.title] } : null]));
}

// ─────────────────────────────────────────────────────────────
// Choosing the tournaments
// ─────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

/** Has a partial date ("2026-11") been reached? Compared at its own precision. */
const started = (start, day) => Boolean(start) && start <= day.slice(0, start.length);

/** End passed: the full date, or the whole month of a partial one, is behind. */
const ended = (end, day) => Boolean(end) && end.length >= 7 && end < day.slice(0, end.length);

function seriesOf(title) {
  for (const s of SERIES) {
    const m = s.pattern.exec(title);
    if (m) return { series: s, number: Number(m[1]) };
  }
  return null;
}

/**
 * Editions kept per series: the latest started one ("current", counted in
 * the meta), and the next one if its page already exists (upcoming).
 * Tournaments already published stay, so their address does not die.
 */
async function editions(cache, published) {
  const mains = new Map();
  let toCheck = [...new Set([...SERIES.map((s) => s.seed), ...published])];
  for (let pass = 0; pass < 4 && toCheck.length; pass += 1) {
    const read = await analyses(toCheck, cache);
    toCheck = [];
    for (const [asked, page] of read) {
      mains.set(asked, page);
      const next = page?.analysis.infobox?.next;
      if (next && seriesOf(next) && !mains.has(next) && !toCheck.includes(next)) toCheck.push(next);
    }
  }
  const day = today();
  const kept = new Map();
  for (const s of SERIES) {
    const list = [...mains.values()]
      .filter((p) => p?.analysis.infobox && seriesOf(p.title)?.series === s)
      .map((p) => ({ page: p, number: seriesOf(p.title).number }))
      .sort((a, b) => a.number - b.number);
    const current = list.filter((e) => started(e.page.analysis.infobox.startDate, day)).at(-1) ?? null;
    const next = list.find((e) => e.number > (current?.number ?? -1)) ?? null;
    for (const e of [current, next]) if (e) kept.set(e.page.title, { ...e, series: s, current: e === current });
  }
  for (const title of published) {
    const p = mains.get(title);
    const id = p && seriesOf(p.title);
    if (id && p.analysis.infobox && !kept.has(p.title)) kept.set(p.title, { page: p, number: id.number, series: id.series, current: false });
  }
  return [...kept.values()];
}

/** Stage subpages; an edition that had ended by the last listing gains no more. */
async function stagesOf(edition, cache) {
  const title = edition.page.title;
  const known = cache.subpages[title];
  if (!known || FORCE || !ended(edition.page.analysis.infobox.endDate, known.fetchedOn)) {
    cache.subpages[title] = { list: await subpages(title), fetchedOn: today() };
  }
  return cache.subpages[title].list
    .map((t) => ({ page: t, name: t.slice(title.length + 1) }))
    .filter((p) => !p.name.includes("/") && stageKey(p.name))
    .map((p) => ({ ...p, key: stageKey(p.name) }))
    .sort((a, b) => STAGE_ORDER.indexOf(a.key) - STAGE_ORDER.indexOf(b.key));
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const wikiLink = (title) => `${WIKI}${encodeURI(title.replace(/ /g, "_"))}`;

async function main() {
  const startedAt = Date.now();
  let cache = await readJson(CACHE, emptyCache());
  if (FORCE || cache.version !== ANALYSIS_VERSION) cache = { ...emptyCache(), teams: cache.teams ?? {} };
  const previous = await readJson(OUTPUT, { tournaments: [] });

  try {
    console.log("Editions and hero names…");
    // Liquipedia's hero alias table ("guin", "yss"): re-read on each revision.
    const heroModule = (await revisions([HERO_MODULE])).get(HERO_MODULE);
    if (heroModule && cache.heroNames?.revid !== heroModule.revid) {
      const c = (await contents([heroModule.title])).get(heroModule.title);
      cache.heroNames = { revid: c.revid, table: readAliasTable(c.text) };
    }
    const kept = await editions(cache, previous.tournaments.map((t) => t.page));

    console.log("Stages…");
    const stagesByEdition = new Map();
    for (const e of kept) stagesByEdition.set(e.page.title, await stagesOf(e, cache));
    const read = await analyses([...stagesByEdition.values()].flat().map((s) => s.page), cache);

    // Teams: every name met, resolved in a single render.
    const keys = new Set();
    for (const p of read.values()) {
      for (const t of p?.analysis.tables ?? []) for (const team of t.teams) keys.add(teamKey(team.name));
      for (const c of p?.analysis.containers ?? []) for (const m of c.matches) for (const team of m.teams) if (team) keys.add(teamKey(team));
    }
    await resolveTeams(keys, cache);
    const teamName = (raw) => cache.teams[teamKey(raw)] ?? raw;

    const siteHeroes = JSON.parse(await readFile(HEROES, "utf8"));
    const { resolve, lookup, unknown } = createHeroResolver(cache.heroNames?.table ?? {}, siteHeroes);

    const tournaments = kept.map((e) => {
      const info = e.page.analysis.infobox;
      const stages = stagesByEdition
        .get(e.page.title)
        .map((s) => ({ title: s.name, key: s.key, page: s.page, analysis: read.get(s.page)?.analysis }))
        .filter((s) => s.analysis);
      // A main page that carries matches itself counts as a stage.
      if (e.page.analysis.containers.length) stages.unshift({ title: null, key: "mainEvent", page: e.page.title, analysis: e.page.analysis });
      const sources = [e.page, ...stages.map((s) => read.get(s.page)).filter(Boolean)]
        .filter((p, i, all) => all.findIndex((x) => x.title === p.title) === i)
        .map((p) => ({ title: p.title, url: wikiLink(p.title), revision: p.timestamp }));
      return {
        slug: e.series.slug(e.number),
        series: e.series.id.startsWith("mpl") ? "mpl" : e.series.id,
        ...(e.series.region ? { region: e.series.region } : {}),
        number: e.number,
        current: e.current,
        page: e.page.title,
        name: info.name ?? e.page.title,
        shortName: e.series.short(e.number),
        startDate: info.startDate,
        endDate: info.endDate,
        prizePool: info.prizePool,
        teamCount: info.teamCount,
        city: info.city,
        country: info.country,
        patch: info.patch,
        endPatch: info.endPatch,
        sources,
        ...buildTournament(stages, { resolve, lookup, teamName, drafts: DRAFTS }),
      };
    });

    const seriesIndex = (t) => SERIES.findIndex((s) => s.slug(t.number) === t.slug);
    tournaments.sort((a, b) => seriesIndex(a) - seriesIndex(b) || b.number - a.number);
    const sourceRevisions = tournaments.flatMap((t) => t.sources.map((s) => s.revision)).sort();
    const output = {
      // Date of the most recent source page: the file only changes when the source does.
      updatedAt: sourceRevisions.at(-1) ?? null,
      source: {
        name: "Liquipedia",
        url: WIKI,
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      },
      unmappedHeroes: [...unknown].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      tournaments,
    };
    await writeFile(OUTPUT, `${JSON.stringify(output, null, 1)}\n`);

    console.log(`\n${tournaments.length} tournaments written to ${OUTPUT}:`);
    for (const t of tournaments) {
      console.log(
        `  ${t.slug.padEnd(24)} ${t.current ? "current" : "       "} ${t.startDate ?? "?"} → ${t.endDate ?? "?"}  ${t.matches} matches, ${t.games} games, ${t.heroes.length} heroes`,
      );
    }
    if (unknown.size) console.log(`Unmapped heroes: ${[...unknown].map(([n, c]) => `${n} (${c})`).join(", ")}`);
  } finally {
    await writeFile(CACHE, `${JSON.stringify(cache)}\n`);
    console.log(`${requestCount} requests, ${Math.round((Date.now() - startedAt) / 1000)} s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

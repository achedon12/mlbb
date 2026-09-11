/**
 * Reading Liquipedia tournament pages (Mobile Legends).
 *
 * Everything comes from the wikitext, read with `action=query`: drafts are
 * entered by hand, game by game (`{{Map|t1h1=…|t1b1=…}}`), while the rendered
 * standings and statistics are computed by Liquipedia at display time. Redoing
 * those computations here avoids `action=parse`, which the API terms limit to
 * one request every 30 seconds.
 *
 * Pure module: no request, so it can be tested on small excerpts. Network and
 * cache live in `esports.mjs`.
 */

// ─────────────────────────────────────────────────────────────
// Wikitext: templates and parameters
// ─────────────────────────────────────────────────────────────

/**
 * A comment right before a bracket match (`<!-- Semifinals -->`) is often the
 * only place where the page names the round: the rendered name comes from the
 * bracket template, absent from the wikitext. It becomes a pseudo-parameter
 * before the other comments are dropped — including `prizepoolusd=…-->` left
 * commented out, which must not be read.
 */
export function prepare(raw) {
  const marked = raw.replace(
    /<!--\s*([^<>]*?)\s*-->(?=\s*\|\s*R\d+M\d+\s*=)/g,
    (_, title) => `|§header=${title.replace(/[|{}=[\]]/g, " ")}`,
  );
  return marked.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
}

function blockEnd(text, start) {
  let depth = 0;
  for (let j = start; j < text.length - 1; j += 1) {
    if (text[j] === "{" && text[j + 1] === "{") {
      depth += 1;
      j += 1;
    } else if (text[j] === "}" && text[j + 1] === "}") {
      depth -= 1;
      j += 1;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

/** Top-level `{{…}}` templates of a text, with their lowercase name. */
export function blocks(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{{", i);
    if (start < 0) break;
    const end = blockEnd(text, start);
    if (end < 0) break;
    const body = text.slice(start + 2, end - 2);
    out.push({ name: body.split("|", 1)[0].trim().toLowerCase(), body });
    i = end;
  }
  return out;
}

/** Named templates at any depth, without descending into those already found. */
export function find(text, names) {
  const out = [];
  for (const b of blocks(text)) {
    if (names.includes(b.name)) out.push(b);
    else if (b.body.includes("{{")) out.push(...find(b.body, names));
  }
  return out;
}

/** Position of the first `=` outside templates and links, -1 otherwise. */
function topLevelEquals(text) {
  let depth = 0;
  for (let j = 0; j < text.length; j += 1) {
    const two = text.slice(j, j + 2);
    if (two === "{{" || two === "[[") {
      depth += 1;
      j += 1;
    } else if (two === "}}" || two === "]]") {
      depth -= 1;
      j += 1;
    } else if (text[j] === "=" && depth === 0) return j;
  }
  return -1;
}

/**
 * Parameters of a template, in page order: named ones (lowercase key) and
 * positional ones. A `|` inside a nested template or link splits nothing.
 */
export function params(body) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let j = 0; j < body.length; j += 1) {
    const two = body.slice(j, j + 2);
    if (two === "{{" || two === "[[") {
      depth += 1;
      current += two;
      j += 1;
    } else if (two === "}}" || two === "]]") {
      depth -= 1;
      current += two;
      j += 1;
    } else if (body[j] === "|" && depth === 0) {
      parts.push(current);
      current = "";
    } else current += body[j];
  }
  parts.push(current);
  parts.shift();
  const order = [];
  const named = new Map();
  const positional = [];
  for (const part of parts) {
    const eq = topLevelEquals(part);
    if (eq >= 0) {
      const key = part.slice(0, eq).trim().toLowerCase();
      const value = part.slice(eq + 1).trim();
      order.push([key, value]);
      named.set(key, value);
    } else {
      order.push([null, part.trim()]);
      positional.push(part.trim());
    }
  }
  return { order, named, positional };
}

/** Readable text of a value: templates removed, links reduced to their label. */
export function plainText(value) {
  if (!value) return "";
  let t = value;
  // Nested templates: removed from the inside out.
  for (let i = 0; i < 5 && t.includes("{{"); i += 1) t = t.replace(/\{\{[^{}]*\}\}/g, "");
  return t
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// Tournament infobox
// ─────────────────────────────────────────────────────────────

/** "2026-08-14", "2026-11-??" → "2026-11", "2026-??-??" → "2026". */
export function partialDate(value) {
  const m = /^(\d{4})(?:-(\d{2}|\?\?)(?:-(\d{2}|\?\?))?)?/.exec((value ?? "").trim());
  if (!m) return null;
  if (!m[2] || m[2] === "??") return m[1];
  if (!m[3] || m[3] === "??") return `${m[1]}-${m[2]}`;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function amount(value) {
  const n = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Target of a `Page{{!}}Label` link, spaces instead of underscores. */
const linkTarget = (value) => (value ? value.split("{{!}}")[0].replace(/_/g, " ").trim() || null : null);

export function readInfobox(text) {
  const block = find(text, ["infobox league"])[0];
  if (!block) return null;
  const p = params(block.body).named;
  const v = (key) => plainText(p.get(key) ?? "") || null;
  const usd = amount(p.get("prizepoolusd"));
  const local = amount(p.get("prizepool"));
  const currency = (p.get("localcurrency") ?? "").trim().toUpperCase();
  let prizePool = null;
  if (usd) prizePool = { amount: usd, currency: "USD" };
  else if (local && /^[A-Z]{3}$/.test(currency)) prizePool = { amount: local, currency };
  return {
    name: v("name"),
    startDate: partialDate(p.get("sdate")),
    endDate: partialDate(p.get("edate")),
    prizePool,
    teamCount: amount(p.get("team_number")),
    city: v("city"),
    country: v("country"),
    patch: v("patch"),
    endPatch: v("epatch"),
    next: linkTarget(p.get("next")),
  };
}

// ─────────────────────────────────────────────────────────────
// Matches and games
// ─────────────────────────────────────────────────────────────

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * Offsets of the time zones written in match dates. An ambiguous abbreviation
 * (CST, IST, BST) is left out: the date then stays without a time rather than
 * being wrong.
 */
const TIME_ZONES = {
  UTC: 0, GMT: 0, CET: 1, CEST: 2, EET: 2, EEST: 3, MSK: 3, TRT: 3, AST: 3, GST: 4,
  MMT: 6.5, ICT: 7, WIB: 7, SGT: 8, MYT: 8, PHT: 8, PHST: 8, HKT: 8, WITA: 8, JST: 9, KST: 9,
};

/** "August 14, 2026 - 15:00 {{abbr/ICT}}" → UTC ISO; without a known zone, the day only. */
export function readDate(value) {
  if (!value) return null;
  const zone = /\{\{\s*abbr\/(\w+)\s*\}\}/i.exec(value)?.[1]?.toUpperCase();
  const text = plainText(value);
  const m = /^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})(?:\s*-?\s*(\d{1,2}):(\d{2}))?/.exec(text);
  if (!m) return partialDate(text)?.length === 10 ? text.slice(0, 10) : null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  const day = `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const offset = zone !== undefined ? TIME_ZONES[zone] : undefined;
  if (m[4] === undefined || offset === undefined) return day;
  const ms = Date.UTC(+m[3], month, +m[2], +m[4], +m[5]) - offset * 3600_000;
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
}

function readOpponent(value) {
  const b = value ? blocks(value)[0] : null;
  if (!b) return { name: null, placeholder: plainText(value) || null, score: null };
  const p = params(b.body);
  const first = plainText(p.positional[0] ?? p.named.get("1") ?? "") || null;
  const score = (p.named.get("score") ?? "").trim() || null;
  if (b.name === "literalopponent") return { name: null, placeholder: first, score };
  const name = first && !/^(tbd|tba|bye)$/i.test(first) ? first : null;
  return { name, placeholder: null, score };
}

/** Heroes of one game, in entry order, empty slots skipped. */
function heroList(p, team, type) {
  const list = [];
  for (let n = 1; n <= 10; n += 1) {
    const v = plainText(p.get(`t${team}${type}${n}`) ?? "");
    if (v) list.push(v.toLowerCase());
  }
  return list;
}

function readGame(value) {
  const b = blocks(value ?? "")[0];
  if (!b) return null;
  const p = params(b.body).named;
  if ((p.get("finished") ?? "").trim() === "skip") return null;
  const winner = (p.get("winner") ?? "").trim();
  const side = (p.get("team1side") ?? "").trim().toLowerCase();
  const duration = (p.get("length") ?? "").trim();
  return {
    winner: winner === "1" ? 1 : winner === "2" ? 2 : null,
    duration: /^\d{1,2}:\d{2}$/.test(duration) ? duration : null,
    team1Side: side === "blue" || side === "red" ? side : null,
    picks: [heroList(p, 1, "h"), heroList(p, 2, "h")],
    bans: [heroList(p, 1, "b"), heroList(p, 2, "b")],
  };
}

const integer = (v) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * One match: its two teams, its games and its winner. The score comes from
 * the games won; a hand-entered score (forfeit "W"/"FF") or an explicit
 * `winner` takes precedence.
 */
export function readMatch(body) {
  const p = params(body).named;
  const opponents = [readOpponent(p.get("opponent1")), readOpponent(p.get("opponent2"))];
  const numbers = [...p.keys()]
    .map((k) => /^map(\d+)$/.exec(k)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  const games = numbers.map((n) => readGame(p.get(`map${n}`))).filter((g) => g && g.winner);
  const bestOf = integer(p.get("bestof")) ?? (numbers.length || null);
  const score = [0, 0];
  for (const g of games) score[g.winner - 1] += 1;
  const entered = opponents.map((o) => o.score);
  for (const i of [0, 1]) if (/^\d+$/.test(entered[i] ?? "")) score[i] = Number(entered[i]);

  let winner = null;
  const explicit = (p.get("winner") ?? "").trim();
  if (explicit === "1" || explicit === "2") winner = Number(explicit);
  else if (entered[0] === "W" || entered[1] === "FF") winner = 1;
  else if (entered[1] === "W" || entered[0] === "FF") winner = 2;
  else if (bestOf) {
    const needed = Math.floor(bestOf / 2) + 1;
    if (score[0] >= needed) winner = 1;
    else if (score[1] >= needed) winner = 2;
  }
  const forfeit = entered.some((s) => s === "W" || s === "FF");
  return {
    teams: opponents.map((o) => o.name),
    placeholders: opponents.map((o) => o.placeholder),
    date: readDate(p.get("date")),
    bestOf,
    score: forfeit ? null : score,
    winner,
    games,
  };
}

// ─────────────────────────────────────────────────────────────
// Round, group and stage labels
// ─────────────────────────────────────────────────────────────

/**
 * An English label of the page ("Upper Bracket QFs", "Week 3", "Group A")
 * mapped to a translatable key. An unknown label returns `null`: the page then
 * shows the source text as is.
 */
export function sourceLabel(text) {
  if (!text) return null;
  let t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/ matches$/, "");
  let side = null;
  const s = /^(upper|lower)(?: bracket)? (.+)$/.exec(t);
  if (s) {
    side = s[1];
    t = s[2];
  }
  t = t.replace(/^qfs?$/, "quarterfinals").replace(/^sfs?$/, "semifinals").replace(/^gfs?$/, "grand final");
  const withSide = (label) => (side ? { ...label, side } : label);
  if (/^grand finals?$/.test(t)) return withSide({ kind: "grandFinal" });
  if (/^(3rd|third) place( match| decider)?$/.test(t)) return withSide({ kind: "thirdPlace" });
  if (/^finals?$/.test(t)) return withSide({ kind: "final" });
  if (/^semi ?finals?$/.test(t)) return withSide({ kind: "semifinal" });
  if (/^quarter ?finals?$/.test(t)) return withSide({ kind: "quarterfinal" });
  const n = /^(round|week|day) (\d+)$/.exec(t);
  if (n) return withSide({ kind: n[1], n: Number(n[2]) });
  // "Wildcard Group A": the stage name is already the section heading.
  const g = /^(?:(?:wild ?card|play ?ins?|group stage|swiss stage) )?group ([a-z0-9])$/.exec(t);
  if (g && !side) return { kind: "group", letter: g[1].toUpperCase() };
  return null;
}

const STAGES = [
  ["wildcard", /^wild ?card$/i],
  ["playIn", /^play-?ins?$/i],
  ["groupStage", /^group stage$/i],
  ["swissStage", /^swiss stage$/i],
  ["regularSeason", /^regular season$/i],
  ["knockoutStage", /^knockout stage$/i],
  ["playoffs", /^playoffs$/i],
  ["mainEvent", /^main event$/i],
  ["finals", /^finals$/i],
];

/** Stage key of a subpage ("Regular Season"); `null` when the page is not a stage. */
export function stageKey(name) {
  return STAGES.find(([, pattern]) => pattern.test(name.trim()))?.[0] ?? null;
}

/** Display order of the stages: the order they are played in. */
export const STAGE_ORDER = STAGES.map(([key]) => key);

// ─────────────────────────────────────────────────────────────
// Page analysis
// ─────────────────────────────────────────────────────────────

const CONTAINERS = ["matchlist", "bracket", "bracketgrouptoggle"];
const TABLES = ["grouptableleague", "swisstableleague"];
const isMatch = (value) => /^\{\{\s*match\b/i.test(value);

function readTable(block) {
  const p = params(block.body);
  const n = p.named;
  const teams = [];
  const zones = [];
  for (const [key, value] of p.order) {
    const t = key && /^(?:team|t)(\d+)$/.exec(key);
    if (t && plainText(value)) teams.push({ name: plainText(value), zone: (n.get(`bg${t[1]}`) ?? "").trim() || null });
    const z = key && /^pbg(\d+)$/.exec(key);
    if (z) zones[Number(z[1]) - 1] = value.trim() || null;
  }
  return {
    kind: block.name === "swisstableleague" ? "swiss" : "league",
    title: plainText(n.get("title") ?? "") || null,
    teams,
    zones: Array.from(zones, (z) => z ?? null),
    // Without a game differential (`diff=false`), only series break ties.
    gameDiff: (n.get("diff") ?? "").trim() !== "false",
  };
}

function readContainer(block) {
  const p = params(block.body);
  const matches = [];
  if (block.name === "matchlist") {
    for (const [key, value] of p.order) {
      if (key && /^m\d+$/.test(key) && isMatch(value)) matches.push({ ...readMatch(blocks(value)[0].body), round: null });
    }
    const title = plainText(p.named.get("title") ?? p.named.get("matchsection") ?? "") || null;
    return { kind: "list", title, matches };
  }
  /*
   * Bracket: the round name comes from an `RxMyheader` parameter (what the
   * rendered page shows) or else from a comment. It applies to its match and
   * to the following matches of the same round: `R1M5header` opens the lower
   * bracket inside round 1.
   */
  const explicit = new Map();
  for (const [key, value] of p.order) {
    const h = key && /^(r\d+m\d+)header$/.exec(key);
    if (h) explicit.set(h[1], plainText(value));
  }
  let comment = null;
  let current = null;
  let currentRound = null;
  for (const [key, value] of p.order) {
    if (key === "§header") {
      comment = value.trim();
      continue;
    }
    const m = key && /^r(\d+)m\d+$/.exec(key);
    if (!m || !isMatch(value)) continue;
    if (explicit.get(key)) current = explicit.get(key);
    else if (comment) current = comment;
    else if (currentRound !== m[1]) current = null;
    comment = null;
    currentRound = m[1];
    matches.push({ ...readMatch(blocks(value)[0].body), round: current, roundNumber: Number(m[1]) });
  }
  const title = plainText(p.named.get("matchsection") ?? p.named.get("title") ?? "") || null;
  return { kind: block.name === "bracketgrouptoggle" ? "group" : "bracket", title, matches };
}

/**
 * Everything a page brings: infobox, standings tables and matches grouped by
 * container. Serializable result, cached per revision.
 */
export function analyzePage(raw) {
  const text = prepare(raw);
  return {
    infobox: readInfobox(text),
    tables: find(text, TABLES).map(readTable),
    containers: find(text, CONTAINERS).map(readContainer).filter((c) => c.matches.length > 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Names: heroes and teams
// ─────────────────────────────────────────────────────────────

/** `['alias'] = 'Name'` table of a Lua module (Module:HeroNames). */
export function readAliasTable(source) {
  const table = {};
  const pattern = /\[\s*(['"])((?:\\.|(?!\1).)*)\1\s*\]\s*=\s*(['"])((?:\\.|(?!\3).)*)\3/g;
  for (const m of source.matchAll(pattern)) {
    table[m[2].replace(/\\(.)/g, "$1").toLowerCase()] = m[4].replace(/\\(.)/g, "$1");
  }
  return table;
}

export const normalizeName = (name) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/**
 * Name entered in a draft ("guin", "yss") → site slug. The alias first goes
 * through Liquipedia's own table, then the name is compared with ours without
 * punctuation ("Yi Sun-shin", "X.Borg"). An unknown name is counted apart, to
 * be reported rather than guessed.
 */
export function createHeroResolver(aliases, siteHeroes) {
  const byName = new Map(siteHeroes.map((h) => [normalizeName(h.nom), h.slug]));
  const unknown = new Map();
  const lookup = (raw) => {
    const key = raw.toLowerCase().trim();
    return byName.get(normalizeName(aliases[key] ?? raw)) ?? byName.get(normalizeName(raw)) ?? null;
  };
  const resolve = (raw) => {
    const slug = lookup(raw);
    if (!slug) {
      const key = raw.toLowerCase().trim();
      unknown.set(key, (unknown.get(key) ?? 0) + 1);
    }
    return slug;
  };
  // `lookup` does not count: drafts re-read games that are already counted.
  return { resolve, lookup, unknown };
}

/** Team key the way Liquipedia resolves its team templates. */
export const teamKey = (name) => name.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();

// ─────────────────────────────────────────────────────────────
// Aggregates
// ─────────────────────────────────────────────────────────────

/**
 * Standings of a table, recomputed from the page's results: series won, then
 * lost, then game differential when the page counts it. Two teams tied on all
 * of these share the rank; the head-to-head that Liquipedia applies next is
 * not redone.
 */
export function rankStandings(table, matches, teamName) {
  const rows = table.teams.map((t) => ({ team: teamName(t.name), teamZone: t.zone, series: [0, 0], games: [0, 0] }));
  const byTeam = new Map(rows.map((r) => [r.team, r]));
  for (const m of matches) {
    const [a, b] = m.teams.map((t) => (t ? teamName(t) : null));
    const ra = byTeam.get(a);
    const rb = byTeam.get(b);
    if (!ra || !rb || !m.winner) continue;
    const [winner, loser] = m.winner === 1 ? [ra, rb] : [rb, ra];
    winner.series[0] += 1;
    loser.series[1] += 1;
    if (m.score) {
      ra.games[0] += m.score[0];
      ra.games[1] += m.score[1];
      rb.games[0] += m.score[1];
      rb.games[1] += m.score[0];
    }
  }
  const diff = (r) => (table.gameDiff ? r.games[0] - r.games[1] : 0);
  const tieKey = (r) => `${r.series[0]}|${r.series[1]}|${diff(r)}`;
  rows.sort(
    (x, y) =>
      y.series[0] - x.series[0] ||
      x.series[1] - y.series[1] ||
      diff(y) - diff(x) ||
      y.games[0] - x.games[0] ||
      x.team.localeCompare(y.team),
  );
  return rows.map((r, i) => ({
    rank: rows.findIndex((other) => tieKey(other) === tieKey(r)) + 1,
    team: r.team,
    series: r.series,
    games: r.games,
    // The team's own zone (qualified, eliminated) wins over the position's.
    zone: r.teamZone ?? table.zones[i] ?? null,
  }));
}

/** Played games whose draft is entered: the basis of every hero statistic. */
export const hasDraft = (g) => g.winner !== null && g.picks[0].length + g.picks[1].length > 0;

/**
 * Picks, bans, wins and losses per hero. A hero cannot be both picked and
 * banned in the same game, so presence (picks + bans over games) stays under
 * 100%.
 */
export function heroCounts(matches, resolve) {
  const counts = new Map();
  const row = (slug) => {
    if (!counts.has(slug)) counts.set(slug, { slug, picks: 0, bans: 0, wins: 0, losses: 0 });
    return counts.get(slug);
  };
  let games = 0;
  for (const m of matches) {
    for (const g of m.games) {
      if (!hasDraft(g)) continue;
      games += 1;
      for (const team of [0, 1]) {
        const won = g.winner === team + 1;
        for (const raw of g.picks[team]) {
          const slug = resolve(raw);
          if (!slug) continue;
          const r = row(slug);
          r.picks += 1;
          if (won) r.wins += 1;
          else r.losses += 1;
        }
        for (const raw of g.bans[team]) {
          const slug = resolve(raw);
          if (slug) row(slug).bans += 1;
        }
      }
    }
  }
  const heroes = [...counts.values()].sort(
    (a, b) => b.picks + b.bans - (a.picks + a.bans) || b.picks - a.picks || a.slug.localeCompare(b.slug),
  );
  return { games, heroes };
}

/** Latest matches played with their draft, most recent first. */
export function recentDrafts(matches, count, lookup, teamName) {
  return matches
    .filter((m) => m.date && m.games.some(hasDraft) && m.teams[0] && m.teams[1])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count)
    .map((m) => ({
      date: m.date,
      stage: m.stage ?? null,
      teams: m.teams.map(teamName),
      score: m.score,
      winner: m.winner,
      games: m.games.filter(hasDraft).map((g) => ({
        winner: g.winner,
        duration: g.duration,
        team1Side: g.team1Side,
        // An unrecognized hero keeps its source name rather than vanishing from the draft.
        picks: g.picks.map((l) => l.map((h) => lookup(h) ?? h)),
        bans: g.bans.map((l) => l.map((h) => lookup(h) ?? h)),
      })),
    }));
}

/** Matches of a container, grouped by round, in page order. */
export function bracketRounds(container, teamName) {
  const rounds = [];
  for (const m of container.matches) {
    const title = m.round ?? null;
    const key = container.kind === "list" ? null : title ?? `#${m.roundNumber}`;
    let round = rounds.at(-1);
    if (!round || round.key !== key) {
      round = { key, title, label: sourceLabel(title), number: m.roundNumber ?? null, matches: [] };
      rounds.push(round);
    }
    round.matches.push({
      teams: m.teams.map((t) => (t ? teamName(t) : null)),
      placeholders: m.placeholders,
      score: m.score,
      winner: m.winner,
      date: m.date,
    });
  }
  return rounds.map(({ title, label, number, matches }) => ({ title, label, number, matches }));
}

/**
 * Champion of a tournament: winner of the last match of the last bracket, when
 * it is a final (grand final, or a final outside a lower bracket). Nothing
 * otherwise — the final placements of the page are computed by Liquipedia, not
 * entered.
 */
export function findChampion(stages) {
  const last = stages.at(-1);
  if (!last) return null;
  for (const bracket of [...last.brackets].reverse()) {
    const round = bracket.rounds.at(-1);
    const l = round?.label;
    if (!l || !["grandFinal", "final"].includes(l.kind) || l.side === "lower") continue;
    const m = round.matches.at(-1);
    if (m?.winner && m.teams[m.winner - 1]) return m.teams[m.winner - 1];
  }
  return null;
}

/**
 * A tournament from its analyzed pages: stages (standings and brackets), hero
 * counts, latest drafts. `stages`: subpages in playing order,
 * `{ title, key, page, analysis }`.
 */
export function buildTournament(stages, { resolve, lookup = resolve, teamName, drafts = 10 }) {
  const all = [];
  const out = [];
  for (const stage of stages) {
    const { tables, containers } = stage.analysis;
    const matches = containers.flatMap((c) => c.matches.map((m) => ({ ...m, stage: stage.title })));
    all.push(...matches);
    // Standings come from group and list matches, not from a final bracket
    // that may follow on the same page.
    const sources = containers.filter((c) => c.kind !== "bracket").flatMap((c) => c.matches);
    const standings = tables.map((t) => ({
      title: t.title,
      label: sourceLabel(t.title),
      kind: t.kind,
      rows: rankStandings(t, sources, teamName),
    }));
    // A match list is only shown when no standings table sums it up.
    const shown = containers.filter((c) => c.kind !== "list" || tables.length === 0);
    out.push({
      title: stage.title,
      key: stage.key,
      page: stage.page,
      standings,
      brackets: shown.map((c) => ({ title: c.title, label: sourceLabel(c.title), rounds: bracketRounds(c, teamName) })),
    });
  }
  const { games, heroes } = heroCounts(all, resolve);
  const played = all.filter((m) => m.winner && m.date).map((m) => m.date).sort();
  const upcoming = all.filter((m) => !m.winner && m.date && m.teams[0] && m.teams[1]).map((m) => m.date).sort();
  return {
    stages: out,
    games,
    matches: all.filter((m) => m.winner).length,
    lastMatch: played.at(-1) ?? null,
    nextMatch: upcoming[0] ?? null,
    champion: findChampion(out),
    heroes,
    drafts: recentDrafts(all, drafts, lookup, teamName),
  };
}

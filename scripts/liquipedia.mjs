/**
 * Liquipedia MediaWiki API client, shared by the esports sync and the patch
 * list sync.
 *
 * The API terms (https://liquipedia.net/api-terms-of-use) are followed to the
 * letter: descriptive User-Agent with a contact, gzip, one request at a time,
 * two seconds between requests and thirty seconds between renders
 * (`action=parse`, and `expandtemplates`, treated the same way). The
 * throttle is per process: the scripts using this module share it.
 * Liquipedia content is licensed under CC BY-SA 3.0: every page showing it
 * credits it.
 */
export const API = "https://liquipedia.net/mobilelegends/api.php";
export const WIKI = "https://liquipedia.net/mobilelegends/";
export const USER_AGENT = "MLBBDex/1.0 (+https://mlbbdex.com; contact@leoderoin.fr)";
export const LICENSE = { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" };

const INTERVAL = 2100;
const RENDER_INTERVAL = 31000;
/** Titles per request: the API caps at 50, and page contents add up fast. */
const CONTENT_BATCH = 10;
const TITLE_BATCH = 50;

/** Address of a page on the wiki. */
export const pageUrl = (title) => `${WIKI}${encodeURI(title.replace(/ /g, "_"))}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
let lastRender = 0;
let requests = 0;

/** Requests sent so far, for the run summary. */
export const requestCount = () => requests;

export async function api(parameters, { render = false } = {}) {
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
      requests += 1;
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

export const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** Title as the wiki uses it, after normalization and redirects. */
export function resolver(query) {
  const to = new Map();
  for (const n of [...(query.normalized ?? []), ...(query.redirects ?? [])]) to.set(n.from, n.to);
  return (title) => {
    let t = title;
    for (let i = 0; i < 3 && to.has(t); i += 1) t = to.get(t);
    return t;
  };
}

/** Latest revision of each title; `null` for a missing page. */
export async function revisions(titles) {
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
export async function contents(titles) {
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

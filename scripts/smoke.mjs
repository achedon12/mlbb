#!/usr/bin/env node
/**
 * Smoke test of the live site: the key pages answer, render a full page, and
 * carry no error screen; a sample of the sitemap does too.
 *
 *   node scripts/smoke.mjs [base]      (default https://mlbbdex.com)
 *
 * Exits 1 with a "::error::" line per failure (GitHub then emails the owner),
 * 0 when everything answered. Read-only: GET requests only, a pause between
 * them, and nothing that needs a login.
 */

const BASE = (process.argv[2] ?? "https://mlbbdex.com").replace(/\/$/, "");
const UA = "MLBBDex-smoke/1.0 (+https://mlbbdex.com)";
const PAUSE_MS = 400;
const SAMPLE = 25;

/** [path, text the page must contain]. */
export const KEY_PAGES = [
  ["/fr", "MLBBDex"],
  ["/en", "MLBBDex"],
  ["/fr/heroes", "Héros"],
  ["/fr/heroes/ling", "Ling"],
  ["/fr/heroes/nolan", "Nolan"],
  ["/en/heroes/fanny", "Fanny"],
  ["/fr/tier-list", "Tier"],
  ["/fr/meta", "MLBBDex"],
  ["/fr/statistics", "MLBBDex"],
  ["/fr/items", "MLBBDex"],
  ["/fr/items/blade-of-despair", "MLBBDex"],
  ["/fr/emblems", "MLBBDex"],
  ["/fr/spells", "MLBBDex"],
  ["/fr/patch-notes", "MLBBDex"],
  ["/fr/news", "MLBBDex"],
  ["/fr/guides", "MLBBDex"],
  ["/fr/skins", "MLBBDex"],
  ["/fr/ranks", "MLBBDex"],
  ["/fr/draft", "MLBBDex"],
  ["/fr/compare", "MLBBDex"],
  ["/fr/tools/build", "MLBBDex"],
  ["/fr/login", "MLBBDex"],
  ["/fr/about", "MLBBDex"],
  ["/fr/privacy", "MLBBDex"],
];

/** Signs of an error screen inside a 200 page. */
// "This page could not be found" is in every page (the not-found boundary
// ships with the layout); a page that really fell into it carries the
// NEXT_HTTP_ERROR_FALLBACK digest, even when it answered 200 while streaming.
const ERROR_SIGNS = [/Application error/i, /Internal Server Error/i, /NEXT_HTTP_ERROR_FALLBACK/, /Unhandled Runtime Error/i];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  return { status: response.status, body: await response.text() };
}

/**
 * What is wrong with this answer, or null.
 * @param {{ status: number, body: string }} answer
 * @param {string | null} [expected] text the page must contain
 * @returns {string | null}
 */
export function problem({ status, body }, expected = null) {
  if (status !== 200) return `HTTP ${status}`;
  if (!/<\/html>\s*$/i.test(body.trim())) return "page cut short (no </html>)";
  const sign = ERROR_SIGNS.find((re) => re.test(body));
  if (sign) return `error screen (${sign.source})`;
  if (expected && !body.includes(expected)) return `"${expected}" missing`;
  return null;
}

/** Every <loc> of a sitemap document. */
export function locs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

async function sitemapSample() {
  const index = await get(`${BASE}/sitemap.xml`);
  if (index.status !== 200) return { urls: [], error: `sitemap.xml: HTTP ${index.status}` };
  const urls = [];
  for (const map of locs(index.body)) {
    const sub = await get(map.replace("https://mlbbdex.com", BASE));
    if (sub.status === 200) urls.push(...locs(sub.body).filter((u) => !/\.(png|webp|jpg|xml)$/.test(u)));
    await sleep(PAUSE_MS);
  }
  // A different sample each day, the same within a day.
  const day = Math.floor(Date.now() / 86_400_000);
  const picked = [];
  for (let i = 0; i < Math.min(SAMPLE, urls.length); i++) picked.push(urls[(day * 7919 + i * 104_729) % urls.length]);
  return { urls: [...new Set(picked)], error: null };
}

async function main() {
  const failures = [];
  for (const [path, expected] of KEY_PAGES) {
    try {
      const p = problem(await get(BASE + path), expected);
      if (p) failures.push(`${path}: ${p}`);
    } catch (e) {
      failures.push(`${path}: ${e?.message ?? e}`);
    }
    await sleep(PAUSE_MS);
  }

  const { urls, error } = await sitemapSample().catch((e) => ({ urls: [], error: `sitemap: ${e?.message ?? e}` }));
  if (error) failures.push(error);
  for (const url of urls) {
    const target = url.replace("https://mlbbdex.com", BASE);
    try {
      const p = problem(await get(target));
      if (p) failures.push(`${new URL(target).pathname}: ${p}`);
    } catch (e) {
      failures.push(`${url}: ${e?.message ?? e}`);
    }
    await sleep(PAUSE_MS);
  }

  const checked = KEY_PAGES.length + urls.length;
  if (failures.length) {
    for (const f of failures) console.log(`::error::${f}`);
    console.log(`${failures.length} of ${checked} pages failed.`);
    process.exit(1);
  }
  console.log(`${checked} pages answered correctly.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

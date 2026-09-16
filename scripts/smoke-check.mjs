#!/usr/bin/env node
/**
 * Content smoke check of a running MLBBDex.
 *
 *   node scripts/smoke-check.mjs <baseUrl>
 *   node scripts/smoke-check.mjs https://mlbbdex.com
 *   node scripts/smoke-check.mjs http://127.0.0.1:3009
 *
 * Checking status codes is not enough: a page whose title reads
 * "Best {plural} in MLBB", or an API answering `{connecte}` instead of
 * `{connected}`, still answers 200. This script fetches a representative set
 * of pages in every language and the endpoints the client depends on, then
 * checks what they contain (see `smoke-check-rules.mjs`).
 *
 * Exits 1 with the list of every failure, 0 when everything passes. No
 * dependency: Node 22 and its global fetch. Polite with production: a few
 * requests at a time, a timeout and a single retry.
 */
import {
  ENDPOINTS,
  checkSitemapChild,
  checkSitemapUnion,
  LOCALES,
  MISSING_PAGE,
  EDGE_PATHS,
  PAGES,
  findPlaceholders,
  inspectPage,
  resolvePages,
  sitemapIndexLocs,
  sitemapPaths,
} from "./smoke-check-rules.mjs";

const USER_AGENT = "MLBBDex-smoke/1.0";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS) || 30_000;
const CONCURRENCY = Math.min(4, Math.max(1, Number(process.env.SMOKE_CONCURRENCY) || 3));

/** One GET, with a timeout, retried once on a network error, a timeout or a 5xx. */
async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = await response.text();
      if (response.status >= 500 && attempt === 1) {
        lastError = new Error(`status ${response.status}`);
        continue;
      }
      return { status: response.status, body, finalUrl: response.url, contentType: response.headers.get("content-type") ?? "" };
    } catch (error) {
      lastError = error;
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError;
}

/** Runs `task` over `items`, at most `limit` at a time, keeping the order of results. */
async function pool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const describeError = (error) => (error?.name === "TimeoutError" ? `timeout after ${TIMEOUT_MS} ms` : String(error?.message ?? error));

async function main() {
  const argument = process.argv[2];
  if (!argument || argument === "--help" || argument === "-h") {
    console.error("Usage: node scripts/smoke-check.mjs <baseUrl>   (e.g. https://mlbbdex.com)");
    process.exit(argument ? 0 : 2);
  }
  let base;
  try {
    base = new URL(argument);
  } catch {
    console.error(`Invalid base URL: ${argument}`);
    process.exit(2);
  }
  const origin = base.origin;
  const started = Date.now();
  /** @type {{ target: string, problems: string[] }[]} */
  const failures = [];
  let checked = 0;

  const record = (target, problems) => {
    checked++;
    if (problems.length) failures.push({ target, problems });
    console.log(`${problems.length ? "FAIL" : "ok  "} ${target}${problems.length ? `\n       - ${problems.join("\n       - ")}` : ""}`);
  };

  console.log(`Smoke check of ${origin} (concurrency ${CONCURRENCY})\n`);

  // Endpoints first: the sitemap they include also resolves the page table.
  let sitemap = "";
  await pool(ENDPOINTS, CONCURRENCY, async (endpoint) => {
    const target = endpoint.path;
    try {
      const { status, body } = await get(origin + endpoint.path);
      if (endpoint.path === "/sitemap.xml") sitemap = body;
      const problems = status === 200 ? [] : [`status ${status}, expected 200`];
      if (status === 200) {
        let parsed = body;
        if (endpoint.type === "json") {
          try {
            parsed = JSON.parse(body);
          } catch {
            problems.push("body is not valid JSON");
            parsed = undefined;
          }
        }
        if (parsed !== undefined) problems.push(...endpoint.check(parsed));
        if (endpoint.placeholders !== false) {
          const found = findPlaceholders(body);
          if (found.length) problems.push(`placeholder in body: ${found.join(", ")}`);
        }
      }
      record(target, problems);
    } catch (error) {
      record(target, [describeError(error)]);
    }
  });

  // Child sitemaps listed by the index, fetched from this server whatever host
  // their addresses name; their URLs together make the sitemap.
  /** @type {Record<string, string[]>} */
  const pathsByChild = {};
  const children = sitemapIndexLocs(sitemap).map((loc) => {
    try {
      return new URL(loc).pathname;
    } catch {
      return loc;
    }
  });
  await pool(children, CONCURRENCY, async (path) => {
    try {
      const { status, body, contentType } = await get(origin + path);
      const problems = status === 200 ? [] : [`status ${status}, expected 200`];
      if (status === 200) {
        if (!/^(application|text)\/xml\b/.test(contentType)) problems.push(`content type "${contentType}", expected XML`);
        problems.push(...checkSitemapChild(body));
        pathsByChild[path] = sitemapPaths(body);
      }
      record(path, problems);
    } catch (error) {
      record(path, [describeError(error)]);
    }
  });
  if (children.length) record("sitemap URLs (all children)", checkSitemapUnion(pathsByChild));
  const sitemapUrls = children.flatMap((path) => pathsByChild[path] ?? []);

  // Page table, resolved against the sitemap the server itself publishes.
  const { pages, problems: tableProblems } = resolvePages(sitemapUrls, PAGES);
  if (tableProblems.length) record("page table vs sitemap", tableProblems);

  const targets = pages.flatMap((page) =>
    page.locales.filter((l) => LOCALES.includes(l)).map((locale) => ({ page, locale, path: `/${locale}${page.path}` })),
  );
  await pool(targets, CONCURRENCY, async ({ page, locale, path }) => {
    try {
      const { status, body } = await get(origin + path);
      record(path, inspectPage({ html: body, status, locale, page }));
    } catch (error) {
      record(path, [describeError(error)]);
    }
  });

  try {
    const { status } = await get(origin + MISSING_PAGE);
    record(`${MISSING_PAGE} (missing page)`, status === 404 ? [] : [`status ${status}, expected 404`]);
  } catch (error) {
    record(`${MISSING_PAGE} (missing page)`, [describeError(error)]);
  }

  for (const { path, status: expected, type, why } of EDGE_PATHS) {
    const label = `${path} (${why ?? `expects ${expected}`})`;
    try {
      const { status, contentType } = await get(origin + path);
      const problems = [];
      if (status !== expected) problems.push(`status ${status}, expected ${expected}`);
      if (type && !contentType.includes(type)) problems.push(`content type "${contentType}", expected ${type}`);
      record(label, problems);
    } catch (error) {
      record(label, [describeError(error)]);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length) {
    console.log(`\n${failures.length} of ${checked} checks failed (${seconds} s):\n`);
    for (const { target, problems } of failures) {
      console.log(`  ${target}`);
      for (const problem of problems) console.log(`    - ${problem}`);
    }
    process.exit(1);
  }
  console.log(`\nAll ${checked} checks passed (${seconds} s).`);
}

await main();

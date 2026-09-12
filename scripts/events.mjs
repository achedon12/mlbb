/**
 * Events calendar: the StarLight and Collector skins of every month.
 *
 *     node scripts/events.mjs
 *
 * The wiki's skin module dates these two series poorly (a StarLight skin can
 * stay "upcoming" there months after its release) and lags months behind the
 * list pages. The "StarLight" and "Collector Skins" pages, on the other hand,
 * keep one gallery per month, reviewed by the community: "Hanabi - Chic
 * Glamour / September 2025". This script reads them and writes
 * `src/data/jeu/events.json`, which the site joins to the skin catalogue.
 *
 * Nothing is translated here: hero and skin names stay as in the game. The
 * "Upcoming content" page is not read: it collects leaks, without dates.
 *
 * Two requests only, spaced out; on failure the previous file stays in place.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const WIKI = "https://mobilelegends.fandom.com";
const UA = "MLBB-sync/1.0 (https://mlbbdex.com; contact via github.com/achedon12)";
const OUTPUT = "src/data/jeu/events.json";
const HEROES = "src/data/jeu/heros.json";

/** Pages read, and the section holding the monthly list. */
export const PAGES = {
  starlight: { title: "StarLight", section: "Starlight Member Skins" },
  collector: { title: "Collector Skins", section: "Collector Skins List" },
};

/**
 * A list that loses more than a fifth of its entries between two runs has
 * more likely been broken (vandalism, rewrite) than pruned: the previous one
 * is kept instead.
 */
const TOLERATED_LOSS = 0.8;

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Comparison key for a hero name: "Yi Sun-Shin" and "Yi Sun-shin" meet. */
export const nameKey = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** Body of a level-2 section (`== Title ==`), subsections included. */
export function level2Section(wikitext, title) {
  const lines = wikitext.split("\n");
  const target = nameKey(title);
  const start = lines.findIndex((l) => /^==[^=]/.test(l) && nameKey(l.replace(/=/g, "")) === target);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^==[^=]/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

/** "[[Hanabi]]" and "[[Page|Label]]" keep their label; bold and repeated spaces go. */
const plainText = (s) =>
  s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Entries of a monthly gallery. A line reads
 * `File:Hero106011-portrait.png|'''Hanabi - Chic Glamour'''<br>September 2025`;
 * the portrait number is the skin's id in the wiki module. "No Collector
 * Skin Released" (portrait Hero000) states that no skin came out that month:
 * that is information, kept as such.
 */
export function readGallery(wikitext) {
  const entries = [];
  const line = /^(?:File:|Image:)?([^|\n]+)\|'''(.+?)'''\s*<br\s*\/?>\s*([A-Za-z]+)\.?\s+(\d{4})/gm;
  for (const [, file, caption, monthName, year] of wikitext.matchAll(line)) {
    const month = MONTHS[monthName.toLowerCase()];
    if (!month) continue;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const id = /^Hero(\d+)-portrait\./i.exec(file.trim())?.[1] ?? null;
    const text = plainText(caption);
    // Hero names never contain "space, dash, space": the first one splits hero from skin.
    const cut = text.indexOf(" - ");
    if (id === "000" || cut < 0) {
      if (/^no .*released$/i.test(text)) entries.push({ month: key, none: true });
      continue;
    }
    entries.push({ month: key, heroName: text.slice(0, cut).trim(), skin: text.slice(cut + 3).trim(), id });
  }
  return entries;
}

/** Entries linked to their hero's slug; an unknown hero keeps its name, without a slug. */
export function attachHeroes(entries, heroes) {
  const byName = new Map(heroes.map((h) => [nameKey(h.name), h.slug]));
  return entries.map((e) => (e.none ? e : { ...e, hero: byName.get(nameKey(e.heroName)) ?? null }));
}

/** Stable order: month ascending, then hero, so that diffs between runs stay readable. */
export const sortEntries = (entries) =>
  [...entries].sort(
    (a, b) => a.month.localeCompare(b.month) || (a.heroName ?? "").localeCompare(b.heroName ?? "", "en"),
  );

async function api(params) {
  const url = new URL(`${WIKI}/api.php`);
  for (const [k, v] of Object.entries({ ...params, format: "json" })) url.searchParams.set(k, v);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45000) });
      if (response.ok) return response.json();
      if (response.status === 429) await pause(3000 * attempt);
      else throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
      await pause(1500 * attempt);
    }
  }
  throw new Error("Wiki unreachable.");
}

/** Text and revision of a page: the revision dates the version that was read. */
async function readPage(title) {
  const data = await api({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content|timestamp|ids",
    rvslots: "main",
    redirects: "1",
  });
  const page = Object.values(data.query.pages)[0];
  const rev = page?.revisions?.[0];
  if (!rev) throw new Error(`Page not found: ${title}`);
  return {
    title: page.title,
    url: `${WIKI}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    revision: rev.revid,
    modified: rev.timestamp,
    text: rev.slots.main["*"],
  };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const heroes = await readJson(HEROES);
  if (!Array.isArray(heroes)) throw new Error(`${HEROES} unreadable: run the sync first.`);
  const previous = await readJson(OUTPUT);

  const output = { updated: new Date().toISOString().slice(0, 10), sources: {} };
  for (const [key, { title, section }] of Object.entries(PAGES)) {
    const page = await readPage(title);
    const body = level2Section(page.text, section);
    if (!body) throw new Error(`Section "${section}" missing from ${title}`);
    const entries = sortEntries(attachHeroes(readGallery(body), heroes));
    const before = previous?.[key] ?? [];
    const keep = before.length > 0 && entries.length < before.length * TOLERATED_LOSS;
    if (keep) {
      console.warn(`  ${title}: ${entries.length} entries against ${before.length} — previous list kept`);
      output[key] = before;
      output.sources[key] = previous.sources[key];
    } else {
      output[key] = entries;
      output.sources[key] = { title: page.title, url: page.url, revision: page.revision, modified: page.modified };
    }
    const orphans = output[key].filter((e) => !e.none && !e.hero);
    console.log(`  ${title}: ${output[key].length} entries, up to ${output[key].at(-1)?.month ?? "—"}`);
    for (const o of orphans) console.warn(`    unknown hero: ${o.heroName} (${o.skin}, ${o.month})`);
    await pause(1000);
  }

  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Written: ${OUTPUT}`);
}

// Imported by the tests for its pure functions: run nothing in that case.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await main();
  } catch (error) {
    console.error(`Events not updated: ${error.message}`);
    process.exitCode = 1;
  }
}

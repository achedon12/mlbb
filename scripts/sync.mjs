/**
 * Game data synchronization.
 *
 * Everything the site shows about heroes, skins, items and patches is
 * extracted from the community wiki, which stores its data in Scribunto
 * modules — structured Lua tables, far more reliable to read than rendered
 * HTML.
 *
 *     npm run sync            data only
 *     npm run sync -- --images   data + visuals download
 *
 * The output is written to `src/data/game/`. Visuals go to `public/visuels/`,
 * versioned with the repository: the image build needs no access to the wiki.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { analyzeTableLua } from "./lua.mjs";
import { clean, count, empty, normalizeHeroes, slugify } from "./heroes.mjs";
import { splitSections, cleanRender, newHeroes, toc } from "./patch-notes.mjs";
import {
  cleanDescription,
  withoutTags,
  extractStory,
  sectionsPage,
  cleanLore,
} from "./wikitext.mjs";
import { heroAdjustments, summary } from "./patch-parser.mjs";
import { extractIllustrations, normalizeNameSkin } from "./gallery.mjs";
import {
  rounded,
  chooseGuide,
  heroCombos,
  duosOfRank,
  mergeDuos,
  mergeHistory,
  serializeDuos,
  dailyStreak,
} from "./measures.mjs";

const WIKI = "https://mobilelegends.fandom.com/api.php";
/**
 * Match statistics.
 *
 * The wiki describes the game but measures nothing. This community API exposes
 * the win, ban and pick rates reported by the game — the only verifiable
 * source for a ranking that is not an opinion.
 */
const STATS = "https://arena.rone.dev/api";

/** Number of patch notes whose full content is fetched. */
const DETAILED_PATCHES = 12;
const UA = "MLBB-sync/1.0 (https://mlbbdex.com; contact via github.com/achedon12)";
const OUTPUT = "src/data/game";

const WITH_IMAGES = process.argv.includes("--images");

// ─────────────────────────────────────────────────────────────
// Wiki access
// ─────────────────────────────────────────────────────────────

async function api(settings) {
  const url = new URL(WIKI);
  for (const [c, v] of Object.entries({ ...settings, format: "json" })) {
    url.searchParams.set(c, v);
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(45000),
      });
      if (response.ok) return response.json();
      // 429: give the service some breathing room before retrying.
      if (response.status === 429) await pause(3000 * attempt);
      else throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
      await pause(1500 * attempt);
    }
  }
  throw new Error("Wiki unreachable.");
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function moduleLua(title) {
  const data = await api({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
  });

  const page = Object.values(data.query.pages)[0];
  if (!page?.revisions) throw new Error(`Module not found: ${title}`);

  return analyzeTableLua(page.revisions[0].slots.main["*"]);
}

// ─────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────

function normalizeSkins(raw) {
  const byHero = {};

  for (const [heroName, entry] of Object.entries(raw)) {
    const skins = Object.values(entry?.skins ?? {})
      .filter((s) => !empty(s.id) && !empty(s.name))
      .map((s) => ({
        id: String(s.id),
        name: String(s.name),
        release: clean(s.release)?.replace(/-XX/g, "") ?? null,
        availability: clean(s.availability),
        rarity: clean(s.tier),
        label: clean(s.tag),
        price: Object.fromEntries(
          Object.entries(s.price ?? {})
            .map(([m, v]) => [m, clean(v)])
            .filter(([, v]) => v),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (skins.length) byHero[slugify(heroName)] = skins;
  }

  return byHero;
}

function normalizeItems(raw) {
  return Object.entries(raw)
    .filter(([, o]) => !empty(o?.name))
    // The wiki module mixes in template rows that are not items: standalone
    // effects ("Passive - Favor") and mechanic flags ("Throw Forbidden"). None
    // has a price, stats or an effect of its own — that is what sets them
    // apart from a real item.
    // A shop item has a price, or at least stats. Anything with neither is an
    // enchantment or an interaction toggle between heroes ("Allow Throw",
    // "Passive - Favor"): the wiki keeps them in the same module, the site
    // must not present them as items.
    .filter(([, o]) => count(o.price) > 0 || !empty(o.bonus))
    .map(([, o]) => ({
      slug: slugify(o.name),
      name: String(o.name),
      summary: clean(o.caption),
      category: clean(o.type) ?? "Autre",
      price: count(o.price),
      bonus: clean(o.bonus),
      unique: clean(o.unique),
      passive: clean(o.passive),
      active: clean(o.active),
      recipe: clean(o.recipe)?.split(",").map((x) => x.trim()).filter(Boolean) ?? [],
      bestFor: clean(o.availability),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ─────────────────────────────────────────────────────────────
// Visuals
// ─────────────────────────────────────────────────────────────

/**
 * Resolves image URLs in batches.
 *
 * The wiki names visuals after the hero or skin identifier, the same
 * convention for both. Queries go out in batches of 50, the API limit for an
 * anonymous request.
 */
async function urlsImages(credentials, variant) {
  const found = {};

  for (let i = 0; i < credentials.length; i += 50) {
    const batch = credentials.slice(i, i + 50);
    const titles = batch.map((id) => `File:Hero${id}-${variant}.png`).join("|");

    const data = await api({
      action: "query",
      titles,
      prop: "imageinfo",
      iiprop: "url",
    });

    for (const page of Object.values(data.query?.pages ?? {})) {
      const source = page.imageinfo?.[0]?.url;
      if (!source) continue;
      const id = page.title.match(/Hero(\w+)-/)?.[1];
      // The cache suffix is useless and makes the URL unstable.
      if (id) found[id] = source.split("/revision/")[0];
    }

    process.stdout.write(`\r    ${variant} ${Math.min(i + 50, credentials.length)}/${credentials.length}`);
    await pause(300);
  }

  process.stdout.write("\n");
  return found;
}

/**
 * Resolves wiki files referenced by their exact name.
 *
 * Hero visuals follow a numeric convention; items, emblems, talents and
 * spells are named after their English label. This function covers the
 * second case.
 */
async function urlsFiles(names, extension = "png") {
  const found = {};

  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const titles = batch.map((n) => `File:${n}.${extension}`).join("|");

    const data = await api({
      action: "query",
      titles,
      prop: "imageinfo",
      iiprop: "url",
    });

    // The wiki normalizes some titles (spaces, apostrophes): follow its
    // redirections to get back to the requested name.
    const normalized = new Map(
      (data.query?.normalized ?? []).map((n) => [n.to, n.from]),
    );

    for (const page of Object.values(data.query?.pages ?? {})) {
      const source = page.imageinfo?.[0]?.url;
      if (!source) continue;
      const title = normalized.get(page.title) ?? page.title;
      found[title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")] =
        source.split("/revision/")[0];
    }

    await pause(300);
  }

  return found;
}

/**
 * Downloads a visual unless it is already present.
 *
 * The wiki's full-size illustrations weigh up to 3 MB each, across 745 files:
 * as is, they add more than 200 MB to the repository and to every clone. They
 * are scaled down to a useful web width and converted to WebP, which cuts the
 * size by six with no visible difference on screen. Portraits and icons,
 * already small, are copied as is.
 */
async function download(url, path, optimize = false, width = 1280) {
  if (existsSync(path)) return "exists";
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return "failed";

    const data = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(path), { recursive: true });

    if (optimize) {
      const sharp = (await import("sharp")).default;
      await sharp(data)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path);
    } else {
      await writeFile(path, data);
    }

    return "ok";
  } catch {
    return "failed";
  }
}

/**
 * Arranges visuals by hero.
 *
 * The site must not depend on any external URL: every image is copied
 * locally, under a readable path rather than the wiki's numeric identifier.
 *
 *     public/visuels/heros/khufra/portrait.png
 *     public/visuels/heros/khufra/icone.png
 *     public/visuels/heros/khufra/skins/782-desert-owl.png
 */
function planVisuals(heroes, skins, portraits, icons) {
  const plan = [];
  const paths = {};

  for (const h of heroes) {
    const folder = `visuels/heros/${h.slug}`;
    const entry = { portrait: null, icon: null, skins: {} };

    if (portraits[h.id]) {
      entry.portrait = `/${folder}/portrait.png`;
      plan.push({ url: portraits[h.id], path: `public/${folder}/portrait.png` });
    }
    if (icons[h.id]) {
      entry.icon = `/${folder}/icone.png`;
      plan.push({ url: icons[h.id], path: `public/${folder}/icone.png` });
    }

    for (const skin of skins[h.slug] ?? []) {
      const url = portraits[skin.id];
      if (!url) continue;
      const file = `${skin.id}-${slugify(skin.name)}.png`;
      entry.skins[skin.id] = `/${folder}/skins/${file}`;
      plan.push({ url, path: `public/${folder}/skins/${file}` });
    }

    paths[h.slug] = entry;
  }

  return { plan, paths };
}

/**
 * Arranges visuals that do not belong to a hero.
 *
 *     public/visuels/objets/blade-of-despair.png
 *     public/visuels/emblemes/tank.png
 *     public/visuels/talents/impure-rage.png
 *     public/visuels/sorts/flicker.png
 */
function planFiles(urls, folder) {
  const plan = [];
  const paths = {};

  for (const [name, url] of Object.entries(urls)) {
    const file = `${slugify(name)}.png`;
    paths[slugify(name)] = `/visuels/${folder}/${file}`;
    plan.push({ url, path: `public/visuels/${folder}/${file}` });
  }

  return { plan, paths };
}

/**
 * Emblems, talents and battle spells.
 *
 * The wiki exposes no data module for them: the list is declared here, and
 * every name was checked against an existing file. A name that stops existing
 * simply drops out of the visuals.
 */
const EMBLEMS = [
  "Tank Emblem", "Fighter Emblem", "Assassin Emblem",
  "Mage Emblem", "Marksman Emblem", "Support Emblem",
];

const TALENTS = [
  "Agility", "Swift", "Vitality", "Fatal", "Firmness", "Thrill", "Inspire",
  "Tenacity", "Seasoned Hunter", "Master Assassin", "Weakness Finder",
  "Impure Rage", "Quantum Charge", "Weapon Master", "Lethal Ignition",
  "Concussive Blast", "Wilderness Blessing", "Focusing Mark", "Brave Smite",
  "Killing Spree", "Festival of Blood", "Bargain Hunter",
  "Pull Yourself Together",
];

const SPELLS = [
  "Flicker", "Execute", "Retribution", "Purify", "Inspire", "Sprint",
  "Petrify", "Arrival", "Vengeance", "Aegis", "Revitalize",
];

// ─────────────────────────────────────────────────────────────
// Skills and illustrations
// ─────────────────────────────────────────────────────────────

/**
 * Extracts skills and illustrations from a hero page.
 *
 * Two pieces of information the data modules do not carry:
 *
 * - the `{{Ability}}` template declares the **English name** of each skill,
 *   which is also the name of its icon on the wiki;
 * - the "Splash art" gallery lists the full-size illustrations of each skin,
 *   much larger than the shop portraits.
 */
/**
 * Extracts the `{{Ability ...}}` templates of a page by counting braces.
 *
 * A regex would fail: the description nests other templates (`{{Scale}}`,
 * `{{ai}}`), and the template closes sometimes with "\n}}", sometimes with "}}"
 * stuck to the last field. Braces are therefore counted to find the real
 * closing, whatever the layout.
 */
function templatesAbility(wikitext) {
  const results = [];
  const re = /\{\{Ability\b/gi;
  let m;
  while ((m = re.exec(wikitext)) !== null) {
    const start = m.index;
    let depth = 0;
    let k = start;
    for (; k < wikitext.length; k += 1) {
      if (wikitext[k] === "{" && wikitext[k + 1] === "{") {
        depth += 1;
        k += 1;
      } else if (wikitext[k] === "}" && wikitext[k + 1] === "}") {
        depth -= 1;
        k += 1;
        if (depth === 0) {
          k += 1;
          break;
        }
      }
    }
    results.push({ position: start, body: wikitext.slice(start + 2, k - 2) });
    re.lastIndex = k;
  }
  return results;
}

function extractFromPage(wikitext) {
  // Skills are declared section by section, and each section holds only one
  // — sometimes none. The search is therefore bounded between one heading and
  // the next.
  //
  // Simply taking the `{{Ability}}` templates in text order would be wrong on
  // two counts: a page mentions other heroes' skills, and a section without a
  // template would pull up the one from the following section.
  const events = [
    ...[...wikitext.matchAll(/^=+\s*(.+?)\s*=+\s*$/gm)].map((m) => ({
      position: m.index,
      type: "heading",
      value: m[1].trim().toLowerCase(),
    })),
    ...templatesAbility(wikitext).map(({ position, body }) => {
      // The description runs until the template's next field. A field name
      // may contain a digit (`term-1`), hence the wider class.
      const description = body.match(
        /\|?\s*description\s*=\s*([\s\S]+?)(?=\n\s*\|\s*[a-z0-9-]+\s*=|$)/i,
      )?.[1];

      return {
        position,
        type: "skill",
        value: withoutTags(body.match(/\|?\s*name\s*=\s*(.+)/)?.[1] ?? "").trim() || undefined,
        description: description ? cleanDescription(description) : null,
        // The icon file name, often different from the displayed name: the
        // skill "Contract: Transform" has the image "Contract Transform"
        // (without the colon, which file names lack). The whitespace after
        // the "=" is limited to the line so the next field is not captured
        // when the value is empty.
        image: body.match(/\|\s*image\s*=[ \t]*(.+)/i)?.[1]?.trim() || null,
      };
    }),
  ].sort((a, b) => a.position - b.position);

  const EXPECTED = ["passive", "skill 1", "skill 2", "ultimate"];
  const bySection = {};

  for (const [i, e] of events.entries()) {
    if (e.type !== "heading" || !EXPECTED.includes(e.value)) continue;

    // Move on to the next heading: whatever lies between the two belongs to
    // this section.
    for (const next of events.slice(i + 1)) {
      if (next.type === "heading") break;
      if (next.value) {
        bySection[e.value] = {
          name: next.value,
          description: next.description,
          image: next.image ?? null,
        };
        break;
      }
    }
  }

  // Empty slots are kept: the position in the list carries the meaning
  // (passive, skill 1, skill 2, ultimate).
  const skills = EXPECTED.map((key) => bySection[key] ?? null);

  // The "Splash art" gallery lists the full-size illustrations of each skin,
  // much larger than the shop portraits.
  const illustrations = extractIllustrations(wikitext);

  return { skills, illustrations, story: extractStory(wikitext) };
}

/** Walks through hero pages, in batches, to extract these two blocks. */
async function heroPages(heroes) {
  const output = {};

  for (let i = 0; i < heroes.length; i += 10) {
    const batch = heroes.slice(i, i + 10);

    const data = await api({
      action: "query",
      titles: batch.map((h) => h.name).join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
    });

    const byTitle = new Map(
      Object.values(data.query?.pages ?? {})
        .filter((p) => p.revisions)
        .map((p) => [p.title, p.revisions[0].slots.main["*"]]),
    );
    const redirections = new Map(
      (data.query?.redirects ?? []).map((r) => [r.from, r.to]),
    );

    for (const h of batch) {
      const text = byTitle.get(redirections.get(h.name) ?? h.name);
      if (text) output[h.slug] = extractFromPage(text);
    }

    process.stdout.write(`\r    pages ${Math.min(i + 10, heroes.length)}/${heroes.length}`);
    await pause(350);
  }

  process.stdout.write("\n");
  return output;
}

/**
 * Measured ranks, in API order.
 *
 * `all` aggregates every match; the others isolate one bracket of the ladder,
 * from Epic to Mythic Glory. Rates and matchups really change from one bracket
 * to the next — Aamon's worst opponent is not the same in Epic and in Glory —,
 * hence one measurement per rank rather than a single average.
 */
const MEASURED_RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"];

/** Game identifier to slug table, from the same endpoint as the rest. */
async function heroTableById(heroes) {
  // Game identifier to slug table, from the same endpoint as the rest.
  const response = await fetch(`${STATS}/heroes?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Hero table unavailable: HTTP ${response.status}`);

  const records = (await response.json())?.data?.records ?? [];
  const byId = new Map();
  const known = new Map(heroes.map((h) => [h.slug, h]));
  for (const r of records) {
    const name = r?.data?.hero?.data?.name;
    const id = r?.data?.hero_id;
    if (name && id != null) {
      const slug = slugify(name);
      if (known.has(slug)) byId.set(id, slug);
    }
  }
  return byId;
}

/**
 * JSON from an API address, or null if it does not answer. A transient error
 * (overload, timeout) deserves two more attempts, spaced out.
 */
async function jsonFrom(url, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (rep.ok) return await rep.json();
      if (rep.status === 404) return null;
    } catch {
      // retry
    }
    if (attempt < attempts) await pause(1000 * 2 ** attempt);
  }
  return null;
}

/**
 * Writes evolution.json: daily series, one line per hero to keep diffs
 * readable. A hero the API did not serve keeps its previous measurements, and
 * the history accumulates from one synchronization to the next.
 */
async function writeEvolution(complementary) {
  const existing = await readJson(`${OUTPUT}/evolution.json`);
  const evolution = {
    trends: { ...(existing.trends ?? {}), ...(complementary?.trends ?? {}) },
    duration: { ...(existing.duration ?? {}), ...(complementary?.duration ?? {}) },
    history: mergeHistory(existing.history ?? {}, complementary?.trends ?? {}),
  };
  const byRow = (byKey) => {
    const rows = Object.entries(byKey).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return rows.length > 0 ? `{\n${rows.join(",\n")}\n  }` : "{}";
  };
  await writeFile(
    `${OUTPUT}/evolution.json`,
    `{\n${Object.entries(evolution).map(([k, v]) => `  "${k}": ${byRow(v)}`).join(",\n")}\n}\n`,
  );
}

/**
 * `--evolution`: refreshes only teammates, trends and match durations, on
 * heroes already synchronized. Enough to fill in these measurements when the
 * API gave out during a full synchronization.
 */
async function evolutionSingle() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Run a full synchronization first.");
  // Heroes still without measurements first: a rerun fills the gaps before
  // the API saturates.
  const existing = await readJson(`${OUTPUT}/evolution.json`);
  const measure = (h) => Number(Boolean(existing.trends?.[h.slug]));
  const order = [...heroes].sort((a, b) => measure(a) - measure(b));
  console.log(`Teammates and trends (academy), ${heroes.filter((h) => !measure(h)).length} heroes without measurements…`);
  const complementary = await teammatesAndTrends(order, await heroTableById(heroes));
  const stats = await readJson(`${OUTPUT}/statistics.json`);
  stats.teammates = { ...(stats.teammates ?? {}), ...complementary.teammates };
  await Promise.all([
    writeFile(`${OUTPUT}/statistics.json`, JSON.stringify(stats, null, 2) + "\n"),
    writeEvolution(complementary),
  ]);
  console.log(`  ${Object.keys(complementary.trends).length} heroes measured`);
}

/**
 * Skill combos recommended by the game, per hero: the API describes them in
 * English and refers to each skill by its identifier, which the hero sheet
 * (`skillsArena`, see fetchArenaSkills) turns into a name. The local icon is
 * used when the skill is recognized, otherwise the CDN one.
 */
async function combosArena(heroes, skillsArena, skillsSite, icons) {
  const output = {};
  let silent = 0;
  for (const [i, h] of heroes.entries()) {
    const response = await jsonFrom(`${STATS}/heroes/${encodeURIComponent(h.name)}/skill-combos`);
    const records = response?.data?.records;
    silent = response ? 0 : silent + 1;
    if (Array.isArray(records)) {
      const combos = heroCombos(records, skillsArena[h.slug] ?? [], skillsSite[h.slug] ?? [], icons[h.slug] ?? {});
      if (combos.length > 0) output[h.slug] = combos;
    }
    process.stdout.write(`\r    combos ${i + 1}/${heroes.length}`);
    // Same safeguard as trends: a silent API will not come back before the end.
    if (silent >= 8) {
      console.warn(`\n    API silent for ${silent} heroes: stopping combos`);
      break;
    }
    await pause(200);
  }
  process.stdout.write("\n");
  return output;
}

/**
 * Writes combos.json, one line per hero. A hero the API did not serve keeps
 * its previous combos.
 */
async function writeCombos(combos) {
  const all = { ...(await readJson(`${OUTPUT}/combos.json`)), ...combos };
  const rows = Object.keys(all)
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: ${JSON.stringify(all[slug])}`);
  await writeFile(`${OUTPUT}/combos.json`, `{\n${rows.join(",\n")}\n}\n`);
  return Object.keys(all).length;
}

/**
 * `--combos`: re-reads only combos, on heroes, skills and icons already
 * synchronized. No other file is rewritten.
 */
async function combosOnly() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Run a full synchronization first.");
  console.log("Hero sheets (API)…");
  const { skills: skillsArena } = await fetchArenaSkills(heroes);
  const skillsSite = await readJson(`${OUTPUT}/skills.json`);
  const icons = (await readJson(`${OUTPUT}/visuals.json`)).skills ?? {};
  console.log("Skill combos (API)…");
  const combos = await combosArena(heroes, skillsArena, skillsSite, icons);
  const total = await writeCombos(combos);
  console.log(`  ${Object.keys(combos).length} heroes re-read, ${total} in combos.json`);
}

/** Duo window, in days: the widest the API accepts, so rare pairs still get measured. */
const DAYS_DUOS = 30;
/** Duo requests in flight at once: beyond six, the API saturates and errors out for everyone. */
const DUOS_IN_FLIGHT = 6;

/**
 * Duos of each hero, for each rank: the five partners that raise its win rate
 * the most, the five that lower it the most, and the duo's rate per match
 * duration bracket (`/heroes/{h}/compatibility`).
 *
 * A hero's six ranks go out together, six requests in flight at most; each
 * retries twice (jsonFrom). An API silent for eight heroes in a row will not
 * come back before the end: what was gathered is kept.
 */
async function duosArena(heroes, byId) {
  const output = {};
  let silent = 0;
  for (const [i, h] of heroes.entries()) {
    const name = encodeURIComponent(h.name);
    const results = [];
    for (let k = 0; k < MEASURED_RANKS.length; k += DUOS_IN_FLIGHT) {
      const batch = MEASURED_RANKS.slice(k, k + DUOS_IN_FLIGHT);
      results.push(
        ...(await Promise.all(
          batch.map((rank) => jsonFrom(`${STATS}/heroes/${name}/compatibility?days=${DAYS_DUOS}&rank=${rank}`)),
        )),
      );
    }
    const byRank = {};
    MEASURED_RANKS.forEach((rank, j) => {
      const duos = duosOfRank(results[j]?.data?.records?.[0]?.data, byId, h.slug);
      if (duos) byRank[rank] = duos;
    });
    if (Object.keys(byRank).length > 0) output[h.slug] = byRank;

    silent = results.some(Boolean) ? 0 : silent + 1;
    if (silent >= 8) {
      console.warn(`\n    API silent for ${silent} heroes: stopping duos after ${i + 1 - silent} heroes`);
      break;
    }
    process.stdout.write(`\r    duos ${i + 1}/${heroes.length}`);
    await pause(250);
  }
  process.stdout.write("\n");
  return output;
}

/**
 * Writes duos.json, one hero per line. A hero or rank the API did not serve
 * keeps its previous measurement.
 */
async function writeDuos(duos) {
  const existing = (await readJson(`${OUTPUT}/duos.json`)).heroes ?? {};
  const all = mergeDuos(existing, duos ?? {});
  await writeFile(`${OUTPUT}/duos.json`, serializeDuos(DAYS_DUOS, all));
  return Object.keys(all).length;
}

/**
 * `--duos`: re-reads only duos, on heroes already synchronized. No other file
 * is rewritten. Heroes still without duos go first.
 */
async function duosOnly() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Run a full synchronization first.");
  const existing = (await readJson(`${OUTPUT}/duos.json`)).heroes ?? {};
  const measure = (h) => Number(Boolean(existing[h.slug]));
  const order = [...heroes].sort((a, b) => measure(a) - measure(b));
  console.log(`Duos (compatibility, ${DAYS_DUOS} days), ${heroes.filter((h) => !measure(h)).length} heroes without measurements…`);
  const duos = await duosArena(order, await heroTableById(heroes));
  const total = await writeDuos(duos);
  console.log(`  ${Object.keys(duos).length} heroes re-read, ${total} in duos.json`);
}

/**
 * Teammates, trends and rates per match duration, for each rank.
 *
 * The academy publishes, for each hero: the change in its win rate depending
 * on its teammate, its daily rates (win, ban, pick) over thirty days, and its
 * win rate per match duration bracket — enough to tell whether it matters
 * early or late in the match. Duration is measured on its main lane.
 */
async function teammatesAndTrends(heroes, byId) {
  const teammates = {};
  const trends = {};
  const duration = {};

  async function measuresOfRank(h, rank) {
    const name = encodeURIComponent(h.name);
    const lane = API_LANES[h.lanes[0]];
    const [team, trend, timer] = await Promise.all([
      jsonFrom(`${STATS}/academy/heroes/${name}/teammates?rank=${rank}`),
      jsonFrom(`${STATS}/academy/heroes/${name}/trends?days=30&rank=${rank}`),
      lane ? jsonFrom(`${STATS}/academy/heroes/${name}/win-rate/timeline?rank=${rank}&lane=${lane}`) : null,
    ]);

    const partners = team?.data?.records?.[0]?.data?.sub_hero;
    const best = (Array.isArray(partners) ? partners : [])
      .map((a) => ({ slug: byId.get(a.heroid), gain: a.increase_win_rate }))
      .filter((a) => a.slug && a.slug !== h.slug && typeof a.gain === "number")
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 6)
      .map((a) => ({ slug: a.slug, advantage: Math.round(a.gain * 1000) / 10 }));

    const series = dailyStreak(
      (trend?.data?.records?.[0]?.data?.win_rate ?? [])
        .filter((x) => x?.date && typeof x.win_rate === "number")
        .map((x) => ({
          date: x.date,
          winRate: rounded(x.win_rate * 100, 1),
          banRate: rounded(x.ban_rate * 100, 1),
          pickRate: rounded(x.app_rate * 100, 2),
        })),
    );

    const buckets = (timer?.data?.records?.[0]?.data?.time_win_rate ?? [])
      .filter((x) => typeof x?.win_rate === "number" && typeof x.time_min === "number")
      .sort((a, b) => a.time_min - b.time_min)
      .map((x) => ({ from: x.time_min, to: x.time_max ?? null, winRate: rounded(x.win_rate * 100, 1) }));

    return { best: best.length > 0 ? best : null, series, buckets: buckets.length > 0 ? buckets : null };
  }

  let silent = 0;
  for (const [i, h] of heroes.entries()) {
    // Two ranks at a time, three requests each: beyond that, the API saturates
    // and errors out for everyone.
    const results = [];
    for (let k = 0; k < MEASURED_RANKS.length; k += 2) {
      results.push(...(await Promise.all(MEASURED_RANKS.slice(k, k + 2).map((rank) => measuresOfRank(h, rank)))));
    }
    MEASURED_RANKS.forEach((rank, j) => {
      const { best, series, buckets } = results[j];
      if (best) (teammates[h.slug] ??= {})[rank] = best;
      if (series) (trends[h.slug] ??= {})[rank] = series;
      if (buckets) (duration[h.slug] ??= {})[rank] = buckets;
    });
    // An API silent for eight heroes in a row will not come back before the
    // end: keep what was gathered rather than wait out every timeout.
    silent = results.some((r) => r.best || r.series || r.buckets) ? 0 : silent + 1;
    if (silent >= 8) {
      console.warn(`\n    API silent for ${silent} heroes: stopping after ${i + 1 - silent} heroes measured`);
      break;
    }
    process.stdout.write(`\r    teammates and trends ${i + 1}/${heroes.length}`);
    await pause(300);
  }
  process.stdout.write("\n");
  return { teammates, trends, duration };
}

/**
 * Actual counters, with win rates, for each rank.
 *
 * The academy exposes, for each hero, the win rate of all its opponents and,
 * above all, how that rate changes when they face it: `increase_win_rate`.
 * Negative, the opponent loses ground — the hero counters it; positive, the
 * opponent gains the upper hand. This yields counters backed by numbers, both
 * ways, where the written analysis covers only a handful of heroes.
 */
async function actualCounters(heroes) {
  const byId = await heroTableById(heroes);

  /** A hero's counters in one rank, or null if the API has nothing for it. */
  async function countersOfRank(h, rank) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/counters?rank=${rank}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) return null;

      const block = (await rep.json())?.data?.records?.[0]?.data;
      const opponents = Array.isArray(block?.sub_hero) ? block.sub_hero : [];
      if (opponents.length === 0) return null;

      // Keep only known opponents, with their change.
      const notes = opponents
        .map((a) => ({
          slug: byId.get(a.heroid),
          delta: typeof a.increase_win_rate === "number" ? a.increase_win_rate : 0,
        }))
        .filter((a) => a.slug && a.slug !== h.slug);

      // `increase_win_rate` is the change in the hero's win rate in this duel:
      // positive, it wins more → it counters the opponent; negative, it
      // struggles. Sorted from most to least favorable.
      const byDelta = [...notes].sort((a, b) => b.delta - a.delta);
      const point = (a) => ({ slug: a.slug, advantage: Math.round(a.delta * 1000) / 10 });

      return {
        // positive advantage: the hero is strong against this target.
        strong: byDelta.slice(0, 6).map(point),
        // negative advantage: the hero struggles.
        weak: byDelta.slice(-6).reverse().map(point),
        winRate: block.main_hero_win_rate
          ? Math.round(block.main_hero_win_rate * 1000) / 10
          : null,
      };
    } catch {
      /* a failed rank does not interrupt the synchronization */
      return null;
    }
  }

  const output = {};

  for (const [i, h] of heroes.entries()) {
    // The six ranks of a hero go out together: the API takes nearly three
    // seconds to answer, so in series the synchronization would last half an hour.
    const results = await Promise.all(MEASURED_RANKS.map((rank) => countersOfRank(h, rank)));
    const byRank = {};
    MEASURED_RANKS.forEach((rank, j) => {
      if (results[j]) byRank[rank] = results[j];
    });
    if (Object.keys(byRank).length > 0) output[h.slug] = byRank;

    process.stdout.write(`\r    counters ${i + 1}/${heroes.length}`);
    await pause(150);
  }

  process.stdout.write("\n");
  return output;
}

/** Site lanes mapped to the API `lane` parameter. */
const API_LANES = { Gold: "gold", Exp: "exp", Mid: "mid", Jungle: "jungle", Roam: "roam" };

/**
 * Builds actually played, per lane and per rank.
 *
 * The academy publishes, for each hero, lane and rank, the current builds with
 * their pick and win rates: three core items, the emblem, its three talents and
 * the spell. The three most played are kept. Items, talents and spells arrive
 * as identifiers: three API tables turn them into names, the very names that
 * link each choice to its visual.
 *
 * These builds carry only the core items. The full equipment exists only in
 * the guides players publish on the academy: for each lane and each rank, the
 * best-rated six-item guide from an author of that rank is kept, or failing
 * that from a higher rank. It is an opinion, not a measurement — the sheet
 * presents it as such.
 */
async function buildsActual(heroes) {
  const table = async (path) => {
    const rep = await fetch(`${STATS}/academy/${path}?size=200`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!rep.ok) throw new Error(`Table ${path} unavailable: HTTP ${rep.status}`);
    return ((await rep.json())?.data?.records ?? []).map((r) => r?.data).filter(Boolean);
  };
  const [talents, spells, equipmentList] = await Promise.all([
    table("emblems"),
    table("spells"),
    table("equipment"),
  ]);

  const talentById = new Map(talents.map((t) => [t.giftid, t.emblemskill]));
  const spellById = new Map(spells.map((s) => [s.battleskillid, s.__data]));
  const itemById = new Map(equipmentList.map((e) => [e.equipid, e.equipname]));
  // Filled in as ranked builds come in: no API table provides them.
  const emblemById = new Map();
  const laneByRoute = new Map();

  // Official icons, for recent talents and spells the wiki lacks.
  const icons = { talents: {}, spells: {} };
  for (const t of talentById.values()) {
    if (t?.skillname && t.skillicon) icons.talents[t.skillname] = t.skillicon;
  }
  for (const s of spellById.values()) {
    if (s?.skillname && s.skillicon) icons.spells[s.skillname] = s.skillicon;
  }

  async function buildsOfRank(h, l, lane, rank) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/builds?rank=${rank}&lane=${lane}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
      );
      if (!rep.ok) return null;

      const data = (await rep.json())?.data?.records?.[0]?.data;
      if (data?.real_road != null) laneByRoute.set(String(data.real_road), l);
      const list = data?.build;
      if (!Array.isArray(list) || list.length === 0) return null;
      for (const b of list) {
        const e = b.emblem?.data;
        if (e?.emblemid && e.emblemname) emblemById.set(e.emblemid, e.emblemname);
      }

      return [...list]
        .sort((a, b) => (b.build_pick_rate ?? 0) - (a.build_pick_rate ?? 0))
        .slice(0, 3)
        .map((b) => ({
          items: (b.equipid ?? []).map((id) => itemById.get(id)).filter(Boolean),
          emblem: b.emblem?.data?.emblemname ?? null,
          talents: (b.new_rune_skill ?? [])
            .map((id) => talentById.get(id)?.skillname)
            .filter(Boolean),
          spell: spellById.get(b.skillid)?.skillname ?? b.battleskill?.data?.__data?.skillname ?? null,
          winRate: round(b.build_win_rate),
          pickRate: round(b.build_pick_rate),
        }));
    } catch {
      /* a failed rank does not interrupt the synchronization */
      return null;
    }
  }

  /** Raw player guides with full equipment: names are resolved at the end. */
  async function heroGuides(h) {
    try {
      const rep = await fetch(
        `${STATS}/academy/heroes/${encodeURIComponent(h.name)}/recommended?size=100`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) },
      );
      if (!rep.ok) return [];
      return ((await rep.json())?.data?.records ?? []).flatMap((r) => {
        const d = r?.data?.data;
        const equipment = (d?.equips ?? [])
          .map((e) => e?.equip_ids)
          .find((ids) => Array.isArray(ids) && ids.length === 6);
        if (!equipment) return [];
        const emblem = d?.emblems?.[0];
        return [
          {
            equipment,
            emblemId: emblem?.emblem_id ?? null,
            talents: Array.isArray(emblem?.emblem_gifts) ? emblem.emblem_gifts : [],
            spellId: d?.spell?.spell_id ?? null,
            route: d?.hero?.hero_lane != null ? String(d.hero.hero_lane) : null,
            authorRank: Number(r?.user?.historyRankLevel) || 0,
            votes: Number(r?.vote_all?.total) || 0,
            views: Number(r?.dynamic?.views) || 0,
          },
        ];
      });
    } catch {
      return [];
    }
  }

  const output = {};
  const guidesRaw = {};

  for (const [i, h] of heroes.entries()) {
    const pendingGuides = heroGuides(h);
    const byLane = {};
    for (const l of h.lanes) {
      const lane = API_LANES[l];
      if (!lane) continue;
      // As with counters, the six ranks of a lane go out together.
      const results = await Promise.all(MEASURED_RANKS.map((rank) => buildsOfRank(h, l, lane, rank)));
      const byRank = {};
      MEASURED_RANKS.forEach((rank, j) => {
        if (results[j]) byRank[rank] = results[j];
      });
      if (Object.keys(byRank).length > 0) byLane[l] = byRank;
    }
    if (Object.keys(byLane).length > 0) output[h.slug] = byLane;
    guidesRaw[h.slug] = await pendingGuides;

    process.stdout.write(`\r    builds ${i + 1}/${heroes.length}`);
    await pause(150);
  }

  process.stdout.write("\n");

  const guides = {};
  for (const h of heroes) {
    const list = (guidesRaw[h.slug] ?? []).map((g) => ({ ...g, lane: laneByRoute.get(g.route) ?? null }));
    const byLane = {};
    for (const l of h.lanes) {
      // A guide without a recognized lane only applies to a single-lane hero.
      // Only guides whose six items are all recognized count.
      const candidates = list.filter(
        (g) =>
          (g.lane === l || (g.lane === null && h.lanes.length === 1)) &&
          g.equipment.every((id) => itemById.has(id)),
      );
      const byRank = {};
      for (const rank of MEASURED_RANKS) {
        const best = chooseGuide(candidates, rank);
        if (!best) continue;
        byRank[rank] = {
          items: best.equipment.map((id) => itemById.get(id)).filter(Boolean),
          emblem: emblemById.get(best.emblemId) ?? null,
          talents: best.talents.map((id) => talentById.get(id)?.skillname).filter(Boolean),
          spell: spellById.get(best.spellId)?.skillname ?? null,
          authorRank: best.authorRank,
          votes: best.votes,
          views: best.views,
        };
      }
      if (Object.keys(byRank).length > 0) byLane[l] = byRank;
    }
    if (Object.keys(byLane).length > 0) guides[h.slug] = byLane;
  }

  return { builds: output, guides, icons };
}

// ─────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────

/**
 * Win, ban and pick rates, for each rank.
 *
 * This API's identifiers are not the wiki's: matching is done by name, after
 * converting both to the same slug format. A hero without a match is simply
 * ignored rather than attached at random.
 */
async function ranking(heroes) {
  const known = new Set(heroes.map((h) => h.slug));

  async function rateOfRank(rank) {
    const response = await fetch(`${STATS}/heroes/rank?size=200&rank=${rank}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Statistics unavailable (${rank}): HTTP ${response.status}`);

    const records = (await response.json())?.data?.records ?? [];
    const rate = {};
    const orphans = [];

    for (const entry of records) {
      const d = entry?.data;
      const name = d?.main_hero?.data?.name;
      if (!name) continue;

      const key = slugify(name);
      if (!known.has(key)) {
        orphans.push(name);
        continue;
      }

      rate[key] = {
        winRate: round(d.main_hero_win_rate),
        banRate: round(d.main_hero_ban_rate),
        pickRate: round(d.main_hero_appearance_rate),
      };
    }
    return { rate, orphans };
  }

  // Only six requests: they go out together.
  const results = await Promise.allSettled(MEASURED_RANKS.map(rateOfRank));

  // Without the all-ranks measurement, the tier list has no basis: fail, and
  // the caller keeps the previous ranking. Any other missing rank is simply
  // omitted.
  if (results[0].status === "rejected") throw results[0].reason;
  const { orphans } = results[0].value;
  if (orphans.length) console.log(`  unmatched: ${orphans.join(", ")}`);

  const byRank = {};
  MEASURED_RANKS.forEach((rank, i) => {
    if (results[i].status === "fulfilled") byRank[rank] = results[i].value.rate;
  });
  return byRank;
}

/**
 * Relations between heroes: counters and synergies.
 *
 * The API exposes, for each hero, those it is strong against, those that give
 * it trouble, and those it combines with. Its identifiers are not the wiki's:
 * matching is done by name.
 */
async function relations(heroes) {
  const bySlug = new Map(heroes.map((h) => [h.slug, h]));

  const response = await fetch(`${STATS}/heroes?size=200`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Relations unavailable: HTTP ${response.status}`);

  const records = (await response.json())?.data?.records ?? [];

  // API identifier to site slug table, built from the names.
  const byId = new Map();
  for (const entry of records) {
    const name = entry?.data?.hero?.data?.name;
    const id = entry?.data?.hero_id;
    if (!name || id == null) continue;
    const slug = slugify(name);
    if (bySlug.has(slug)) byId.set(id, slug);
  }

  const output = {};
  for (const entry of records) {
    const slug = byId.get(entry?.data?.hero_id);
    if (!slug) continue;

    const read = (key) =>
      (entry.data.relation?.[key]?.target_hero_id ?? [])
        .map((id) => byId.get(id))
        .filter(Boolean);

    output[slug] = {
      strongAgainst: read("strong"),
      weakAgainst: read("weak"),
      synergies: read("assist"),
    };
  }

  return output;
}

/** Rates arrive as fractions; they are stored as percentages with two decimals. */
const round = (v) => (typeof v === "number" ? Math.round(v * 10000) / 100 : null);

// ─────────────────────────────────────────────────────────────
// Patches
// ─────────────────────────────────────────────────────────────

async function patches() {
  const members = [];
  let run;

  do {
    const data = await api({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Patch Notes",
      cmlimit: "500",
      ...(run ? { cmcontinue: run } : {}),
    });
    members.push(...(data.query?.categorymembers ?? []));
    run = data.continue?.cmcontinue;
  } while (run);

  // Some official notes are missing from the category (2.1.90 was): pages
  // whose title starts with "Patch Notes " fill the gap. Duplicates merge by
  // version below.
  do {
    const data = await api({
      action: "query",
      list: "allpages",
      apprefix: "Patch Notes ",
      apfilterredir: "nonredirects",
      aplimit: "500",
      ...(run ? { apcontinue: run } : {}),
    });
    members.push(...(data.query?.allpages ?? []));
    run = data.continue?.apcontinue;
  } while (run);

  /**
   * The wiki publishes several pages for the same version: the official notes,
   * the test server ones ("Advanced Server"), and sometimes a separate balance
   * adjustment. Only the most authoritative is kept — showing "1.8.30" three
   * times would tell nobody anything.
   */
  const rank = (title) => {
    if (/advanced server/i.test(title)) return 2;
    if (/balance adjustment/i.test(title)) return 1;
    return 0;
  };

  const byVersion = new Map();

  for (const m of members) {
    const version = m.title.match(/(\d+\.\d+\.\d+)/)?.[1];
    if (!version) continue;

    const candidate = {
      version,
      title: m.title,
      link: `https://mobilelegends.fandom.com/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`,
    };

    const existing = byVersion.get(version);
    if (!existing || rank(candidate.title) < rank(existing.title)) {
      byVersion.set(version, candidate);
    }
  }

  return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Date of each detailed patch: the first revision of its wiki page, created
 * on release day or within a few days. It places patches on the rate
 * charts.
 */
async function datePatches(detail) {
  for (const patch of Object.values(detail)) {
    try {
      const data = await api({
        action: "query",
        prop: "revisions",
        titles: patch.title,
        rvprop: "timestamp",
        rvdir: "newer",
        rvlimit: "1",
      });
      const page = Object.values(data.query?.pages ?? {})[0];
      patch.date = page?.revisions?.[0]?.timestamp?.slice(0, 10) ?? null;
    } catch {
      patch.date = null;
    }
  }
}

/**
 * Full content of the most recent patch notes.
 *
 * The wiki is asked for its own HTML rendering rather than parsing wikitext,
 * then whatever only makes sense on the wiki is cleaned out. Only the latest
 * patches are fetched: all 249 pages would amount to several megabytes of
 * content nobody reads anymore.
 */
async function contentPatches(list) {
  const contents = {};

  for (const [i, patch] of list.slice(0, DETAILED_PATCHES).entries()) {
    try {
      const data = await api({
        action: "parse",
        page: patch.title,
        prop: "text",
        disabletoc: "1",
        formatversion: "2",
      });

      const raw = data.parse?.text;
      if (!raw) continue;

      // Two complementary reads: the HTML rendering for free-form sections
      // (designers' note, battlefield), and the wikitext to extract hero
      // adjustments as structured data — hero, type, diffs.
      let adjustments = [];
      try {
        const wt = await api({
          action: "parse",
          page: patch.title,
          prop: "wikitext",
          formatversion: "2",
        });
        const wikitext = wt.parse?.wikitext;
        if (wikitext) adjustments = heroAdjustments(wikitext);
      } catch {
        // Without the wikitext, at least the HTML rendering is kept.
      }

      const { html } = cleanRender(raw, patch.link);

      // The body is split into sections: the page renders some as is and
      // replaces others — new heroes, adjustments — with a rich component. The
      // new heroes' presentation is extracted and the HTML of sections taken
      // over by a component is emptied, as there is no point keeping it.
      const sections = splitSections(html);
      let introduced = [];
      const sectionsRendered = sections.map((s) => {
        const t = (s.title ?? "").toLowerCase();
        if (/hero adjustments/.test(t)) return { ...s, html: "", role: "adjustments" };
        if (/new hero/.test(t)) {
          introduced = newHeroes(s.html).map((h) => ({ ...h, slug: slugify(h.name) }));
          return { ...s, html: "", role: "newHeroes" };
        }
        return { ...s, role: null };
      });

      contents[patch.version] = {
        version: patch.version,
        title: patch.title,
        link: patch.link,
        toc: toc(html),
        sections: sectionsRendered,
        newHeroes: introduced,
        // Hero adjustments mapped to slugs, to link to the hero pages.
        adjustments: adjustments.map((a) => ({ ...a, slug: slugify(a.name) })),
        balance: summary(adjustments),
      };
    } catch {
      // An unreadable page must not interrupt the synchronization.
    }

    process.stdout.write(`\r    patches ${i + 1}/${Math.min(DETAILED_PATCHES, list.length)}`);
    await pause(400);
  }

  process.stdout.write("\n");
  return contents;
}

/** Sorts 1.9.40 after 1.9.9, which an alphabetical sort does not. */
function compareVersions(a, b) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** Reads an already generated JSON, or an empty object if it does not exist yet. */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

/** Cleans a skill description returned by the API (tags, line breaks). */
function cleanSkillDesc(raw) {
  return withoutTags(String(raw ?? "").replace(/<br\s*\/?>/gi, " "))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Skills from the community API, as a fallback for the wiki.
 *
 * Some wiki pages do not expose their skills — name, description or icon
 * missing. The API provides them all: name, in-game text and official icon.
 * They are fetched to fill in what the wiki leaves out, without ever
 * overwriting what it already provides.
 */
async function fetchArenaSkills(heroes) {
  const output = {};
  // The API also exposes a one-line tagline ("story"): it is collected along
  // the way, without an extra query.
  const taglines = {};

  for (const [i, h] of heroes.entries()) {
    try {
      const rep = await fetch(`${STATS}/heroes/${encodeURIComponent(h.name)}?lang=en`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (rep.ok) {
        const data = (await rep.json())?.data?.records?.[0]?.data?.hero?.data;
        const skills = (data?.heroskilllist ?? []).flatMap((g) => g.skilllist ?? []);
        if (skills.length > 0) {
          output[h.slug] = skills.map((s) => ({
            // Game identifier: combos refer to the skill through it.
            id: s.skillid ?? null,
            name: String(s.skillname ?? "").trim(),
            description: cleanSkillDesc(s.skilldesc) || null,
            icon: s.skillicon ? String(s.skillicon) : null,
          }));
        }
        const tagline = String(data?.story ?? "").trim();
        if (tagline) taglines[h.slug] = tagline;
      }
    } catch {
      // A failed hero must not interrupt the synchronization.
    }

    process.stdout.write(`\r    arena skills ${i + 1}/${heroes.length}`);
    await pause(200);
  }

  process.stdout.write("\n");
  return { skills: output, taglines };
}

/**
 * Game modes, from the wiki.
 *
 * The "Game Modes" page lists the official battle modes in a gallery; each
 * mode has its own page, from which the introduction paragraph and the image
 * are taken. The community API does not cover modes: the wiki is the only
 * structured source.
 */
async function modesOfGame() {
  const gallery = await api({
    action: "parse",
    page: "Game Modes",
    prop: "wikitext",
    formatversion: "2",
  });
  const wt = gallery.parse?.wikitext ?? "";
  const entries = [...wt.matchAll(/File:([^|]+)\|link=([^|]+)\|\[\[([^\]]+)\]\]/gi)].map((m) => ({
    file: m[1].trim(),
    page: m[2].trim().replace(/_/g, " "),
    name: m[3].trim(),
  }));
  if (entries.length === 0) return [];

  // Images: a single request for all gallery files.
  const dataImg = await api({
    action: "query",
    titles: entries.map((e) => `File:${e.file}`).join("|"),
    prop: "imageinfo",
    iiprop: "url",
  });
  const byFile = new Map(
    Object.values(dataImg.query?.pages ?? {})
      .filter((p) => p.imageinfo)
      .map((p) => [p.title.replace(/^File:/, ""), p.imageinfo[0].url.split("/revision")[0]]),
  );

  // A mode's introduction paragraph is taken from its page. The gallery link
  // and the displayed label sometimes differ ("Arcade" vs "Arcade Mode");
  // both are tried before giving up.
  // Housekeeping sections, of no interest to a reader: they are skipped.
  const IGNORED_SECTIONS = [
    "trivia", "gallery", "references", "navigation", "see also",
    "ranked mode subpages", "external links",
  ];

  // The page is read once, as raw wikitext, to extract the introduction and
  // the detailed sections.
  const content = async (title) => {
    try {
      const rep = await api({
        action: "query",
        titles: title,
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        redirects: "1",
      });
      const page = Object.values(rep.query?.pages ?? {})[0];
      const wt = page?.revisions?.[0]?.slots?.main?.["*"];
      if (!wt) return null;

      // The introduction: whatever precedes the first section heading.
      const intro = wt.split(/\n==/)[0];
      const description = cleanLore(intro).find((p) => p.length > 40) ?? null;

      const sections = sectionsPage(wt, IGNORED_SECTIONS);
      return { description, sections };
    } catch {
      return null;
    }
  };

  const modes = [];
  for (const e of entries) {
    // The gallery link and the displayed label sometimes differ
    // ("Arcade" vs "Arcade Mode"): both are tried.
    const c = (await content(e.page)) ?? (await content(e.name));

    modes.push({
      name: e.name,
      slug: slugify(e.name),
      description: c?.description ?? null,
      sections: c?.sections ?? [],
      image: byFile.get(e.file) ?? null,
    });
    await pause(300);
  }

  return modes;
}

/**
 * Official rank emblems.
 *
 * The rank tiers (from Warrior to Epic, then the Mythic family) are stable and
 * coded on the site side; only the emblems are fetched here, from the wiki, to
 * stay fresh if their file changes. The Mythic sub-tiers (Honor, Glory,
 * Immortal) do not exist in the game table: their images are taken from the
 * wiki, where they are documented.
 */
async function ranks() {
  const FILES = {
    warrior: "Warrior.png",
    elite: "Elite.png",
    master: "Master.png",
    grandmaster: "Grandmaster.png",
    epic: "Epic.png",
    legend: "Legend.png",
    mythic: "Mythic.png",
    "mythic-honor": "Mythical_Honor.png",
    "mythic-glory": "Mythical_Glory.png",
    "mythic-immortal": "Mythical_Immortal.png",
  };

  const data = await api({
    action: "query",
    titles: Object.values(FILES)
      .map((f) => `File:${f}`)
      .join("|"),
    prop: "imageinfo",
    iiprop: "url",
  });

  const byName = new Map(
    Object.values(data.query?.pages ?? {})
      .filter((p) => p.imageinfo)
      .map((p) => [
        p.title.replace(/^File:/, "").replace(/ /g, "_"),
        p.imageinfo[0].url.split("/revision")[0],
      ]),
  );

  const images = {};
  for (const [key, file] of Object.entries(FILES)) {
    const url = byName.get(file);
    if (url) images[key] = url;
  }
  return { images };
}

/**
 * Portraits of the Retribution trainer's monsters: the main image of their
 * wiki page. The 12-minute Lord reuses the 8-minute one.
 */
async function monsters() {
  const PAGES = { lord: "Lord", turtle: "Turtle", "purple-buff": "Thunder Fenrir", "orange-buff": "Molten Fiend" };
  const data = await api({
    action: "query",
    titles: Object.values(PAGES).join("|"),
    prop: "pageimages",
    piprop: "original",
  });
  const byTitle = new Map(
    Object.values(data.query?.pages ?? {})
      .filter((p) => p.original)
      .map((p) => [p.title, p.original.source.split("/revision")[0]]),
  );
  const images = {};
  for (const [key, title] of Object.entries(PAGES)) {
    const url = byTitle.get(title);
    if (url) images[key] = url;
  }
  return images;
}

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUTPUT, { recursive: true });

  console.log("Reading wiki modules…");
  const [rawHeroes, rawSkins, rawItems] = await Promise.all([
    moduleLua("Module:Hero/data"),
    moduleLua("Module:Skin/data"),
    moduleLua("Module:Equipment/data"),
  ]);

  // The previous catalogue covers an entry an edit blanked or removed.
  const heroes = normalizeHeroes(rawHeroes, await readJson(`${OUTPUT}/heroes.json`));
  const skins = normalizeSkins(rawSkins);
  const items = normalizeItems(rawItems);

  const nbSkins = Object.values(skins).reduce((n, s) => n + s.length, 0);
  console.log(`  ${heroes.length} heroes, ${nbSkins} skins, ${items.length} items`);

  console.log("Reading hero pages…");
  const pages = await heroPages(heroes);
  const nbSkills = Object.values(pages).reduce(
    (n, p) => n + p.skills.filter(Boolean).length,
    0,
  );
  const nbDescriptions = Object.values(pages).reduce(
    (n, p) => n + p.skills.filter((c) => c?.description).length,
    0,
  );
  const nbIllustrations = Object.values(pages).reduce((n, p) => n + p.illustrations.length, 0);
  console.log(
    `  ${nbSkills} skills (${nbDescriptions} described), ${nbIllustrations} illustrations`,
  );

  console.log("Fallback skills (API)…");
  const { skills: skillsArena, taglines } = await fetchArenaSkills(heroes);
  console.log(`  ${Object.keys(skillsArena).length} heroes covered by the API`);

  // Wiki + API merge: the wiki wins, the API fills in missing name,
  // description and icon. Both lists follow the same order (passive →
  // ultimate). As a last resort, whatever was already filled in is kept: an
  // API outage must not erase enrichment obtained during a previous run.
  const skillsExisting = await readJson(`${OUTPUT}/skills.json`);
  const finalSkills = {};
  for (const h of heroes) {
    const wiki = pages[h.slug]?.skills ?? [];
    const arena = skillsArena[h.slug] ?? [];
    const old = skillsExisting[h.slug] ?? [];
    const n = Math.max(wiki.length, arena.length, old.length);
    if (n === 0) continue;

    const list = [];
    for (let i = 0; i < n; i += 1) {
      const name = wiki[i]?.name ?? arena[i]?.name ?? old[i]?.name ?? null;
      const description =
        wiki[i]?.description ?? arena[i]?.description ?? old[i]?.description ?? null;
      list.push(name || description ? { name, description } : null);
    }
    finalSkills[h.slug] = list;
  }

  // ── Hero stories ───────────────────────────────────────────────────
  // Two complementary sources: the API's one-line tagline and the wiki's long
  // story (lore, narrative profile, trivia). A hero is only listed if it
  // brings at least one of the two.
  const stories = {};
  for (const h of heroes) {
    const story = pages[h.slug]?.story ?? null;
    const tagline = taglines[h.slug] ?? null;
    if (!story && !tagline) continue;
    stories[h.slug] = {
      tagline,
      lore: story?.lore ?? [],
      profile: story?.sheet ?? null,
      trivia: story?.trivia ?? [],
    };
  }
  console.log(`  ${Object.keys(stories).length} hero stories`);

  console.log("Hero ranking…");
  let stats = {};
  try {
    stats = await ranking(heroes);
    console.log(`  ${Object.keys(stats.all).length} heroes measured, ${Object.keys(stats).length} ranks`);
  } catch (error) {
    // An unavailable statistics source must not fail the whole
    // synchronization: the site falls back on the previous ranking.
    console.warn(`  statistics unavailable (${error.message}) — ranking unchanged`);
    stats = null;
  }

  console.log("Actual counters (academy)…");
  let counters = null;
  try {
    counters = await actualCounters(heroes);
    console.log(`  ${Object.keys(counters).length} heroes with measured counters`);
  } catch (error) {
    console.warn(`  counters unavailable (${error.message}) — unchanged`);
  }

  console.log("Played builds (academy)…");
  let builds = null;
  let guides = null;
  let iconsBuilds = { talents: {}, spells: {} };
  try {
    ({ builds, guides, icons: iconsBuilds } = await buildsActual(heroes));
    console.log(`  ${Object.keys(builds).length} heroes with builds, ${Object.keys(guides).length} with a full guide`);
  } catch (error) {
    console.warn(`  builds unavailable (${error.message}) — unchanged`);
  }

  console.log("Teammates and trends (academy)…");
  let complementary = null;
  try {
    complementary = await teammatesAndTrends(heroes, await heroTableById(heroes));
    console.log(
      `  ${Object.keys(complementary.teammates).length} heroes with teammates, ${Object.keys(complementary.trends).length} with trends`,
    );
  } catch (error) {
    console.warn(`  teammates and trends unavailable (${error.message}) — unchanged`);
  }

  console.log("Duos (compatibility)…");
  let duos = null;
  try {
    duos = await duosArena(heroes, await heroTableById(heroes));
    console.log(`  ${Object.keys(duos).length} heroes with duos`);
  } catch (error) {
    console.warn(`  duos unavailable (${error.message}) — unchanged`);
  }

  console.log("Relations between heroes…");
  let links = null;
  try {
    links = await relations(heroes);
    const n = Object.values(links).reduce((t, r) => t + r.strongAgainst.length, 0);
    console.log(`  ${Object.keys(links).length} heroes, ${n} counter relations`);
  } catch (error) {
    console.warn(`  relations unavailable (${error.message}) — unchanged`);
  }

  console.log("Patch list…");
  const patchList = await patches();
  console.log(`  ${patchList.length} patches`);

  console.log("Recent patch content…");
  const patchDetails = await contentPatches(patchList);
  await datePatches(patchDetails);
  console.log(`  ${Object.keys(patchDetails).length} detailed patches`);

  console.log("Rank emblems…");
  const emblemsRanks = await ranks();
  console.log(`  ${Object.keys(emblemsRanks.images).length} emblems`);

  console.log("Game modes…");
  const modes = await modesOfGame();
  console.log(`  ${modes.length} modes (${modes.filter((m) => m.description).length} described)`);

  console.log("Resolving visuals…");
  const credentials = [
    ...heroes.map((h) => h.id),
    ...Object.values(skins).flat().map((s) => s.id),
  ];
  // Two formats: the vertical portrait for hero pages and galleries, the
  // square icon for compact lists.
  const portraits = await urlsImages(credentials, "portrait");
  const icons = await urlsImages(heroes.map((h) => h.id), "icon");
  console.log(`  ${Object.keys(portraits).length} portraits, ${Object.keys(icons).length} icons`);

  const { plan, paths } = planVisuals(heroes, skins, portraits, icons);

  // Rank emblems copied locally, like everything else: no image served from an
  // external host at runtime.
  for (const [key, url] of Object.entries(emblemsRanks.images)) {
    if (!url || url.startsWith("/")) continue;
    plan.push({
      url,
      path: `public/visuels/rangs/${key}.webp`,
      optimize: true,
      width: 160,
    });
    emblemsRanks.images[key] = `/visuels/rangs/${key}.webp`;
  }

  // Portraits of the Retribution trainer's monsters, same treatment.
  for (const [key, url] of Object.entries(await monsters())) {
    plan.push({ url, path: `public/visuels/monstres/${key}.webp`, optimize: true, width: 320 });
  }

  // ── Mode visuals ───────────────────────────────────────────────────
  // Like everything else, a mode's image is copied locally: the site must not
  // depend on any external URL at runtime. The download is planned and the
  // wiki URL is replaced with the local path in `modes.json`.
  for (const mode of modes) {
    if (!mode.image || mode.image.startsWith("/")) continue;
    plan.push({
      url: mode.image,
      path: `public/visuels/modes/${mode.slug}.webp`,
      optimize: true,
      width: 640,
    });
    mode.image = `/visuels/modes/${mode.slug}.webp`;
  }

  // ── Skill icons ────────────────────────────────────────────────────
  // The icon file takes the name from the template's "image" field when it
  // exists, often different from the displayed name ("Contract Transform" for
  // the skill "Contract: Transform"); otherwise it falls back on the name.
  const fileIcon = (slug, i, name) => pages[slug]?.skills?.[i]?.image ?? name;
  const namesSkills = [
    ...new Set(
      Object.entries(finalSkills).flatMap(([slug, cs]) =>
        cs.map((c, i) => (c?.name ? fileIcon(slug, i, c.name) : null)).filter(Boolean),
      ),
    ),
  ];
  const urlsSkills = await urlsFiles(namesSkills);

  // Already resolved icons: last resort if neither the wiki nor the API answers.
  const visualsExisting = (await readJson(`${OUTPUT}/visuals.json`)).skills ?? {};

  let iconsArena = 0;
  const visualsSkills = {};
  for (const [slug, comps] of Object.entries(finalSkills)) {
    const arena = skillsArena[slug] ?? [];
    const icons = {};
    comps.forEach((skill, i) => {
      const name = skill?.name;
      if (!name) return;
      const urlWiki = urlsSkills[fileIcon(slug, i, name)];
      if (urlWiki) {
        const file = `${slugify(name)}.webp`;
        icons[name] = `/visuels/competences/${file}`;
        plan.push({
          url: urlWiki,
          path: `public/visuels/competences/${file}`,
          optimize: true,
          width: 128,
        });
      } else if (arena[i]?.icon) {
        // Fallback: the official icon from the API CDN, copied locally like
        // everything else — the site serves no image from an external host.
        const file = `${slugify(name)}.webp`;
        icons[name] = `/visuels/competences/${file}`;
        plan.push({
          url: arena[i].icon,
          path: `public/visuels/competences/${file}`,
          optimize: true,
          width: 128,
        });
        iconsArena += 1;
      } else if (visualsExisting[slug]?.[name]) {
        // Neither wiki nor API: keep the icon resolved previously.
        icons[name] = visualsExisting[slug][name];
      }
    });
    if (Object.keys(icons).length) visualsSkills[slug] = icons;
  }
  console.log(
    `  ${Object.keys(urlsSkills).length}/${namesSkills.length} wiki icons` +
      (iconsArena ? `, ${iconsArena} filled in by the API` : ""),
  );

  // ── Skill combos ───────────────────────────────────────────────────
  // After the icons: a combo reuses the local icon of each recognized skill.
  console.log("Skill combos (API)…");
  const combos = await combosArena(heroes, skillsArena, finalSkills, visualsSkills);
  console.log(`  ${Object.keys(combos).length} heroes with combos`);

  // ── Full-size illustrations ────────────────────────────────────────
  const namesIllustrations = [
    ...new Set(Object.values(pages).flatMap((p) => p.illustrations.map((i) => i.file))),
  ];
  // Illustrations come as .jpg as well as .png: both are queried.
  const [toJpg, toPng] = await Promise.all([
    urlsFiles(
      namesIllustrations.filter((f) => f.endsWith(".jpg")).map((f) => f.replace(/\.jpg$/, "")),
      "jpg",
    ),
    urlsFiles(
      namesIllustrations.filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, "")),
      "png",
    ),
  ]);
  const urlsIllustrations = { ...toJpg, ...toPng };

  const illustrations = {};
  for (const [slug, page] of Object.entries(pages)) {
    const bySkin = {};
    // The illustration is stored under the data module's name, the one the
    // hero page uses to find it, as soon as the caption matches it.
    const namesModule = new Map(
      (skins[slug] ?? []).map((s) => [normalizeNameSkin(s.name), s.name]),
    );
    for (const { file, skin } of page.illustrations) {
      const key = file.replace(/\.(jpg|png)$/, "");
      const url = urlsIllustrations[key];
      if (!url || !skin) continue;
      const nameSkin = namesModule.get(normalizeNameSkin(skin)) ?? skin;
      // First illustration wins: the following ones are older visuals.
      if (bySkin[nameSkin]) continue;
      const nameFile = `${slugify(nameSkin)}.webp`;
      bySkin[nameSkin] = `/visuels/heros/${slug}/illustrations/${nameFile}`;
      plan.push({
        url,
        path: `public/visuels/heros/${slug}/illustrations/${nameFile}`,
        optimize: true,
      });
    }
    if (Object.keys(bySkin).length) illustrations[slug] = bySkin;
  }
  console.log(
    `  ${Object.keys(urlsIllustrations).length}/${namesIllustrations.length} full-size illustrations`,
  );

  console.log("Resolving items, emblems, talents and spells…");
  const [urlsItems, urlsEmblems, urlsTalents, spellUrls] = await Promise.all([
    urlsFiles(items.map((o) => o.name)),
    urlsFiles(EMBLEMS),
    urlsFiles(TALENTS),
    urlsFiles(SPELLS),
  ]);

  const batches = [
    planFiles(urlsItems, "objets"),
    planFiles(urlsEmblems, "emblemes"),
    planFiles(urlsTalents, "talents"),
    planFiles(spellUrls, "sorts"),
  ];
  plan.push(...batches.flatMap((l) => l.plan));

  const [visualsItems, visualsEmblems, visualsTalents, spellVisuals] =
    batches.map((l) => l.paths);

  // Recent talents and spells missing from the wiki (Rupture, War Cry,
  // Flameshot…): the API's official icon fills them in, copied locally like
  // everything else. Without --images, only what is already on disk is
  // referenced.
  for (const [type, icons, target] of [
    ["talents", iconsBuilds.talents, visualsTalents],
    ["sorts", iconsBuilds.spells, spellVisuals],
  ]) {
    for (const [name, url] of Object.entries(icons)) {
      const key = slugify(name);
      if (target[key]) continue;
      const path = `/visuels/${type}/${key}.png`;
      plan.push({ url, path: `public${path}` });
      if (WITH_IMAGES || existsSync(`public${path}`)) target[key] = path;
    }
  }

  console.log(
    `  ${Object.keys(visualsItems).length}/${items.length} items, ` +
      `${Object.keys(visualsEmblems).length} emblems, ` +
      `${Object.keys(visualsTalents).length} talents, ` +
      `${Object.keys(spellVisuals).length} spells`,
  );

  if (WITH_IMAGES) {
    console.log(`Downloading ${plan.length} visuals…`);
    let ok = 0;
    let already = 0;
    let failures = 0;

    // In small batches: fast enough, without saturating the wiki.
    for (let i = 0; i < plan.length; i += 8) {
      const results = await Promise.all(
        plan.slice(i, i + 8).map((v) => download(v.url, v.path, v.optimize, v.width)),
      );
      ok += results.filter((r) => r === "ok").length;
      already += results.filter((r) => r === "exists").length;
      failures += results.filter((r) => r === "failed").length;
      process.stdout.write(`\r    ${Math.min(i + 8, plan.length)}/${plan.length}`);
    }
    console.log(`\n  ${ok} downloaded, ${already} already present, ${failures} failed`);
  } else {
    console.log("  (rerun with --images to download the visuals)");
  }

  const write = (name, data) =>
    writeFile(`${OUTPUT}/${name}.json`, JSON.stringify(data, null, 2) + "\n");

  // Measurements (ranking, counters, synergies) are grouped in a single file.
  // Each has its own availability: when a source does not answer, the
  // previous value is kept rather than erased. The ranking also keeps its
  // date, since it does not refresh at the same pace as the rest.
  const statsExisting = await readJson(`${OUTPUT}/statistics.json`);
  const statistics = {
    rankings: stats
      ? { measuredAt: new Date().toISOString(), rates: stats.all, byRank: stats }
      : (statsExisting.rankings ?? { measuredAt: null, rates: {} }),
    counters: counters ?? statsExisting.counters ?? {},
    builds: builds ?? statsExisting.builds ?? {},
    guides: guides ?? statsExisting.guides ?? {},
    // Per hero: one the API did not serve keeps its teammates.
    teammates: { ...(statsExisting.teammates ?? {}), ...(complementary?.teammates ?? {}) },
    relations: links ?? statsExisting.relations ?? {},
  };

  // Name-by-slug table, shipped client-side without the rest of the catalog.
  const names = Object.fromEntries(heroes.map((h) => [h.slug, h.name]));

  await Promise.all([
    // Catalogue
    write("heroes", heroes),
    write("skins", skins),
    write("items", items),
    write("skills", finalSkills),
    write("modes", modes),
    write("stories", stories),
    write("ranks", emblemsRanks),
    write("names", names),
    writeEvolution(complementary),
    writeCombos(combos),
    writeDuos(duos),
    // All visual paths, grouped
    write("visuals", {
      heroes: paths,
      illustrations,
      skills: visualsSkills,
      items: visualsItems,
      emblems: visualsEmblems,
      talents: visualsTalents,
      spells: spellVisuals,
    }),
    // Measurements and patches, grouped
    write("statistics", statistics),
    write("patches", { list: patchList, details: patchDetails }),
    // Synchronization metadata
    write("sync", {
      date: new Date().toISOString(),
      source: "https://mobilelegends.fandom.com",
      heroes: heroes.length,
      skins: nbSkins,
      items: items.length,
      patches: patchList.length,
      rankings: stats ? Object.keys(stats.all).length : null,
      counters: counters ? Object.keys(counters).length : null,
      builds: builds ? Object.keys(builds).length : null,
      // The wiki provides the catalog; the community API provides the measurements.
      sources: [
        "https://mobilelegends.fandom.com",
        "https://arena.rone.dev",
      ],
    }),
  ]);

  console.log(`\nWritten to ${OUTPUT}/`);
}

await (process.argv.includes("--evolution")
  ? evolutionSingle()
  : process.argv.includes("--combos")
    ? combosOnly()
    : process.argv.includes("--duos")
      ? duosOnly()
      : main());

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
 *     npm run sync -- --patches  patch list and notes only (Fandom + Liquipedia)
 *     npm run sync -- --heroes   heroes, base stats and skills only
 *
 * The output is written to `src/data/game/`. Visuals go to `public/visuels/`,
 * versioned with the repository: the image build needs no access to the wiki.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { analyzeTableLua } from "./lua.mjs";
import { clean, count, empty, normalizeHeroes, officialLanes, slugify, withOfficialLanes } from "./heroes.mjs";
import { splitSections, cleanRender, newHeroes, toc } from "./patch-notes.mjs";
import {
  cleanDescription,
  withoutTags,
  extractStory,
  sectionsPage,
  cleanLore,
  plainValue,
} from "./wikitext.mjs";
import { reportMarkup } from "./markup-guard.mjs";
import { heroAdjustments, summary } from "./patch-parser.mjs";
import { compareVersions, readVersion } from "./patch-version.mjs";
import * as liquipedia from "./liquipedia.mjs";
import { heroStatsFromInfobox, itemFromInfobox, liquipediaInfoboxes } from "./liquipedia-game.mjs";
import { mergeHeroStats, patchAttributes } from "./hero-stats.mjs";
import { levelValues, matchOfficial, mergeSkills, officialSkills } from "./skills.mjs";
import { itemRemoved, liquipediaItemTitle, officialItemNames, priceGaps } from "./items.mjs";
import { liquipediaDetail, liquipediaList, liquipediaPages, mergeDetail, mergeLists } from "./liquipedia-patches.mjs";
import {
  distinctSkinIds,
  extractAvatarIcons,
  extractIllustrations,
  fallbackFileNames,
  isProvisionalFile,
  normalizeNameSkin,
} from "./gallery.mjs";
import { isReleasedHero } from "./release.mjs";
import { mergeSkins, parseLiquipediaSkins } from "./skin-sources.mjs";
import { differentImages, refreshDecision } from "./visual-refresh.mjs";
import { PAGES as SERIES_PAGES, attachHeroes, level2Section, readGallery } from "./events.mjs";
import {
  rounded,
  chooseGuide,
  heroCombos,
  duosOfRank,
  mergeDuos,
  mergeHistory,
  serializeDuos,
  dailyStreak,
  keepMissingRanks,
  keepUnservedHeroes,
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
/** Wiki file and SHA-1 behind each downloaded visual (see `scripts/visual-refresh.mjs`). */
const MANIFEST = `${OUTPUT}/visual-sources.json`;

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

  // Each skin's id, once told apart from another hero's (see distinctSkinIds).
  const listed = Object.entries(raw).flatMap(([heroName, entry]) =>
    Object.entries(entry?.skins ?? {})
      .filter(([, s]) => !empty(s.id) && !empty(s.name))
      .map(([key, s]) => ({ hero: slugify(heroName), key, id: String(s.id), skin: s })),
  );
  const { ids, rewritten } = distinctSkinIds(listed);
  for (const e of rewritten) console.warn(`  skin ${e.skin.name}: id ${e.id} taken by another hero, wiki key ${e.key} used`);
  const idOf = new Map(listed.map((e, i) => [e.skin, ids[i]]));

  for (const [heroName, entry] of Object.entries(raw)) {
    const skins = Object.values(entry?.skins ?? {})
      .filter((s) => !empty(s.id) && !empty(s.name))
      .map((s) => ({
        id: idOf.get(s),
        name: String(s.name),
        release: clean(s.release)?.replace(/-XX/g, "") ?? null,
        availability: clean(s.availability),
        rarity: clean(s.tier),
        label: clean(s.tag),
        price: Object.fromEntries(
          Object.entries(s.price ?? {})
            // "Obtained via the [[MLBB × Transformers]] event": the link's label.
            .map(([m, v]) => [m, plainValue(clean(v))])
            .filter(([, v]) => v),
        ),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (skins.length) byHero[slugify(heroName)] = skins;
  }

  return byHero;
}

/**
 * An item effect as plain text. The module joins an item's two passives with
 * an "@" ("…for 2 seconds.@ Redemption: …"), a separator its own template
 * turns into a line break: here, the sentences simply follow each other.
 */
const effectText = (v) => plainValue(clean(v)?.replace(/\s*@\s*/g, " "));

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
      unique: effectText(o.unique),
      passive: effectText(o.passive),
      active: effectText(o.active),
      recipe: clean(o.recipe)?.split(",").map((x) => x.trim()).filter(Boolean) ?? [],
      // The same wiki field says who may buy the item and whether it is
      // still sold: the status is read apart (see `itemsInGame`).
      bestFor: /^removed$/i.test(clean(o.availability) ?? "") ? null : clean(o.availability),
      availability: clean(o.availability),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ─────────────────────────────────────────────────────────────
// Visuals
// ─────────────────────────────────────────────────────────────

/**
 * What the wiki says of each file resolved during this run, by download URL:
 * its title, the SHA-1 and date of its current version, and whether it is a
 * provisional visual (see `isProvisionalFile`). `download` compares the
 * SHA-1 with the one of the last download to refresh replaced files.
 */
const fileInfo = new Map();

/** One query for the URL, fingerprint, upload comment, description and categories of each file. */
const FILE_QUERY = (titles) => ({
  action: "query",
  titles,
  prop: "imageinfo|categories|revisions",
  iiprop: "url|sha1|timestamp|comment",
  cllimit: "max",
  rvprop: "content",
  rvslots: "main",
});

/** Records a file page of a `FILE_QUERY` answer; returns its stable download URL. */
function recordFile(page) {
  const info = page.imageinfo?.[0];
  if (!info?.url) return null;
  // The cache suffix is useless and makes the URL unstable.
  const url = info.url.split("/revision/")[0];
  const categories = (page.categories ?? []).map((c) => c.title);
  const description = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
  fileInfo.set(url, {
    file: page.title,
    sha1: info.sha1 ?? null,
    timestamp: info.timestamp ?? null,
    provisional: isProvisionalFile({ name: page.title, description, comment: info.comment, categories }),
  });
  return url;
}

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

    const data = await api(FILE_QUERY(titles));

    for (const page of Object.values(data.query?.pages ?? {})) {
      const source = recordFile(page);
      if (!source) continue;
      const id = page.title.match(/Hero(\w+)-/)?.[1];
      if (id) found[id] = source;
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
 *
 * `extension` is the extension of the **wiki's** page title, not of the local
 * file: the wiki catalogues almost everything under `File:....png`, whatever
 * the bytes it actually serves. `download` decides what to write on disk.
 */
async function urlsFiles(names, extension = "png") {
  const found = {};

  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const titles = batch.map((n) => `File:${n}.${extension}`).join("|");

    const data = await api(FILE_QUERY(titles));

    // The wiki normalizes some titles (spaces, apostrophes): follow its
    // redirections to get back to the requested name.
    const normalized = new Map(
      (data.query?.normalized ?? []).map((n) => [n.to, n.from]),
    );

    for (const page of Object.values(data.query?.pages ?? {})) {
      const source = recordFile(page);
      if (!source) continue;
      const title = normalized.get(page.title) ?? page.title;
      found[title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")] = source;
    }

    await pause(300);
  }

  return found;
}

/** True when the buffer already holds a WebP image (RIFF container). */
function isWebp(data) {
  return data.length > 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
}

/**
 * Downloads a visual, or refreshes it when the wiki replaced it.
 *
 * The wiki's full-size illustrations weigh up to 3 MB each, across 745 files:
 * as is, they add more than 200 MB to the repository and to every clone. They
 * are scaled down to a useful web width and converted to WebP, which cuts the
 * size by six with no visible difference on screen.
 *
 * Portraits and icons are already small and already WebP: the wiki names its
 * files `.png` but serves WebP bytes for most of them. Everything is stored
 * under a `.webp` name, so the file's name matches what is inside it and the
 * site sends the right `Content-Type`. The bytes are written untouched when
 * they are already WebP — re-encoding a lossy image only loses quality — and
 * converted otherwise, which is the case for the few icons that come from the
 * game's API rather than the wiki.
 *
 * A file already on disk is kept while the wiki's version is the one it was
 * made from (see `refreshDecision`): `manifest` records, per local path, the
 * wiki file and SHA-1 of the last download. Returns `ok` (new file),
 * `refreshed` (replaced by the wiki's newer version), `exists` (kept) or
 * `failed`.
 */
async function download({ url, path, optimize = false, width = 1280 }, manifest) {
  const current = fileInfo.get(url);
  const exists = existsSync(path);
  const decision = refreshDecision({ exists, recorded: manifest[path], current });
  if (decision === "keep") return "exists";
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return "failed";

    const data = Buffer.from(await response.arrayBuffer());
    let output = data;
    if (optimize) {
      const sharp = (await import("sharp")).default;
      output = await sharp(data).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } else if (path.endsWith(".webp") && !isWebp(data)) {
      // 92 is generous for a 100x100 icon with an alpha channel: a quarter of
      // the weight of the source PNG, and no visible difference at any size
      // the site displays it.
      const sharp = (await import("sharp")).default;
      output = await sharp(data).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer();
    }

    const record = current?.sha1 ? { file: current.file, sha1: current.sha1, timestamp: current.timestamp } : null;
    if (decision === "verify") {
      // Downloaded before the manifest existed: replaced only if the picture changed.
      const changed = await differentImages(output, await readFile(path)).catch(() => true);
      if (record) manifest[path] = record;
      if (!changed) return "exists";
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output);
    if (record) manifest[path] = record;
    return exists ? "refreshed" : "ok";
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
 *     public/visuels/heros/khufra/portrait.webp
 *     public/visuels/heros/khufra/icone.webp
 *     public/visuels/heros/khufra/skins/782-desert-owl.webp
 */
function planVisuals(heroes, skins, portraits, icons) {
  const plan = [];
  const paths = {};

  for (const h of heroes) {
    const folder = `visuels/heros/${h.slug}`;
    const entry = { portrait: null, icon: null, skins: {} };

    if (portraits[h.id]) {
      entry.portrait = `/${folder}/portrait.webp`;
      plan.push({ url: portraits[h.id], path: `public/${folder}/portrait.webp` });
    }
    if (icons[h.id]) {
      entry.icon = `/${folder}/icone.webp`;
      plan.push({ url: icons[h.id], path: `public/${folder}/icone.webp` });
    }

    for (const skin of skins[h.slug] ?? []) {
      const url = portraits[skin.id];
      if (!url) continue;
      const file = `${skin.id}-${slugify(skin.name)}.webp`;
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
 *     public/visuels/objets/blade-of-despair.webp
 *     public/visuels/emblemes/tank.webp
 *     public/visuels/talents/impure-rage.webp
 *     public/visuels/sorts/flicker.webp
 */
function planFiles(urls, folder) {
  const plan = [];
  const paths = {};

  for (const [name, url] of Object.entries(urls)) {
    const file = `${slugify(name)}.webp`;
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
  // The emblem every role can take, "All" in the played builds. The wiki has
  // no file under this name yet: it is resolved as soon as one appears.
  "Common Emblem",
];

// Lane icons, under the names the wiki gives them. The site's lane tokens
// (Gold, Exp, Mid, Jungle, Roam) name the files, so `imageLane` finds them
// without a table: see `src/lib/emblems.ts`.
const LANE_FILES = {
  Gold: "Gold Lane", Exp: "EXP Lane", Mid: "Mid Lane", Jungle: "Jungling", Roam: "Roaming",
};

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
  "Petrify", "Arrival", "Vengeance", "Aegis", "Revitalize", "Flameshot",
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
        // Per-level figures, kept when the official sheet has none.
        cooldown: levelValues(body.match(/\|\s*cooldown\s*=[ \t]*(.+)/i)?.[1]),
        cost: levelValues(body.match(/\|\s*(?:mana|energy)-cost\s*=[ \t]*(.+)/i)?.[1]),
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
          cooldown: next.cooldown ?? null,
          cost: next.cost ?? null,
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

  return {
    skills,
    illustrations,
    // Skin ids and names of the "Avatar icons" gallery, newer than the module.
    avatars: extractAvatarIcons(wikitext),
    // `{{Unfinished}}`: a hero page written ahead of the hero's release.
    unfinished: /\{\{\s*unfinished\b/i.test(wikitext),
    story: extractStory(wikitext),
  };
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
 * `--measures`: the daily refresh of everything measured in ranked games —
 * ranking (win, ban and pick rates, per rank), counters, played builds, plus
 * teammates and trends — on heroes already synchronized, without rereading
 * the wiki. The weekly full sync still does the catalogue. Same merge rules
 * as `main`: a source that does not answer keeps the previous values, and a
 * hero it did not serve keeps his. Icons of talents or spells new to a build
 * are only downloaded by the full sync.
 */
async function measuresDaily() {
  const heroes = await readJson(`${OUTPUT}/heroes.json`);
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error("Run a full synchronization first.");
  const statsExisting = await readJson(`${OUTPUT}/statistics.json`);

  console.log("Hero ranking…");
  let stats = null;
  try {
    stats = await ranking(heroes);
    console.log(`  ${Object.keys(stats.all).length} heroes measured, ${Object.keys(stats).length} ranks`);
  } catch (error) {
    console.warn(`  statistics unavailable (${error.message}) — ranking unchanged`);
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
  try {
    ({ builds, guides } = await buildsActual(heroes));
    console.log(`  ${Object.keys(builds).length} heroes with builds`);
  } catch (error) {
    console.warn(`  builds unavailable (${error.message}) — unchanged`);
  }
  const existing = await readJson(`${OUTPUT}/evolution.json`);
  const measured = (h) => Number(Boolean(existing.trends?.[h.slug]));
  const order = [...heroes].sort((a, b) => measured(a) - measured(b));
  console.log("Teammates and trends (academy)…");
  let complementary = { teammates: {}, trends: {} };
  try {
    complementary = await teammatesAndTrends(order, await heroTableById(heroes));
  } catch (error) {
    console.warn(`  teammates and trends unavailable (${error.message}) — unchanged`);
  }

  const perHero = (name, next) => {
    const { merged, kept } = keepUnservedHeroes(statsExisting[name], next ?? {});
    if (next && kept.length) console.warn(`  ${name}: ${kept.length} heroes not served this run, previous values kept`);
    return merged;
  };
  const ranksBefore = statsExisting.rankings?.byRank ?? {};
  const statistics = {
    ...statsExisting,
    rankings: stats
      ? { measuredAt: new Date().toISOString(), rates: stats.all, byRank: keepMissingRanks(ranksBefore, stats) }
      : (statsExisting.rankings ?? { measuredAt: null, rates: {} }),
    counters: perHero("counters", counters),
    builds: perHero("builds", builds),
    guides: perHero("guides", guides),
    teammates: { ...(statsExisting.teammates ?? {}), ...(complementary.teammates ?? {}) },
  };
  await Promise.all([
    writeFile(`${OUTPUT}/statistics.json`, JSON.stringify(statistics, null, 2) + "\n"),
    writeEvolution(complementary),
  ]);
  // The ranking is the measure the site dates: nothing served, fail the
  // run so the workflow retries rather than reporting a silent success.
  if (!stats && !counters && !builds) throw new Error("No measure served by the API");
  console.log(`  ${Object.keys(complementary.trends ?? {}).length} heroes with trends`);
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
 * The ranking payload of a rank. The community API's firewall refuses this
 * endpoint (HTTP 403) to the cloud runners of the daily workflow, while it
 * answers the production server: the workflow then fetches it through the
 * server into RANKING_RELAY_DIR, read first. A missing or unreadable relayed
 * file falls back on the API itself.
 */
async function rankingPayload(rank) {
  const relay = process.env.RANKING_RELAY_DIR;
  if (relay) {
    try {
      const payload = JSON.parse(await readFile(`${relay}/${rank}.json`, "utf8"));
      if (Array.isArray(payload?.data?.records) && payload.data.records.length > 0) return payload;
    } catch {
      // Not relayed: ask the API.
    }
  }
  const response = await fetch(`${STATS}/heroes/rank?size=200&rank=${rank}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Statistics unavailable (${rank}): HTTP ${response.status}`);
  return response.json();
}

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
    const records = (await rankingPayload(rank))?.data?.records ?? [];
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
  // the caller keeps the previous ranking. Any other missing rank keeps its
  // previous measurement when the file is written.
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
    // "2.2.16a" stays a hotfix of its own; "1.5.0.2" keeps its first three parts, as before.
    const version = readVersion(m.title) ?? m.title.match(/(\d+\.\d+\.\d+)/)?.[1];
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

const LIQUIPEDIA_CACHE = "scripts/patches-cache.json";

/**
 * Patch list and notes, from both wikis.
 *
 * Liquipedia decides which patches exist, when each one was released and
 * which one is live: the Fandom wiki stopped at 2.2.16 and never listed the
 * hotfixes. The notes of the most recent patches come from the Fandom page
 * when there is one (it is what the site always showed), from Liquipedia's
 * otherwise; Liquipedia also fills the hero changes a Fandom page lacks. See
 * `liquipedia-patches.mjs` for the merge. Nothing already published is
 * dropped: a patch detailed before stays detailed, a source that does not
 * answer leaves the previous data in place.
 */
async function syncPatches() {
  const before = await readJson(`${OUTPUT}/patches.json`);
  const previous = before.details ?? {};

  console.log("Patch list (Fandom wiki)…");
  let fandomList = [];
  try {
    fandomList = await patches();
    console.log(`  ${fandomList.length} pages`);
  } catch (error) {
    console.warn(`  Fandom wiki unavailable (${error.message}): previous list kept`);
  }

  console.log("Patch list (Liquipedia)…");
  const cache = await readJson(LIQUIPEDIA_CACHE);
  let lpList = [];
  try {
    const pages = await liquipediaPages(liquipedia, cache);
    lpList = liquipediaList(pages, { today: new Date().toISOString().slice(0, 10), url: liquipedia.pageUrl });
    await writeFile(LIQUIPEDIA_CACHE, `${JSON.stringify(cache, null, 1)}\n`);
    console.log(`  ${lpList.length} released patches, latest ${lpList[0]?.version ?? "?"} (${lpList[0]?.date ?? "?"})`);
  } catch (error) {
    console.warn(`  Liquipedia unavailable (${error.message}): Fandom list only`);
  }

  const list = mergeLists(fandomList, lpList, before.list ?? []);
  const window = list.slice(0, DETAILED_PATCHES).map((p) => p.version);

  console.log("Recent patch notes (Fandom wiki)…");
  const fandomByVersion = new Map(fandomList.map((p) => [p.version, p]));
  const fandomDetails = await contentPatches(window.flatMap((v) => fandomByVersion.get(v) ?? []));
  await datePatches(fandomDetails);

  console.log("Recent patch notes (Liquipedia)…");
  const lpByVersion = new Map(lpList.map((p) => [p.version, p]));
  const lpDetails = {};
  try {
    const wanted = window.flatMap((v) => lpByVersion.get(v) ?? []);
    const texts = await liquipedia.contents(wanted.map((p) => p.title));
    for (const p of wanted) {
      const text = texts.get(p.title)?.text;
      if (!text) continue;
      const d = liquipediaDetail(text, { version: p.version, title: p.title, link: p.link });
      lpDetails[p.version] = {
        ...d,
        date: d.date ?? p.date,
        newHeroes: d.newHeroes.map((h) => ({ ...h, slug: slugify(h.name) })),
        adjustments: d.adjustments.map((a) => ({ ...a, slug: slugify(a.name) })),
      };
    }
    console.log(`  ${Object.keys(lpDetails).length} pages read`);
  } catch (error) {
    console.warn(`  Liquipedia notes unavailable (${error.message})`);
  }

  const details = {};
  for (const v of window) {
    const d = mergeDetail(fandomDetails[v], lpDetails[v]) ?? previous[v];
    if (d) details[v] = d;
  }
  // Patches detailed by an earlier run stay detailed, with the release date
  // Liquipedia gives them.
  for (const [v, d] of Object.entries(previous)) {
    if (details[v]) continue;
    const lp = lpByVersion.get(v);
    details[v] = { ...d, source: d.source ?? "fandom", date: lp?.date ?? d.date ?? null, liquipedia: lp?.link ?? d.liquipedia ?? null };
  }

  const fromLiquipedia = Object.values(details).filter((d) => d.source === "liquipedia").map((d) => d.version);
  console.log(`  ${Object.keys(details).length} detailed patches (${fromLiquipedia.length} from Liquipedia: ${fromLiquipedia.join(", ") || "none"})`);
  return { list: list.map((p) => ({ ...p, date: p.date ?? details[p.version]?.date ?? null })), details };
}

/** `--patches`: re-reads only the patch list and notes. No other file is rewritten. */
async function patchesOnly() {
  const result = await syncPatches();
  await writeFile(`${OUTPUT}/patches.json`, JSON.stringify(result, null, 2) + "\n");
  const live = result.list[0];
  console.log(`\nWritten to ${OUTPUT}/patches.json: ${result.list.length} patches, live ${live?.version} (${live?.date ?? "no date"})`);
}


/** Reads an already generated JSON, or an empty object if it does not exist yet. */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Official hero sheets, from the community API: Moonton's in-game text for
 * every skill (name, description, cooldown, cost, icon), every form included.
 * See `skills.mjs` for how they meet the wiki's.
 */
async function fetchArenaSkills(heroes) {
  const output = {};
  // The API also exposes a one-line tagline ("story"): it is collected along
  // the way, without an extra query.
  const taglines = {};
  // So are the lanes, in the game's order (see `withOfficialLanes`).
  const lanes = {};

  for (const [i, h] of heroes.entries()) {
    // A transient error (an HTML error page instead of JSON) gets two more
    // attempts: a hero left out falls back on the wiki's older text.
    const data = (await jsonFrom(`${STATS}/heroes/${encodeURIComponent(h.name)}?lang=en`))?.data?.records?.[0]?.data?.hero?.data;
    const skills = officialSkills(data);
    if (skills.length > 0) output[h.slug] = skills;
    const tagline = String(data?.story ?? "").trim();
    if (tagline) taglines[h.slug] = tagline;
    const official = officialLanes(data);
    if (official) lanes[h.slug] = official;

    process.stdout.write(`\r    arena skills ${i + 1}/${heroes.length}`);
    await pause(200);
  }

  process.stdout.write("\n");
  return { skills: output, taglines, lanes };
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
// Released content
// ─────────────────────────────────────────────────────────────

/**
 * Slugs of the heroes the live game lists: the community API relays Moonton's
 * own hero list; Liquipedia's hero category stands in when the API does not
 * answer. Null when neither does: the release dates decide alone then.
 */
async function officialHeroes() {
  try {
    const answer = await jsonFrom(`${STATS}/heroes?size=200`);
    const names = (answer?.data?.records ?? []).map((r) => r?.data?.hero?.data?.name).filter(Boolean);
    if (names.length > 50) return { source: "arena.rone.dev", slugs: new Set(names.map(slugify)) };
  } catch {
    // Liquipedia below.
  }
  try {
    const { query } = await liquipedia.api({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Hero",
      cmnamespace: "0",
      cmlimit: "500",
    });
    const names = (query?.categorymembers ?? []).map((m) => m.title);
    if (names.length > 50) return { source: "Liquipedia", slugs: new Set(names.map(slugify)) };
  } catch (error) {
    console.warn(`  Liquipedia hero list unavailable (${error.message})`);
  }
  return null;
}

/**
 * Skins of each hero's Liquipedia gallery (`Kagura/Gallery`), which follows
 * the live game: `{ slug: [{ name, type, availability }] }`. Null when
 * Liquipedia does not answer; a hero without a gallery page is left out.
 */
async function liquipediaGalleries(heroes) {
  try {
    const output = {};
    for (const batch of liquipedia.chunks(heroes, 10)) {
      const titles = batch.map((h) => `${h.name}/Gallery`);
      const { query } = await liquipedia.api({
        action: "query",
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        redirects: "1",
        titles: titles.join("|"),
      });
      const resolve = liquipedia.resolver(query);
      const byTitle = new Map((query?.pages ?? []).map((p) => [p.title, p]));
      batch.forEach((h, i) => {
        const text = byTitle.get(resolve(titles[i]))?.revisions?.[0]?.slots?.main?.content;
        if (text) output[h.slug] = parseLiquipediaSkins(text);
      });
      process.stdout.write(`\r    Liquipedia galleries ${Object.keys(output).length}/${heroes.length}`);
    }
    process.stdout.write("\n");
    return output;
  } catch (error) {
    console.warn(`  Liquipedia galleries unavailable (${error.message}): skins confirmed by their dates only`);
    return null;
  }
}

/**
 * StarLight and Collector skins dated to their month, from the two wiki
 * pages `scripts/events.mjs` reads. When the wiki does not answer, the
 * calendar that script wrote last time.
 */
async function seriesEntries(heroes) {
  const label = { starlight: "StarLight", collector: "Collector" };
  const entries = [];
  try {
    for (const [key, { title, section }] of Object.entries(SERIES_PAGES)) {
      const data = await api({ action: "query", titles: title, prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1" });
      const text = Object.values(data.query?.pages ?? {})[0]?.revisions?.[0]?.slots?.main?.["*"] ?? "";
      const body = level2Section(text, section);
      if (!body) throw new Error(`section "${section}" missing from ${title}`);
      entries.push(...attachHeroes(readGallery(body), heroes).map((e) => ({ ...e, series: label[key] })));
      await pause(300);
    }
    return entries;
  } catch (error) {
    console.warn(`  StarLight and Collector pages unavailable (${error.message}): previous calendar used`);
    const previous = await readJson(`${OUTPUT}/events.json`);
    return Object.entries(label).flatMap(([key, series]) => (previous[key] ?? []).map((e) => ({ ...e, series })));
  }
}

/**
 * Removes the visuals of what is no longer listed: the folder of a hero
 * that is not released (Dori's artwork, downloaded in November 2026), and
 * the portrait and artwork of a hidden skin, or of an artwork left out as
 * provisional with no live file to replace it. The data sync workflow
 * commits public/visuels with `git add -A`, deletions included. `planned`
 * holds every path this run wrote or kept: none of them is touched.
 */
async function pruneVisuals({ heroes, hidden, withdrawn, planned, manifest }) {
  const removed = [];
  const remove = async (path) => {
    if (planned.has(path) || !existsSync(path)) return;
    await rm(path, { recursive: true, force: true });
    for (const key of Object.keys(manifest)) if (key === path || key.startsWith(`${path}/`)) delete manifest[key];
    removed.push(path);
  };
  const listed = new Set(heroes.map((h) => h.slug));
  const folders = existsSync("public/visuels/heros") ? await readdir("public/visuels/heros") : [];
  for (const folder of folders) if (!listed.has(folder)) await remove(`public/visuels/heros/${folder}`);
  for (const s of hidden) {
    await remove(`public/visuels/heros/${s.hero}/skins/${s.id}-${slugify(s.name)}.webp`);
    await remove(`public/visuels/heros/${s.hero}/illustrations/${slugify(s.name)}.webp`);
  }
  for (const path of withdrawn) await remove(path);
  return removed;
}

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

/**
 * Hero pages (wiki) and official sheets (API), merged slot by slot: see
 * `skills.mjs`. `matched` is the official skill of each slot, for its icon.
 */
async function heroSkills(heroes, read = null) {
  if (!read) console.log("Reading hero pages…");
  const pages = read ?? (await heroPages(heroes));
  const nbSkills = Object.values(pages).reduce((n, p) => n + p.skills.filter(Boolean).length, 0);
  const nbIllustrations = Object.values(pages).reduce((n, p) => n + p.illustrations.length, 0);
  console.log(`  ${nbSkills} wiki skills, ${nbIllustrations} illustrations`);

  console.log("Official hero sheets (API)…");
  const { skills: skillsArena, taglines, lanes } = await fetchArenaSkills(heroes);
  console.log(`  ${Object.keys(skillsArena).length} heroes covered by the API`);
  // Before the builds, counters and durations, which are read per lane.
  const relaned = withOfficialLanes(heroes, lanes);
  console.log(`  ${Object.keys(lanes).length} heroes with the official lanes${relaned.length ? `, ${relaned.length} differing from the wiki:` : ""}`);
  for (const d of relaned) console.log(`    ${d.name}: wiki ${d.wiki.join("/") || "none"}, official ${d.official.join("/")}`);

  // As a last resort, whatever the last run wrote is kept: an outage of both
  // sources must not erase a hero's skills.
  const skillsExisting = await readJson(`${OUTPUT}/skills.json`);
  const finalSkills = {};
  const matched = {};
  let official = 0;
  let withNumbers = 0;
  let withCooldown = 0;
  for (const h of heroes) {
    const wiki = pages[h.slug]?.skills ?? [];
    const arena = skillsArena[h.slug] ?? [];
    matched[h.slug] = matchOfficial(wiki, arena);
    const list = mergeSkills({ wiki, official: arena, previous: skillsExisting[h.slug] ?? [] });
    if (!list.length) continue;
    finalSkills[h.slug] = list;
    official += matched[h.slug].filter(Boolean).length;
    withNumbers += list.filter((c) => /\d/.test(c?.description ?? "")).length;
    withCooldown += list.filter((c) => c?.cooldown).length;
  }
  const total = Object.values(finalSkills).reduce((n, l) => n + l.filter(Boolean).length, 0);
  console.log(`  ${total} skills: ${official} with the official text, ${withNumbers} with figures, ${withCooldown} with a cooldown`);
  return { pages, skillsArena, taglines, finalSkills, matched };
}

const LIQUIPEDIA_GAME_CACHE = "scripts/liquipedia-game-cache.json";

/**
 * Corrects each hero's `stats` in place: Liquipedia's level-1 attributes and
 * the official patch notes over the Fandom module, field by field (see
 * `hero-stats.mjs`). Without Liquipedia, the patch notes still apply.
 */
async function heroBaseStats(heroes, patchDetails) {
  const cache = await readJson(LIQUIPEDIA_GAME_CACHE);
  let pages = new Map();
  try {
    pages = await liquipediaInfoboxes(liquipedia, heroes.map((h) => h.name), cache, "heroes", heroStatsFromInfobox);
    await writeFile(LIQUIPEDIA_GAME_CACHE, `${JSON.stringify(cache, null, 1)}\n`);
  } catch (error) {
    console.warn(`  Liquipedia unavailable (${error.message}): patch notes and Fandom only`);
  }
  const fromPatches = patchAttributes(patchDetails);
  let fromLiquipedia = 0;
  let changed = 0;
  const conflicts = [];
  for (const h of heroes) {
    const lp = pages.get(h.name)?.data ?? null;
    if (lp) fromLiquipedia += 1;
    const merged = mergeHeroStats({ fandom: h.stats, liquipedia: lp, patch: fromPatches[h.slug] });
    for (const c of merged.conflicts) conflicts.push(`${h.name} ${c.field}: Liquipedia ${c.liquipedia}, patch ${c.version} ${c.patch}`);
    if (JSON.stringify(merged.stats) !== JSON.stringify(h.stats)) changed += 1;
    h.stats = merged.stats;
  }
  console.log(`  ${fromLiquipedia}/${heroes.length} heroes on Liquipedia, ${Object.keys(fromPatches).length} with attributes in the patch notes, ${changed} corrected`);
  // The official note wins; the gap is worth a look in game.
  if (conflicts.length) console.warn(`  Liquipedia behind the patch notes (${conflicts.length}):\n    ${conflicts.join("\n    ")}`);
}

/**
 * `--heroes`: re-reads only the hero catalogue, base stats and skills (wiki,
 * official sheets, Liquipedia), on the patch notes already synchronized.
 * Writes `heroes.json`, `skills.json` and the English skills the site reads.
 */
async function heroesOnly() {
  // Only the heroes already listed: a new or unreleased hero enters through
  // the full sync, which checks the official list.
  const previous = await readJson(`${OUTPUT}/heroes.json`);
  const listed = new Set((Array.isArray(previous) ? previous : []).filter((h) => isReleasedHero(h)).map((h) => h.slug));
  const heroes = normalizeHeroes(await moduleLua("Module:Hero/data"), previous)
    .filter((h) => listed.has(h.slug))
    .map((h) => ({ ...h, released: true }));
  const { finalSkills } = await heroSkills(heroes);
  console.log("Hero base stats (Liquipedia, patch notes)…");
  await heroBaseStats(heroes, (await readJson(`${OUTPUT}/patches.json`)).details ?? {});
  const write = (name, data) => writeFile(`${OUTPUT}/${name}.json`, JSON.stringify(data, null, 2) + "\n");
  await Promise.all([write("heroes", heroes), write("skills", finalSkills), write("skills/en", finalSkills)]);
  console.log(`\nWritten to ${OUTPUT}/: heroes.json, skills.json, skills/en.json`);
}

/**
 * Marks the items out of the game (`removed: true`), from Liquipedia's status
 * and the official catalogue (see `items.mjs`), and reports the prices the
 * wiki and Liquipedia disagree on. Drops the wiki's raw `availability`.
 */
async function itemsInGame(items) {
  const official = await jsonFrom(`${STATS}/academy/equipment?size=500`);
  const names = official?.data?.records?.length ? officialItemNames(official.data.records) : null;
  const cache = await readJson(LIQUIPEDIA_GAME_CACHE);
  let pages = new Map();
  try {
    pages = await liquipediaInfoboxes(liquipedia, items.map((o) => liquipediaItemTitle(o.name)), cache, "items", itemFromInfobox);
    await writeFile(LIQUIPEDIA_GAME_CACHE, `${JSON.stringify(cache, null, 1)}\n`);
  } catch (error) {
    console.warn(`  Liquipedia unavailable (${error.message}): wiki status and official catalogue only`);
  }
  const byName = new Map(items.map((o) => [o.name, pages.get(liquipediaItemTitle(o.name))?.data ?? null]));
  for (const o of items) {
    const removed = itemRemoved({ name: o.name, availability: o.availability, liquipedia: byName.get(o.name), official: names });
    delete o.availability;
    if (removed) o.removed = true;
  }
  const removed = items.filter((o) => o.removed).map((o) => o.name);
  console.log(`  ${removed.length} removed from the game: ${removed.join(", ") || "none"}` + (names ? "" : " (official catalogue unavailable)"));
  const gaps = priceGaps(items.filter((o) => !o.removed), byName);
  if (gaps.length) {
    console.warn(`  prices differing on Liquipedia (wiki kept, to check in game):\n    ${gaps.map((g) => `${g.name}: wiki ${g.wiki}, Liquipedia ${g.liquipedia}`).join("\n    ")}`);
  }
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });

  console.log("Reading wiki modules…");
  const [rawHeroes, rawSkins, rawItems] = await Promise.all([
    moduleLua("Module:Hero/data"),
    moduleLua("Module:Skin/data"),
    moduleLua("Module:Equipment/data"),
  ]);

  // The previous catalogue covers an entry an edit blanked or removed.
  const previousHeroes = await readJson(`${OUTPUT}/heroes.json`);
  const catalogue = normalizeHeroes(rawHeroes, previousHeroes);
  const moduleSkins = normalizeSkins(rawSkins);
  const items = normalizeItems(rawItems);
  console.log(`  ${catalogue.length} heroes, ${Object.values(moduleSkins).flat().length} skins, ${items.length} items in the modules`);

  console.log("Reading hero pages…");
  const pages = await heroPages(catalogue);

  // Only released heroes are listed: the wiki documents announced ones
  // ahead of time (Dori, "TBA", November 2026).
  console.log("Released heroes…");
  const official = await officialHeroes();
  // A hero listed last time with a past release date stays listed even if
  // the official list skipped it this time: a released hero does not leave
  // the game, and a partial answer must not drop half the roster.
  const listedBefore = (Array.isArray(previousHeroes) ? previousHeroes : [])
    .filter((h) => isReleasedHero(h))
    .map((h) => h.slug);
  const officialSlugs = official ? new Set([...official.slugs, ...listedBefore]) : null;
  const heroes = catalogue
    .filter((h) => isReleasedHero(h, { official: officialSlugs, unfinished: pages[h.slug]?.unfinished }))
    .map((h) => ({ ...h, released: true }));
  const unreleased = catalogue.filter((h) => !heroes.some((r) => r.slug === h.slug));
  for (const h of unreleased) delete pages[h.slug];
  console.log(
    `  ${heroes.length} released (official list: ${official ? official.source : "unavailable, dates only"})` +
      (unreleased.length ? `, left out: ${unreleased.map((h) => `${h.name} (${h.release ?? "no date"})`).join(", ")}` : ""),
  );

  // Skins: the module, completed by the hero pages, kept to released ones.
  console.log("Skins…");
  const merged = mergeSkins({
    moduleSkins,
    avatars: Object.fromEntries(Object.entries(pages).map(([slug, p]) => [slug, p.avatars])),
    liquipedia: await liquipediaGalleries(heroes),
    events: await seriesEntries(heroes),
    heroes,
  });
  const skins = merged.skins;
  const nbSkins = Object.values(skins).reduce((n, s) => n + s.length, 0);
  console.log(`  ${nbSkins} skins listed, ${merged.added.length} added from the hero pages, ${merged.hidden.length} not released yet left out`);
  for (const s of merged.hidden) console.log(`    not released: ${s.hero} ${s.name} (${s.id})`);
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

  console.log("Items still in the game (Liquipedia, official catalogue)…");
  await itemsInGame(items);

  const { skillsArena, taglines, finalSkills, matched } = await heroSkills(heroes, pages);

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
      // Positions in `lore` of the chapter titles ("Duke of Shards").
      headings: story?.headings ?? [],
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

  const { list: patchList, details: patchDetails } = await syncPatches();

  console.log("Hero base stats (Liquipedia, patch notes)…");
  await heroBaseStats(heroes, patchDetails);

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
  // A portrait or icon the wiki marks as provisional (test server, leak) is
  // not the game's: the file already on disk, if any, stays as it is.
  for (const urls of [portraits, icons]) {
    for (const [id, url] of Object.entries(urls)) if (fileInfo.get(url)?.provisional) delete urls[id];
  }
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
  // A slot renamed by the official sheet (a revamp) has a new icon: the wiki
  // file of the old skill is not used for it.
  const fileIcon = (slug, i, name) => {
    const wiki = pages[slug]?.skills?.[i];
    return wiki?.name === name ? (wiki.image ?? name) : name;
  };
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
    const arena = matched[slug] ?? [];
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
  // A gallery row whose file is provisional ("Thamuz (Lord Lava; unreleased
  // revamp).jpg", "Masha Rogue Talon (Original).jpg") gives way to the live
  // file it stands next to on the wiki, when there is one.
  const rowsBySlug = Object.fromEntries(
    Object.entries(pages).map(([slug, page]) => [
      slug,
      page.illustrations.flatMap(({ file, skin }) =>
        isProvisionalFile({ name: file })
          ? fallbackFileNames(file).map((f) => ({ file: f, skin, fallback: true }))
          : [{ file, skin }],
      ),
    ]),
  );
  const namesIllustrations = [
    ...new Set(Object.values(rowsBySlug).flatMap((rows) => rows.map((r) => r.file))),
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

  const hiddenNames = new Set(merged.hidden.map((h) => `${h.hero}:${normalizeNameSkin(h.name)}`));
  const illustrations = {};
  // Artwork paths of a provisional file with no live file to replace it.
  const withdrawnIllustrations = [];
  let provisionalReplaced = 0;
  let unlisted = 0;
  for (const [slug, rows] of Object.entries(rowsBySlug)) {
    const bySkin = {};
    // The illustration is stored under the data module's name, the one the
    // hero page uses to find it, as soon as the caption matches it.
    const namesModule = new Map(
      (skins[slug] ?? []).map((s) => [normalizeNameSkin(s.name), s.name]),
    );
    // Skins one of whose artworks was set aside as provisional.
    const setAside = new Set(
      pages[slug].illustrations.filter(({ file }) => isProvisionalFile({ name: file })).map(({ skin }) => skin),
    );
    for (const { file, skin, fallback } of rows) {
      const key = file.replace(/\.(jpg|png)$/, "");
      const url = urlsIllustrations[key];
      if (!url || !skin) continue;
      if (fileInfo.get(url)?.provisional) {
        setAside.add(skin);
        continue;
      }
      // The artwork of a skin left out as not released yet is not shown. A
      // caption the catalogue does not know otherwise (another spelling,
      // "Exoracial Executioner" for "Exoracial Executer", a painted variant)
      // stays a lone artwork, under the caption's name.
      if (hiddenNames.has(`${slug}:${normalizeNameSkin(skin)}`)) {
        unlisted += 1;
        continue;
      }
      const nameSkin = namesModule.get(normalizeNameSkin(skin)) ?? skin;
      // First illustration wins: the following ones are older visuals.
      if (bySkin[nameSkin]) continue;
      if (fallback) provisionalReplaced += 1;
      const nameFile = `${slugify(nameSkin)}.webp`;
      bySkin[nameSkin] = `/visuels/heros/${slug}/illustrations/${nameFile}`;
      plan.push({
        url,
        path: `public/visuels/heros/${slug}/illustrations/${nameFile}`,
        optimize: true,
      });
    }
    // A provisional artwork with nothing to replace it is withdrawn.
    for (const skin of setAside) {
      const nameSkin = namesModule.get(normalizeNameSkin(skin)) ?? skin;
      if (!bySkin[nameSkin]) {
        withdrawnIllustrations.push(`public/visuels/heros/${slug}/illustrations/${slugify(nameSkin)}.webp`);
      }
    }
    if (Object.keys(bySkin).length) illustrations[slug] = bySkin;
  }
  console.log(
    `  ${Object.keys(urlsIllustrations).length}/${namesIllustrations.length} full-size illustrations` +
      `, ${provisionalReplaced} provisional replaced by the live file, ${unlisted} of unreleased skins left out`,
  );

  console.log("Resolving items, emblems, talents and spells…");
  const [urlsItems, urlsEmblems, urlsTalents, spellUrls, urlsLanes] = await Promise.all([
    urlsFiles(items.map((o) => o.name)),
    urlsFiles(EMBLEMS),
    urlsFiles(TALENTS),
    urlsFiles(SPELLS),
    urlsFiles(Object.values(LANE_FILES)),
  ]);

  // The lane icons keep the site's token as their file name, not the wiki's.
  const urlsLanesByLane = Object.fromEntries(
    Object.entries(LANE_FILES)
      .map(([lane, file]) => [lane, urlsLanes[file]])
      .filter(([, url]) => url),
  );

  const batches = [
    planFiles(urlsItems, "objets"),
    planFiles(urlsEmblems, "emblemes"),
    planFiles(urlsTalents, "talents"),
    planFiles(spellUrls, "sorts"),
    planFiles(urlsLanesByLane, "lanes"),
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
      const path = `/visuels/${type}/${key}.webp`;
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

  const manifest = await readJson(MANIFEST);
  if (WITH_IMAGES) {
    console.log(`Downloading ${plan.length} visuals…`);
    const results = { ok: 0, refreshed: 0, exists: 0, failed: 0 };
    const refreshed = [];

    // In small batches: fast enough, without saturating the wiki.
    for (let i = 0; i < plan.length; i += 8) {
      const batch = plan.slice(i, i + 8);
      const outcomes = await Promise.all(batch.map((v) => download(v, manifest)));
      outcomes.forEach((r, k) => {
        results[r] += 1;
        if (r === "refreshed") refreshed.push(batch[k].path);
      });
      process.stdout.write(`\r    ${Math.min(i + 8, plan.length)}/${plan.length}`);
    }
    console.log(
      `\n  ${results.ok} downloaded, ${results.refreshed} refreshed from a newer wiki version, ` +
        `${results.exists} already up to date, ${results.failed} failed`,
    );
    for (const path of refreshed) console.log(`    refreshed: ${path}`);

    const removed = await pruneVisuals({
      heroes,
      hidden: merged.hidden,
      withdrawn: withdrawnIllustrations,
      planned: new Set(plan.map((v) => v.path)),
      manifest,
    });
    console.log(`  ${removed.length} visuals of unlisted content removed`);
    for (const path of removed) console.log(`    removed: ${path}`);

    await writeFile(
      MANIFEST,
      JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n",
    );
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
  // Per hero as well: a partial answer only replaces the heroes it served.
  const perHero = (name, next) => {
    const { merged, kept } = keepUnservedHeroes(statsExisting[name], next ?? {});
    if (next && kept.length) console.warn(`  ${name}: ${kept.length} heroes not served this run, previous values kept`);
    return merged;
  };
  const ranksBefore = statsExisting.rankings?.byRank ?? {};
  const ranksKept = stats ? Object.keys(ranksBefore).filter((r) => !(r in stats)) : [];
  if (ranksKept.length) console.warn(`  ranking: ${ranksKept.join(", ")} not served this run, previous values kept`);
  const statistics = {
    rankings: stats
      ? { measuredAt: new Date().toISOString(), rates: stats.all, byRank: keepMissingRanks(ranksBefore, stats) }
      : (statsExisting.rankings ?? { measuredAt: null, rates: {} }),
    counters: perHero("counters", counters),
    builds: perHero("builds", builds),
    guides: perHero("guides", guides),
    // Per hero: one the API did not serve keeps its teammates.
    teammates: { ...(statsExisting.teammates ?? {}), ...(complementary?.teammates ?? {}) },
    relations: links ?? statsExisting.relations ?? {},
  };

  // Name-by-slug table, shipped client-side without the rest of the catalog.
  const names = Object.fromEntries(heroes.map((h) => [h.slug, h.name]));

  // Wiki markup that got through the cleanup ("[[", "{{", "|image=", "===")
  // would show as is on the pages: every text about to be written is checked,
  // and each leftover reported, so a new wiki template is noticed at the
  // first sync rather than by a reader.
  reportMarkup({ heroes, skins, items, skills: finalSkills, modes, stories });

  await Promise.all([
    // Catalogue
    write("heroes", heroes),
    write("skins", skins),
    write("items", items),
    write("skills", finalSkills),
    // The files the site reads in English, and the translations' source:
    // without them, a sync never reached the pages.
    write("items/en", items),
    write("skills/en", finalSkills),
    write("modes", modes),
    write("stories", stories),
    // The English pages read `<dataset>/en.json`, the source every other
    // language is translated from (`translate-data.mjs`): written here, from
    // the wiki, so a sync reaches the pages instead of a frozen copy.
    write("stories/en", stories),
    write("modes/en", modes),
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
      // The wiki provides the catalog; Liquipedia the patch list and the
      // notes the wiki lacks; the community API provides the measurements.
      sources: [
        "https://mobilelegends.fandom.com",
        "https://liquipedia.net/mobilelegends",
        "https://arena.rone.dev",
      ],
    }),
  ]);

  console.log(`\nWritten to ${OUTPUT}/`);
}

await (process.argv.includes("--measures")
  ? measuresDaily()
  : process.argv.includes("--patches")
  ? patchesOnly()
  : process.argv.includes("--heroes")
  ? heroesOnly()
  : process.argv.includes("--evolution")
  ? evolutionSingle()
  : process.argv.includes("--combos")
    ? combosOnly()
    : process.argv.includes("--duos")
      ? duosOnly()
      : main());

// The wiki keeps idle connections open for minutes after the last request:
// everything is written, nothing is left to wait for.
process.exit();

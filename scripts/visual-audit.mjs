/**
 * Audit of the hero visuals the site ships: which ones are not the final,
 * official file, by category, and where each one shows on the site.
 *
 *     node scripts/visual-audit.mjs            # report on stdout
 *     node scripts/visual-audit.mjs --json out.json
 *
 * Offline: reads the synced catalogue (`src/data/game/`), the download
 * manifest (`visual-sources.json`: the wiki file each visual comes from) and
 * the files under `public/visuels/heros/` (their size, with sharp, and their
 * bytes, for duplicates). It changes nothing: what it finds is fixed by the
 * rules of `visual-rules.mjs` and `gallery.mjs`, at display time and at the
 * next sync.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { normalizeNameSkin } from "./gallery.mjs";
import { isReleasedSkin } from "./release.mjs";
import { duplicateGroups, heroOfPath, isProvisionalUpload, visualIssues, visualKind } from "./visual-rules.mjs";

const DATA = "src/data/game";
const read = async (file) => JSON.parse(await readFile(file, "utf8"));

const [visuals, sources, skins, events] = await Promise.all([
  read(`${DATA}/visuals.json`),
  read(`${DATA}/visual-sources.json`),
  read(`${DATA}/skins.json`),
  read(`${DATA}/events.json`),
]);
const now = Date.parse(JSON.parse(await readFile(`${DATA}/sync.json`, "utf8")).date) || Date.now();

/** Every path the catalogue references, with the hero and, for a skin, its name. */
const referenced = new Map();
for (const [slug, v] of Object.entries(visuals.heroes ?? {})) {
  if (v.portrait) referenced.set(v.portrait, { hero: slug, role: "hero-portrait" });
  if (v.icon) referenced.set(v.icon, { hero: slug, role: "hero-icon" });
  const byId = new Map((skins[slug] ?? []).map((s) => [s.id, s]));
  for (const [id, path] of Object.entries(v.skins ?? {})) {
    referenced.set(path, { hero: slug, role: "skin-portrait", skin: byId.get(id) ?? null, id });
  }
}
for (const [slug, byName] of Object.entries(visuals.illustrations ?? {})) {
  const byKey = new Map((skins[slug] ?? []).map((s) => [normalizeNameSkin(s.name), s]));
  for (const [name, path] of Object.entries(byName)) {
    referenced.set(path, { hero: slug, role: "artwork", name, skin: byKey.get(normalizeNameSkin(name)) ?? null });
  }
}

/** Heroes whose artwork a page names in its code (`heroArt("estes")`, the tools' faces). */
async function heroesNamedInCode() {
  const named = new Map();
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else if (/\.tsx?$/.test(e.name)) {
        const text = await readFile(p, "utf8");
        for (const m of text.matchAll(/(?:heroArt|artOf)\(\s*"([a-z0-9-]+)"/g)) named.set(m[1], [...(named.get(m[1]) ?? []), p]);
        for (const m of text.matchAll(/"(\/[a-z/-]*)":\s*\{\s*hero:\s*"([a-z0-9-]+)"/g)) {
          named.set(m[2], [...(named.get(m[2]) ?? []), `tool ${m[1]}`]);
        }
      }
    }
  };
  await walk("src");
  return named;
}
const named = await heroesNamedInCode();

/** Months of the events calendar that quote a skin, by hero and normalised name. */
const eventMonths = new Map();
for (const list of ["starlight", "collector"]) {
  for (const e of events[list] ?? []) {
    if (!e.hero || !e.skin) continue;
    const key = `${e.hero}:${normalizeNameSkin(e.skin)}`;
    eventMonths.set(key, [...(eventMonths.get(key) ?? []), e.month]);
  }
}

/** The first artwork of a hero the site shows: its poster everywhere a page shows the hero big. */
const posterOf = new Map();
for (const [slug, byName] of Object.entries(visuals.illustrations ?? {})) {
  for (const [, path] of Object.entries(byName)) {
    const ref = referenced.get(path);
    if (!ref.skin || !isReleasedSkin(ref.skin, now)) continue;
    const issues = visualIssues({ path, source: sources[`public${path}`] });
    if (issues.some((i) => i !== "unknown-source")) continue;
    posterOf.set(slug, path);
    break;
  }
}

/** Pages where a visual shows. */
function placesOf(path, ref) {
  const places = [];
  if (ref.role === "artwork") {
    places.push(`/heroes/${ref.hero}/skins`);
    const months = eventMonths.get(`${ref.hero}:${normalizeNameSkin(ref.name)}`);
    if (months) places.push(...months.map((m) => `/events/${m}`));
    if (posterOf.get(ref.hero) === path) {
      places.push("hero poster (hero page headers, builds, counters, compare, home, share cards)");
      for (const where of named.get(ref.hero) ?? []) places.push(`poster: ${where}`);
    }
  } else if (ref.role === "skin-portrait") {
    places.push(`/heroes/${ref.hero}/skins`, "/skins", "/tools/collection");
  } else {
    places.push(`/heroes/${ref.hero}`, "hero lists, draft, tier list, quizzes");
  }
  return places;
}

/** Every file under public/visuels/heros. */
async function filesOnDisk() {
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else out.push(p);
    }
  };
  if (existsSync("public/visuels/heros")) await walk("public/visuels/heros");
  return out.sort();
}

const entries = [];
for (const file of await filesOnDisk()) {
  const path = file.replace(/^public/, "");
  const data = await readFile(file);
  const meta = await sharp(data).metadata().catch(() => ({}));
  const source = sources[file];
  const ref = referenced.get(path) ?? null;
  const issues = ref ? visualIssues({ path, source, width: meta.width, height: meta.height }) : [];
  if (ref?.role === "artwork" && !ref.skin) issues.push(isProvisionalUpload(source?.timestamp, now) ? "provisional" : "unmatched");
  if (ref?.skin && !isReleasedSkin(ref.skin, now)) issues.push("unreleased");
  if (!ref) issues.push("orphan");
  entries.push({
    path,
    kind: visualKind(path),
    hero: ref?.hero ?? heroOfPath(path),
    name: ref?.name ?? ref?.skin?.name ?? null,
    width: meta.width ?? null,
    height: meta.height ?? null,
    source: source?.file ?? null,
    uploaded: source?.timestamp ?? null,
    sha1: source?.sha1 ?? null,
    hash: createHash("sha1").update(data).digest("hex"),
    issues,
    places: ref ? placesOf(path, ref) : [],
  });
}

// Same picture under two paths: an artwork drawn for two heroes is legitimate
// (Zilong and Freya's "Christmas Carnival"); two skins of one hero sharing a
// file is not. A hero's portrait is its default skin's by design.
const duplicates = duplicateGroups(
  entries.filter((e) => !e.issues.includes("orphan") && !e.path.endsWith("/portrait.webp")),
);
const byPath = new Map(entries.map((e) => [e.path, e]));
for (const group of duplicates) {
  const sameHero = new Set(group.map(heroOfPath)).size === 1;
  for (const path of group) byPath.get(path).issues.push(sameHero ? "duplicate" : "shared");
}

const CATEGORIES = {
  "pre-release": "Pre-release file (unreleased, leak, advanced/test server, concept, draft, teaser)",
  altered: "Altered copy (edit, crop, upscale, screenshot, watermark, older version)",
  withheld: "On the hand-checked list (WITHHELD_ARTWORKS)",
  ratio: "Abnormal shape (crop, stretched or resized)",
  "low-resolution": "Low resolution",
  duplicate: "Same picture as another skin of the same hero",
  shared: "Same picture under two heroes (usually a shared official artwork)",
  provisional: "Recent artwork matching no catalogue skin (badge, never a poster)",
  unmatched: "Older artwork matching no catalogue skin (hero gallery only, never a poster)",
  unreleased: "Visual of a skin that is not out",
  "unknown-source": "No manifest entry: origin cannot be checked",
  orphan: "File on disk no catalogue entry references (not shown)",
};

/**
 * What the site does with a visual: `hidden` (left out at display time,
 * `sortIllustrations` in `src/lib/listed.ts`), `badge` (shown as
 * provisional), `gallery` (hero gallery only) or `shown`.
 */
const HIDDEN = new Set(["pre-release", "altered", "withheld", "unreleased", "orphan"]);
for (const e of entries) {
  e.status = e.issues.some((i) => HIDDEN.has(i) && (i !== "altered" || e.kind === "artwork"))
    ? "hidden"
    : e.issues.includes("provisional")
      ? "badge"
      : e.issues.includes("unmatched")
        ? "gallery"
        : "shown";
}

const report = Object.fromEntries(
  Object.keys(CATEGORIES).map((c) => [c, entries.filter((e) => e.issues.includes(c))]),
);

if (process.argv.includes("--json")) {
  const out = process.argv[process.argv.indexOf("--json") + 1];
  await writeFile(out, JSON.stringify({ date: new Date(now).toISOString(), total: entries.length, report, duplicates }, null, 2) + "\n");
  console.log(`Written to ${out}`);
}

const kinds = entries.reduce((n, e) => ({ ...n, [e.kind ?? "other"]: (n[e.kind ?? "other"] ?? 0) + 1 }), {});
console.log(`Hero visuals: ${entries.length} (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")})`);
const statuses = entries.reduce((n, e) => ({ ...n, [e.status]: (n[e.status] ?? 0) + 1 }), {});
console.log(`On the site: ${Object.entries(statuses).map(([k, n]) => `${n} ${k}`).join(", ")}\n`);
for (const [category, list] of Object.entries(report)) {
  console.log(`## ${CATEGORIES[category]}: ${list.length}`);
  const shown = process.argv.includes("--all") ? list : list.slice(0, 15);
  for (const e of shown) {
    const size = e.width ? ` ${e.width}x${e.height}` : "";
    const name = e.name ? ` "${e.name}"` : "";
    console.log(`  [${e.status}] ${e.path}${size}${name} ← ${e.source ?? "?"}`);
    if (e.places.length) console.log(`      shown on: ${e.places.join("; ")}`);
  }
  if (shown.length < list.length) console.log(`  … ${list.length - shown.length} more (--all)`);
  console.log();
}

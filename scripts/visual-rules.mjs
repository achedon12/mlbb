/**
 * Rules telling a final, official visual from one the site must not show
 * as such: a pre-release or altered file, a picture of the wrong size or
 * shape, a duplicate. Shared by the audit (`visual-audit.mjs`), the site
 * (`src/lib/listed.ts`) and the tests; the sync keeps its own checks on the
 * wiki's file pages (`gallery.mjs`), which see more than a file name.
 */
import { ARTWORK_MIN_WIDTH, alteredArtwork, isProvisionalFile, isWithheldArtwork } from "./gallery.mjs";

/**
 * Expected shape of each kind of visual, width over height, and the smallest
 * width an official file of that kind has. Full-size artworks are 16:9 (see
 * `ARTWORK_RATIO` in `gallery.mjs`); shop portraits are drawn 240 x 390 or a
 * multiple of it (0.62); icons are square.
 */
export const VISUAL_SHAPES = {
  artwork: { ratio: [1.5, 2.1], minWidth: ARTWORK_MIN_WIDTH },
  portrait: { ratio: [0.5, 0.75], minWidth: 180 },
  icon: { ratio: [0.9, 1.1], minWidth: 64 },
};

/** Kind of a hero visual from its local path, or null for any other visual. */
export function visualKind(path) {
  if (!/\/visuels\/heros\//.test(path)) return null;
  if (/\/illustrations\//.test(path)) return "artwork";
  if (/\/skins\//.test(path) || /\/portrait\.webp$/.test(path)) return "portrait";
  if (/\/icone\.webp$/.test(path)) return "icon";
  return null;
}

/** Hero slug of a hero visual's path ("/visuels/heros/<slug>/…"), or "". */
export const heroOfPath = (path) => String(path).match(/\/heros\/([^/]+)\//)?.[1] ?? "";

/**
 * Why a picture of `kind` is not the official file, from its size: "low-resolution"
 * (narrower than any official file of that kind), "ratio" (another shape: a
 * crop, a stretched or a resized copy), or null. Unknown sizes are not held
 * against it.
 */
export function shapeIssue(kind, width, height) {
  const shape = VISUAL_SHAPES[kind];
  if (!shape || !width || !height) return null;
  const ratio = width / height;
  if (ratio < shape.ratio[0] || ratio > shape.ratio[1]) return "ratio";
  if (width < shape.minWidth) return "low-resolution";
  return null;
}

/**
 * The categories a hero visual falls into, most serious first. `source` is
 * the manifest entry (`visual-sources.json`: wiki file, SHA-1, upload date),
 * `width` and `height` those of the local file. Each category is one of:
 *
 * - `pre-release`: the wiki file is marked as unreleased, leaked, from the
 *   advanced or test server, a concept, a draft, a teaser (`isProvisionalFile`);
 * - `altered`: an edit, a crop, an upscale, a screenshot, a watermarked or fan
 *   copy, an older version (`alteredArtwork`, full-size artwork only);
 * - `withheld`: on the hand-checked list (`WITHHELD_ARTWORKS`);
 * - `ratio`, `low-resolution`: see `shapeIssue`;
 * - `unknown-source`: no manifest entry, the file's origin cannot be checked.
 */
export function visualIssues({ path, source, width, height }) {
  const kind = visualKind(path);
  const issues = [];
  const file = source?.file;
  if (file && isProvisionalFile({ name: file })) issues.push("pre-release");
  if (file && kind === "artwork" && alteredArtwork({ name: file })) issues.push("altered");
  if (file && kind === "artwork" && isWithheldArtwork(heroOfPath(path), file)) issues.push("withheld");
  const shape = shapeIssue(kind, width, height);
  if (shape) issues.push(shape);
  if (!file) issues.push("unknown-source");
  return issues;
}

/**
 * Days after its upload during which an artwork no catalogue skin claims is
 * held as provisional: the wiki puts a skin's artwork up ahead of its
 * release (advanced server, announcement), and often replaces it with the
 * final file within weeks (Bruno's "The Protector", September 2026). Past
 * that, a lone artwork is an older skin the catalogue lacks or spells
 * otherwise ("Stellar Briliance").
 */
export const PROVISIONAL_DAYS = 60;

/**
 * Whether a lone artwork, uploaded at `timestamp` (ISO, from the manifest),
 * is provisional at `now`: recent, or of unknown upload date.
 */
export function isProvisionalUpload(timestamp, now = Date.now()) {
  const uploaded = Date.parse(timestamp ?? "");
  return Number.isNaN(uploaded) || now - uploaded < PROVISIONAL_DAYS * 86_400_000;
}

/**
 * Sets of paths that show the same picture: same SHA-1 on the wiki, or same
 * bytes on disk (`hash`). `entries` holds `{ path, sha1, hash }`; returns the
 * groups of two paths or more.
 */
export function duplicateGroups(entries) {
  const groups = new Map();
  for (const e of entries) {
    for (const key of [e.sha1 && `sha1:${e.sha1}`, e.hash && `hash:${e.hash}`].filter(Boolean)) {
      const group = groups.get(key) ?? new Set();
      group.add(e.path);
      groups.set(key, group);
    }
  }
  const seen = new Set();
  const out = [];
  for (const group of groups.values()) {
    if (group.size < 2) continue;
    const id = [...group].sort().join("|");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push([...group].sort());
  }
  return out;
}

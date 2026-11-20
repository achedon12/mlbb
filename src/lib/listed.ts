import { alteredArtwork, isProvisionalFile, isWithheldArtwork } from "../../scripts/gallery.mjs";
import { isListedHero, isReleasedSkin } from "../../scripts/release.mjs";
import { isProvisionalUpload, shapeIssue } from "../../scripts/visual-rules.mjs";
import { collaborationOf } from "./collaborations";
import type { GeneratedHero, Skin } from "./types";
import { normalizeNameSkin } from "./utils";

/**
 * What the site lists out of the synced catalogue: released heroes and
 * skins only. The sync already leaves the rest out (`scripts/release.mjs`);
 * these filters apply the same rules to a catalogue an older sync wrote, so
 * an announced hero (Dori, "TBA") or a skin marked "Upcoming" never reaches
 * a list, a page, the sitemap, the draft, the quizzes or the bot.
 */

export function listedHeroes<H extends GeneratedHero>(heroes: H[], now = Date.now()): H[] {
  return heroes.filter((h) => isListedHero(h, now));
}

export function listedSkins(skins: Skin[], now = Date.now()): Skin[] {
  return skins.filter((s) => isReleasedSkin(s, now));
}

/**
 * What the download manifest (`visual-sources.json`) says of a local visual:
 * the wiki file it was made from, when that version was uploaded and, once
 * the sync records it, the size of the wiki's original. A bare string is the
 * wiki file alone.
 */
export interface VisualSource {
  file?: string;
  timestamp?: string | null;
  width?: number | null;
  height?: number | null;
}
export type SourceOf = (path: string) => VisualSource | string | undefined;
const asSource = (s: VisualSource | string | undefined): VisualSource | undefined =>
  typeof s === "string" ? { file: s } : s;

/**
 * A hero's full-size artworks, by skin name, without those the site does not
 * show: the artwork of a skin that is not out (it would reappear as a lone
 * artwork), the artwork of a collaboration skin, shown as its shop portrait
 * only (see `collaborations.ts`), and an artwork that is not the one Moonton
 * published (`isPublishedArtwork`). The sync applies the same rules with the
 * file's description at hand (`candidateRows`); these keep a catalogue an
 * older sync wrote in line.
 */
export function shownIllustrations(
  byName: Record<string, string> | undefined,
  skins: Skin[],
  now = Date.now(),
  sourceOf: SourceOf = () => undefined,
): Record<string, string> {
  const withheld = new Set(
    skins.filter((s) => !isReleasedSkin(s, now) || collaborationOf(s)).map((s) => normalizeNameSkin(s.name)),
  );
  return Object.fromEntries(
    Object.entries(byName ?? {}).filter(
      ([name, path]) => !withheld.has(normalizeNameSkin(name)) && isPublishedArtwork(path, sourceOf(path)),
    ),
  );
}

/**
 * Whether the artwork at `path` (`/visuels/heros/<hero>/illustrations/…`)
 * may be shown, from what the manifest knows of it: not a provisional or
 * altered copy by its wiki file's name, not on the hand-checked list
 * (`WITHHELD_ARTWORKS`), and, when the manifest records the original's size,
 * of an official artwork's size and shape (`shapeIssue`). An artwork whose
 * source is unknown is given the benefit of the doubt.
 */
export function isPublishedArtwork(path: string, source: VisualSource | string | undefined): boolean {
  const s = asSource(source);
  const file = s?.file;
  if (!file) return true;
  const hero = path.match(/\/heros\/([^/]+)\//)?.[1] ?? "";
  if (isProvisionalFile({ name: file }) || alteredArtwork({ name: file }) || isWithheldArtwork(hero, file)) return false;
  return shapeIssue("artwork", s.width ?? undefined, s.height ?? undefined) == null;
}

/** An artwork no catalogue skin claims, shown on the hero's gallery only. */
export interface LoneArtwork {
  name: string;
  illustration: string;
  /** Maybe not final: shown with a "provisional" badge, never as a poster. */
  provisional: boolean;
}

/**
 * The shown artworks of a hero (`shownIllustrations`), split in two:
 *
 * - `final`: the artwork of a released catalogue skin, by skin name: the
 *   only ones a poster, a share card, a quiz or the API may use;
 * - `lone`: artworks no catalogue skin claims, kept for the hero's gallery.
 *   One uploaded less than `PROVISIONAL_DAYS` before `now`, or of unknown
 *   upload date, is provisional (`isProvisionalUpload`).
 */
export function sortIllustrations(
  byName: Record<string, string> | undefined,
  skins: Skin[],
  now = Date.now(),
  sourceOf: SourceOf = () => undefined,
): { final: Record<string, string>; lone: LoneArtwork[] } {
  const shown = shownIllustrations(byName, skins, now, sourceOf);
  const catalogue = new Set(skins.map((s) => normalizeNameSkin(s.name)));
  const final: Record<string, string> = {};
  const lone: LoneArtwork[] = [];
  for (const [name, illustration] of Object.entries(shown)) {
    if (catalogue.has(normalizeNameSkin(name))) {
      final[name] = illustration;
      continue;
    }
    lone.push({ name, illustration, provisional: isProvisionalUpload(asSource(sourceOf(illustration))?.timestamp, now) });
  }
  return { final, lone };
}

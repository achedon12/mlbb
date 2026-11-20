import { alteredArtwork, isProvisionalFile, isWithheldArtwork } from "../../scripts/gallery.mjs";
import { isListedHero, isReleasedSkin } from "../../scripts/release.mjs";
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
 * A hero's full-size artworks, by skin name, without those the site does not
 * show: the artwork of a skin that is not out (it would reappear as a lone
 * artwork), the artwork of a collaboration skin, shown as its shop portrait
 * only (see `collaborations.ts`), and an artwork that is not the one Moonton
 * published. `sourceOf` gives the wiki file each local artwork was made from
 * (`visual-sources.json`): a provisional or altered copy by its name, or one
 * on the hand-checked list (`WITHHELD_ARTWORKS`), is left out. The sync
 * applies the same rules with the file's size and description at hand
 * (`candidateRows`); these keep a catalogue an older sync wrote in line.
 */
export function shownIllustrations(
  byName: Record<string, string> | undefined,
  skins: Skin[],
  now = Date.now(),
  sourceOf: (path: string) => string | undefined = () => undefined,
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
 * Whether the artwork at `path` (`/visuels/heros/<hero>/illustrations/…`),
 * made from wiki file `file`, may be shown. An artwork whose source is
 * unknown is given the benefit of the doubt.
 */
export function isPublishedArtwork(path: string, file: string | undefined): boolean {
  if (!file) return true;
  const hero = path.match(/\/heros\/([^/]+)\//)?.[1] ?? "";
  return !isProvisionalFile({ name: file }) && !alteredArtwork({ name: file }) && !isWithheldArtwork(hero, file);
}

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
 * artwork), and the artwork of a collaboration skin, shown as its shop
 * portrait only (see `collaborations.ts`).
 */
export function shownIllustrations(
  byName: Record<string, string> | undefined,
  skins: Skin[],
  now = Date.now(),
): Record<string, string> {
  const withheld = new Set(
    skins.filter((s) => !isReleasedSkin(s, now) || collaborationOf(s)).map((s) => normalizeNameSkin(s.name)),
  );
  return Object.fromEntries(Object.entries(byName ?? {}).filter(([name]) => !withheld.has(normalizeNameSkin(name))));
}

import fs from "node:fs";
import path from "node:path";
import type { HeroStory, StoryProfile } from "./types";

/**
 * Hand-written stories, laid over the machine translation.
 *
 * `content/<locale>/lore/<slug>.json` holds a hero's story with the same keys
 * as its entry in `src/data/game/stories/<locale>.json`. A key present in the
 * file replaces the generated one, a missing key keeps it; `profile` is merged
 * field by field. The generated files are rewritten by every sync, these are
 * not: a proofread story survives the next run of the translation script.
 */
export type StoryOverride = Partial<Omit<HeroStory, "profile">> & { profile?: Partial<StoryProfile> | null };

const EMPTY: HeroStory = { tagline: null, lore: [], headings: [], profile: null, trivia: [] };
const EMPTY_PROFILE: StoryProfile = {
  fullName: null,
  title: null,
  species: null,
  gender: null,
  age: null,
  origin: null,
  birthday: null,
  affiliations: [],
  relations: [],
  powers: [],
};

/** One story with its override applied. */
export function applyOverride(base: HeroStory | undefined, override: StoryOverride): HeroStory {
  const from = base ?? EMPTY;
  const story: HeroStory = { ...from, ...override, profile: from.profile };
  // Chapter titles point into `lore`: rewritten paragraphs split differently
  // would leave them on the wrong lines, so they only carry over unchanged
  // when the paragraph count did not move.
  if (override.lore && !("headings" in override) && override.lore.length !== from.lore.length) story.headings = [];
  if ("profile" in override) {
    story.profile = override.profile === null ? null : { ...(from.profile ?? EMPTY_PROFILE), ...override.profile };
  }
  return story;
}

/** All the stories of a language, with the overrides applied; the input is left untouched. */
export function applyOverrides(
  stories: Record<string, HeroStory>,
  overrides: Record<string, StoryOverride>,
): Record<string, HeroStory> {
  if (Object.keys(overrides).length === 0) return stories;
  const out = { ...stories };
  for (const [slug, override] of Object.entries(overrides)) out[slug] = applyOverride(stories[slug], override);
  return out;
}

/** Folder of a language's hand-written stories. */
export function overridesFolder(locale: string, root = path.join(process.cwd(), "content")): string {
  return path.join(root, locale, "lore");
}

/**
 * Reads a language's overrides, keyed by hero slug (the file name). A file
 * that is not valid JSON stops the build with its name rather than silently
 * falling back to the machine text.
 */
export function readOverrides(folder: string): Record<string, StoryOverride> {
  if (!fs.existsSync(folder)) return {};
  const out: Record<string, StoryOverride> = {};
  for (const file of fs.readdirSync(folder).sort()) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(folder, file), "utf8");
    try {
      out[file.slice(0, -".json".length)] = JSON.parse(raw) as StoryOverride;
    } catch (e) {
      throw new Error(`${path.join(folder, file)}: ${(e as Error).message}`);
    }
  }
  return out;
}

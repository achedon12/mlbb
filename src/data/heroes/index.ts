import type { HeroAnalysis } from "@/lib/types";
import { assassins } from "./assassins";
import { fighters } from "./fighters";
import { mages } from "./mages";
import { marksmen } from "./marksmen";
import { supports } from "./supports";
import { tanks } from "./tanks";

/**
 * Hand-written analyses, grouped by role.
 *
 * They only hold what no extraction will ever produce: the commentary, the
 * written skills, counters and builds. Everything else — roles, lanes,
 * release, difficulty, skins, visuals — comes from the wiki sync and does not
 * belong here.
 *
 * To add an analysis: use the exact `slug` as it appears in
 * `src/data/game/heroes.json`, and follow the `HeroAnalysis` type. Analyses
 * are written in French only; they are not translated.
 */
export const analyses: HeroAnalysis[] = [
  ...tanks,
  ...fighters,
  ...assassins,
  ...mages,
  ...marksmen,
  ...supports,
];

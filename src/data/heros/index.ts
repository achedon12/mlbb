import type { AnalyseHeros } from "@/lib/types";
import { assassins } from "./assassins";
import { fighters } from "./fighters";
import { mages } from "./mages";
import { marksmen } from "./marksmen";
import { supports } from "./supports";
import { tanks } from "./tanks";

/**
 * Analyses ecrites a la main, regroupees par role.
 *
 * Elles ne contiennent que ce qu'aucune extraction ne produira : le
 * commentaire, les competences redigees, les contres et les builds. Tout le
 * reste — roles, positions, sortie, difficulte, skins, visuels — vient de la
 * synchronisation du wiki et n'a pas a etre recopie ici.
 *
 * Pour ajouter une analyse : reprendre le `slug` exact tel qu'il apparait dans
 * `src/data/jeu/heros.json`, et suivre le type `AnalyseHeros`.
 */
export const analyses: AnalyseHeros[] = [
  ...tanks,
  ...fighters,
  ...assassins,
  ...mages,
  ...marksmen,
  ...supports,
];

import type { Heros } from "@/lib/types";
import { assassins } from "./assassins";
import { fighters } from "./fighters";
import { mages } from "./mages";
import { marksmen } from "./marksmen";
import { supports } from "./supports";
import { tanks } from "./tanks";

/**
 * Toutes les fiches detaillees, regroupees par role d'origine.
 *
 * Pour ajouter une fiche : completer le fichier du role correspondant en
 * suivant le type `Heros`, en reprenant exactement le `slug` deja present dans
 * `roster.ts`. Le site fait le reste — page, plan du site, donnees
 * structurees, liens de contre.
 */
export const herosDetails: Heros[] = [
  ...tanks,
  ...fighters,
  ...assassins,
  ...mages,
  ...marksmen,
  ...supports,
];

export const detailParSlug = new Map(herosDetails.map((h) => [h.slug, h]));

import type { Role } from "./site/game-data.js";

/**
 * Emblems and battle spells: the public API has no endpoint for them yet, and
 * the list is short and stable (six emblems, eleven spells, unchanged for
 * seasons). Only what the commands need to suggest a name and link to the
 * page is kept here: names are the game's, in English as players see them in
 * a match; descriptions are read from `/api/v1/emblems` and `/api/v1/spells`
 * once the site serves them.
 */

export interface CatalogEntry {
  slug: string;
  name: string;
  roles: Role[];
  cooldown?: number;
}

export const EMBLEMS: CatalogEntry[] = [
  { slug: "tank", name: "Tank Emblem", roles: ["Tank"] },
  { slug: "fighter", name: "Fighter Emblem", roles: ["Fighter"] },
  { slug: "assassin", name: "Assassin Emblem", roles: ["Assassin"] },
  { slug: "mage", name: "Mage Emblem", roles: ["Mage"] },
  { slug: "marksman", name: "Marksman Emblem", roles: ["Marksman"] },
  { slug: "support", name: "Support Emblem", roles: ["Support"] },
];

export const SPELLS: CatalogEntry[] = [
  { slug: "flicker", name: "Flicker", cooldown: 120, roles: ["Tank", "Mage", "Support", "Fighter", "Assassin", "Marksman"] },
  { slug: "execute", name: "Execute", cooldown: 60, roles: ["Assassin", "Fighter", "Mage"] },
  { slug: "retribution", name: "Retribution", cooldown: 35, roles: ["Assassin", "Fighter", "Marksman"] },
  { slug: "purify", name: "Purify", cooldown: 90, roles: ["Marksman", "Mage", "Fighter"] },
  { slug: "inspire", name: "Inspire", cooldown: 75, roles: ["Marksman"] },
  { slug: "sprint", name: "Sprint", cooldown: 100, roles: ["Marksman", "Mage"] },
  { slug: "petrify", name: "Petrify", cooldown: 60, roles: ["Tank", "Support"] },
  { slug: "arrival", name: "Arrival", cooldown: 90, roles: ["Fighter", "Tank"] },
  { slug: "vengeance", name: "Vengeance", cooldown: 75, roles: ["Fighter", "Tank"] },
  { slug: "aegis", name: "Aegis", cooldown: 75, roles: ["Support", "Tank"] },
  { slug: "revitalize", name: "Revitalize", cooldown: 60, roles: ["Support"] },
];

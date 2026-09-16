import ranksData from "@/data/game/ranks.json";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { laneFromParam } from "@/lib/draft";
import type { Lane, Role } from "@/lib/types";

/**
 * Emblems of the ranks and of the roles, for the filters.
 *
 * A rank or a role is recognised by its emblem long before its name is read,
 * and a chip carrying its emblem is the same height as one carrying two
 * words: the image costs nothing in space and saves a reading. Addresses
 * only — the components decide their size and whether the image is
 * decorative.
 */

const IMAGES = (ranksData as { images: Record<string, string> }).images;

/**
 * Emblem key of each measured band. `all` covers every match at once: no
 * single emblem stands for it, and a neutral one would only suggest a rank
 * that is not being filtered on — it keeps its name alone.
 */
const KEY_RANK: Record<MeasuredRank, string | null> = {
  all: null,
  epic: "epic",
  legend: "legend",
  mythic: "mythic",
  honor: "mythic-honor",
  glory: "mythic-glory",
};

/** Official emblem of a measured rank; `null` for the all-ranks aggregate. */
export function imageRank(rank: MeasuredRank): string | null {
  const key = KEY_RANK[rank];
  return key ? (IMAGES[key] ?? null) : null;
}

/** Emblem of each role, the one the game shows on its own emblem pages. */
export const IMAGE_ROLE: Record<Role, string> = {
  Tank: "/visuels/emblemes/tank-emblem.webp",
  Fighter: "/visuels/emblemes/fighter-emblem.webp",
  Assassin: "/visuels/emblemes/assassin-emblem.webp",
  Mage: "/visuels/emblemes/mage-emblem.webp",
  Marksman: "/visuels/emblemes/marksman-emblem.webp",
  Support: "/visuels/emblemes/support-emblem.webp",
};

/** Emblem of a role, whatever the shape of the value that carries it. */
export function imageRole(role: string): string | undefined {
  return IMAGE_ROLE[role as Role];
}

/**
 * Lane icon, the one the game draws on its map. The sync writes the files
 * under the site's own lane tokens, so the address follows the value.
 */
export const IMAGE_LANE: Record<Lane, string> = {
  Gold: "/visuels/lanes/gold.webp",
  Jungle: "/visuels/lanes/jungle.webp",
  Mid: "/visuels/lanes/mid.webp",
  Exp: "/visuels/lanes/exp.webp",
  Roam: "/visuels/lanes/roam.webp",
};

/** Icon of a lane, including the addresses that still carry its old name. */
export function imageLane(lane: string): string | undefined {
  return IMAGE_LANE[(laneFromParam(lane) ?? lane) as Lane];
}

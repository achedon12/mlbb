import data from "@/data/editorial/free-rotation.json";
import { heroesBySlug } from "./data";
import { freeRotation, type FreeRotation, type FreeRotationData } from "./free-rotation";

export const PATH_FREE_ROTATION = "/heroes/free-rotation";

export const freeRotationData = data as FreeRotationData;

/**
 * The rotation as of now. Pages are prerendered and rebuilt at every daily
 * sync, so "now" is at most a day old: a week past its ten days disappears
 * with the next build at the latest.
 */
export function currentFreeRotation(now = Date.now()): FreeRotation {
  return freeRotation(freeRotationData, now, (slug) => heroesBySlug.has(slug));
}

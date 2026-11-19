/**
 * Account level as the game shows it: levels 1 to 30 first, then celestial
 * levels counted from 1. The API gives one raw number (115 = celestial 85).
 */
export const LEVEL_CAP = 30;

/** Celestial level, or null while the account is still at or below level 30. */
export function celestialLevel(level: number): number | null {
  return level > LEVEL_CAP ? level - LEVEL_CAP : null;
}

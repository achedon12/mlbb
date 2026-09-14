/**
 * Skin rarities.
 *
 * The game frames each skin with a color that tells its rarity at a glance:
 * a Supreme skin is recognized by its outline before its name is read. We
 * reuse that code.
 *
 * The six tiers are the ones used by the game, from most common to rarest.
 * Colors are hard-coded rather than Tailwind classes: they
 * serve both a border and a drop shadow, and a class cannot
 * be composed dynamically without breaking Tailwind's purge.
 */
export interface Rarity {
  /**
   * Original English key, for translation (`skinRarity.*`). An unknown
   * rarity keeps its raw label here.
   */
  key: string;
  color: string;
  halo: string;
  /** Rank, from most common to rarest. Used for sorting and the legend. */
  rank: number;
}

export const RARITIES: Record<string, Rarity> = {
  Common: { key: "Common", color: "#9aa7c2", halo: "rgba(154,167,194,0.3)", rank: 1 },
  Exquisite: { key: "Exquisite", color: "#4da3ff", halo: "rgba(77,163,255,0.35)", rank: 2 },
  Exceptional: { key: "Exceptional", color: "#3ddc97", halo: "rgba(61,220,151,0.35)", rank: 3 },
  Deluxe: { key: "Deluxe", color: "#b06bff", halo: "rgba(176,107,255,0.4)", rank: 4 },
  Grand: { key: "Grand", color: "#f5c451", halo: "rgba(245,196,81,0.45)", rank: 5 },
  Supreme: { key: "Supreme", color: "#ff4d6d", halo: "rgba(255,77,109,0.5)", rank: 6 },
};

/** The original skin has no rarity: it was never bought. */
export const RARITY_ORIGIN: Rarity = {
  key: "origin",
  color: "#3a4767",
  halo: "rgba(58,71,103,0.4)",
  rank: 0,
};

export function rarity(name: string | null | undefined): Rarity {
  if (!name) return RARITY_ORIGIN;
  return (
    RARITIES[name] ?? {
      // An unknown rarity keeps its original label rather than being
      // lumped into a catch-all: it signals that it needs translating.
      key: name,
      color: RARITY_ORIGIN.color,
      halo: RARITY_ORIGIN.halo,
      rank: 0,
    }
  );
}

/** Rarities present in a list of skins, sorted from most common to rarest. */
export function presentRarities(raritiesRaw: (string | null)[]): Rarity[] {
  const views = new Map<string, Rarity>();
  for (const raw of raritiesRaw) {
    const r = rarity(raw);
    if (!views.has(r.key)) views.set(r.key, r);
  }
  return [...views.values()].sort((a, b) => a.rank - b.rank);
}

/**
 * Rank translation.
 *
 * The profile returns a numeric `rank_level` — 166 — which means nothing to a
 * reader. From Warrior to Legend, each division covers a fixed rankid
 * range, taken from the game's official table (rankid 1 to 135). Beyond that begins
 * the Mythic family, which no longer has divisions but "points": they
 * mark the move from Mythic to Mythic Honor (25), Mythic Glory
 * (50), then Immortal (100). Each tier has its official emblem.
 */
import ranksData from "@/data/game/ranks.json";

const IMAGES = (ranksData as { images: Record<string, string> }).images;

interface Tier {
  /** Lower rank_level bound, inclusive. */
  min: number;
  name: string;
  /** Roman numeral of the division, from lowest to highest. */
  division: string;
  /** Emblem key, shared by all divisions of the same rank. */
  key: string;
  color: string;
}

const TIERS: Tier[] = [
  { min: 1, name: "Guerrier", division: "III", key: "warrior", color: "#9aa7c2" },
  { min: 5, name: "Guerrier", division: "II", key: "warrior", color: "#9aa7c2" },
  { min: 8, name: "Guerrier", division: "I", key: "warrior", color: "#9aa7c2" },
  { min: 11, name: "Elite", division: "III", key: "elite", color: "#7ee0b8" },
  { min: 16, name: "Elite", division: "II", key: "elite", color: "#7ee0b8" },
  { min: 21, name: "Elite", division: "I", key: "elite", color: "#7ee0b8" },
  { min: 26, name: "Maitre", division: "IV", key: "master", color: "#4da3ff" },
  { min: 31, name: "Maitre", division: "III", key: "master", color: "#4da3ff" },
  { min: 36, name: "Maitre", division: "II", key: "master", color: "#4da3ff" },
  { min: 41, name: "Maitre", division: "I", key: "master", color: "#4da3ff" },
  { min: 46, name: "Grand Maitre", division: "V", key: "grandmaster", color: "#b06bff" },
  { min: 52, name: "Grand Maitre", division: "IV", key: "grandmaster", color: "#b06bff" },
  { min: 58, name: "Grand Maitre", division: "III", key: "grandmaster", color: "#b06bff" },
  { min: 64, name: "Grand Maitre", division: "II", key: "grandmaster", color: "#b06bff" },
  { min: 70, name: "Grand Maitre", division: "I", key: "grandmaster", color: "#b06bff" },
  { min: 76, name: "Epique", division: "V", key: "epic", color: "#f5c451" },
  { min: 82, name: "Epique", division: "IV", key: "epic", color: "#f5c451" },
  { min: 88, name: "Epique", division: "III", key: "epic", color: "#f5c451" },
  { min: 94, name: "Epique", division: "II", key: "epic", color: "#f5c451" },
  { min: 100, name: "Epique", division: "I", key: "epic", color: "#f5c451" },
  { min: 106, name: "Legende", division: "V", key: "legend", color: "#ffb84d" },
  { min: 112, name: "Legende", division: "IV", key: "legend", color: "#ffb84d" },
  { min: 118, name: "Legende", division: "III", key: "legend", color: "#ffb84d" },
  { min: 124, name: "Legende", division: "II", key: "legend", color: "#ffb84d" },
  { min: 130, name: "Legende", division: "I", key: "legend", color: "#ffb84d" },
];

/** First rank_level of the Mythic family, right after Legend I. */
const MYTHIC_MIN = 136;

/**
 * rank_level matching the first mythic star.
 *
 * The official table (/api/academy/ranks) puts Legend V to I at 106-135:
 * mythic stars only count from 136, so an account at
 * 166 has 30 stars, not 60. Checked on a real account: rank_level
 * 166 = 30 stars (Honor).
 */
const MYTHIC_BASE = 136;

/** Mythic sub-tiers, by stars accumulated since entering Mythic. */
const MYTHIC = [
  { threshold: 100, name: "Immortel mythique", key: "mythic-immortal", color: "#ff3d6b" },
  { threshold: 50, name: "Gloire mythique", key: "mythic-glory", color: "#ff6b3d" },
  { threshold: 25, name: "Honneur mythique", key: "mythic-honor", color: "#ff8c42" },
  { threshold: 0, name: "Mythique", key: "mythic", color: "#ffab5e" },
];

export interface ReadableRank {
  /** Emblem key, language-independent, for translating the name. */
  key: string;
  name: string;
  /** Roman numeral of the division (empty in Mythic). */
  division: string;
  color: string;
  /** URL of the rank's official emblem. */
  image: string;
  /** Stars in the division, or accumulated mythic points. */
  stars: number;
  /** Star label: "stars" below Mythic, "points" above. */
  unitStars: "star" | "point";
  /** True in the Mythic family. */
  mythic: boolean;
}

export function readableRank(rankLevel: number): ReadableRank {
  if (rankLevel >= MYTHIC_MIN) {
    const stars = Math.max(0, rankLevel - MYTHIC_BASE);
    const tier = MYTHIC.find((m) => stars >= m.threshold) ?? MYTHIC.at(-1)!;
    return {
      key: tier.key,
      name: tier.name,
      division: "",
      color: tier.color,
      image: IMAGES[tier.key],
      stars,
      unitStars: "star",
      mythic: true,
    };
  }

  // The last tier whose threshold is reached.
  let chosen = TIERS[0];
  for (const p of TIERS) if (rankLevel >= p.min) chosen = p;

  return {
    key: chosen.key,
    name: chosen.name,
    division: chosen.division,
    color: chosen.color,
    image: IMAGES[chosen.key],
    stars: Math.max(1, rankLevel - chosen.min + 1),
    unitStars: "star",
    mythic: false,
  };
}

/** Country name from the ISO code, when known. */
const COUNTRY: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  CA: "Canada",
  PH: "Philippines",
  ID: "Indonesie",
  MY: "Malaisie",
  SG: "Singapour",
  US: "Etats-Unis",
  BR: "Bresil",
  TR: "Turquie",
  RU: "Russie",
  DE: "Allemagne",
  ES: "Espagne",
  GB: "Royaume-Uni",
};

export function nameCountry(code: string): string {
  return COUNTRY[code.toUpperCase()] ?? code;
}

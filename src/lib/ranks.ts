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
import { LOCALE_HTML, type Locale } from "@/i18n/config";

const IMAGES = (ranksData as { images: Record<string, string> }).images;

interface Tier {
  /** Lower rank_level bound, inclusive. */
  min: number;
  /** Roman numeral of the division, from lowest to highest. */
  division: string;
  /** Emblem key, shared by all divisions of the same rank. */
  key: string;
  color: string;
}

const TIERS: Tier[] = [
  { min: 1, division: "III", key: "warrior", color: "#9aa7c2" },
  { min: 5, division: "II", key: "warrior", color: "#9aa7c2" },
  { min: 8, division: "I", key: "warrior", color: "#9aa7c2" },
  { min: 11, division: "III", key: "elite", color: "#7ee0b8" },
  { min: 16, division: "II", key: "elite", color: "#7ee0b8" },
  { min: 21, division: "I", key: "elite", color: "#7ee0b8" },
  { min: 26, division: "IV", key: "master", color: "#4da3ff" },
  { min: 31, division: "III", key: "master", color: "#4da3ff" },
  { min: 36, division: "II", key: "master", color: "#4da3ff" },
  { min: 41, division: "I", key: "master", color: "#4da3ff" },
  { min: 46, division: "V", key: "grandmaster", color: "#b06bff" },
  { min: 52, division: "IV", key: "grandmaster", color: "#b06bff" },
  { min: 58, division: "III", key: "grandmaster", color: "#b06bff" },
  { min: 64, division: "II", key: "grandmaster", color: "#b06bff" },
  { min: 70, division: "I", key: "grandmaster", color: "#b06bff" },
  { min: 76, division: "V", key: "epic", color: "#f5c451" },
  { min: 82, division: "IV", key: "epic", color: "#f5c451" },
  { min: 88, division: "III", key: "epic", color: "#f5c451" },
  { min: 94, division: "II", key: "epic", color: "#f5c451" },
  { min: 100, division: "I", key: "epic", color: "#f5c451" },
  { min: 106, division: "V", key: "legend", color: "#ffb84d" },
  { min: 112, division: "IV", key: "legend", color: "#ffb84d" },
  { min: 118, division: "III", key: "legend", color: "#ffb84d" },
  { min: 124, division: "II", key: "legend", color: "#ffb84d" },
  { min: 130, division: "I", key: "legend", color: "#ffb84d" },
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
  { threshold: 100, key: "mythic-immortal", color: "#ff3d6b" },
  { threshold: 50, key: "mythic-glory", color: "#ff6b3d" },
  { threshold: 25, key: "mythic-honor", color: "#ff8c42" },
  { threshold: 0, key: "mythic", color: "#ffab5e" },
];

export interface ReadableRank {
  /** Emblem key, language-independent, for translating the name (`rankNames.*`). */
  key: string;
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
    division: chosen.division,
    color: chosen.color,
    image: IMAGES[chosen.key],
    stars: Math.max(1, rankLevel - chosen.min + 1),
    unitStars: "star",
    mythic: false,
  };
}

/**
 * Country name from the ISO 3166 code the game account carries
 * (`reg_country`), in the reader's language. An empty or unknown code is
 * returned as is rather than guessed.
 */
export function countryName(code: string, locale: Locale): string {
  const region = code.trim().toUpperCase();
  // "ZZ" is CLDR's "unknown region": showing its label would say nothing more.
  if (!/^[A-Z]{2}$/.test(region) || region === "ZZ") return code;
  try {
    const name = new Intl.DisplayNames([LOCALE_HTML[locale]], { type: "region", fallback: "none" }).of(region);
    return name ?? code;
  } catch {
    return code;
  }
}

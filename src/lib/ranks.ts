/**
 * Traduction du rang.
 *
 * Le profil renvoie un `rank_level` numerique — 166 — qui ne dit rien a un
 * lecteur. De Guerrier a Legende, chaque division couvre une plage de rankid
 * fixe, tiree de la table officielle du jeu (rankid 1 a 135). Au-dela commence
 * la famille Mythique, qui n'a plus de divisions mais des « points » : ils
 * marquent le passage de Mythique a Honneur mythique (25), Gloire mythique
 * (50), puis Immortel (100). Chaque palier a son embleme officiel.
 */
import ranksData from "@/data/game/ranks.json";

const IMAGES = (ranksData as { images: Record<string, string> }).images;

interface Tier {
  /** Seuil bas du rank_level, inclus. */
  min: number;
  name: string;
  /** Chiffre romain de la division, du plus bas au plus haut. */
  division: string;
  /** Cle d'embleme, commune a toutes les divisions d'un meme rang. */
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

/** Premier rank_level de la famille Mythique, juste apres Legende I. */
const MYTHIC_MIN = 136;

/**
 * rank_level correspondant a la premiere etoile mythique.
 *
 * La table officielle (/api/academy/ranks) place Legende V a I sur 106-135 :
 * les etoiles mythiques ne comptent qu'a partir de 136, si bien qu'un compte de
 * 166 correspond a 30 etoiles, pas a 60. Repere sur un compte reel : rank_level
 * 166 = 30 etoiles (Honneur).
 */
const MYTHIC_BASE = 136;

/** Sous-paliers mythiques, par etoiles cumulees depuis l'entree en Mythique. */
const MYTHIC = [
  { threshold: 100, name: "Immortel mythique", key: "mythic-immortal", color: "#ff3d6b" },
  { threshold: 50, name: "Gloire mythique", key: "mythic-glory", color: "#ff6b3d" },
  { threshold: 25, name: "Honneur mythique", key: "mythic-honor", color: "#ff8c42" },
  { threshold: 0, name: "Mythique", key: "mythic", color: "#ffab5e" },
];

export interface ReadableRank {
  /** Cle d'embleme, langue-independante, pour la traduction du nom. */
  key: string;
  name: string;
  /** Chiffre romain de la division (vide en Mythique). */
  division: string;
  color: string;
  /** URL de l'embleme officiel du rang. */
  image: string;
  /** Etoiles dans la division, ou points mythiques accumules. */
  stars: number;
  /** Libelle des etoiles : « etoiles » sous Mythique, « points » au-dessus. */
  unitStars: "star" | "point";
  /** Vrai dans la famille Mythique. */
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

  // Le dernier palier dont le seuil est atteint.
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

/** Nom de pays a partir du code ISO, quand il est connu. */
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

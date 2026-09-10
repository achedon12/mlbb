/**
 * Traduction du rang.
 *
 * Le profil renvoie un `rank_level` numerique — 166 — qui ne dit rien a un
 * lecteur. De Guerrier a Epique, chaque division couvre une plage de rankid
 * fixe, tiree de la table officielle du jeu (rankid 1 a 105). Au-dela commence
 * la famille Mythique, qui n'a plus de divisions mais des « points » : ils
 * marquent le passage de Mythique a Honneur mythique (25), Gloire mythique
 * (50), puis Immortel (100). Chaque palier a son embleme officiel.
 */
import rangsData from "@/data/jeu/rangs.json";

const IMAGES = (rangsData as { images: Record<string, string> }).images;

interface Palier {
  /** Seuil bas du rank_level, inclus. */
  min: number;
  nom: string;
  /** Chiffre romain de la division, du plus bas au plus haut. */
  division: string;
  /** Cle d'embleme, commune a toutes les divisions d'un meme rang. */
  cle: string;
  couleur: string;
}

const PALIERS: Palier[] = [
  { min: 1, nom: "Guerrier", division: "III", cle: "guerrier", couleur: "#9aa7c2" },
  { min: 5, nom: "Guerrier", division: "II", cle: "guerrier", couleur: "#9aa7c2" },
  { min: 8, nom: "Guerrier", division: "I", cle: "guerrier", couleur: "#9aa7c2" },
  { min: 11, nom: "Elite", division: "III", cle: "elite", couleur: "#7ee0b8" },
  { min: 16, nom: "Elite", division: "II", cle: "elite", couleur: "#7ee0b8" },
  { min: 21, nom: "Elite", division: "I", cle: "elite", couleur: "#7ee0b8" },
  { min: 26, nom: "Maitre", division: "IV", cle: "maitre", couleur: "#4da3ff" },
  { min: 31, nom: "Maitre", division: "III", cle: "maitre", couleur: "#4da3ff" },
  { min: 36, nom: "Maitre", division: "II", cle: "maitre", couleur: "#4da3ff" },
  { min: 41, nom: "Maitre", division: "I", cle: "maitre", couleur: "#4da3ff" },
  { min: 46, nom: "Grand Maitre", division: "V", cle: "grand-maitre", couleur: "#b06bff" },
  { min: 52, nom: "Grand Maitre", division: "IV", cle: "grand-maitre", couleur: "#b06bff" },
  { min: 58, nom: "Grand Maitre", division: "III", cle: "grand-maitre", couleur: "#b06bff" },
  { min: 64, nom: "Grand Maitre", division: "II", cle: "grand-maitre", couleur: "#b06bff" },
  { min: 70, nom: "Grand Maitre", division: "I", cle: "grand-maitre", couleur: "#b06bff" },
  { min: 76, nom: "Epique", division: "V", cle: "epique", couleur: "#f5c451" },
  { min: 82, nom: "Epique", division: "IV", cle: "epique", couleur: "#f5c451" },
  { min: 88, nom: "Epique", division: "III", cle: "epique", couleur: "#f5c451" },
  { min: 94, nom: "Epique", division: "II", cle: "epique", couleur: "#f5c451" },
  { min: 100, nom: "Epique", division: "I", cle: "epique", couleur: "#f5c451" },
];

/** Premier rank_level de la famille Mythique, juste apres Epique I. */
const MYTHIQUE_MIN = 106;

/**
 * rank_level correspondant a la premiere etoile mythique.
 *
 * L'echelle reserve encore la plage de l'ancien palier « Legende » (cinq
 * divisions supprimees de l'affichage), si bien que les etoiles mythiques ne
 * comptent qu'a partir de 136 : un compte de 166 correspond a 30 etoiles, pas
 * a 60. Repere sur un compte reel : rank_level 166 = 30 etoiles (Honneur).
 */
const MYTHIQUE_BASE = 136;

/** Sous-paliers mythiques, par etoiles cumulees depuis l'entree en Mythique. */
const MYTHIQUES = [
  { seuil: 100, nom: "Immortel mythique", cle: "mythique-immortel", couleur: "#ff3d6b" },
  { seuil: 50, nom: "Gloire mythique", cle: "mythique-gloire", couleur: "#ff6b3d" },
  { seuil: 25, nom: "Honneur mythique", cle: "mythique-honneur", couleur: "#ff8c42" },
  { seuil: 0, nom: "Mythique", cle: "mythique", couleur: "#ffab5e" },
];

export interface RangLisible {
  nom: string;
  /** Chiffre romain de la division (vide en Mythique). */
  division: string;
  couleur: string;
  /** URL de l'embleme officiel du rang. */
  image: string;
  /** Etoiles dans la division, ou points mythiques accumules. */
  etoiles: number;
  /** Libelle des etoiles : « etoiles » sous Mythique, « points » au-dessus. */
  uniteEtoiles: "etoile" | "point";
  /** Vrai dans la famille Mythique. */
  mythique: boolean;
}

export function rangLisible(rankLevel: number): RangLisible {
  if (rankLevel >= MYTHIQUE_MIN) {
    const etoiles = Math.max(0, rankLevel - MYTHIQUE_BASE);
    const palier = MYTHIQUES.find((m) => etoiles >= m.seuil) ?? MYTHIQUES.at(-1)!;
    return {
      nom: palier.nom,
      division: "",
      couleur: palier.couleur,
      image: IMAGES[palier.cle],
      etoiles,
      uniteEtoiles: "etoile",
      mythique: true,
    };
  }

  // Le dernier palier dont le seuil est atteint.
  let choisi = PALIERS[0];
  for (const p of PALIERS) if (rankLevel >= p.min) choisi = p;

  return {
    nom: choisi.nom,
    division: choisi.division,
    couleur: choisi.couleur,
    image: IMAGES[choisi.cle],
    etoiles: Math.max(1, rankLevel - choisi.min + 1),
    uniteEtoiles: "etoile",
    mythique: false,
  };
}

/** Nom de pays a partir du code ISO, quand il est connu. */
const PAYS: Record<string, string> = {
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

export function nomPays(code: string): string {
  return PAYS[code.toUpperCase()] ?? code;
}

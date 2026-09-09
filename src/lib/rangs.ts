/**
 * Traduction du rang.
 *
 * Le profil renvoie un `rank_level` numerique — 166 — qui ne dit rien a un
 * lecteur. Les paliers de Guerrier a Epique suivent la table publique du jeu
 * (rankid 1 a 105) ; au-dela, tout appartient a la famille Mythique, dont les
 * subdivisions varient d'une saison a l'autre et ne sont pas exposees. On
 * traduit donc jusqu'a Epique, et on nomme « Mythique » ce qui est au-dessus,
 * plutot que d'inventer un palier precis qui pourrait etre faux.
 */
interface Palier {
  /** Seuil bas du rank_level, inclus. */
  min: number;
  nom: string;
  /** Chiffre romain de la division, du plus bas au plus haut. */
  division: string;
  couleur: string;
}

const PALIERS: Palier[] = [
  { min: 1, nom: "Guerrier", division: "III", couleur: "#9aa7c2" },
  { min: 5, nom: "Guerrier", division: "II", couleur: "#9aa7c2" },
  { min: 8, nom: "Guerrier", division: "I", couleur: "#9aa7c2" },
  { min: 11, nom: "Elite", division: "III", couleur: "#7ee0b8" },
  { min: 16, nom: "Elite", division: "II", couleur: "#7ee0b8" },
  { min: 21, nom: "Elite", division: "I", couleur: "#7ee0b8" },
  { min: 26, nom: "Maitre", division: "IV", couleur: "#4da3ff" },
  { min: 31, nom: "Maitre", division: "III", couleur: "#4da3ff" },
  { min: 36, nom: "Maitre", division: "II", couleur: "#4da3ff" },
  { min: 41, nom: "Maitre", division: "I", couleur: "#4da3ff" },
  { min: 46, nom: "Grand Maitre", division: "V", couleur: "#b06bff" },
  { min: 52, nom: "Grand Maitre", division: "IV", couleur: "#b06bff" },
  { min: 58, nom: "Grand Maitre", division: "III", couleur: "#b06bff" },
  { min: 64, nom: "Grand Maitre", division: "II", couleur: "#b06bff" },
  { min: 70, nom: "Grand Maitre", division: "I", couleur: "#b06bff" },
  { min: 76, nom: "Epique", division: "V", couleur: "#f5c451" },
  { min: 82, nom: "Epique", division: "IV", couleur: "#f5c451" },
  { min: 88, nom: "Epique", division: "III", couleur: "#f5c451" },
  { min: 94, nom: "Epique", division: "II", couleur: "#f5c451" },
  { min: 100, nom: "Epique", division: "I", couleur: "#f5c451" },
  // Au-dela d'Epique, la famille Mythique, sans subdivision fiable a exposer.
  { min: 106, nom: "Mythique", division: "", couleur: "#ff6b3d" },
];

export interface RangLisible {
  nom: string;
  division: string;
  couleur: string;
  /** Vrai quand le rang depasse la table publique : la division est inconnue. */
  approximatif: boolean;
}

export function rangLisible(rankLevel: number): RangLisible {
  // Le dernier palier dont le seuil est atteint.
  let choisi = PALIERS[0];
  for (const p of PALIERS) if (rankLevel >= p.min) choisi = p;

  return {
    nom: choisi.nom,
    division: choisi.division,
    couleur: choisi.couleur,
    approximatif: choisi.nom === "Mythique",
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

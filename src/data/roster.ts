import type { Lane, Role, Specialite } from "@/lib/types";

/**
 * Roster complet.
 *
 * Ce fichier porte les attributs que le jeu affiche sur la carte d'un heros :
 * role, position, specialites, annee de sortie, difficulte. Il alimente la
 * liste et les filtres.
 *
 * Les fiches detaillees (competences, builds, contres) vivent dans
 * `heros-details.ts` et ne couvrent volontairement pas encore tout le roster :
 * mieux vaut une fiche vide qu'une fiche fausse. Voir CONTRIBUTING.md pour en
 * ajouter une.
 */
export interface EntreeRoster {
  slug: string;
  nom: string;
  roles: Role[];
  lanes: Lane[];
  specialites: Specialite[];
  sortie: number;
  difficulte: number;
}

export const roster: EntreeRoster[] = [
  // ── Tanks ────────────────────────────────────────────────────────────────
  { slug: "tigreal", nom: "Tigreal", roles: ["Tank"], lanes: ["Roam"], specialites: ["Controle", "Protection"], sortie: 2016, difficulte: 4 },
  { slug: "akai", nom: "Akai", roles: ["Tank"], lanes: ["Roam"], specialites: ["Controle", "Charge"], sortie: 2016, difficulte: 4 },
  { slug: "franco", nom: "Franco", roles: ["Tank"], lanes: ["Roam"], specialites: ["Controle"], sortie: 2016, difficulte: 6 },
  { slug: "minotaur", nom: "Minotaur", roles: ["Tank", "Support"], lanes: ["Roam"], specialites: ["Controle", "Soin"], sortie: 2016, difficulte: 3 },
  { slug: "johnson", nom: "Johnson", roles: ["Tank"], lanes: ["Roam"], specialites: ["Controle", "Deplacement"], sortie: 2017, difficulte: 7 },
  { slug: "gatotkaca", nom: "Gatotkaca", roles: ["Tank", "Fighter"], lanes: ["Roam", "Experience"], specialites: ["Controle", "Charge"], sortie: 2017, difficulte: 4 },
  { slug: "hylos", nom: "Hylos", roles: ["Tank"], lanes: ["Roam", "Experience"], specialites: ["Controle", "Regeneration"], sortie: 2017, difficulte: 3 },
  { slug: "grock", nom: "Grock", roles: ["Tank", "Fighter"], lanes: ["Roam", "Experience"], specialites: ["Charge", "Controle"], sortie: 2017, difficulte: 5 },
  { slug: "lolita", nom: "Lolita", roles: ["Tank", "Support"], lanes: ["Roam"], specialites: ["Controle", "Protection"], sortie: 2017, difficulte: 5 },
  { slug: "uranus", nom: "Uranus", roles: ["Tank"], lanes: ["Experience"], specialites: ["Regeneration"], sortie: 2018, difficulte: 3 },
  { slug: "belerick", nom: "Belerick", roles: ["Tank"], lanes: ["Experience", "Roam"], specialites: ["Regeneration", "Protection"], sortie: 2018, difficulte: 3 },
  { slug: "khufra", nom: "Khufra", roles: ["Tank"], lanes: ["Roam"], specialites: ["Controle", "Charge"], sortie: 2019, difficulte: 6 },
  { slug: "baxia", nom: "Baxia", roles: ["Tank"], lanes: ["Roam", "Jungle"], specialites: ["Charge", "Regeneration"], sortie: 2019, difficulte: 5 },
  { slug: "atlas", nom: "Atlas", roles: ["Tank"], lanes: ["Roam"], specialites: ["Controle"], sortie: 2020, difficulte: 6 },
  { slug: "barats", nom: "Barats", roles: ["Tank", "Fighter"], lanes: ["Experience"], specialites: ["Regeneration", "Controle"], sortie: 2020, difficulte: 5 },
  { slug: "gloo", nom: "Gloo", roles: ["Tank"], lanes: ["Experience", "Roam"], specialites: ["Controle", "Regeneration"], sortie: 2021, difficulte: 6 },
  { slug: "edith", nom: "Edith", roles: ["Tank", "Marksman"], lanes: ["Roam", "Experience"], specialites: ["Controle", "Explosion"], sortie: 2021, difficulte: 7 },
  { slug: "fredrinn", nom: "Fredrinn", roles: ["Fighter", "Tank"], lanes: ["Jungle", "Experience"], specialites: ["Degats", "Regeneration"], sortie: 2022, difficulte: 6 },
  { slug: "chip", nom: "Chip", roles: ["Support", "Tank"], lanes: ["Roam"], specialites: ["Deplacement", "Controle"], sortie: 2024, difficulte: 5 },

  // ── Fighters ─────────────────────────────────────────────────────────────
  { slug: "balmond", nom: "Balmond", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Degats", "Regeneration"], sortie: 2016, difficulte: 2 },
  { slug: "alucard", nom: "Alucard", roles: ["Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Regeneration"], sortie: 2016, difficulte: 3 },
  { slug: "bane", nom: "Bane", roles: ["Fighter", "Mage"], lanes: ["Experience", "Jungle"], specialites: ["Degats", "Poussee"], sortie: 2016, difficulte: 4 },
  { slug: "zilong", nom: "Zilong", roles: ["Fighter", "Assassin"], lanes: ["Experience", "Jungle"], specialites: ["Charge", "Poussee"], sortie: 2016, difficulte: 3 },
  { slug: "freya", nom: "Freya", roles: ["Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Degats"], sortie: 2016, difficulte: 5 },
  { slug: "chou", nom: "Chou", roles: ["Fighter"], lanes: ["Roam", "Experience"], specialites: ["Controle", "Charge"], sortie: 2017, difficulte: 8 },
  { slug: "sun", nom: "Sun", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Poussee", "Invocation"], sortie: 2017, difficulte: 4 },
  { slug: "hilda", nom: "Hilda", roles: ["Fighter", "Tank"], lanes: ["Experience", "Roam"], specialites: ["Charge", "Regeneration"], sortie: 2017, difficulte: 4 },
  { slug: "jawhead", nom: "Jawhead", roles: ["Fighter"], lanes: ["Roam", "Experience"], specialites: ["Charge", "Controle"], sortie: 2017, difficulte: 5 },
  { slug: "martis", nom: "Martis", roles: ["Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Degats"], sortie: 2018, difficulte: 4 },
  { slug: "argus", nom: "Argus", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Degats", "Charge"], sortie: 2017, difficulte: 4 },
  { slug: "leomord", nom: "Leomord", roles: ["Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Degats"], sortie: 2018, difficulte: 6 },
  { slug: "thamuz", nom: "Thamuz", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Regeneration", "Degats"], sortie: 2018, difficulte: 5 },
  { slug: "minsitthar", nom: "Minsitthar", roles: ["Fighter"], lanes: ["Roam", "Experience"], specialites: ["Controle", "Charge"], sortie: 2018, difficulte: 5 },
  { slug: "badang", nom: "Badang", roles: ["Fighter"], lanes: ["Experience", "Roam"], specialites: ["Controle", "Explosion"], sortie: 2018, difficulte: 6 },
  { slug: "x-borg", nom: "X.Borg", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Degats", "Poussee"], sortie: 2019, difficulte: 6 },
  { slug: "dyrroth", nom: "Dyrroth", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Degats", "Charge"], sortie: 2019, difficulte: 5 },
  { slug: "masha", nom: "Masha", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Poussee", "Regeneration"], sortie: 2019, difficulte: 5 },
  { slug: "silvanna", nom: "Silvanna", roles: ["Fighter", "Mage"], lanes: ["Experience", "Roam"], specialites: ["Controle", "Charge"], sortie: 2019, difficulte: 5 },
  { slug: "yu-zhong", nom: "Yu Zhong", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Regeneration", "Charge"], sortie: 2020, difficulte: 6 },
  { slug: "khaleed", nom: "Khaleed", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Charge", "Regeneration"], sortie: 2020, difficulte: 4 },
  { slug: "aulus", nom: "Aulus", roles: ["Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Degats", "Charge"], sortie: 2021, difficulte: 3 },
  { slug: "paquito", nom: "Paquito", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Charge", "Explosion"], sortie: 2021, difficulte: 7 },
  { slug: "phoveus", nom: "Phoveus", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Charge", "Regeneration"], sortie: 2021, difficulte: 5 },
  { slug: "yin", nom: "Yin", roles: ["Fighter", "Assassin"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Explosion"], sortie: 2022, difficulte: 7 },
  { slug: "arlott", nom: "Arlott", roles: ["Fighter", "Assassin"], lanes: ["Experience", "Jungle"], specialites: ["Charge", "Controle"], sortie: 2023, difficulte: 6 },
  { slug: "terizla", nom: "Terizla", roles: ["Fighter"], lanes: ["Experience"], specialites: ["Controle", "Degats"], sortie: 2019, difficulte: 5 },
  { slug: "ruby", nom: "Ruby", roles: ["Fighter", "Tank"], lanes: ["Experience", "Roam"], specialites: ["Controle", "Regeneration"], sortie: 2017, difficulte: 6 },
  { slug: "guinevere", nom: "Guinevere", roles: ["Fighter", "Mage"], lanes: ["Experience", "Jungle"], specialites: ["Controle", "Explosion"], sortie: 2019, difficulte: 8 },
  { slug: "esmeralda", nom: "Esmeralda", roles: ["Mage", "Tank"], lanes: ["Experience", "Jungle"], specialites: ["Regeneration", "Protection"], sortie: 2019, difficulte: 5 },
  { slug: "julian", nom: "Julian", roles: ["Fighter", "Mage"], lanes: ["Experience", "Jungle"], specialites: ["Degats", "Controle"], sortie: 2022, difficulte: 8 },
  { slug: "aldous", nom: "Aldous", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Charge", "Explosion"], sortie: 2018, difficulte: 5 },
  { slug: "alpha", nom: "Alpha", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Charge", "Regeneration"], sortie: 2017, difficulte: 4 },
  { slug: "lapu-lapu", nom: "Lapu-Lapu", roles: ["Fighter"], lanes: ["Experience", "Jungle"], specialites: ["Degats", "Controle"], sortie: 2018, difficulte: 5 },
  { slug: "kaja", nom: "Kaja", roles: ["Support", "Fighter"], lanes: ["Roam"], specialites: ["Controle", "Charge"], sortie: 2017, difficulte: 6 },
  { slug: "roger", nom: "Roger", roles: ["Fighter", "Marksman"], lanes: ["Jungle", "Or"], specialites: ["Charge", "Degats"], sortie: 2016, difficulte: 6 },
  { slug: "suyou", nom: "Suyou", roles: ["Fighter", "Assassin"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Deplacement"], sortie: 2024, difficulte: 7 },
  { slug: "lukas", nom: "Lukas", roles: ["Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Regeneration"], sortie: 2025, difficulte: 6 },

  // ── Assassins ────────────────────────────────────────────────────────────
  { slug: "saber", nom: "Saber", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Explosion"], sortie: 2016, difficulte: 3 },
  { slug: "karina", nom: "Karina", roles: ["Assassin", "Mage"], lanes: ["Jungle"], specialites: ["Charge", "Explosion"], sortie: 2016, difficulte: 4 },
  { slug: "fanny", nom: "Fanny", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Deplacement"], sortie: 2016, difficulte: 10 },
  { slug: "natalia", nom: "Natalia", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Deplacement"], sortie: 2016, difficulte: 7 },
  { slug: "hayabusa", nom: "Hayabusa", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Poussee"], sortie: 2017, difficulte: 7 },
  { slug: "lancelot", nom: "Lancelot", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Deplacement"], sortie: 2017, difficulte: 8 },
  { slug: "helcurt", nom: "Helcurt", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Explosion"], sortie: 2017, difficulte: 6 },
  { slug: "gusion", nom: "Gusion", roles: ["Assassin", "Mage"], lanes: ["Jungle"], specialites: ["Charge", "Explosion"], sortie: 2018, difficulte: 9 },
  { slug: "hanzo", nom: "Hanzo", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Poussee", "Explosion"], sortie: 2018, difficulte: 8 },
  { slug: "ling", nom: "Ling", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Deplacement"], sortie: 2019, difficulte: 9 },
  { slug: "benedetta", nom: "Benedetta", roles: ["Assassin", "Fighter"], lanes: ["Jungle", "Experience"], specialites: ["Charge", "Deplacement"], sortie: 2020, difficulte: 9 },
  { slug: "aamon", nom: "Aamon", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Explosion", "Charge"], sortie: 2021, difficulte: 8 },
  { slug: "joy", nom: "Joy", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Deplacement"], sortie: 2022, difficulte: 8 },
  { slug: "nolan", nom: "Nolan", roles: ["Assassin"], lanes: ["Jungle"], specialites: ["Charge", "Explosion"], sortie: 2023, difficulte: 7 },
  { slug: "harley", nom: "Harley", roles: ["Mage", "Assassin"], lanes: ["Milieu", "Jungle"], specialites: ["Charge", "Explosion"], sortie: 2017, difficulte: 6 },
  { slug: "selena", nom: "Selena", roles: ["Assassin", "Mage"], lanes: ["Roam", "Milieu"], specialites: ["Controle", "Explosion"], sortie: 2018, difficulte: 9 },
  { slug: "kadita", nom: "Kadita", roles: ["Mage", "Assassin"], lanes: ["Milieu", "Roam"], specialites: ["Explosion", "Controle"], sortie: 2019, difficulte: 8 },

  // ── Mages ────────────────────────────────────────────────────────────────
  { slug: "eudora", nom: "Eudora", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Explosion", "Controle"], sortie: 2016, difficulte: 3 },
  { slug: "nana", nom: "Nana", roles: ["Mage", "Support"], lanes: ["Milieu", "Roam"], specialites: ["Controle", "Degats"], sortie: 2016, difficulte: 4 },
  { slug: "gord", nom: "Gord", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats"], sortie: 2016, difficulte: 5 },
  { slug: "alice", nom: "Alice", roles: ["Mage", "Tank"], lanes: ["Experience", "Milieu"], specialites: ["Regeneration", "Charge"], sortie: 2016, difficulte: 6 },
  { slug: "cyclops", nom: "Cyclops", roles: ["Mage"], lanes: ["Milieu", "Jungle"], specialites: ["Degats", "Controle"], sortie: 2017, difficulte: 4 },
  { slug: "aurora", nom: "Aurora", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Controle", "Explosion"], sortie: 2016, difficulte: 5 },
  { slug: "vexana", nom: "Vexana", roles: ["Mage"], lanes: ["Milieu", "Roam"], specialites: ["Controle", "Invocation"], sortie: 2017, difficulte: 5 },
  { slug: "odette", nom: "Odette", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Controle"], sortie: 2017, difficulte: 5 },
  { slug: "chang-e", nom: "Chang'e", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Poussee"], sortie: 2018, difficulte: 5 },
  { slug: "vale", nom: "Vale", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Explosion", "Controle"], sortie: 2018, difficulte: 6 },
  { slug: "pharsa", nom: "Pharsa", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Explosion"], sortie: 2017, difficulte: 6 },
  { slug: "lunox", nom: "Lunox", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Explosion"], sortie: 2018, difficulte: 7 },
  { slug: "harith", nom: "Harith", roles: ["Mage"], lanes: ["Milieu", "Jungle"], specialites: ["Charge", "Deplacement"], sortie: 2018, difficulte: 7 },
  { slug: "kagura", nom: "Kagura", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Explosion", "Controle"], sortie: 2017, difficulte: 9 },
  { slug: "lylia", nom: "Lylia", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Poussee"], sortie: 2019, difficulte: 6 },
  { slug: "cecilion", nom: "Cecilion", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Poussee"], sortie: 2020, difficulte: 5 },
  { slug: "luo-yi", nom: "Luo Yi", roles: ["Mage"], lanes: ["Milieu", "Roam"], specialites: ["Controle", "Deplacement"], sortie: 2020, difficulte: 7 },
  { slug: "yve", nom: "Yve", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Controle", "Degats"], sortie: 2020, difficulte: 6 },
  { slug: "valentina", nom: "Valentina", roles: ["Mage"], lanes: ["Milieu", "Roam"], specialites: ["Degats", "Controle"], sortie: 2021, difficulte: 8 },
  { slug: "xavier", nom: "Xavier", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Explosion"], sortie: 2022, difficulte: 6 },
  { slug: "novaria", nom: "Novaria", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Degats", "Deplacement"], sortie: 2023, difficulte: 6 },
  { slug: "zhuxin", nom: "Zhuxin", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Controle", "Degats"], sortie: 2024, difficulte: 6 },
  { slug: "faramis", nom: "Faramis", roles: ["Support", "Mage"], lanes: ["Roam"], specialites: ["Alliance", "Invocation"], sortie: 2019, difficulte: 6 },
  { slug: "carmilla", nom: "Carmilla", roles: ["Support", "Tank"], lanes: ["Roam"], specialites: ["Controle", "Alliance"], sortie: 2020, difficulte: 5 },
  { slug: "zhask", nom: "Zhask", roles: ["Mage"], lanes: ["Milieu"], specialites: ["Poussee", "Invocation"], sortie: 2017, difficulte: 5 },

  // ── Marksmen ─────────────────────────────────────────────────────────────
  { slug: "layla", nom: "Layla", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats"], sortie: 2016, difficulte: 1 },
  { slug: "miya", nom: "Miya", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Poussee"], sortie: 2016, difficulte: 2 },
  { slug: "bruno", nom: "Bruno", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats"], sortie: 2016, difficulte: 4 },
  { slug: "clint", nom: "Clint", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Explosion"], sortie: 2016, difficulte: 5 },
  { slug: "moskov", nom: "Moskov", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Poussee"], sortie: 2016, difficulte: 4 },
  { slug: "yi-sun-shin", nom: "Yi Sun-shin", roles: ["Marksman", "Assassin"], lanes: ["Jungle", "Or"], specialites: ["Poussee", "Degats"], sortie: 2017, difficulte: 7 },
  { slug: "irithel", nom: "Irithel", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Deplacement"], sortie: 2017, difficulte: 5 },
  { slug: "hanabi", nom: "Hanabi", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Poussee"], sortie: 2018, difficulte: 4 },
  { slug: "lesley", nom: "Lesley", roles: ["Marksman", "Assassin"], lanes: ["Or"], specialites: ["Degats", "Explosion"], sortie: 2018, difficulte: 5 },
  { slug: "karrie", nom: "Karrie", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats"], sortie: 2017, difficulte: 4 },
  { slug: "claude", nom: "Claude", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Deplacement"], sortie: 2018, difficulte: 6 },
  { slug: "kimmy", nom: "Kimmy", roles: ["Marksman", "Mage"], lanes: ["Or", "Milieu"], specialites: ["Degats", "Poussee"], sortie: 2018, difficulte: 6 },
  { slug: "granger", nom: "Granger", roles: ["Marksman"], lanes: ["Or", "Jungle"], specialites: ["Degats", "Explosion"], sortie: 2019, difficulte: 6 },
  { slug: "wanwan", nom: "Wanwan", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Deplacement"], sortie: 2019, difficulte: 8 },
  { slug: "popol-et-kupa", nom: "Popol et Kupa", roles: ["Marksman"], lanes: ["Or", "Roam"], specialites: ["Invocation", "Controle"], sortie: 2020, difficulte: 6 },
  { slug: "brody", nom: "Brody", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Explosion"], sortie: 2020, difficulte: 5 },
  { slug: "beatrix", nom: "Beatrix", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Explosion"], sortie: 2021, difficulte: 9 },
  { slug: "natan", nom: "Natan", roles: ["Marksman", "Mage"], lanes: ["Or"], specialites: ["Degats", "Invocation"], sortie: 2021, difficulte: 7 },
  { slug: "melissa", nom: "Melissa", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats", "Protection"], sortie: 2022, difficulte: 5 },
  { slug: "ixia", nom: "Ixia", roles: ["Marksman"], lanes: ["Or"], specialites: ["Degats"], sortie: 2023, difficulte: 5 },

  // ── Supports ─────────────────────────────────────────────────────────────
  { slug: "rafaela", nom: "Rafaela", roles: ["Support"], lanes: ["Roam"], specialites: ["Soin", "Deplacement"], sortie: 2016, difficulte: 3 },
  { slug: "estes", nom: "Estes", roles: ["Support"], lanes: ["Roam"], specialites: ["Soin"], sortie: 2017, difficulte: 4 },
  { slug: "angela", nom: "Angela", roles: ["Support"], lanes: ["Roam"], specialites: ["Soin", "Alliance"], sortie: 2018, difficulte: 6 },
  { slug: "diggie", nom: "Diggie", roles: ["Support"], lanes: ["Roam"], specialites: ["Controle", "Protection"], sortie: 2017, difficulte: 6 },
  { slug: "mathilda", nom: "Mathilda", roles: ["Support", "Assassin"], lanes: ["Roam"], specialites: ["Deplacement", "Alliance"], sortie: 2020, difficulte: 7 },
  { slug: "floryn", nom: "Floryn", roles: ["Support"], lanes: ["Roam"], specialites: ["Soin"], sortie: 2022, difficulte: 4 },
  { slug: "kalea", nom: "Kalea", roles: ["Support"], lanes: ["Roam"], specialites: ["Controle", "Alliance"], sortie: 2025, difficulte: 6 },
];

export const rosterParSlug = new Map(roster.map((h) => [h.slug, h]));

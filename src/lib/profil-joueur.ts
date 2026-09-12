/**
 * Profil de joueur : ses chiffres, rapportes a ceux du site.
 *
 * Le service donne les parties et les heros joues ; le site connait le taux de
 * victoire de chaque heros dans chaque tranche de rang. Rapprocher les deux
 * situe le joueur face aux autres joueurs de son niveau, et en tire quelques
 * conseils simples. Tout est calcule ici, sans appel reseau : pages et tests
 * passent des reponses deja lues par `joueur-api`.
 */
import { heros } from "./donnees";
import type { HerosFrequent, HerosJeu, Participant, PartieResume } from "./joueur-api";
import { rangLisible } from "./rangs";
import type { RangMesure } from "./rangs-mesure";
import { statsParRang } from "./tier-list";
import { cleRecherche } from "./utils";

/** Heros pret a afficher : fiche du site quand elle existe, sinon ce qu'en dit le service. */
export interface HerosAffiche {
  slug: string | null;
  nom: string;
  portrait: string | null;
}

const cleNom = (nom: string) => cleRecherche(nom).replace(/[^a-z0-9]/g, "");

/**
 * Identifiant du jeu vers fiche du site. Le wiki numerote les heros comme le
 * jeu, suivis d'un chiffre : Fanny, heros 17 du jeu, est « 171 » ; Miya,
 * heros 1, « 011 ».
 */
const PAR_HID = new Map(heros.map((h) => [Math.floor(Number(h.id) / 10), h]));
const PAR_NOM = new Map(heros.map((h) => [cleNom(h.name), h]));

export function herosAffiche(h: HerosJeu): HerosAffiche {
  // Le nom d'abord : un nouveau heros numerote autrement ne doit pas en
  // emprunter un autre. L'identifiant rattrape les graphies divergentes.
  const site = PAR_NOM.get(cleNom(h.nom)) ?? PAR_HID.get(h.hid);
  if (!site) return { slug: null, nom: h.nom, portrait: h.image };
  return { slug: site.slug, nom: site.name, portrait: site.images.portrait ?? h.image };
}

/**
 * Tranche de mesure du rang du joueur.
 *
 * Le site mesure les heros d'Epique a Gloire mythique. En dessous, aucune
 * tranche ne correspond : on compare a tous rangs confondus. Immortel, au-dela
 * de la derniere tranche mesuree, se compare a Gloire.
 */
const TRANCHES: Partial<Record<string, RangMesure>> = {
  epique: "epic",
  legende: "legend",
  mythique: "mythic",
  "mythique-honneur": "honor",
  "mythique-gloire": "glory",
  "mythique-immortel": "glory",
};

export function trancheDuRang(rankLevel: number): RangMesure {
  if (!Number.isFinite(rankLevel) || rankLevel < 1) return "all";
  return TRANCHES[rangLisible(rankLevel).cle] ?? "all";
}

/** Taux de victoire d'un heros dans la tranche, ou tous rangs confondus a defaut. */
export function moyenneDuRang(slug: string, tranche: RangMesure): { victoire: number; tranche: RangMesure } | null {
  const stats = statsParRang(slug);
  const retenue = stats[tranche] ? tranche : stats.all ? "all" : null;
  return retenue ? { victoire: stats[retenue]!.winRate, tranche: retenue } : null;
}

export interface LigneHeros {
  heros: HerosAffiche;
  parties: number;
  victoires: number;
  /** Taux de victoire du joueur, en points (0 a 100). */
  taux: number;
  /** Taux de victoire du heros chez tous les joueurs de la tranche, en points. */
  moyenne: number | null;
  trancheMoyenne: RangMesure | null;
  /** Taux du joueur moins la moyenne, en points. */
  ecart: number | null;
  note: number | null;
}

/** Heros joues, du plus au moins joue, chacun face a la moyenne de la tranche. */
export function comparerHeros(frequents: HerosFrequent[], tranche: RangMesure): LigneHeros[] {
  return frequents
    .filter((f) => f.parties > 0)
    .map((f) => {
      const affiche = herosAffiche(f.heros);
      const taux = (f.victoires / f.parties) * 100;
      const moyenne = affiche.slug ? moyenneDuRang(affiche.slug, tranche) : null;
      return {
        heros: affiche,
        parties: f.parties,
        victoires: f.victoires,
        taux,
        moyenne: moyenne?.victoire ?? null,
        trancheMoyenne: moyenne?.tranche ?? null,
        ecart: moyenne ? taux - moyenne.victoire : null,
        note: f.note,
      };
    })
    .sort((a, b) => b.parties - a.parties || b.victoires - a.victoires);
}

export interface BilanSaison {
  parties: number;
  victoires: number;
  /** Taux de victoire, en points ; null sans partie. */
  taux: number | null;
  heros: number;
}

/** Bilan de la saison, somme des heros joues : le service ne le donne pas tout fait. */
export function bilanSaison(frequents: HerosFrequent[]): BilanSaison {
  const parties = frequents.reduce((n, f) => n + f.parties, 0);
  const victoires = frequents.reduce((n, f) => n + f.victoires, 0);
  return { parties, victoires, taux: parties ? (victoires / parties) * 100 : null, heros: frequents.length };
}

/** En dessous, un taux de victoire sur un heros ne dit encore rien. */
export const PARTIES_MIN = 5;
/** Ecart a la moyenne, en points, a partir duquel un heros est signale. */
export const MARGE_POINTS = 3;

/**
 * Borne basse de l'intervalle de Wilson (90 %). Classe les heros sur ce que
 * leur taux garantit plutot que sur ce qu'il affiche : 5 victoires en 5
 * parties passent derriere 17 en 20.
 */
function borneBasse(victoires: number, parties: number): number {
  if (parties === 0) return 0;
  const z = 1.645;
  const p = victoires / parties;
  const z2 = z * z;
  const centre = p + z2 / (2 * parties);
  const marge = z * Math.sqrt((p * (1 - p) + z2 / (4 * parties)) / parties);
  return (centre - marge) / (1 + z2 / parties);
}

/** Heros qui font gagner le joueur, assez joues pour que ce soit credible. */
export function meilleursHeros(lignes: LigneHeros[], combien = 3): LigneHeros[] {
  return lignes
    .filter((l) => l.parties >= PARTIES_MIN && l.taux > 50)
    .sort((a, b) => borneBasse(b.victoires, b.parties) - borneBasse(a.victoires, a.parties))
    .slice(0, combien);
}

/**
 * Heros nettement sous la moyenne de la tranche. Classes par parties perdues
 * de trop — l'ecart fois le nombre de parties : un heros un peu faible mais
 * tres joue coute plus qu'un echec ponctuel.
 */
export function herosSousMoyenne(lignes: LigneHeros[], combien = 3): LigneHeros[] {
  const manque = (l: LigneHeros) => (-(l.ecart ?? 0) * l.parties) / 100;
  return lignes
    .filter((l) => l.parties >= PARTIES_MIN && l.ecart !== null && l.ecart <= -MARGE_POINTS)
    .sort((a, b) => manque(b) - manque(a))
    .slice(0, combien);
}

/** Nombre de parties recentes dont on lit le detail pour reperer les adversaires. */
export const PARTIES_ANALYSEES = 12;

export interface PartieAnalysee {
  /** Issue selon la liste des parties ; a defaut, celle du detail. */
  victoire: boolean | null;
  participants: Participant[];
}

export interface Bourreau {
  heros: HerosAffiche;
  defaites: number;
  rencontres: number;
}

/**
 * Heros adverses qui reviennent dans les defaites du joueur.
 *
 * Le joueur se retrouve dans le detail par son identifiant ; son equipe
 * designe, par difference, les adversaires. Une partie ou il n'apparait pas,
 * ou sans equipes, est ignoree plutot que devinee. Un heros n'est retenu qu'a
 * partir de deux defaites : une seule ne fait pas une tendance.
 */
export function bourreaux(
  parties: PartieAnalysee[],
  moi: { roleId: number; zoneId: number },
  combien = 3,
): { liste: Bourreau[]; analysees: number } {
  const compteurs = new Map<number, { heros: HerosJeu; defaites: number; rencontres: number }>();
  let analysees = 0;

  for (const partie of parties) {
    const soi = partie.participants.find(
      (p) => p.roleId === moi.roleId && (p.zoneId === null || p.zoneId === moi.zoneId),
    );
    const victoire = partie.victoire ?? soi?.victoire ?? null;
    if (!soi || soi.equipe === null || victoire === null) continue;

    const adversaires = partie.participants.filter((p) => p.equipe !== null && p.equipe !== soi.equipe);
    if (adversaires.length === 0) continue;
    analysees++;

    const vus = new Set<number>();
    for (const a of adversaires) {
      if (vus.has(a.heros.hid)) continue;
      vus.add(a.heros.hid);
      const c = compteurs.get(a.heros.hid) ?? { heros: a.heros, defaites: 0, rencontres: 0 };
      c.rencontres++;
      if (!victoire) c.defaites++;
      compteurs.set(a.heros.hid, c);
    }
  }

  const liste = [...compteurs.values()]
    .filter((c) => c.defaites >= 2)
    .sort((a, b) => b.defaites - a.defaites || b.defaites / b.rencontres - a.defaites / a.rencontres)
    .slice(0, combien)
    .map((c) => ({ heros: herosAffiche(c.heros), defaites: c.defaites, rencontres: c.rencontres }));

  return { liste, analysees };
}

/** Partie prete a afficher, transmissible telle quelle au navigateur. */
export interface PartieAffichee {
  id: string;
  heros: HerosAffiche;
  victoire: boolean | null;
  eliminations: number;
  morts: number;
  assistances: number;
  note: number | null;
  mvp: boolean;
  lane: number | null;
  date: number | null;
}

export function afficherPartie(p: PartieResume): PartieAffichee {
  return {
    id: p.id,
    heros: herosAffiche(p.heros),
    victoire: p.victoire,
    eliminations: p.eliminations,
    morts: p.morts,
    assistances: p.assistances,
    note: p.note,
    mvp: p.mvp,
    lane: p.lane,
    date: p.date,
  };
}

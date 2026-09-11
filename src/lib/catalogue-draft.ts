import statistiques from "@/data/jeu/statistiques.json";
import { coequipiers, heros } from "./donnees";
import type { HerosDraft } from "./draft";
import { classementComplet } from "./tier-list";

/**
 * Fiche reduite de chaque heros, pour l'aide au draft et l'analyse d'equipe.
 * Lue cote serveur seulement : elle tire les relations du wiki et le
 * classement, que le navigateur n'a pas a charger.
 */
interface Relation {
  fortContre: string[];
  faibleContre: string[];
  synergies: string[];
}

const relations = statistiques.relations as unknown as Record<string, Relation>;

/**
 * On n'envoie au client que ce dont les outils se servent : la fiche complete
 * d'un heros porte des competences et des skins qui n'entrent pas dans le
 * calcul et pesent lourd multiplies par 133.
 */
export function herosDraft(): HerosDraft[] {
  const taux = new Map(classementComplet.map((e) => [e.heros.slug, e.victoire]));
  return heros.map((h) => ({
    slug: h.slug,
    nom: h.nom,
    lanes: h.lanes,
    roles: h.roles,
    icone: h.visuels.icone ?? h.visuels.portrait,
    victoire: taux.get(h.slug) ?? null,
    fortContre: relations[h.slug]?.fortContre ?? [],
    faibleContre: relations[h.slug]?.faibleContre ?? [],
    // Synergies ecrites par le wiki, completees des coequipiers qui font le
    // plus gagner le heros en partie classee.
    synergies: [
      ...new Set([...(relations[h.slug]?.synergies ?? []), ...(coequipiers[h.slug]?.all ?? []).map((c) => c.slug)]),
    ],
  }));
}

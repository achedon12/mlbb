import type { TierList } from "@/lib/types";

/**
 * Tier list de la file classee.
 *
 * Elle est volontairement courte et argumentee : une note par entree, plutot
 * qu'un classement de cent heros sans justification. Elle vaut pour la file
 * classee solo, pas pour le jeu en equipe organisee, ou les priorites de pick
 * et de ban changent completement.
 */
export const tierList: TierList = {
  patch: "1.9.xx",
  miseAJour: "2026-09-09",
  entrees: [
    { heros: "khufra", palier: "S+", lane: "Roam", note: "Reponse structurelle a toute la categorie des heros mobiles, qui domine la file classee haute." },
    { heros: "melissa", palier: "S+", lane: "Or", note: "Le seul tireur qui resout seul le probleme du plongeon, sans dependre de son soutien." },
    { heros: "fredrinn", palier: "S+", lane: "Jungle", note: "Tient la ligne de front tout en gardant des degats reels : un jungleur qui pardonne les erreurs." },
    { heros: "mathilda", palier: "S", lane: "Roam", note: "Sauve un allie mal place et rattrape une erreur de positionnement, ce qui compte beaucoup en solo." },
    { heros: "yu-zhong", palier: "S", lane: "Experience", note: "Gagne les combats longs tant que l'adversaire n'achete pas de reduction de soins." },
    { heros: "cecilion", palier: "S", lane: "Milieu", note: "Fin de partie sans plafond, a condition de traverser les quinze premieres minutes." },
    { heros: "beatrix", palier: "S", lane: "Or", note: "Puissance tres elevee, mais le palier suppose de maitriser le choix des armes." },
    { heros: "tigreal", palier: "A", lane: "Roam", note: "Valeur constante et lisible ; plafond limite par la previsibilite de l'engagement." },
    { heros: "granger", palier: "A", lane: "Jungle", note: "Pic precoce excellent, fin de partie plus faible que les tireurs a critique." },
    { heros: "paquito", palier: "A", lane: "Experience", note: "Tres fort entre de bonnes mains, sans valeur si les fenetres sont gachees." },
    { heros: "kagura", palier: "A", lane: "Milieu", note: "Plafond eleve, mais punie par les assassins des que la gestion d'etat derape." },
    { heros: "estes", palier: "A", lane: "Roam", note: "Domine les compositions sans reduction de soins ; s'effondre des qu'elle arrive." },
    { heros: "lancelot", palier: "B", lane: "Jungle", note: "Solide, mais la presence generalisee de Khufra plafonne son influence." },
    { heros: "gusion", palier: "B", lane: "Jungle", note: "Le palier depend presque entierement du joueur : S+ maitrise, C sinon." },
    { heros: "chou", palier: "B", lane: "Roam", note: "Excellent en equipe coordonnee, beaucoup moins en solo ou l'isolement n'est pas suivi." },
    { heros: "angela", palier: "B", lane: "Roam", note: "Depend du niveau de l'allie choisi, ce qui la rend irreguliere en file classee." },
    { heros: "pharsa", palier: "B", lane: "Milieu", note: "Punie par le nombre d'assassins de jungle joues actuellement." },
    { heros: "ling", palier: "C", lane: "Jungle", note: "Toujours viable, mais chaque equipe adverse dispose desormais d'une reponse." },
    { heros: "franco", palier: "C", lane: "Roam", note: "Un grappin rate coute une rotation entiere ; trop irregulier sans coordination vocale." },
  ],
};

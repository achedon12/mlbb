/**
 * Tier list comments.
 *
 * The ranking itself is no longer written here: it is computed from the win
 * and ban rates reported by the game, and updates with every sync (see
 * `src/lib/tier-list.ts`).
 *
 * What remains hand-written is what the numbers do not say: *why* a hero
 * sits where it does. An entry is optional — a hero without a comment is
 * shown with its numbers alone.
 */
export const notesTierList: Record<string, string> = {
  "khufra":
    "Réponse structurelle à toute la catégorie des héros mobiles, qui domine la file classée haute.",
  "melissa":
    "Le seul tireur qui résout seul le problème du plongeon, sans dépendre de son soutien.",
  "fredrinn":
    "Tient la ligne de front tout en gardant des dégâts réels : un jungleur qui pardonne les erreurs.",
  "mathilda":
    "Sauve un allié mal placé et rattrape une erreur de positionnement, ce qui compte beaucoup en solo.",
  "yu-zhong":
    "Gagne les combats longs tant que l'adversaire n'achète pas de réduction de soins.",
  "cecilion":
    "Fin de partie sans plafond, à condition de traverser les quinze premières minutes.",
  "beatrix":
    "Puissance très élevée, mais le palier suppose de maîtriser le choix des armes.",
  "tigreal":
    "Valeur constante et lisible ; plafond limité par la prévisibilité de l'engagement.",
  "granger":
    "Pic précoce excellent, fin de partie plus faible que les tireurs à critique.",
  "paquito":
    "Très fort entre de bonnes mains, sans valeur si les fenêtres sont gâchées.",
  "kagura":
    "Plafond élevé, mais punie par les assassins dès que la gestion d'état dérape.",
  "estes":
    "Domine les compositions sans réduction de soins ; s'effondre dès qu'elle arrive.",
  "lancelot":
    "Solide, mais la présence généralisée de Khufra plafonne son influence.",
  "gusion":
    "Le palier dépend presque entièrement du joueur : S+ maîtrisé, C sinon.",
  "chou":
    "Excellent en équipe coordonnée, beaucoup moins en solo où l'isolement n'est pas suivi.",
  "angela":
    "Dépend du niveau de l'allié choisi, ce qui la rend irrégulière en file classée.",
  "pharsa":
    "Punie par le nombre d'assassins de jungle joués actuellement.",
  "ling":
    "Toujours viable, mais chaque équipe adverse dispose désormais d'une réponse.",
  "franco":
    "Un grappin raté coûte une rotation entière ; trop irrégulier sans coordination vocale.",
};

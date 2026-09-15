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
  "belerick":
    "Classé tout en haut surtout par ses bannissements, parmi les plus fréquents du jeu ; son taux de victoire est bon sans être exceptionnel, et Lesley comme Beatrix le gênent nettement.",
  "eudora":
    "Sa place tient d'abord au bannissement, en hausse sur trente jours. Renforcée au patch 2.1.88 sans détail publié, elle gagne surtout les parties courtes.",
  "hirara":
    "Nouvelle héroïne du patch 2.1.88, bannie dans la grande majorité des parties en Mythic Glory : le palier traduit la crainte qu'elle inspire, alors que son taux de victoire passe sous la moyenne en Mythic.",
  "marcel":
    "Taux de victoire parmi les plus hauts, mais sur très peu de parties jouées. Le patch 2.1.88 a retiré l'immobilisation de sa compétence 1 ; Angela et Floryn restent ses pires adversaires mesurés.",
  "gloo":
    "Banni environ une partie sur deux et gagnant quand il passe, malgré son affaiblissement au patch 2.1.88. Faramis est de loin sa réponse la plus nette selon les mesures.",
  "rafaela":
    "Porté par un taux de victoire parmi les plus hauts du jeu depuis que le patch 2.1.88 a raccourci la recharge de base de sa résurrection ; son bannissement monte sur trente jours.",
  "sun":
    "Héros de fin de partie : sous la moyenne avant la quatorzième minute, très au-dessus après la seizième. Son bannissement recule sur trente jours mais reste élevé, surtout en Mythic.",
  "hanzo":
    "Le palier tient au bannissement, en hausse sur trente jours, alors que son taux de victoire a baissé jusqu'à passer sous la moyenne. Le patch 2.1.88 l'a renforcé sur la tortue et le seigneur.",
  "miya":
    "Le héros le plus joué du jeu, avec un taux de victoire au-dessus de la moyenne à tous les rangs et un bannissement en hausse sur trente jours.",
  "floryn":
    "Très efficace dans les parties courtes, mais son taux de victoire passe sous la moyenne après la dix-huitième minute : une valeur de tempo plus que de fin de partie.",
  "saber":
    "Banni bien plus souvent en Mythic qu'en Mythic Glory pour un taux de victoire proche de la moyenne. Le patch 2.1.88 l'a orienté vers des dégâts soutenus et les objets de combattant.",
  "atlas":
    "Engagement de groupe qui gagne surtout avec un soutien à ses côtés, Mathilda, Floryn, Estes ou Rafaela ; Marcel reste de loin son pire adversaire mesuré.",
  "masha":
    "Taux de victoire très élevé, mais sur un nombre de parties infime : la mesure est trop fragile pour en tirer une conclusion.",
  "kaja":
    "Classé haut par le seul bannissement, en net recul sur trente jours ; son taux de victoire reste sous la moyenne à tous les rangs.",
  "minotaur":
    "L'un des meilleurs taux de victoire parmi les roamers, pour un bannissement faible : un choix sûr, presque toujours disponible en sélection.",
  "yi-sun-shin":
    "Le jungleur le plus joué en Mythic Glory, efficace surtout dans les parties courtes ; son taux de victoire revient à la moyenne passé la douzième minute.",
  "hanabi":
    "Très jouée et au-dessus de la moyenne tous rangs confondus, mais nettement moins efficace en Mythic Glory et dans les parties qui s'allongent.",
  "barats":
    "En pleine montée, avec sélection et bannissement en hausse sur trente jours. Son rendement chute pourtant dans les parties longues, et X.Borg le contre très nettement.",
  "lukas":
    "Faible dans les parties courtes, solide ensuite, et meilleur en Mythic Glory qu'en Mythic ; peu banni, il reste souvent disponible.",
  "diggie":
    "Taux de victoire solide mais très peu joué, donc une mesure fragile. Le patch 2.1.88 a revu ses attributs et le coût de ses compétences.",
  "lolita":
    "Presque jamais jouée : son palier repose sur un échantillon trop mince pour être pris au pied de la lettre.",
  "minsitthar":
    "Proche de la moyenne en victoires, classé par un bannissement qui recule sur trente jours ; Natalia et Yin sont ses adversaires les plus pénibles selon les mesures.",
  "valir":
    "Peu banni et régulier : au-dessus de la moyenne à tous les rangs et encore dans les parties longues. Rafaela et Kaja sont ses contres les plus nets en Mythic Glory.",
  "carmilla":
    "Son efficacité dépend du partenaire : ses duos mesurés avec Diggie, Floryn ou Mathilda comptent parmi les écarts les plus forts du jeu. Renforcée au patch 2.1.88, sans détail publié.",
};

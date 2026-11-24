# Brief graphique : MLBBDex, refonte « Terre de l'Aube »

## Objectif

Le site doit taper dans l'œil dès la première seconde, comme le site de lancement
d'un jeu, et rester un outil de données rapide et lisible. Personne ne doit pouvoir
le confondre avec un template ou un site généré : il a sa propre image, qu'on
reconnaît sur une capture d'écran sans voir le logo.

## Concept : « la bataille, en grand »

MLBB, c'est des héros spectaculaires et des combats nerveux. Le site montre ça en
premier : les illustrations officielles en plein écran, comme des affiches de
cinéma, et l'interface du jeu (ses découpes en biais, son or, ses éclats de
compétence) devient le langage graphique. Les chiffres viennent ensuite, gros et
francs, comme un score affiché après un combat.

## Signature (ce qu'on reconnaît)

1. **La coupe en biais.** Toutes les formes fortes (blocs d'image, bandeaux,
   boutons, onglets, cartes de héros) ont un ou deux coins coupés en biais, comme
   les panneaux du jeu. Pas de coins arrondis. Le site a déjà `bevel` : on le
   pousse partout, avec une seule règle d'angle.
2. **L'affiche de héros.** Chaque page forte s'ouvre sur une illustration en
   pleine largeur, recadrée serré, avec un dégradé de nuit vers le bas où vient le
   texte. Le nom du héros est écrit en énorme, en capitales condensées inclinées,
   et passe devant l'illustration.
3. **Le chiffre de score.** Les grands chiffres (taux de victoire, palier, rang)
   sont en très gros caractères condensés, en or, avec un contour fin sur le
   chiffre secondaire. Un seul grand chiffre par écran.
4. **L'éclat.** Un trait lumineux en biais (comme une lame ou une compétence)
   sépare les sections et souligne l'élément actif. C'est le seul effet lumineux
   du site.
5. **Le palier comme un insigne.** S+, S, A… sont des écussons découpés en biais,
   colorés par palier, et non de simples badges.

## Palette

- **Nuit** (fonds) : `#06080F`, `#0B1020`, `#141B33`.
- **Or MLBB** (accent principal, titres forts, chiffres) : `#F5C451`, plus foncé `#C8901E`.
- **Bleu allié** (buffs, hausses, ce qui gagne) : `#3D8BFF`.
- **Rouge ennemi** (nerfs, baisses, bans) : `#FF4D4D`.
- **Craie** (texte) : `#EEF2FB`, secondaire `#9AA6C2`.

Pas d'autres couleurs, sauf les couleurs de palier et de rareté, qui sont des
informations. Jamais de violet, jamais de dégradé arc-en-ciel.

## Typographie

- **Titres et chiffres :** une police condensée très grasse, avec une version
  italique pour les noms de héros et les grands titres (par exemple Barlow
  Condensed 800/900 italique, ou Saira Extra Condensed). Toujours en capitales
  pour les noms de héros.
- **Texte :** une grotesque lisible (Inter, déjà chargée), chiffres tabulaires
  dans les tableaux.
- **Hiérarchie figée :** nom de héros ou titre de page géant (clamp jusqu'à
  9rem) · titre de section 2,5–3,5rem · sous-titre 1,25rem · texte 1rem.

## Mouvement

- **Un seul moment fort par page :** à l'arrivée, l'illustration de l'affiche
  glisse très légèrement et le nom apparaît en biais (moins de 700 ms).
- **Survol :** les cartes de héros montent de 2 px et leur illustration zoome
  de 3 % dans son cadre, l'éclat passe sous l'élément survolé, et les boutons
  s'enfoncent au clic.
- **Au défilement, une seule chose :** sur l'accueil, chaque bloc entre une fois,
  la première fois qu'il approche (il monte, son titre arrive en biais, son
  éclat passe). Rien d'autre ne bouge au défilement. Tout s'arrête si
  l'utilisateur demande moins d'animations.
- **La scène de l'accueil :** l'illustration du n°1 de la méta, une lueur or et
  bleu qui dérive lentement, quelques braises qui montent, un léger relief qui
  suit la souris, Dex qui présente le patch et des chiffres qui défilent jusqu'à
  leur valeur. C'est le seul endroit du site où lueur et braises sont permises.

## Composition

- Une chose domine chaque écran : l'affiche, un grand chiffre ou une liste.
- Des compositions qui débordent : illustrations qui sortent de leur colonne, nom
  de héros qui chevauche l'image, blocs décalés.
- Les listes de héros deviennent des rangées de portraits découpés en biais,
  avec le chiffre clé en or dessus, et non des tableaux gris.
- Les tableaux restent pour les vraies données (statistiques), mais ils sont
  aérés et leurs en-têtes sont en capitales condensées.

## Interdits (ce qui fait « site généré »)

- Les petites étiquettes en capitales espacées partout : une seule par écran,
  et seulement si elle informe.
- Les légendes sous les images.
- Trois colonnes égales de listes côte à côte.
- Les cadres autour de chaque section.
- Les titres en dégradé, les halos flous, les particules, l'effet verre, le néon.
- Les emojis en illustration, les cartes arc-en-ciel, les coins très arrondis.
- Les illustrations en petites vignettes alignées quand elles peuvent être grandes.

## Ce qui ne doit pas changer

- Toutes les fonctionnalités, adresses, filtres, raccourcis, sauvegardes du
  navigateur et événements de mesure d'audience. Les tests navigateur
  (`tests/e2e`) et les tests unitaires les protègent : ils doivent tous passer.
- L'accessibilité : un seul h1, focus visible, contrastes suffisants, navigation
  au clavier.
- La vitesse : les illustrations en grand sont optimisées (formats modernes,
  bonnes tailles, priorité à l'affiche), et la mise en page ne saute pas au
  chargement.

## Élément fait main (à fournir)

Le logo (marque et logotype) est dessiné à part, en SVG, dans
`public/brand/`. Les pages l'utilisent par un composant unique (`src/components/brand-mark.tsx`)
pour qu'il soit remplacé partout d'un coup.

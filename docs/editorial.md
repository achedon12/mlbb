# Textes signés de l'auteur

Le site affiche trois emplacements réservés à la voix de son auteur. Ils sont
vides tant que rien n'est écrit : **aucun texte de remplacement, aucun exemple
n'est jamais affiché**. Un emplacement apparaît dès qu'un fichier complet
existe, au prochain déploiement.

## Où écrire

Tout est dans `content/fr/editorial/`, en Markdown avec un en-tête YAML :

| Fichier | Ce qu'il affiche | Où |
| --- | --- | --- |
| `auteur.md` | « Qui fait MLBBDex » : nom ou pseudo, rôle, rang, héros favoris, pourquoi le site, contact | `/about`, en haut de la page (ancre `#auteur`) |
| `patchs/<version>.md` | « L'avis de l'auteur sur le patch X » | la note de ce patch, `/patch-notes/<version>`, avant le détail des changements |
| `tier-list/<version>.md` | « L'avis de l'auteur sur cette tier list » | `/tier-list` (le classement tous rangs), tant que `<version>` est le patch en ligne |

`<version>` est le numéro du patch tel que l'écrit l'adresse de sa note, par
exemple `2.1.88`. L'avis sur la tier list disparaît de lui-même quand un
nouveau patch sort : on écrit alors `tier-list/<nouvelle version>.md`.

Les modèles commentés sont dans `content/fr/editorial/_modeles/` : copier le
modèle à la bonne place, le renommer, le remplir. Ce dossier n'est jamais lu
par le site.

## Format

En-tête (entre les deux lignes `---`) :

- `auteur.md` : `nom` (obligatoire), `role`, `rang`, `heros` (liste de slugs
  de `src/data/game/heroes.json`, six au plus), `contact` (e-mail ou lien
  `https://`), `date` (`AAAA-MM-JJ`).
- avis : `date` (obligatoire, `AAAA-MM-JJ`), `titre`, `auteur` (sinon le `nom`
  de `auteur.md`), `rang` (sinon celui de `auteur.md`).
- `brouillon: true` cache le fichier, quel que soit son contenu. Les modèles
  commencent avec : l'enlever pour publier.

Sous l'en-tête, le texte en Markdown simple : paragraphes, gras, listes, liens.
Les liens vers le site s'écrivent sans la langue (`[Layla](/heroes/layla)`) :
le site l'ajoute. Les commentaires `<!-- … -->` sont retirés avant affichage.

Un fichier n'apparaît que s'il est complet : du texte sous l'en-tête, une date
valide pour un avis, et une signature (`auteur`, ou `nom` dans `auteur.md`
publié). Sinon il reste caché, sans erreur sur le site.

## Vérifier avant de publier

```
npx vitest run tests/unit/editorial.test.ts
```

Le test lit le vrai dossier et nomme chaque fichier qui ne s'afficherait pas ou
s'afficherait mal : version de patch inconnue, date mal écrite, slug de héros
inexistant, contact invalide, signature manquante. Un en-tête YAML illisible
arrête la construction du site avec le nom du fichier.

Les textes sont lus au rendu des pages, comme les histoires relues
(`content/fr/lore/`) : ils sont en ligne au déploiement suivant, sans attendre
la synchronisation des données.

## Langues : le texte n'est jamais traduit automatiquement

Les textes signés sont une opinion personnelle. Une traduction automatique
pourrait leur faire dire autre chose que ce que l'auteur a écrit, sous sa
signature. Le choix retenu est donc le plus simple à vérifier :

- dans toutes les langues, le texte est affiché **tel qu'il a été écrit, en
  français** ;
- il porte l'attribut `lang="fr"`, pour que les lecteurs d'écran le
  prononcent correctement et que le navigateur du visiteur propose sa propre
  traduction s'il le souhaite ;
- hors du français, une ligne dit « Texte original en français, non traduit »
  dans la langue de la page.

Le script de traduction (`scripts/translate-articles.mjs`) ne lit que
`news`, `patch-notes` et `guides` : il ne touche pas à `editorial/`. La page
`/methodology` décrit ce choix aux visiteurs.

## Où c'est dans le code

- `src/lib/editorial.ts` : lecture des fichiers et règles d'affichage.
- `src/components/author-note.tsx` : l'encart signé (patch, tier list).
- `src/components/author-profile.tsx` : « Qui fait MLBBDex » sur `/about`.
- `tests/unit/editorial.test.ts` : règles d'affichage et vérification du
  dossier réel.

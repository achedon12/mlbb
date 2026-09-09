# Contribuer

Toute contribution est bienvenue. La plus utile, et de loin : **ecrire
l'analyse d'un heros qui n'en a pas encore**.

## Comment le projet est organise

Deux sources de donnees, qu'il ne faut pas confondre.

| | Ou | Qui l'ecrit |
| --- | --- | --- |
| **Donnees factuelles** — heros, skins, objets, patchs, visuels | `src/data/genere/`, `public/visuels/` | Personne : `npm run sync` les extrait du wiki |
| **Analyse** — commentaire, competences redigees, contres, builds | `src/data/heros/` | Vous |
| **Articles** — guides, actualites, patch notes | `content/` | Vous |
| **Tier list, emblemes, sorts** | `src/data/` | Vous |

> **Ne modifiez jamais `src/data/genere/` ni `public/visuels/` a la main.**
> La prochaine synchronisation ecrasera vos changements. Si une donnee du jeu
> est fausse, elle vient du wiki : la corriger la-bas resout le probleme pour
> tout le monde, et definitivement.

## Demarrer

```bash
npm install
cp .env.example .env.local     # renseigner SESSION_SECRET
npm run dev                    # http://localhost:3001
```

Les donnees et les visuels sont deja dans le depot : rien a synchroniser pour
travailler.

## Ecrire une analyse de heros

1. Reprendre le `slug` **exact** depuis `src/data/genere/heros.json`.
2. Ouvrir le fichier du role dans `src/data/heros/` (`tanks.ts`,
   `fighters.ts`, `assassins.ts`, `mages.ts`, `marksmen.ts`, `supports.ts`).
3. Ajouter une entree suivant le type `AnalyseHeros` de `src/lib/types.ts`.

N'y remettez pas le role, la position, la date de sortie ni la difficulte :
tout cela vient deja de la synchronisation.

### Ce qui fait une bonne analyse

- **`resume`** — une phrase. Elle sert aussi de meta description.
- **`analyse`** — deux paragraphes separes par une ligne vide : ce que le heros
  fait reellement, puis ses limites. Pas de superlatifs. « Il est fort » n'est
  pas une analyse ; « il gagne les combats longs tant que l'adversaire
  n'achete pas de reduction de soins » en est une.
- **`competences`** — la description, les recharges et le cout. **Le nom
  n'est plus affiche** : il vient du wiki, dans la langue du jeu, pour que le
  lecteur retrouve la competence en partie. Respectez l'ordre passif,
  competence 1, competence 2, ultime — c'est lui qui apparie votre description
  a la bonne competence. Ne recopiez pas les valeurs de degats : elles
  changent presque a chaque patch.
- **`fortContre` / `faibleContre`** — des `slug`, pas des noms.
- **`builds`** — le champ `contexte` explique *quand* prendre ce build. Un
  build sans contexte n'apprend rien a personne.

## Ecrire un article

Un fichier Markdown dans `content/actualites/` ou `content/patch-notes/`,
nomme `AAAA-MM-JJ-titre-en-slug.md`. La date sert au tri et disparait de l'URL.

```markdown
---
titre: "Titre de l'article"
date: "2026-09-09"
categorie: "Guide"        # Actualite | Patch | Esport | Guide
auteur: "votre-pseudo"
chapeau: "Une phrase de resume, reprise en meta description et dans le flux RSS."
motsCles: ["mot", "cle"]
---

Le corps de l'article, en Markdown.
```

## Modifier la tier list

Dans `src/data/tier-list.ts`. Mettre a jour `patch` et `miseAJour`.

**Un placement sans argument n'est pas accepte.** Le champ `note` doit dire ce
qui justifie la position au patch courant.

## Relancer une synchronisation

Elle tourne toute seule chaque lundi et ouvre une pull request. Pour la
declencher a la main :

```bash
npm run sync -- --images
```

## Avant d'ouvrir une pull request

```bash
npm run lint
npm run typecheck
npm run build
```

Les trois doivent passer — la verification automatique les relancera de toute
facon.

Messages de commit en francais, a l'imperatif : « ajoute l'analyse de Ling »,
« corrige la recharge de Khufra ».

## Style

Le site est en francais. Les commentaires de code aussi : ils expliquent
**pourquoi**, pas **quoi**. Si un commentaire paraphrase la ligne suivante, il
vaut mieux l'enlever.

Une remarque sur les accents : le code et la documentation de ce projet sont
ecrits sans accents, par coherence avec l'existant. Les textes affiches aux
visiteurs, eux, en portent normalement.

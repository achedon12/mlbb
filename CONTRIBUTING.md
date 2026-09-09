# Contribuer

Toute contribution est bienvenue, en particulier les **fiches heros
manquantes** et les **corrections d'equilibrage** apres un patch.

## Regle unique

Ne rien ajouter qui n'ait ete verifie en jeu. Une fiche absente est preferable
a une fiche approximative : c'est ce qui fait la difference entre ce site et
une liste generee automatiquement.

## Ajouter une fiche heros

1. Le heros est deja dans `src/data/roster.ts` avec ses attributs de base.
   Reprendre **exactement** son `slug`.
2. Ouvrir le fichier du role correspondant dans `src/data/heros/`
   (`tanks.ts`, `fighters.ts`, `assassins.ts`, `mages.ts`, `marksmen.ts`,
   `supports.ts`).
3. Ajouter une entree suivant le type `Heros` de `src/lib/types.ts`.

Le reste est automatique : page, plan du site, donnees structurees, liens de
contre depuis les autres fiches.

Conventions de redaction :

- **`resume`** — une phrase. Sert aussi de meta description.
- **`analyse`** — deux paragraphes separes par une ligne vide. Ce que le heros
  fait reellement, puis ses limites. Pas de superlatifs.
- **`competences`** — les recharges vont du niveau 1 au niveau maximum. Ne pas
  reprendre les valeurs de degats : elles changent presque a chaque patch et
  vieillissent mal.
- **`fortContre` / `faibleContre`** — des `slug`, pas des noms.
- **`builds`** — le champ `contexte` explique *quand* prendre ce build. Un
  build sans contexte n'apporte rien.

## Ajouter un article

Creer un fichier Markdown dans `content/actualites/` ou
`content/patch-notes/`, nomme `AAAA-MM-JJ-titre-en-slug.md` — la date sert au
tri et est retiree de l'URL.

```markdown
---
titre: "Titre de l'article"
date: "2026-09-09"
categorie: "Guide"        # Actualite | Patch | Esport | Guide
auteur: "votre-pseudo"
chapeau: "Une phrase de resume, utilisee en meta description et dans le flux RSS."
motsCles: ["mot", "cle"]
---

Le corps de l'article, en Markdown.
```

## Corriger l'equilibrage

Apres un patch, les fichiers concernes sont generalement :

- `src/data/tier-list.ts` — penser a mettre a jour `patch` et `miseAJour`.
- Les recharges dans `src/data/heros/*.ts`.
- `src/data/objets.ts` si un objet a change.

Une modification de tier list doit s'accompagner d'une note qui **justifie** le
placement. Un classement sans argument n'est pas accepte.

## Avant d'ouvrir une pull request

```bash
npm run lint
npm run typecheck
npm run build
```

Les trois doivent passer. Les messages de commit sont en francais, a
l'imperatif : « ajoute la fiche de Ling », « corrige la recharge de Khufra ».

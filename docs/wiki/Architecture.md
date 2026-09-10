# Architecture

## Pile technique

- **Next.js 16** (App Router), **React 19** — pages de contenu générées au build (statiques).
- **Tailwind CSS v4** — thème par jetons (`@theme`), coins biseautés propres au jeu.
- **TypeScript** de bout en bout.
- **Docker** — image de production autonome (`output: standalone`).

## Principe directeur : tout en local

Le site ne dépend d'**aucune URL externe à l'exécution**. Chaque donnée et chaque
image est copiée dans le dépôt :

- les données factuelles vivent dans `src/data/jeu/` (JSON) ;
- les visuels dans `public/visuels/`.

Les seuls scripts autorisés sont ceux qui **récupèrent** ces données (voir
[Données et synchronisation](Donnees-et-synchronisation)) ; ils tournent hors ligne,
puis leur sortie est versionnée.

## Organisation du code

```
src/
  app/            Pages (App Router) — héros, tier list, objets, modes, patch notes…
  components/     Composants d'interface
  lib/            Accès aux données (donnees.ts), types, utilitaires
  data/
    jeu/          Données extraites (heros, visuels, statistiques, patchs…)
    heros/        Analyses écrites à la main (builds, contres, commentaire)
scripts/          Récupération et traduction des données (voir page dédiée)
public/visuels/   Images copiées en local
```

## Deux origines de données, séparées

1. **Factuel** (héros, skins, objets, patchs, histoire) : extrait automatiquement,
   dans `src/data/jeu/`. Ne se modifie pas à la main — la prochaine synchronisation
   l'écraserait.
2. **Éditorial** (analyse, builds, contres commentés) : écrit à la main dans
   `src/data/heros/`, posé par-dessus le factuel via le `slug` du héros.

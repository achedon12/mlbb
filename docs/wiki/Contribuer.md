# Contribuer

Les contributions sont bienvenues, en particulier les **analyses de héros** :
c'est le seul contenu qu'aucune extraction ne produira jamais.

## Écrire une analyse

Les analyses vivent dans `src/data/heros/`, une par héros, reliées au reste par le
`slug`. Une analyse contient : un résumé, deux paragraphes de commentaire, forces,
faiblesses, matchups commentés et builds.

Ne pas toucher à `src/data/jeu/` : ce dossier est régénéré par la synchronisation.

## Mettre en place le projet

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3001
```

## Branches

- `develop` : le travail en cours — **les pull requests la visent**, fusionnées
  par *rebase* ou *squash*.
- `main` : la production, déployée à chaque push. Pour publier :
  `git push origin develop:main` une fois la CI verte (avance rapide, sans
  commit de fusion), ou le bouton **Publier en production** ;
  les données de la synchronisation y sont poussées chaque nuit puis reportées
  sur `develop`. Récupérez `develop` avec `git pull --rebase`.

Voir [Données et synchronisation](Donnees-et-synchronisation) pour le détail du
déploiement et des protections de branches.

## Avant d'ouvrir une PR

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Règles de commit

- Messages en français, à l'impératif, décrivant l'intention.
- Pas de signature d'outil dans les messages ni dans le contenu publié.

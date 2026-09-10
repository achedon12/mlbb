# MLBBDex — le wiki

**MLBBDex** est une base de connaissances francophone sur *Mobile Legends: Bang Bang* :
roster complet, fiches héros vérifiées, tier list argumentée, objets, emblèmes,
histoire des héros, modes de jeu et patch notes.

En ligne : <https://mlbbdex.com> · Code : <https://github.com/achedon12/mlbb>

> Le parti pris tient en une phrase : **rien n'est publié qui n'ait été vérifié**.
> Un héros sans fiche est affiché comme tel, plutôt que rempli de valeurs approximatives.

## Sommaire

- **[Architecture](Architecture)** — la pile technique et l'organisation du code.
- **[Données et synchronisation](Donnees-et-synchronisation)** — d'où viennent les données et comment elles sont rafraîchies.
- **[API](API)** — les routes JSON publiques, leur format et leurs limites.
- **[Traductions](Traductions)** — comment les contenus anglais deviennent français.
- **[Contribuer](Contribuer)** — écrire une analyse, corriger une donnée, ouvrir une PR.
- **[FAQ](FAQ)** — les questions récurrentes.

## En bref

| | |
| --- | --- |
| Framework | Next.js 16 (App Router) · React 19 |
| Style | Tailwind CSS v4 |
| Données | extraites du wiki Fandom + API communautaire, stockées **en dur** dans le dépôt |
| Déploiement | image Docker autonome (`output: standalone`) |
| Mesure d'audience | Matomo, sans cookie |

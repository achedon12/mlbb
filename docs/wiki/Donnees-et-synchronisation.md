# Données et synchronisation

Toutes les données sont **stockées en dur** dans le dépôt. Les scripts ne servent
qu'à les **rafraîchir** : ils tournent à la demande (ou en CI), puis leur sortie est
committée.

## Sources

- **Wiki Fandom** (`mobilelegends.fandom.com`) — roster, compétences, skins, objets,
  patch notes, histoire des héros, modes de jeu.
- **API communautaire** (`arena.rone.dev`) — statistiques (taux de victoire, contres),
  icônes de compétences en repli, accroche d'histoire.

> Aucune statistique de partie de joueur n'est disponible : Moonton a fermé ces accès.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run sync` | Relit les sources et régénère `src/data/jeu/` |
| `npm run sync -- --images` | Idem, en téléchargeant aussi les visuels en local |
| `npm run sync:evolution` | Mesures seules : tendances, coéquipiers, durées de partie, historique |
| `node scripts/sync.mjs --combos` | Combos de compétences seuls (`combos.json`) |
| `npm run traduire` | Traduit en français les histoires et les compétences |

## Ce que produit la synchronisation

`src/data/jeu/` : `heros.json`, `skins.json`, `objets.json`, `patchs.json`,
`patchs-detail.json`, `competences.json`, `contres.json`, `classement.json`,
`histoires.json`, `modes.json`, `rangs.json`, `evolution.json`, `combos.json`,
et les tables de visuels.

L'historique long (`evolution.json`, clé `historique`) garde les 90 derniers
jours au jour près ; les semaines plus anciennes y sont réduites à leur moyenne
(sous `semaines`), et la fiche héros les redessine en courbe continue.

## En intégration continue

Le workflow **Synchronisation** tourne chaque nuit : les mesures seules du mardi
au dimanche, la synchronisation complète le lundi. Les données changées sont
committées directement sur `main` par `github-actions[bot]`, puis le workflow
**Image Docker** est appelé pour reconstruire l'image depuis ce commit et la
déployer. Une panne de l'API ne fait qu'un avertissement : les mesures
précédentes et l'historique sont conservés.

Le déploiement se fait par SSH : le serveur récupère `main` puis relance
`docker compose up -d --build`. Il reste inactif tant que ces réglages du dépôt
ne sont pas renseignés (*Settings → Secrets and variables → Actions*) :

| Nom | Type | Contenu |
| --- | --- | --- |
| `DEPLOY_HOST` | variable | Hôte du serveur |
| `DEPLOY_USER` | variable | Utilisateur SSH, membre du groupe `docker` |
| `DEPLOY_PATH` | variable | Dossier du clone du dépôt sur le serveur |
| `DEPLOY_PORT` | variable | Port SSH (22 par défaut) |
| `DEPLOY_SSH_KEY` | secret | Clé privée autorisée sur le serveur |
| `DEPLOY_KNOWN_HOSTS` | secret | Empreinte du serveur (`ssh-keyscan <hôte>`) |

Si `main` est protégée, `github-actions[bot]` doit être autorisé à y pousser.

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
committées directement sur `main` — la production — puis déployées. Une panne
de l'API ne fait qu'un avertissement : les mesures précédentes et l'historique
sont conservés.

## Branches et déploiement

L'historique est linéaire : aucun commit de fusion, `main` et `develop`
n'avancent que par avance rapide.

- `develop` est le travail en cours : les pull requests la visent (fusion par
  *rebase* ou *squash*), les tests y tournent, rien n'y est déployé.
- `main` est la production : chaque push y déclenche le workflow **Image
  Docker**, qui construit l'image puis déploie. Pour publier, on avance `main`
  jusqu'à `develop` une fois Qualité et Tests verts sur `develop` :

  ```bash
  git push origin develop:main
  ```

  ou avec le bouton **Publier en production** (onglet *Actions*), qui fait la
  même chose après avoir vérifié la CI. GitHub refuse tout push sur `main` qui
  ne serait pas une avance rapide, ou dont le commit n'a pas passé la CI.
- La synchronisation pousse ses données sur `main` chaque nuit, puis **Aligner
  develop** les reporte sur `develop` : avance rapide si `develop` n'a rien de
  neuf, sinon ses commits non publiés sont rejoués par-dessus `main` (rebase).
  En local, récupérez `develop` avec `git pull --rebase`.
- Synchronisation, publication et alignement poussent avec la clé de
  déploiement `SYNC_DEPLOY_KEY`, seule autorisée à contourner les protections.

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
| `SYNC_DEPLOY_KEY` | secret | Clé privée d'une clé de déploiement du dépôt, en écriture |

Protections (*Settings → Rules → Rulesets*), avec la clé de déploiement
(*Deploy keys*) en contournement :

- **`main`** : historique linéaire, contrôles **Qualité** et **Tests**
  obligatoires (le commit doit les avoir passés sur `develop`), ni force push
  ni suppression.
- **`develop`** : historique linéaire, ni force push ni suppression.

Les commits de fusion sont désactivés dans les réglages du dépôt : seuls
*squash* et *rebase* restent proposés.

Sans `SYNC_DEPLOY_KEY`, la synchronisation pousse avec `GITHUB_TOKEN` (refusé si
`main` est protégée) et appelle elle-même le déploiement et l'alignement.

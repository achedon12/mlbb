# MLBB

Une base de connaissances francophone sur **Mobile Legends: Bang Bang** : le
roster complet, des fiches heros verifiees, une tier list argumentee, les
objets, les emblemes, les sorts de combat, des guides et les resumes de patch.

Le parti pris tient en une phrase : **rien n'est publie qui n'ait ete verifie**.
Un heros sans fiche est affiche comme tel, plutot que rempli de valeurs
approximatives.

En ligne : <https://mlbb.leoderoin.fr>

---

## Demarrage

```bash
npm install
cp .env.example .env.local     # puis renseigner SESSION_SECRET
npm run dev                    # http://localhost:3001
```

`SESSION_SECRET` doit faire au moins 32 caracteres. Pour en generer un :

```bash
openssl rand -hex 32
```

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de developpement sur le port 3001 |
| `npm run build` | Build de production, sortie `standalone` |
| `npm run start` | Sert le build de production sur le port 3001 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sync` | Relit le wiki et regenere `src/data/genere/` |
| `npm run sync -- --images` | Idem, en telechargeant aussi les visuels |

Les visuels et les donnees sont deja dans le depot : `sync` ne sert qu'a les
rafraichir. Renseigner `YOUTUBE_API_KEY` ajoute la recherche des presentations
video officielles ; sans elle, les fiches proposent un lien de recherche.

## Ce que contient le site

- **Roster complet** — tous les heros avec role, position, specialites, annee
  de sortie et difficulte, filtrables.
- **Fiches detaillees** — competences avec recharges et couts, analyse, forces,
  faiblesses, contres dans les deux sens, et builds commentes.
- **Tier list** — courte et argumentee : une justification par entree, pour la
  file classee solo.
- **Objets** — statistiques, passifs, et surtout le moment ou l'objet vaut la
  peine d'etre achete.
- **Emblemes, talents et sorts de combat** — avec le type de heros vise.
- **Skins** — les 1 000 skins du jeu, avec rarete, disponibilite, prix et
  visuel, dans une galerie par heros.
- **Actualites et patch notes** — la liste des patchs est synchronisee ; les
  mises a jour marquantes font l'objet d'une analyse redigee.
- **Veille** — les publications du reste du web sur le jeu, rassemblees
  automatiquement et rafraichies toutes les 30 minutes, sans tache planifiee.
- **Visuels** — portraits, icones et skins sont servis par le site lui-meme.
  Aucune image ne depend d'un domaine tiers.

## D'ou viennent les donnees

| Donnee | Source | Mise a jour |
| --- | --- | --- |
| Heros, skins, objets, patchs, visuels | Wiki communautaire, modules Lua | **Automatique**, chaque lundi |
| Analyses de heros, tier list, emblemes | Redigees a la main | Par pull request |
| Articles et guides | Markdown dans `content/` | Par pull request |
| Veille | Flux publics agreges au rendu | **Automatique**, toutes les 30 min |
| Presentations video | YouTube, si `YOUTUBE_API_KEY` est renseignee | A la synchronisation |

Les donnees factuelles ne s'ecrivent plus a la main. Un workflow relit le wiki
chaque semaine, telecharge les nouveaux visuels et ouvre une pull request quand
quelque chose a change — un nouveau heros apparait donc sans intervention.

Ce qui reste ecrit a la main, c'est ce qu'aucune extraction ne produira : le
commentaire sur un heros, la justification d'un placement en tier list, un
guide.

Moonton ne publie **aucune interface de programmation ni flux officiel** : le
site du jeu est une application dont le contenu n'est pas diffusable. Le wiki
communautaire est la source la plus complete et la plus structuree disponible.

## Ce qu'il ne contient pas

Aucune statistique de joueur. Moonton ne publie aucune interface de
programmation : ni classement, ni indice de competence, ni historique de
parties, ni statut « en partie ». Les sites qui affichent un « MMR » pour ce
jeu l'estiment ; ils ne le lisent nulle part.

La seule information verifiable de l'exterieur est le pseudo associe a un
identifiant de joueur, via l'etape de validation des plateformes de recharge.
C'est exactement ce que fait la liaison de compte, et rien de plus.

## Architecture

```
src/
  app/            Routes (App Router), flux RSS, plan du site, robots
  components/     Composants d'interface
  data/
    genere/       Extrait du wiki — ne pas modifier a la main
    heros/        Analyses redigees, un fichier par role
    tier-list.ts  Classement argumente
  lib/            Types, donnees, contenu, base, sessions, actions
content/
  actualites/     Articles en Markdown
  patch-notes/    Analyses de patch en Markdown
public/
  visuels/heros/  Portraits, icones et skins, ranges par heros
scripts/
  sync.mjs        Synchronisation depuis le wiki
  lua.mjs         Lecture des tables Lua du wiki
```

Les pages de contenu sont **generees au build**. Seules les routes de compte
sont rendues a la demande : l'en-tete ne lit pas la session cote serveur, il
l'interroge apres l'affichage, precisement pour que le reste du site reste
statique.

L'etat persistant se limite a une base SQLite contenant les comptes, les
identifiants de jeu lies et les favoris.

## Deploiement

```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env
docker compose up -d --build
```

Le service ecoute sur `127.0.0.1:3001`, a placer derriere un reverse proxy.
L'image finale ne contient ni sources, ni npm, ni chaine de compilation : le
serveur Next en mode `standalone`, les ressources statiques, et le module
SQLite. Le conteneur tourne sans privileges, en systeme de fichiers en lecture
seule, avec toutes les capacites retirees ; seul `/data` est inscriptible.

## Contribuer

Les donnees se mettent a jour toutes seules. Ce qui manque, ce sont les
**analyses de heros** : sur 133 heros, une minorite a un commentaire redige.
C'est la contribution la plus utile, et elle ne demande pas de connaitre le
reste du projet.

Voir [CONTRIBUTING.md](CONTRIBUTING.md), le
[code de conduite](CODE_OF_CONDUCT.md) et la
[politique de securite](SECURITY.md).

## Mentions

Mobile Legends: Bang Bang, son univers, ses heros, leurs noms et leurs
representations graphiques sont des marques et des oeuvres de **Shanghai
Moonton Technology Co., Ltd.** Ce site est un projet de fan independant, sans
affiliation, ni approbation, ni parrainage de Moonton.

Les visuels presents dans `public/visuels/` proviennent du wiki communautaire
et restent la propriete de Moonton. Ils sont inclus a des fins d'illustration
et d'information. **La licence MIT ci-dessous ne couvre pas ces fichiers**,
mais uniquement le code et les textes rediges pour ce site. Sur demande de
l'ayant droit, ils seront retires.

Les donnees factuelles proviennent du
[wiki Mobile Legends](https://mobilelegends.fandom.com), sous licence
CC BY-SA.

Code et textes sous licence MIT — voir [LICENSE](LICENSE).

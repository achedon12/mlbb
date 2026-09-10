# MLBB

<p>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/qualite.yml"><img alt="Qualite" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/qualite.yml?branch=main&label=qualit%C3%A9&logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/tests.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/tests.yml?branch=main&label=tests&logo=vitest"></a>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/securite.yml"><img alt="Securite" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/securite.yml?branch=main&label=s%C3%A9curit%C3%A9&logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/docker.yml"><img alt="Image Docker" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/docker.yml?branch=main&label=docker&logo=docker"></a>
</p>
<p>
  <a href="https://github.com/achedon12/mlbb/issues"><img alt="Issues" src="https://img.shields.io/github/issues/achedon12/mlbb?logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/pulls"><img alt="Pull requests" src="https://img.shields.io/github/issues-pr/achedon12/mlbb?logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/commits/main"><img alt="Dernier commit" src="https://img.shields.io/github/last-commit/achedon12/mlbb?logo=git&label=dernier%20commit"></a>
  <a href="https://github.com/achedon12/mlbb/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/achedon12/mlbb?style=flat&logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/network/members"><img alt="Forks" src="https://img.shields.io/github/forks/achedon12/mlbb?style=flat&logo=github"></a>
</p>
<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="Taille du code" src="https://img.shields.io/github/languages/code-size/achedon12/mlbb?logo=github">
  <img alt="Langage" src="https://img.shields.io/github/languages/top/achedon12/mlbb?logo=typescript">
</p>

Une base de connaissances francophone sur **Mobile Legends: Bang Bang** : le
roster complet, des fiches heros verifiees, une tier list argumentee, les
objets, les emblemes, les sorts de combat, des guides et les resumes de patch.

Le parti pris tient en une phrase : **rien n'est publie qui n'ait ete verifie**.
Un heros sans fiche est affiche comme tel, plutot que rempli de valeurs
approximatives.

En ligne : <https://mlbbdex.com>

---

## Demarrage

```bash
npm install
cp .env.example .env.local
npm run dev                    # http://localhost:3001
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
- **Compte connecte** — connexion par le code de verification officiel du jeu,
  puis profil, rang reel (embleme, division, etoiles, paliers mythiques) et
  liste d'amis. Aucun mot de passe, aucun etat conserve.
- **Visuels** — portraits, icones et skins sont servis par le site lui-meme.
  Aucune image ne depend d'un domaine tiers.

## D'ou viennent les donnees

| Donnee | Source | Mise a jour |
| --- | --- | --- |
| Heros, skins, objets, patchs, visuels | Wiki communautaire, modules Lua | **Automatique**, chaque lundi |
| Taux de victoire, contres chiffres, classement, emblemes de rang | API communautaire `arena.rone.dev` | **Automatique**, chaque lundi |
| Analyses de heros, tier list, emblemes | Redigees a la main | Par pull request |
| Articles et guides | Markdown dans `content/` | Par pull request |
| Veille | Flux publics agreges au rendu | **Automatique**, toutes les 30 min |
| Presentations video | YouTube, si `YOUTUBE_API_KEY` est renseignee | A la synchronisation |

Les donnees factuelles ne s'ecrivent plus a la main. Un workflow relit chaque
semaine les deux sources — le wiki pour le catalogue, l'API communautaire pour
les mesures (taux de victoire, contres, classement, emblemes de rang) —
telecharge les nouveaux visuels et ouvre une pull request quand quelque chose a
change. Un nouveau heros apparait donc sans intervention.

Ce qui reste ecrit a la main, c'est ce qu'aucune extraction ne produira : le
commentaire sur un heros, la justification d'un placement en tier list, un
guide.

Moonton ne publie **aucune interface de programmation ni flux officiel** : le
site du jeu est une application dont le contenu n'est pas diffusable. Le wiki
communautaire fournit le catalogue ; une API communautaire relaie ce que le jeu
expose encore par ailleurs — taux de victoire, contres, classement.

## Le compte connecte

On se connecte avec le **flux officiel de Moonton** : le jeu envoie un code de
verification dans la messagerie du joueur, et ce code prouve qu'on possede le
compte. Aucun mot de passe n'est demande ; le site ne recoit qu'un jeton
temporaire, range dans un cookie httpOnly. Une fois connecte, la page compte
affiche le profil (pseudo, niveau, pays, avatar), le **rang reel** — embleme
officiel, division et etoiles, jusqu'aux paliers mythiques — et la liste
d'amis.

## Ce qu'il ne contient pas

Aucune statistique de partie. Le sous-systeme de Moonton qui les exposait est
**hors ligne** : ni taux de victoire personnel, ni historique de parties, ni
heros les plus joues. Aucun « MMR » non plus — les sites qui en affichent un
l'estiment ; il ne se lit nulle part. Ce qui reste accessible pour un compte
connecte est ce que decrit la section ci-dessus, et rien de plus.

## Architecture

```
src/
  app/            Routes (App Router), flux RSS, plan du site, robots
  components/     Composants d'interface
  data/
    genere/       Extrait du wiki et de l'API — ne pas modifier a la main
    heros/        Analyses redigees, un fichier par role
    tier-list.ts  Classement argumente
  lib/            Types, donnees, contenu, rangs, sessions, actions
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

Le site n'a **aucun etat a conserver**. L'identite vient du jeu : on se
connecte avec le code de verification officiel de Moonton, et le site ne recoit
qu'un jeton temporaire, range dans un cookie httpOnly. Les favoris vivent dans
le navigateur. Ni base de donnees, ni table de sessions.

## Deploiement

```bash
docker compose up -d --build
```

Le service ecoute sur `127.0.0.1:3001`, a placer derriere un reverse proxy.
L'image finale ne contient ni sources, ni npm, ni chaine de compilation :
seulement le serveur Next en mode `standalone`, les ressources statiques et le
module de rendu. Le conteneur tourne sans privileges, en systeme de fichiers en
lecture seule, avec toutes les capacites retirees ; il n'a aucun volume a
conserver, le site ne gardant aucun etat.

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

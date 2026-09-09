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
- **Actualites et patch notes** — en Markdown, publies aussi en RSS.

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
  data/           Donnees du jeu, typees
    heros/        Fiches detaillees, un fichier par role
    roster.ts     Roster complet
  lib/            Types, contenu, base, sessions, actions serveur
content/
  actualites/     Articles en Markdown
  patch-notes/    Resumes de patch en Markdown
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

Les fiches heros sont des fichiers TypeScript types, les articles des fichiers
Markdown : on peut completer une fiche ou corriger une erreur d'equilibrage
sans connaitre le reste du projet. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Mentions

Mobile Legends: Bang Bang, son univers, ses heros et leurs noms sont des
marques deposees de **Shanghai Moonton Technology Co., Ltd.** Ce site est un
projet de fan independant, sans affiliation, ni approbation, ni parrainage de
Moonton. Aucune ressource graphique du jeu n'est redistribuee ici.

Code sous licence MIT — voir [LICENSE](LICENSE).

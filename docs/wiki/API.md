# API publique

MLBBDex expose ses données en JSON, en lecture seule et sans clé : de quoi
construire un bot Discord, un tableau de bord ou un autre site sans refaire
l'extraction.

- **Base** : `https://mlbbdex.com`
- **Méthodes** : `GET` (et `OPTIONS` pour le CORS)
- **Sur le site** : la même documentation, avec des exemples cliquables, sur
  [mlbbdex.com/fr/api-doc](https://mlbbdex.com/fr/api-doc)

## Routes

| Route | Contenu | Paramètres |
| --- | --- | --- |
| `GET /api/v1/heros` | Le roster : fiche résumée de chaque héros (rôles, positions, notes, compétences…) | `role` : Tank, Fighter, Assassin, Mage, Marksman, Support · `lane` : Or, Jungle, Milieu, Experience, Roam |
| `GET /api/v1/heros/{slug}` | La fiche complète d'un héros : statistiques de base, notes, compétences, skins… | — |
| `GET /api/v1/objets` | Le catalogue des objets : prix, bonus, passif, actif, recette | `categorie` : Attack, Magic, Defense, Movement, Jungling, Roaming |
| `GET /api/v1/patchs` | La liste des patch notes, avec le lien vers chacune | — |
| `GET /api/v1/classement` | La tier list calculée : palier, taux de victoire, de ban et de sélection, score | — |
| `GET /api/sante` | Contrôle de santé du service (`{ "etat": "ok" }`) | — |

Exemples :

```sh
curl "https://mlbbdex.com/api/v1/heros?role=Tank&lane=Roam"
curl "https://mlbbdex.com/api/v1/heros/khufra"
curl "https://mlbbdex.com/api/v1/objets?categorie=Defense"
```

Les paramètres se combinent : `?role=Tank&lane=Roam` renvoie les tanks joués
en roam.

## Format des réponses

Chaque réponse enveloppe ses données de la même façon :

```json
{
  "donnees": [],
  "total": 18,
  "source": {
    "nom": "Mobile Legends Wiki",
    "url": "https://mobilelegends.fandom.com",
    "licence": "CC BY-SA"
  }
}
```

- `donnees` — un tableau pour une liste, un objet pour une fiche. Pour
  `/api/v1/classement`, un objet `{ mesureLe, heros }` : `mesureLe` date le
  relevé des taux, distinct de la synchronisation.
- `total` — présent sur les listes : le nombre d'éléments renvoyés.
- `source` — l'origine des données et leur licence, reprise dans l'en-tête
  `X-Data-License`.

Un identifiant inconnu (`/api/v1/heros/inconnu`) renvoie `404` et
`{ "erreur": "… introuvable" }`.

## Limites et bon usage

- **Débit** : 90 requêtes par minute et par adresse IP, en fenêtre fixe.
  Au-delà, la réponse est `429 Too Many Requests`, avec un en-tête
  `Retry-After` en secondes. Le contrôle de santé n'est pas limité.
- **Cache** : `Cache-Control: public, max-age=3600, s-maxage=86400`. Les
  données ne changent qu'à la synchronisation hebdomadaire (voir
  [Données et synchronisation](Donnees-et-synchronisation)) : inutile de les
  interroger plus d'une fois par heure.
- **CORS** : ouvert (`Access-Control-Allow-Origin: *`), l'API s'appelle
  directement depuis un navigateur.
- **Licence** : les données viennent du wiki Mobile Legends, sous licence
  CC BY-SA. Les republier impose de créditer la source et de partager dans
  les mêmes conditions.

## Côté code

Les routes vivent dans `src/app/api/v1/`, l'enveloppe commune dans
`src/lib/api.ts` et la limitation de débit dans `src/proxy.ts`. Une nouvelle
route passe par `reponseApi()` pour hériter du format, du cache et du crédit
de la source.

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
| `npm run sync` | Relit les sources et régénère `src/data/genere/` |
| `npm run sync -- --images` | Idem, en téléchargeant aussi les visuels en local |
| `npm run traduire` | Traduit en français les histoires et les compétences |

## Ce que produit la synchronisation

`src/data/genere/` : `heros.json`, `skins.json`, `objets.json`, `patchs.json`,
`patchs-detail.json`, `competences.json`, `contres.json`, `classement.json`,
`histoires.json`, `modes.json`, `rangs.json`, et les tables de visuels.

## En intégration continue

Le workflow **Synchronisation** rejoue le scraping périodiquement et ouvre une PR
avec les données rafraîchies : c'est la seule automatisation qui touche au réseau.

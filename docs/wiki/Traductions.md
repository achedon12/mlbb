# Traductions

Le wiki et l'API ne publient qu'en anglais. MLBBDex traduit ces contenus **une fois**,
au moment de la synchronisation, puis met le résultat en cache.

## Fonctionnement

- `scripts/traduction.mjs` — un traducteur à cache. Il traduit par lots, met chaque
  phrase en cache dans `scripts/traductions.json` (dictionnaire anglais → français,
  versionné), et n'y revient jamais.
- `scripts/traduire-histoires.mjs` — traduit `histoires.json` (accroche, récit, fiche,
  anecdotes).
- `scripts/traduire-competences.mjs` — traduit les descriptions de compétences. Le
  **nom** du sort garde sa forme officielle du jeu.

## Lancer une traduction

```bash
npm run traduire
```

Comme le cache est versionné, une phrase déjà traduite ne repart jamais sur le réseau :
seules les nouveautés d'une synchronisation sont traduites.

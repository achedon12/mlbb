# Architecture

## Tech stack

- **Next.js 16** (App Router), **React 19**: content pages generated at build time (static).
- **Tailwind CSS v4**: token-based theme (`@theme`), bevelled corners borrowed from the game.
- **TypeScript** end to end.
- **Docker**: self-contained production image (`output: standalone`).

## Guiding principle: everything local

The site's content depends on **no external URL at runtime**. Every piece of
data and every image is copied into the repository:

- factual data lives in `src/data/jeu/` (JSON);
- visuals live in `public/visuels/`.

The only scripts allowed are the ones that **fetch** this data (see
[Data and sync](Data-and-sync)); they run outside the site, locally or in CI,
and their output is committed. The one exception is the signed-in account
area: profile, rank and friends are read live from Moonton, through the
community API.

## Code layout

```
src/
  app/            Pages (App Router): heroes, tier list, items, modes, patch notes, tools…
  components/     UI components
  i18n/           Languages, message catalogues, translation helpers
  lib/            Data access (donnees.ts), types, utilities
  data/
    jeu/          Extracted data (heroes, visuals, statistics, patches…)
    heros/        Hand-written analyses (builds, counters, commentary)
content/          Articles in Markdown, one folder per language
scripts/          Data fetching and translation (see the dedicated page)
public/visuels/   Images copied locally
```

## Two separate data origins

1. **Factual** (heroes, skins, items, patches, lore): extracted automatically
   into `src/data/jeu/`. Never edited by hand: the next sync would overwrite it.
2. **Editorial** (analysis, builds, annotated counters): written by hand in
   `src/data/heros/`, layered on top of the factual data through the hero's `slug`.

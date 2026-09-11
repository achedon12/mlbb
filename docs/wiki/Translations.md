# Translations

The site is available in **English (en, the default language), French (fr),
Italian (it) and Spanish (es)**. Nothing is translated at runtime: everything is
translated **once**, by hand or in CI, then committed and cached. The
application only reads static catalogues and data, per language.

## What gets translated

- **The interface**: `src/i18n/messages/fr.json` is the source catalogue;
  `en.json`, `it.json` and `es.json` are derived from it.
- **Content data**: lore, skills, game modes and tier list notes (French
  source), items, patch notes and skill combos (English source), in
  `src/data/jeu/<dataset>/<language>.json`.
- **Articles**: `content/fr/<section>/*.md` → `content/<language>/…` (title,
  standfirst and body; Markdown markers are preserved).

## Scripts

- `scripts/traduire-messages.mjs`: the interface catalogue. `{variables}`,
  `code` and the URLs of Markdown links are protected before translation.
- `scripts/traduire-donnees.mjs`: content data. Each dataset declares its
  source language, and the other three are derived from it.
  `node scripts/traduire-donnees.mjs patchs combos` only processes the named
  datasets.
- `scripts/traduire-articles.mjs`: Markdown articles.

Every script caches its sentences (`scripts/traductions-messages.json` for the
interface, `scripts/traductions-donnees.json` for data and articles; keyed by
language and text, committed): a sentence already translated never goes back
over the network.

## Running a translation

```bash
npm run traduire
```

This shortcut chains the three scripts. Since the cache is committed, only new
text gets translated. The weekly full sync (CI, every Monday) runs it
automatically.

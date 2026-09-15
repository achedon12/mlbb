# Translations

The site is available in **English (en, the default language), French (fr),
Italian (it), Spanish (es) and Indonesian (id)**. Nothing is translated at
runtime: everything is translated **once**, by hand or in CI, then committed
and cached. The application only reads static catalogues and data, per
language.

The list of languages lives in one place, `LOCALES` in `src/i18n/config.ts`.
The routes, `hreflang`, the sitemap, the language picker and the translate
scripts all derive from it (the scripts read that array from the file).

## What gets translated

- **The interface**: `src/i18n/messages/fr.json` is the source catalogue;
  every other `src/i18n/messages/<language>.json` is derived from it.
- **Content data**: lore, skills, game modes and tier list notes (French
  source), items, patch notes and skill combos (English source), in
  `src/data/game/<dataset>/<language>.json`. Advance Server notes (English
  source) are translated by `scripts/advance-server.mjs`.
- **Articles**: `content/fr/<section>/*.md` → `content/<language>/…` (title,
  standfirst and body; Markdown markers are preserved).

## Scripts

- `scripts/translate-messages.mjs`: the interface catalogue. `{variables}`,
  `code` and the URLs of Markdown links are protected before translation; a
  message whose protected parts do not come back intact is left untranslated
  (and reported) rather than cached broken.
- `scripts/translate-data.mjs`: content data. Each dataset declares its
  source language, and the other languages are derived from it.
  `node scripts/translate-data.mjs patches combos` only processes the named
  datasets.
- `scripts/translate-articles.mjs`: Markdown articles.
- `scripts/advance-server.mjs --translation-only`: translates the saved
  Advance Server data without calling the wiki.

Every script accepts `--locale id` (repeatable, or comma separated) to only
produce the named languages, for example when adding one: a language can be
translated before it is added to `LOCALES`.

Every script caches its sentences (`scripts/translations-messages.json` for the
interface, `scripts/translations-data.json` for data and articles; keyed by
language and text, committed): a sentence already translated never goes back
over the network.

## Game vocabulary and hand corrections

- `scripts/translation-glossary.mjs` holds per-language game vocabulary applied
  to the output (not to the cache). Indonesian players keep most MOBA terms in
  English ("hero", "skin", "build", "counter", "win rate", "Gold Lane"), which
  the service would otherwise translate literally. Hero stories are left out.
- `scripts/translations-messages-overrides.json` holds hand corrections of the
  interface, per language and message key, together with the French text they
  correct. They win over the machine translation and survive reruns; when the
  French text changes, the correction is ignored with a warning, so it can be
  reviewed.

## Running a translation

```bash
npm run translate
```

This shortcut chains the three scripts. Since the cache is committed, only new
text gets translated. The weekly full sync (CI, every Monday) runs it
automatically.

## Adding a language

1. Translate first: `npm run translate:messages -- --locale xx`, then
   `translate:data` and `translate:articles` with the same option, and
   `node scripts/advance-server.mjs --translation-only --locale xx`.
2. Add the code to `LOCALES` in `src/i18n/config.ts`, then follow the type
   checker: every `Record<Locale, …>` table (language name, `lang` code, Open
   Graph locale, error page texts, server time examples) needs its entry, and
   `src/lib/data.ts`, `src/lib/advance-server.ts` and
   `src/i18n/translations.ts` import the new files.
3. Outside the type checker: the service worker's offline table
   (`public/sw.js`), the smoke check's locale list
   (`scripts/smoke-check-rules.mjs`) and the catalogue tests.

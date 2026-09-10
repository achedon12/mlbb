# Traductions

Le site est disponible en **anglais (en, langue par défaut), français (fr), italien (it)
et espagnol (es)**. Aucune traduction n'a lieu à l'exécution : tout est traduit **une
fois**, à la main ou en CI, puis versionné et mis en cache. L'application ne lit que des
catalogues et des données statiques, par langue.

## Ce qui est traduit

- **L'interface** — `src/i18n/messages/fr.json` est le catalogue source ; on en dérive
  `en.json`, `it.json` et `es.json`.
- **Les données de contenu** — histoires, compétences, modes de jeu, notes de tier list
  (source française) et objets (source anglaise), dans `src/data/jeu/<jeu>/<langue>.json`.
- **Les articles** — `content/fr/<section>/*.md` → `content/<langue>/…` (titre, chapeau
  et corps ; les marqueurs Markdown sont préservés).

## Scripts

- `scripts/traduire-messages.mjs` — catalogue d'interface. Les `{variables}`, le `code`
  et l'URL des liens Markdown sont mis à l'abri avant traduction.
- `scripts/traduire-donnees.mjs` — données de contenu ; chaque jeu déclare sa langue
  source et on en dérive les trois autres.
- `scripts/traduire-articles.mjs` — articles Markdown.

Chaque script met les phrases en cache (`scripts/traductions-messages.json` et
`scripts/traductions-donnees.json`, clef langue+texte, versionnés) : une phrase déjà
traduite ne repart jamais sur le réseau.

## Lancer une traduction

```bash
npm run traduire
```

Ce raccourci enchaîne les trois scripts. Comme le cache est versionné, seules les
nouveautés sont traduites. La synchronisation hebdomadaire (CI) l'exécute automatiquement.

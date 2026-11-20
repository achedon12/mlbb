# Histoires des héros, relues à la main

Un fichier par héros : `<slug>.json` (slug de `src/data/game/heroes.json`), mêmes clés que son entrée dans `src/data/game/stories/fr.json` : `tagline`, `lore` (paragraphes), `headings` (index des intertitres dans `lore`), `profile` (`fullName`, `title`, `species`, `gender`, `age`, `origin`, `birthday`, `affiliations`, `relations`, `powers`), `trivia`.
Une clé présente remplace la traduction automatique, une clé absente la garde ; `profile` se fusionne champ par champ.
`affiliations` et `relations` gardent le nombre et l'ordre des lignes anglaises, au format « Nom (nature) ».
Si `lore` change de découpage, donner aussi `headings`.
Traduire depuis `stories/en.json`, jamais depuis la sortie automatique. Lu au rendu des pages : visible dès le prochain déploiement, sans attendre la synchro.
Vérifier : `npx vitest run tests/unit/lore-overrides.test.ts`.

# MLBBDex wiki

**MLBBDex** is a knowledge base for *Mobile Legends: Bang Bang*, in English,
French, Italian and Spanish: full roster, verified hero pages, reasoned tier
list, items, emblems, hero lore, game modes and patch notes.

Live: <https://mlbbdex.com> · Code: <https://github.com/achedon12/mlbb>

> The approach fits in one sentence: **nothing is published unless it has been verified**.
> A hero without a write-up is shown as such, rather than filled with approximate values.

## Contents

- **[Architecture](Architecture)**: the tech stack and how the code is organized.
- **[Data and sync](Data-and-sync)**: where the data comes from, how it is refreshed, branches, CI and deployment.
- **[API](API)**: the public JSON routes, their format and their limits.
- **[Translations](Translations)**: how content reaches the site's four languages.
- **[Contributing](Contributing)**: write an analysis, fix a data point, open a pull request.
- **[FAQ](FAQ)**: recurring questions.

## At a glance

| | |
| --- | --- |
| Framework | Next.js 16 (App Router) · React 19 |
| Styling | Tailwind CSS v4 |
| Languages | English (default), French, Italian, Spanish |
| Data | extracted from the Fandom wiki + community API, **committed** to the repository |
| Deployment | self-contained Docker image (`output: standalone`) |
| Analytics | Matomo, cookieless |

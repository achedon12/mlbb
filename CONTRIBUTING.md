# Contributing

Every contribution is welcome. The most useful one, by far: **writing the
analysis of a hero who does not have one yet**.

## How the project is organized

Two kinds of data, which must not be confused.

| | Where | Who writes it |
| --- | --- | --- |
| **Factual data**: heroes, skins, items, patches, visuals | `src/data/jeu/`, `public/visuels/` | Nobody: `npm run sync` extracts it from the wiki and the stats API |
| **Analysis**: commentary, written skills, counters, builds | `src/data/heros/` | You |
| **Articles**: guides, news, patch notes | `content/fr/` | You |
| **Tier list notes, emblems** | `src/data/tier-list.ts`, `src/data/emblemes.ts` | You |

> **Never edit `src/data/jeu/` or `public/visuels/` by hand.**
> The next sync will overwrite your changes. If some game data is wrong, it
> comes from the wiki: fixing it there solves the problem for everyone, for
> good.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev                    # http://localhost:3001
```

The data and the visuals are already in the repository: nothing to sync before
you start working.

## Writing a hero analysis

The full guide (every field explained, the annotated template, the style rules
and the review) is also online, in the site's four languages:
[mlbbdex.com/en/contribute](https://mlbbdex.com/en/contribute).

1. Copy the **exact** `slug` from `src/data/jeu/heros.json`.
2. Open the role file in `src/data/heros/` (`tanks.ts`, `fighters.ts`,
   `assassins.ts`, `mages.ts`, `marksmen.ts`, `supports.ts`).
3. Copy the annotated template [`docs/modele-analyse.ts`](docs/modele-analyse.ts)
   to the end of the list, fill it in, then remove its comments. The template
   follows the `AnalyseHeros` type from `src/lib/types.ts`: `npm run typecheck`
   checks it on every run, so it cannot go stale.

Do not add the role, lane, release date or difficulty: all of that already
comes from the sync.

### Style rules

- **Analyses are written in French**, with their accents: this is text shown to
  visitors, not code.
- **Game terms stay in English**: items, skills, talents and spells keep the
  name players see in a match ("Winter Crown", "Flicker").
- **Nothing copied**: not from the wiki, a guide or a video. An analysis taken
  from elsewhere, even closely reworded, is rejected.

### What makes a good analysis

- **`resume`**: one sentence. It is also used as the meta description.
- **`analyse`**: two paragraphs separated by a blank line: what the hero
  actually does, then their limits. No superlatives. "He is strong" is not an
  analysis; "he wins long fights as long as the enemy does not buy healing
  reduction" is.
- **`competences`**: the description, the cooldowns and the cost. **The name
  is no longer displayed**: it comes from the wiki, in the game's language, so
  that readers recognize the skill in a match. Keep the order passive, skill 1,
  skill 2, ultimate: that order is what matches your description to the right
  skill. Do not copy damage values: they change almost every patch.
- **`fortContre` / `faibleContre`** (strong against / weak against): `slug`s,
  not names.
- **`builds`**: the `contexte` field explains *when* to pick the build. A build
  without context teaches nobody anything.

## Writing an article

A Markdown file in `content/fr/actualites/` (news) or `content/fr/patch-notes/`,
named `YYYY-MM-DD-title-as-slug.md`. The date is used for sorting and is dropped
from the URL. `npm run traduire` produces the English, Italian and Spanish
versions.

```markdown
---
titre: "Article title"
date: "2026-09-09"
categorie: "Guide"        # Actualite | Patch | Esport | Guide
auteur: "your-username"
chapeau: "A one-sentence summary, reused as the meta description and in the RSS feed."
motsCles: ["keyword", "another"]
---

The article body, in Markdown.
```

## Editing the tier list

The ranking itself is not written by hand: it is computed from the win and ban
rates reported by the game, and updated at every sync (`src/lib/tier-list.ts`).
What you write is the note for a hero in `notesTierList`
(`src/data/tier-list.ts`): what the numbers do not say, *why* the hero sits
where they do at the current patch. A note is optional; a hero without one is
shown with their numbers only.

**A note without an argument is not accepted.**

## Running a sync

It runs by itself every night (full sync on Mondays) and pushes its data
straight to production. To run it by hand:

```bash
npm run sync -- --images
```

## Branches

- `develop`: ongoing work. **Every pull request targets it**, and is merged by
  *rebase* or *squash*: never a merge commit.
- `main`: production, deployed on every push. To publish, once CI is green on
  `develop`: `git push origin develop:main` (fast-forward only), or the
  **Publier en production** (publish to production) button in *Actions*.

```bash
git switch develop && git pull --rebase
git switch -c my-contribution
# ... commits ...
git push -u origin my-contribution   # then a pull request to develop
```

The sync data lands on `main` every night and is carried over to `develop`,
which is replayed on top of it if needed: always pull it with
`git pull --rebase` (or `git config pull.rebase true`, once and for all).

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All of them must pass: the automated checks will run them again anyway, along
with the browser tests (`npm run test:e2e`).

A few automations then follow the pull request:

- it fails automatically if it changes `src/data/jeu/` or `public/visuels/`,
  which the sync regenerates;
- if it conflicts with its target branch, it gets the `conflit` label: rebase
  it;
- if changes are requested, it goes back to draft with the `à corriger` label;
  mark it "Ready for review" again once it is fixed, and it gets the `à relire`
  label.

## Review

Every contribution goes through a pull request on GitHub. It can only be
merged once the tests pass and after approval from the repository owner, who
reviews both substance and form: accuracy at the current patch, style,
originality. If something needs to change, they say so in a comment on the
pull request; once merged, the analysis goes live at the next release to
production.

Commit messages are in English, in the imperative: "Add the Ling analysis",
"Fix Khufra's cooldown".

## Style

The site was written in French first: the interface catalogue and the analyses
start in French, and so do code comments. Comments explain **why**, not
**what**. If a comment paraphrases the next line, it is better removed.

A note on accents: code comments are written without accents, for consistency
with the existing code. Text shown to visitors keeps its accents.

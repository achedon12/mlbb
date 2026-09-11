# Data and sync

All data is **committed** to the repository. The scripts only **refresh** it:
they run on demand (or in CI), then their output is committed.

## Sources

- **Fandom wiki** (`mobilelegends.fandom.com`): roster, skills, skins, items,
  patch notes, hero lore, game modes.
- **Community API** (`arena.rone.dev`): statistics (win rates, counters),
  fallback skill icons, lore teasers.

> The sync collects no player's match statistics: Moonton does not publish them.

## Commands

| Command | What it does |
| --- | --- |
| `npm run sync` | Re-reads the sources and regenerates `src/data/jeu/` |
| `npm run sync -- --images` | Same, and also downloads the visuals locally |
| `npm run sync:evolution` | Measurements only: trends, teammates, game lengths, history |
| `node scripts/sync.mjs --combos` | Skill combos only (`combos.json`) |
| `npm run traduire` | Translates the interface, content data and articles (see [Translations](Translations)) |
| `npm run veille` | Snapshot of the Watch page feeds (`veille.json`) |

## What the sync produces

`src/data/jeu/`: `heros.json`, `skins.json`, `objets.json`, `competences.json`,
`patchs.json` (list and detail), `statistiques.json` (ranking, counters,
builds, guides, teammates, relations), `histoires.json`, `modes.json`,
`rangs.json`, `noms.json`, `evolution.json`, `combos.json`, `duos.json`,
`visuels.json` (the visuals tables) and `synchro.json` (the run's timestamp).
`npm run veille` writes `veille.json`, and `npm run traduire` writes the
per-language versions (`histoires/`, `competences/`, `modes/`, `objets/`,
`patchs/`, `combos/`, `tier-notes/`, one `<language>.json` each).

The long history (`evolution.json`, key `historique`) keeps the last 90 days
day by day; older weeks are reduced to their average (under `semaines`), and
the hero page draws them back as one continuous curve.

## In continuous integration

The **Synchronisation des donnees** workflow (`data-sync.yml`) runs every night
at 03:30 UTC: measurements only from Tuesday to Sunday, the full sync on
Monday (which also translates, takes the Watch snapshot and checks that the
site builds). Changed data is committed directly to `main`, the production
branch, and then deployed. An API outage only produces a warning: the previous
measurements and the history are kept.

## Branches and deployment

History is linear: no merge commits. `main` only ever moves forward by
fast-forward, and so does `develop`, except when **Aligner develop** replays it
on top of `main` (see below).

- `develop` is ongoing work: pull requests target it (merged by *rebase* or
  *squash*), tests run on it, nothing is deployed from it.
- `main` is production: every push to it triggers the **Image Docker**
  workflow (`docker.yml`), which builds the image, then deploys. To publish,
  move `main` up to `develop` once **Qualite** and **Tests** are green on
  `develop`:

  ```bash
  git push origin develop:main
  ```

  or use the **Publier en production** button (`publish.yml`, *Actions* tab),
  which does the same after checking CI. GitHub rejects any push to `main` that
  is not a fast-forward, or whose commit has not passed CI.
- The sync pushes its data to `main` every night, then **Aligner develop**
  (`align-develop.yml`) carries it over to `develop`: a fast-forward if
  `develop` has nothing new, otherwise its unpublished commits are replayed on
  top of `main` (rebase). Locally, pull `develop` with `git pull --rebase`.
- Sync, publishing and alignment push with the deploy key `SYNC_DEPLOY_KEY`,
  the only one allowed to bypass the protections.

Deployment goes over SSH: the server pulls `main`, then runs
`docker compose up -d --build`. It stays inactive until these repository
settings are filled in (*Settings → Secrets and variables → Actions*):

| Name | Type | Content |
| --- | --- | --- |
| `DEPLOY_HOST` | variable | Server host |
| `DEPLOY_USER` | variable | SSH user, member of the `docker` group |
| `DEPLOY_PATH` | variable | Folder of the repository clone on the server |
| `DEPLOY_PORT` | variable | SSH port (22 by default) |
| `DEPLOY_SSH_KEY` | secret | Private key authorized on the server |
| `DEPLOY_KNOWN_HOSTS` | secret | Server fingerprint (`ssh-keyscan -p <port> <host>`, checked by hand) |
| `SYNC_DEPLOY_KEY` | secret | Private key of a repository deploy key, with write access |

Protections (*Settings → Rules → Rulesets*), with the deploy key
(*Deploy keys*) allowed to bypass them:

- **`main`**: linear history, required **Qualite** and **Tests** checks (the
  commit must have passed them on `develop`), no force push, no deletion.
- **`develop`**: linear history, no force push, no deletion.
- **`pull-requests`** (on both branches): every pull request must pass
  **Qualite** and **Tests** and be approved by the repository owner, declared
  in `.github/CODEOWNERS`; a new commit dismisses the approval. The owner
  bypasses this rule to push directly.

Merge commits are disabled in the repository settings: only *squash* and
*rebase* remain available.

Without `SYNC_DEPLOY_KEY`, the sync pushes with `GITHUB_TOKEN` (rejected if
`main` is protected) and calls the deployment and the alignment itself.

## Workflows

The names are the ones shown in the *Actions* tab.

| Workflow | File | Runs on | What it does |
| --- | --- | --- | --- |
| Qualite | `quality.yml` | pushes to `main` and `develop`, pull requests | Lint, type check, build, and checks that the generated data is present |
| Tests | `tests.yml` | pushes to `main` and `develop`, pull requests | Unit and functional tests (Vitest), browser tests (Playwright, Chromium) on a production build |
| Securite | `security.yml` | pushes to `main` and `develop`, pull requests, every Monday | Code analysis with CodeQL, dependency audit with `npm audit` |
| Image Docker | `docker.yml` | pushes to `main`, pull requests touching the image | Builds the image; on `main`, deploys over SSH |
| Synchronisation des donnees | `data-sync.yml` | every night, manual | Nightly sync, see above |
| Aligner develop | `align-develop.yml` | pushes to `main`, called by the sync, manual | Carries `main` over to `develop` |
| Publier en production | `publish.yml` | manual | Fast-forwards `main` to `develop` after checking CI |
| Workflows | `workflow-audit.yml` | changes under `.github/` | Audits the workflows themselves: actionlint (syntax, expressions, shell) and zizmor (security) |
| Fichiers generes | `generated-files.yml` | pull requests | Fails if a pull request touches `src/data/jeu/` or `public/visuels/` |
| Conflits | `merge-conflicts.yml` | pushes to `main` and `develop`, pull request updates | Labels conflicting pull requests `conflit`, with a comment asking for a rebase |
| Revue | `review.yml` | reviews, labels, "Ready for review" | Changes requested: back to draft with `à corriger`; ready for review again: `à relire` |
| Bienvenue | `welcome.yml` | a contributor's first pull request to `develop` | A welcome message when it is opened, a thank-you when it is merged |
| Issues inactives | `stale-issues.yml` | every day, manual | Labels issues `inactif` after two months without activity and closes them two weeks later; issues labelled bug, enhancement, donnees, accessibility, good first issue or help wanted, and pull requests, are never affected |

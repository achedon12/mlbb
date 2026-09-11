# MLBB

<p>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/quality.yml"><img alt="Quality" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/quality.yml?branch=main&label=quality&logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/tests.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/tests.yml?branch=main&label=tests&logo=vitest"></a>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/security.yml"><img alt="Security" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/security.yml?branch=main&label=security&logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/actions/workflows/docker.yml"><img alt="Docker image" src="https://img.shields.io/github/actions/workflow/status/achedon12/mlbb/docker.yml?branch=main&label=docker&logo=docker"></a>
</p>
<p>
  <a href="https://github.com/achedon12/mlbb/issues"><img alt="Issues" src="https://img.shields.io/github/issues/achedon12/mlbb?logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/pulls"><img alt="Pull requests" src="https://img.shields.io/github/issues-pr/achedon12/mlbb?logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/achedon12/mlbb?logo=git&label=last%20commit"></a>
  <a href="https://github.com/achedon12/mlbb/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/achedon12/mlbb?style=flat&logo=github"></a>
  <a href="https://github.com/achedon12/mlbb/network/members"><img alt="Forks" src="https://img.shields.io/github/forks/achedon12/mlbb?style=flat&logo=github"></a>
</p>
<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="Code size" src="https://img.shields.io/github/languages/code-size/achedon12/mlbb?logo=github">
  <img alt="Language" src="https://img.shields.io/github/languages/top/achedon12/mlbb?logo=typescript">
</p>

A knowledge base for **Mobile Legends: Bang Bang**, in English, French, Italian
and Spanish: the full roster, verified hero pages, tier lists, statistics,
items, emblems, battle spells, skins, lore, guides, patch notes and a set of
tools.

The approach fits in one sentence: **nothing is published unless it has been
verified**. A hero without a write-up is shown as such, rather than filled with
approximate values.

Live: <https://mlbbdex.com>

---

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev                    # http://localhost:3001
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Production build, `standalone` output |
| `npm run start` | Serves the production build on port 3001 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sync` | Re-reads the wiki and the stats API, regenerates `src/data/jeu/` |
| `npm run sync -- --images` | Same, and also downloads the visuals |
| `npm run sync:evolution` | Measurements only: trends, teammates, win rates by game length, history |
| `npm run traduire` | Translates the interface, the content data and the articles into the other languages |
| `npm run veille` | Takes the snapshot of the news feeds shown on the Watch page |
| `npm run test` | Unit and functional tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) |

Visuals and data are already in the repository: `sync`, `traduire` and
`veille` only refresh them, and only ever run locally or in CI, never while the
site is running.

## What the site offers

- **Full roster**: every hero with role, lane, specialties, release year and
  difficulty, filterable.
- **Detailed hero pages**: skills with cooldowns and costs, analysis,
  strengths, weaknesses, counters both ways, annotated builds, builds and
  counters by rank, best duos.
- **Tier lists**: computed from in-game win and ban rates, overall and by rank,
  role and lane, updated at every sync, with hand-written notes on why a hero
  sits where they do.
- **Statistics**: win, pick and ban rates, by rank.
- **Items**: stats, passives, and above all when an item is worth buying.
- **Emblems, talents and battle spells**: with the kind of hero each one suits.
- **Skins**: the game's 1,000+ skins, with rarity, availability, price and
  artwork, in a gallery per hero and a release calendar.
- **Events calendar**: what comes out each month (StarLight, Collector, event,
  shop and pass skins), assembled from the skin catalogue and the wiki's
  monthly lists.
- **Lore and game modes**.
- **News and patch notes**: the patch list is synced; notable updates get a
  written analysis.
- **Watch**: posts about the game from around the web, gathered
  automatically, frozen as a snapshot and refreshed at each sync.
- **Tools**: draft helper, hero comparison, team composition analyzer, tier
  list maker, win-rate calculator, Retribution trainer, daily quiz, MLBBdle
  (guess the day's secret hero from its traits or a skill icon), server time
  and collection value calculator. More tools are being added.
- **Signed-in account**: sign-in with the game's official verification code,
  then profile, actual rank (emblem, division, stars, Mythic tiers) and friends
  list. No password, no stored state.
- **Public API**: read-only JSON routes, without a key. See
  [API](docs/wiki/API.md).
- **Four languages, installable**: English (default), French, Italian and
  Spanish; the site can be installed as a PWA and has an offline page.
- **Visuals**: portraits, icons and skins are served by the site itself. No
  content image depends on a third-party domain.

## Where the data comes from

| Data | Source | Updated |
| --- | --- | --- |
| Heroes, skins, items, patches, visuals | Community wiki, Lua modules | **Automatically**, every Monday |
| Win rates, counters, ranking, rank emblems | Community API `arena.rone.dev` | **Automatically**, every Monday |
| Trends, teammates, win rates by game length | Community API `arena.rone.dev` | **Automatically**, every night |
| Hero analyses, tier list notes, emblems | Written by hand | By pull request |
| Articles and guides | Markdown in `content/` | By pull request |
| Watch | Public feeds, snapshot taken beforehand | **Automatically**, at the Monday sync |

Factual data is no longer written by hand. A workflow re-reads both sources,
the wiki for the catalogue and the community API for measurements (win rates,
counters, ranking, rank emblems): measurements every night, the full catalogue
every Monday. It downloads new visuals and commits whatever changed straight to
`main`, which deploys it. A new hero therefore appears without anyone stepping
in.

What remains hand-written is what no extraction will ever produce: the
commentary on a hero, the reason behind a tier list placement, a guide.

Moonton publishes **no public API and no official feed**: the game's website is
an app whose content cannot be redistributed. The community wiki provides the
catalogue; a community API relays what the game still exposes elsewhere: win
rates, counters, ranking.

## The signed-in account

You sign in with **Moonton's official flow**: the game sends a verification
code to the player's in-game mail, and that code proves you own the account. No
password is asked for; the site only receives a temporary token, stored in an
httpOnly cookie. Once signed in, the account page shows the profile (username,
level, country, avatar), the **actual rank** (official emblem, division and
stars, up to the Mythic tiers) and the friends list.

## Match statistics

They depend on Moonton's battle report service, which is **often offline**.
When it answers, the account page and the player profile add overall figures,
recent matches and the heroes played per season, compared with the site's win
rates at the same rank; when it does not, those sections say so. No "MMR"
either: sites that show one estimate it, since it cannot be read anywhere.

## Architecture

```
src/
  app/            Routes (App Router), API, RSS feeds, sitemap, robots
  components/     UI components
  data/
    jeu/          Extracted from the wiki and the API: never edit by hand
    heros/        Written analyses, one file per role
    tier-list.ts  Hand-written tier list notes
    emblemes.ts   Hand-written emblem data
  i18n/           Languages and interface message catalogues
  lib/            Types, data, content, ranks, sessions, actions
content/
  fr/             Source articles: actualites/ (news) and patch-notes/
  en/ it/ es/     Their translations
public/
  visuels/        Portraits, icons, skins and other game visuals
scripts/
  sync.mjs        Sync from the wiki and the stats API
  lua.mjs         Reads the wiki's Lua tables
  traduire-*.mjs  Translation of the interface, data and articles
  veille.mjs      Snapshot of the Watch page feeds
```

Content pages are **generated at build time**. Only the account routes are
rendered on demand: the header does not read the session on the server, it asks
for it after rendering, precisely so that the rest of the site stays static.

The site has **no state to keep**. Identity comes from the game: you sign in
with Moonton's official verification code, and the site only receives a
temporary token, stored in an httpOnly cookie. Favorites live in the browser.
No database, no sessions table. The one optional exception: patch notification
subscriptions, in a JSON file (see below).

More details in the [project wiki](docs/wiki/Home.md): architecture, data and
sync, branches, CI and deployment, API, translations.

## Deployment

```bash
docker compose up -d --build
```

The service listens on `127.0.0.1:3003` by default (the `PORT` variable; 3001
inside the container) and belongs behind a reverse proxy. The final image
contains no sources and no build toolchain: only the Next server in
`standalone` mode, its static assets and `public/`. The container runs without
privileges, with a read-only filesystem and all capabilities dropped. Two
volumes: the logs (`./logs`) and the named volume `donnees`
(`/app/donnees-serveur`), which keeps notification subscriptions from one
deployment to the next.

In production, every push to `main` deploys automatically over SSH: see
[Data and sync](docs/wiki/Data-and-sync.md).

### Patch notifications (optional)

A visitor can ask, from their favorites or from the bell on a hero page, to be
notified when a patch buffs, nerfs or adjusts one of their favorite heroes. To
enable it:

1. `npx web-push generate-vapid-keys`, once and for all (changing the keys
   invalidates every subscription);
2. in the server's `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (`mailto:…` or `https://…`), and if needed
   `PUSH_ADMIN_TOKEN` (see `.env.example`);
3. `docker compose up -d`: the keys are read at startup, no rebuild needed.

Without these keys, the feature is hidden. Subscriptions (notification service
address, encryption keys, language, favorite slugs) are stored in
`$DONNEES_DIR/push-abonnements.json`, rewritten atomically; the last announced
patch, in `push-etat.json`. At each startup, if the latest patch in the data has
not been announced yet, every subscriber concerned gets a notification, only
once per patch. The very first startup with the keys only records the current
patch, without sending anything.

Test run, sending nothing (dry run, with a preview of the messages):

```bash
curl -X POST https://mlbbdex.com/api/push/envoi -H "Authorization: Bearer $PUSH_ADMIN_TOKEN"
```

The optional JSON body accepts `version`, `envoyer: true` (actually send),
`cible` (a subscriber id read from the dry run, to send to that subscriber
only) and `forcer: true` (resend an already announced patch to everyone).
Backing up the volume:
`docker compose cp mlbb:/app/donnees-serveur ./server-data-backup`.

## Contributing

The data updates itself. What is missing are **hero analyses**: out of 133
heroes, only a minority have written commentary. It is the most useful
contribution, and it does not require knowing the rest of the project.

See [CONTRIBUTING.md](CONTRIBUTING.md), the
[code of conduct](CODE_OF_CONDUCT.md) and the
[security policy](SECURITY.md).

## Notices

Mobile Legends: Bang Bang, its universe, its heroes, their names and their
artwork are trademarks and works of **Shanghai Moonton Technology Co., Ltd.**
This site is an independent fan project, not affiliated with, endorsed or
sponsored by Moonton.

The visuals in `public/visuels/` come from the community wiki and remain the
property of Moonton. They are included for illustration and information.
**The MIT license below does not cover these files**, only the code and the
texts written for this site. They will be removed at the rights holder's
request.

Factual data comes from the
[Mobile Legends wiki](https://mobilelegends.fandom.com), under the
CC BY-SA license.

Code and texts under the MIT license: see [LICENSE](LICENSE).

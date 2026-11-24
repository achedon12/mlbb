# Design system

The rules every page follows. The why is in `docs/design-brief.md`; this file
is the how. Tokens and component classes live in `src/app/globals.css`, the
React pieces in `src/components/ui.tsx`, `hero-tile.tsx` and `brand-mark.tsx`.

## Palette

Only these colours. Tier and rarity colours are information and the only
exception.

| Role | Token | Value |
| --- | --- | --- |
| Night, page ground | `night-950` | `#06080F` |
| Night, surfaces (cards, footer, rail) | `night-900` | `#0B1020` |
| Night, raised (buttons, chips, bands) | `night-800` | `#141B33` |
| Night, lines (derived) | `night-700`, `night-600` | `#1F2847`, `#2E3A5F` |
| MLBB gold: accent, strong titles, figures | `gold-400` | `#F5C451` |
| Gold, dark side (pressed, gradients) | `gold-600` | `#C8901E` |
| Gold, hover light (derived) | `gold-300` | `#FFD87A` |
| Ally blue: buffs, rises, what wins | `azure-400` | `#3D8BFF` |
| Enemy red: nerfs, drops, bans | `blood-400` | `#FF4D4D` |
| Chalk: text | `chalk-100` | `#EEF2FB` |
| Chalk: secondary text | `chalk-400` | `#9AA6C2` |
| Tiers S+ / S / A / B / C | `tier-splus` … `tier-c` | `#FF7A3D` `#F5C451` `#3D8BFF` `#9AA6C2` `#3A4566` |

**The hero accent** is the one other exception, on a hero's page only:
`--hero-accent`, the dominant hue of the hero's official artwork, measured by
`scripts/hero-colors.mjs` into `src/data/hero-colors.json` (run it after a
sync that brings new artwork) and made readable by `src/lib/hero-accent.ts`
(saturation held in a band, lightness raised to 4.5:1 on every night ground,
checked in `tests/unit/hero-accent.test.ts`; the gold without a measure). It
tints the poster's light, the epithet, the lane chips' edge, the gauges and
the focus rings (`.hero-accent` in `globals.css`), nothing else. The colour
is looked up by the path of the artwork the page shows, so a withheld
artwork never lends its colour.

Legacy aliases, so older pages keep working: `emerald-*` is the ally blue
(it always meant "good"), `blurple-*` (Discord) is the ally blue too. New
code uses `azure` and never `emerald` or `blurple`.

## Type

- **Display**: Saira Extra Condensed 800/900, the wordmark's face, slanted
  (the browser slants it: `font-style: italic`), always in capitals. Class
  `display-caps`. Hero names, page and section titles, score figures, the
  wordmark.
- **Headings and labels**: Barlow Condensed 600/700, upright (`font-heading`).
  Card titles, buttons, nav, table headers (in capitals), facts.
- **Figures**: Saira, the wordmark's family, in its real italic (variable
  cut, `wdth` narrowed to 62.5, the extra-condensed width), tabular and
  lining digits (`--font-figure`). `.score` and `.figure` use it: win rates,
  scores, key counts. Digits are Latin, so the figures keep this face on the
  Russian and Thai pages too; letters in a figure fall back to the display
  face of the page's script. Not preloaded: until it arrives the figures
  show in Saira Extra Condensed, almost the same width.
- **Text**: Inter (`font-body`), tabular figures in tables (`tabular-nums`).
- Russian takes Fira Sans Extra Condensed, Thai Chakra Petch, for both
  roles (`:lang()` overrides in `globals.css`).

Fixed scale, nothing in between:

| Level | Class | Size |
| --- | --- | --- |
| Hero name / poster | `type-giant` | `clamp(5rem, 1.5rem + 12vw, 9rem)` |
| Page title | `PageHeader` h1 | `clamp(2.6rem, …, 4.75rem)` |
| Section title | `type-section` (`SectionTitle`) | 2.25–3.5 rem |
| Subtitle | `type-subtitle` | 1.25 rem |
| Text | — | 1 rem |

One `<h1>` per page.

## Signature

1. **The bevel cut** — one rule: top-right and bottom-left corners cut at
   45°, never rounded. `bevel-sm` (0.45 rem), `bevel` (0.75 rem),
   `bevel-lg` (1.75 rem); only the size of the cut changes. A clip-path
   clips borders and outlines: bevelled shapes are filled surfaces, not
   framed ones, and their focus ring is drawn inside.
2. **The poster** (`affiche`) — strong pages open on the official artwork,
   full width, cropped tight, night closing in from the foot. The name is
   `type-giant` and overlaps the art. The art's frame has a fixed height, the
   image is `next/image` with `priority` and real `sizes`.
3. **The score figure** — `Score` (`.score`): display face, gold, very
   large. One per screen. A secondary figure beside it is outlined
   (`outline`, `.score-outline`).
4. **The éclat** — the only luminous effect. `eclat` (a slanted blade, under
   titles), `eclat-rule` (section divider: hairline + blade),
   `eclat-under` (blade under the hovered or active element: tabs, cards;
   active = `aria-current`, `aria-selected="true"` or `.is-active`).
5. **The tier crest** — `BadgeTier` (`.crest`, `data-tier`): a bevelled
   shield coloured by tier, sizes `sm`, `md`, `lg`.

## Components

- **Buttons**: `btn btn-primary` (gold, the one main action of a block),
  `btn btn-secondary` (night with a thin line; `aria-pressed="true"` turns
  it gold), `btn-sm`. Both press in on click.
- **Cards**: `card` (static surface), `card-link` (a link: lifts 2 px on
  hover). `Card` in `ui.tsx` is a `card`.
- **Hero rows**: `HeroTile` — bevelled portrait, the key figure in gold on
  it (blue/red when it carries a direction), the name in the display face
  on the image. Never a caption under the image.
- **Chips / filters**: `Chip` — night fill, gold when active.
- **Section head**: `SectionTitle` (title, éclat, lead, `ActionLink`).
- **Brand**: `BrandMark` renders `/brand/emblem.svg` (the crystal in the winged crest) and the wordmark; it is
  the only place the logo is drawn.
- **Brand kit**: `/brand` repeats this palette and the three typefaces for
  the press (change both together) and serves Dex's poses as PNG, written
  by `scripts/mascot-png.mjs`. It shows the text wordmark only until the
  redrawn logo is validated. Dex's story lives on `/dex`.

## Small states

The waits, empties and confirmations carry the brand too. Never a generic
spinner, a grey rounded skeleton or a bare red line.

- **Wait**: `DexLoading` (`dex-loading.tsx`): Dex hops, one line in his
  voice, a blade sweeps a bevelled track; `lines` adds skeletons, `dex={false}`
  keeps only the line and the blade under a header that already shows Dex.
  A route that awaits real data gets a `loading.tsx` with it, never a route
  that may answer 404 or redirect from a parent segment.
- **Inline wait**: `BrandSpinner` (three slanted blades), in buttons and
  status lines. **Skeleton**: `Skeleton`, a bevelled night shape.
- **Empty or failed**: `DexNote` (whole Dex, bubble) where no Dex is on the
  screen yet; `DexNotice` (his head in a medallion) where one already is, a
  tool under its header for one. `surpris` for empty and errors, `idee` for
  a step to take.
- **Confirmation**: `Flash` — bevelled, gold edge and Dex cheering
  (`victoire`), red edge and Dex surprised for a failure. The live role stays
  on the element around it.
- Lines Dex says use `tu`, short, with the next step. No emojis.
- **Microcopy**: a wait says what is being done, in the first person when
  it is Dex's or the tool's voice ("Je prépare la partie…", "Je cherche…"),
  never a bare "Chargement…". An empty state names what is missing and the
  way out ("Aucun héros sous ce nom."). A failure says it plainly and offers
  the retry ("Ça a coincé", "Un nouvel essai suffit souvent."). Sober,
  gamer-friendly, no jokes that age, no exclamation marks in a row. A page
  that already says `vous` keeps it.

## Motion

Tokens (`globals.css`, "Brand stage"): easings `--ease-brand-out` (arrivals,
reveals, the poster), `--ease-brand-in-out` (slow loops), `--ease-brand-spring`
(Dex, bubbles, flashes), also as utilities (`ease-brand-out`…); durations
`--duration-fast` 150 ms (hover, press), `--duration-base` 320 ms (small
entries), `--duration-slow` 650 ms (the strong moment, a reveal). New motion
takes these, never a curve of its own.

- One strong moment per page: `affiche-art` (art slides slightly) and
  `affiche-name` (name comes in on the slant), under 700 ms, transforms only
  (the name is painted from the first frame).
- Hover: cards and tiles rise 2 px, a tile's image zooms 3 % in its frame,
  the éclat slides under the element; buttons press in.
- On scroll, only three things move: the home blocks come in (scroll reveal,
  below), the patch recap's chapters (below) and the hero page's poster: its layers (art,
  the hero's light, the name) drift at their own depth with the scroll and,
  on a fine pointer, the cursor (`PosterParallax`, `hero-cinematic.tsx`),
  a few pixels, transforms only. Its chips, figures, facts and gauges come in
  one after the other (`Cascade`): on load when already on screen, when they
  reach the screen otherwise.
- A hero's portrait flies from its tile in the lists to its place on the
  hero page (React's `ViewTransition`, name `heroMorph(slug)`, class
  `hero-morph`); a browser without the View Transitions API just navigates.
- The chapters of a patch recap (`/patch-notes/<version>/bilan`, `.recap-chapter`),
  a story page, rise into place as they enter the view, by CSS scroll-driven
  animation only.
- **Scroll reveal** (`RevealGroup`, `reveal.tsx`): the blocks marked
  `data-reveal` come in once, the first time they near the screen — the block
  rises and fades in, its section title arrives on the slant, its blade
  sweeps, its hero tiles follow one by one (45 ms apart); a divider
  (`eclat-rule`) only sweeps its blade. Progressive: the server sends
  everything visible, the group arms only once its script runs, and what is
  already on screen is never hidden. Used on the home page; a page that adopts
  it wraps its blocks the same way.
- **Counting figures** (`CountUp`, `count-up.tsx`): a key figure counts up
  to its value (1.1 s, ease-out) the first time it shows. The server writes
  the final value; the CSS hides it until the script counts and shows it on
  its own after 2.5 s if the script is late.
- Everything stops under `prefers-reduced-motion`: no reveal, no count, no
  parallax, no embers, no view transition; an infinite animation is switched off explicitly
  (`animation: none`), never left to the global 0.01 ms rule.

## Brand stage (home poster)

The home page opens on a stage, its "wow" moment; the hero pages have their
own cinematic poster (above), no other page copies either.

- **The art**: the official artwork of the meta's number one (the first
  reliably measured hero of the tier list with an artwork the site may show:
  `illustrations`, filtered by `listed.ts`), `next/image` with `priority`.
  It changes when the meta does, not with the calendar.
- **Parallax** (`HomeStage`): on a fine pointer that can hover, the layers
  shift by their depth against the pointer (`--stage-x`, `--stage-y`):
  the art −14 px, the glow 12 px, the embers 22 px, the name 8 px, Dex 10 px.
  They move by `translate`, so they never fight a layer's own `transform`
  animation. Still on a phone and without JavaScript.
- **Glow**: three soft radial gradients (gold, ally blue, dark gold) behind
  the poster, drifting over 22 s, plus a soft gold light over the art
  (`screen`). No `filter: blur`, no other colour.
- **Embers**: fourteen small diamonds (the bevel's angle) rising from the foot
  of the art, gold, two in ally blue; CSS only, fixed positions so the server
  and the browser draw the same. Removed under reduced motion.
- **Dex** presents the live patch in his bubble (`DexSays`, pose `salut`),
  with the link to the notes; in the poster's top corner from `lg`, under the
  buttons on a phone.
- **Figures**: the site's four key counts under the search (heroes, heroes
  changed by the patch, S+ heroes, items) and the number one's win rate,
  counting up.

## Composition

- One dominant thing per screen: the poster, a big figure or a list.
- No frame around each section: sections are separated by `eclat-rule`
  and space.
- Lists of heroes are rows of `HeroTile`, not grey tables. Tables stay for
  real data, airy, with condensed capital headers.
- Never three equal list columns side by side: give lists different weights
  (portrait row + short ranked lines, a wide column and a narrow one).

## Ban list

- Small spaced capital labels everywhere — one per screen at most, and only
  if it informs.
- Captions under images.
- Three equal columns of lists.
- Frames around every section.
- Gradient text, blurred halos, particles, glass (`backdrop-blur`), neon —
  except the brand stage's glow and embers on the home poster, which stay
  there, in the palette, and rest under reduced motion.
- Emojis as illustration, rainbow cards (one colour per role or per item),
  rounded corners (`rounded-*`).
- Artwork in small aligned thumbnails when it can be large.
- Violet, rainbow gradients, any colour outside the palette.

## Share images

Every important page has its own Open Graph / Twitter card, drawn in the same
frame (`src/lib/og/frame.tsx`): night ground, the artwork behind the bevel
cut, the éclat along the cut, the "MLBBDEX" wordmark in text, the title in
slanted condensed capitals (Saira Extra Condensed, Barlow Condensed for the
lines, Fira Sans Extra Condensed for Russian, Chakra Petch for Thai; TTF in
`public/fonts`), and Dex in the page's pose. Each card is built from the
page's own data in `src/lib/og/cards.tsx`, served by an `opengraph-image.tsx`
next to the page, rendered on first request and kept a week. A page points to
its card with `metaPage(…, { card: true })`; any other page gets its
language's home card.

"Partager en image" (`ShareImageButton`, `src/components/share-image-button.tsx`)
draws what a visitor made or found — a build, a draft, the tier list, a MLBBdle
result, a patch recap — as a card in two formats: 1080 × 1350 portrait for
feeds and stories (`src/lib/og/share-frame.tsx`: the artwork across the top
behind a bevelled foot, the title over it, the data, Dex and his line at the
foot) and 1200 × 630 in the frame above. Served by `/api/share/<kind>`, whose
query is checked against the site's catalog (`src/lib/share-card.ts`): no URL,
picture or free text is ever read from it. A MLBBdle card never shows the
day's hero.

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
- **Brand**: `BrandMark` renders `/brand/mark.svg` and the wordmark; it is
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

## Motion

- One strong moment per page: `affiche-art` (art slides slightly) and
  `affiche-name` (name comes in on the slant), under 700 ms, transforms only
  (the name is painted from the first frame).
- Hover: cards and tiles rise 2 px, a tile's image zooms 3 % in its frame,
  the éclat slides under the element; buttons press in.
- Nothing moves on scroll. Everything stops under `prefers-reduced-motion`.

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
- Gradient text, blurred halos, particles, glass (`backdrop-blur`), neon.
- Emojis as illustration, rainbow cards (one colour per role or per item),
  rounded corners (`rounded-*`).
- Artwork in small aligned thumbnails when it can be large.
- Violet, rainbow gradients, any colour outside the palette.

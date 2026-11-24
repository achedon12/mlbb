import type { DexPose } from "@/components/mascot";
import type { Locale } from "@/i18n/config";

/**
 * Pure layout rules of the share images (`src/lib/og/frame.tsx`): sizes, title
 * fitting and Dex's pose per kind of page. No image engine here, so the
 * rules are tested on their own (`tests/unit/og-layout.test.ts`).
 */

/** Open Graph and Twitter large card: 1.91:1. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * A share image is only requested by social network and messaging bots: none
 * is rendered at build time, each one on its first request, then kept a week
 * (data pages change with a deploy, which empties the cache anyway).
 */
export const OG_REVALIDATE = 604800;

/** Address of a page's share image: its own path followed by `opengraph-image`. */
export const ogPath = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}/opengraph-image`;

/**
 * Advance widths of Saira Extra Condensed Black (the display face), in em,
 * measured on the font file: capitals, figures and the usual signs. A
 * character outside the table takes the width of its script.
 */
const SAIRA: Record<string, number> = {
  A: 0.427, B: 0.408, C: 0.321, D: 0.415, E: 0.338, F: 0.312, G: 0.41, H: 0.432, I: 0.222, J: 0.27,
  K: 0.416, L: 0.311, M: 0.634, N: 0.437, O: 0.416, P: 0.407, Q: 0.416, R: 0.42, S: 0.369, T: 0.352,
  U: 0.422, V: 0.418, W: 0.679, X: 0.431, Y: 0.404, Z: 0.37,
  "0": 0.396, "1": 0.287, "2": 0.386, "3": 0.37, "4": 0.393, "5": 0.386, "6": 0.389, "7": 0.362, "8": 0.402, "9": 0.389,
  " ": 0.14, ".": 0.243, ",": 0.243, ":": 0.243, "'": 0.215, "’": 0.215, "-": 0.262, "–": 0.4, "—": 0.6, "+": 0.44, "%": 0.706,
  "(": 0.25, ")": 0.25, "/": 0.3, "!": 0.24, "?": 0.36, "&": 0.46, "·": 0.24,
};
/** Cyrillic falls back on Fira Sans Extra Condensed, Thai on Chakra Petch: both are wider. */
const CYRILLIC = /[Ѐ-ӿ]/;
const THAI = /[฀-๿]/;
/** Thai combining marks (vowels above and below, tone marks) take no width. */
const THAI_MARK = /[ัิ-ฺ็-๎]/;

/** Width of a character in em, in the display face (capitals). */
export function charWidth(ch: string): number {
  const known = SAIRA[ch];
  if (known !== undefined) return known;
  if (THAI_MARK.test(ch)) return 0;
  if (THAI.test(ch)) return 0.6;
  if (CYRILLIC.test(ch)) return 0.54;
  // Accented Latin capitals are as wide as their base letter.
  const base = ch.normalize("NFD")[0];
  if (base !== ch && SAIRA[base] !== undefined) return SAIRA[base];
  return 0.44;
}

/** Width of a text in em. */
export const textWidth = (text: string) => [...text].reduce((sum, ch) => sum + charWidth(ch), 0);

/**
 * Lines of a text wrapped at `width` em, word by word (and character by
 * character for a word longer than the line, or for Thai, written without
 * spaces between words).
 */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = (word: string) => {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate) <= width) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    line = "";
    if (textWidth(word) <= width) {
      line = word;
      return;
    }
    // A word wider than the line is cut where it overflows.
    for (const ch of word) {
      if (textWidth(line + ch) > width && line) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  };
  for (const word of text.split(/\s+/).filter(Boolean)) push(word);
  if (line) lines.push(line);
  return lines;
}

/** Cuts a text to `max` characters at most, at a word boundary when one is close, with an ellipsis. */
export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const chars = [...clean];
  if (chars.length <= max) return clean;
  const cut = chars.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  const kept = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s,.:;–—-]+$/, "")}…`;
}

export interface FittedTitle {
  /** The lines to draw, in capitals, shortened when the title could not fit. */
  lines: string[];
  /** Font size in pixels. */
  size: number;
}

/**
 * Lines of the same count as `wrap(text, width)`, but as even as possible:
 * the narrowest width that still needs no more lines. "Base de
 * connaissances Mobile Legends: Bang Bang" ends on "Bang Bang", not on a
 * lone "Bang".
 */
export function balance(text: string, width: number): string[] {
  const target = wrap(text, width);
  if (target.length < 2) return target;
  // Never narrower than the widest word: it would be cut in two.
  let low = Math.min(width, Math.max(...text.split(" ").map(textWidth)));
  let high = width;
  if (wrap(text, low).length <= target.length) return wrap(text, low);
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (wrap(text, mid).length <= target.length) high = mid;
    else low = mid;
  }
  return wrap(text, high);
}

/** Line height of the display face in the frame. */
export const TITLE_LINE_HEIGHT = 0.94;

/**
 * The largest size at which a title fits its box: `width` pixels wide and
 * `height` high, on `lines` lines at most, between `max` and `min` pixels,
 * its lines balanced, and no word cut in two as long as a smaller size
 * avoids it. Below `min`, the title is shortened until it fits at `min`.
 * Titles are drawn in capitals.
 *
 * The lines are drawn one by one: each is slanted on its own, where a slanted
 * block would push its first line right and its last one left.
 */
export function fitTitle(
  title: string,
  {
    width,
    height = Infinity,
    lines = 2,
    max = 128,
    min = 56,
    lineHeight = TITLE_LINE_HEIGHT,
  }: { width: number; height?: number; lines?: number; max?: number; min?: number; lineHeight?: number },
): FittedTitle {
  const text = title.replace(/\s+/g, " ").trim().toLocaleUpperCase();
  const widest = Math.max(0, ...text.split(" ").map(textWidth));
  const fits = (size: number, whole: boolean) => {
    const count = wrap(text, width / size).length;
    return count <= lines && count * size * lineHeight <= height && (!whole || widest <= width / size);
  };
  for (const whole of [true, false]) {
    for (let size = max; size >= min; size -= 4) {
      if (fits(size, whole)) return { lines: balance(text, width / size), size };
    }
  }
  // Even at the smallest size the title is too long: it is shortened, on as many lines as the height allows.
  const room = Math.max(1, Math.min(lines, Math.floor(height / (min * lineHeight))));
  let chars = [...text].length;
  let short = text;
  while (chars > 1 && wrap(short, width / min).length > room) {
    chars -= 1;
    short = shorten(text, chars);
  }
  return { lines: balance(short, width / min), size: min };
}

/**
 * The first of `names` a text mentions as a whole word, the longest names
 * tried first: "Yi Sun-shin" before "Yi", and "Nana" never inside "Banana".
 */
export function nameInText(text: string, names: string[]): string | null {
  const lower = text.toLocaleLowerCase();
  const letter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch);
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const n = name.toLocaleLowerCase();
    for (let i = lower.indexOf(n); i >= 0; i = lower.indexOf(n, i + 1)) {
      if (!letter(lower[i - 1]) && !letter(lower[i + n.length])) return name;
    }
  }
  return null;
}

/** Kinds of share image, each with its Dex pose. */
export type OgKind =
  | "home"
  | "hero"
  | "ranking"
  | "statistics"
  | "sheet"
  | "guide"
  | "article"
  | "patch"
  | "skins"
  | "events"
  | "esports"
  | "tool"
  | "game"
  | "community";

/**
 * Dex's pose for each kind of page, after the mascot's own rules
 * (`src/components/mascot.tsx`): the welcome for the home page and the
 * community, a thought over data, the idea for a tool, the map for guides,
 * the victory for rankings, applause for tournaments, joy for skins and
 * events, the pointing finger for news, the jump for the games.
 */
const POSES: Record<OgKind, DexPose> = {
  home: "salut",
  hero: "victoire",
  ranking: "victoire",
  statistics: "reflexion",
  sheet: "reflexion",
  guide: "carte",
  article: "pointe",
  patch: "reflexion",
  skins: "joie",
  events: "joie",
  esports: "bravo",
  tool: "idee",
  game: "saut",
  community: "salut",
};

export const ogPose = (kind: OgKind): DexPose => POSES[kind];

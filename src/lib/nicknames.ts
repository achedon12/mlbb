/**
 * Stylish nickname generator.
 *
 * No font is installed on the player's device: each "style" is a set of other
 * Unicode characters that look like Latin letters (mathematical alphanumeric
 * symbols, circled letters, full-width forms...). Only ASCII letters and
 * digits are converted; everything else (accents, spaces, symbols, other
 * scripts) is kept as typed, so the tool never mangles what the player wrote.
 *
 * Pure module with no browser dependency, so it is tested as is.
 */

/** Available styles, in display order. */
export const STYLES = [
  "bold",
  "italic",
  "boldItalic",
  "script",
  "boldScript",
  "fraktur",
  "boldFraktur",
  "doubleStruck",
  "monospace",
  "sans",
  "sansBold",
  "sansItalic",
  "sansBoldItalic",
  "smallCaps",
  "circled",
  "negativeCircled",
  "squared",
  "fullWidth",
  "superscript",
  "strikethrough",
  "underline",
] as const;

export type Style = (typeof STYLES)[number];

/**
 * Contiguous block of characters: first code point of the capitals, the
 * lowercase letters and the digits. `exceptions` fills the holes of the
 * mathematical block: a dozen letters already existed elsewhere (h, B, C...
 * in Letterlike Symbols) and their slot in the block is reserved, hence empty;
 * looking them up there would render a box.
 */
interface Range {
  upper: number;
  /** Missing: lowercase letters reuse the capitals (negative circled, squared). */
  lower?: number;
  digits?: number;
  exceptions?: Partial<Record<string, number>>;
}

const RANGES: Partial<Record<Style, Range>> = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digits: 0x1d7ce },
  italic: { upper: 0x1d434, lower: 0x1d44e, exceptions: { h: 0x210e } },
  boldItalic: { upper: 0x1d468, lower: 0x1d482 },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6,
    exceptions: {
      B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b,
      e: 0x212f, g: 0x210a, o: 0x2134,
    },
  },
  boldScript: { upper: 0x1d4d0, lower: 0x1d4ea },
  fraktur: { upper: 0x1d504, lower: 0x1d51e, exceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 } },
  boldFraktur: { upper: 0x1d56c, lower: 0x1d586 },
  doubleStruck: {
    upper: 0x1d538,
    lower: 0x1d552,
    digits: 0x1d7d8,
    exceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digits: 0x1d7f6 },
  sans: { upper: 0x1d5a0, lower: 0x1d5ba, digits: 0x1d7e2 },
  sansBold: { upper: 0x1d5d4, lower: 0x1d5ee, digits: 0x1d7ec },
  sansItalic: { upper: 0x1d608, lower: 0x1d622 },
  sansBoldItalic: { upper: 0x1d63c, lower: 0x1d656 },
  circled: { upper: 0x24b6, lower: 0x24d0 },
  // Negative circled and squared letters only exist as capitals.
  negativeCircled: { upper: 0x1f150 },
  squared: { upper: 0x1f130 },
  fullWidth: { upper: 0xff21, lower: 0xff41, digits: 0xff10 },
};

/** Circled digits: zero stands apart, one to nine are contiguous. */
const CIRCLED_DIGITS = "⓪①②③④⑤⑥⑦⑧⑨";

/**
 * Small capitals. There is none for "x" (the plain letter, already short, is
 * kept); for "q", the proper small capital U+A7AF is too recent for most
 * fonts, so "ǫ" stands in: it looks close and renders everywhere.
 */
const SMALL_CAPS = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";

/** Superscript letters; "q" has none and stays as is. */
const SUPERSCRIPT_LETTERS = "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ";
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Combining marks, placed after every visible character. */
const COMBINING_MARKS: Partial<Record<Style, string>> = {
  strikethrough: "\u0336",
  underline: "\u0332",
};

const UPPER_A = 0x41;
const LOWER_A = 0x61;
const ZERO = 0x30;

/** Index of an ASCII letter (0 to 25) and its case, or `null` for any other character. */
function asciiLetter(c: string): { index: number; upper: boolean } | null {
  const code = c.codePointAt(0)!;
  if (code >= UPPER_A && code < UPPER_A + 26) return { index: code - UPPER_A, upper: true };
  if (code >= LOWER_A && code < LOWER_A + 26) return { index: code - LOWER_A, upper: false };
  return null;
}

function asciiDigit(c: string): number | null {
  const code = c.codePointAt(0)!;
  return code >= ZERO && code < ZERO + 10 ? code - ZERO : null;
}

/** Characters split by code point: `split("")` would cut characters outside the BMP in half. */
const codePoints = (s: string) => Array.from(s);
const SMALL_CAPS_TABLE = codePoints(SMALL_CAPS);
const SUPERSCRIPT_LETTERS_TABLE = codePoints(SUPERSCRIPT_LETTERS);
const SUPERSCRIPT_DIGITS_TABLE = codePoints(SUPERSCRIPT_DIGITS);
const CIRCLED_DIGITS_TABLE = codePoints(CIRCLED_DIGITS);

function convertChar(c: string, style: Style): string {
  const letter = asciiLetter(c);
  const digit = asciiDigit(c);
  if (style === "smallCaps") return letter ? SMALL_CAPS_TABLE[letter.index] : c;
  if (style === "superscript") {
    if (letter) return SUPERSCRIPT_LETTERS_TABLE[letter.index];
    return digit === null ? c : SUPERSCRIPT_DIGITS_TABLE[digit];
  }
  const range = RANGES[style];
  if (!range) return c;
  if (letter) {
    const exception = range.exceptions?.[c];
    if (exception !== undefined) return String.fromCodePoint(exception);
    const start = letter.upper || range.lower === undefined ? range.upper : range.lower;
    return String.fromCodePoint(start + letter.index);
  }
  if (digit !== null) {
    if (style === "circled") return CIRCLED_DIGITS_TABLE[digit];
    if (range.digits !== undefined) return String.fromCodePoint(range.digits + digit);
  }
  return c;
}

/** Writes `text` in a style; characters without an equivalent are kept as is. */
export function stylize(text: string, style: Style): string {
  const mark = COMBINING_MARKS[style];
  if (mark) {
    // A line under a space is invisible and the game might count it: spaces stay bare.
    return codePoints(text)
      .map((c) => (/\s/u.test(c) ? c : c + mark))
      .join("");
  }
  return codePoints(text)
    .map((c) => convertChar(c, style))
    .join("");
}

/**
 * Decorations around the nickname. None carries a combining mark or a
 * default-emoji character (the game would reject or replace the latter); all
 * are visible symbols with no space, so they waste no length.
 */
export interface Decoration {
  key: string;
  before: string;
  after: string;
}

export const DECORATIONS: readonly Decoration[] = [
  { key: "none", before: "", after: "" },
  { key: "javanese", before: "꧁", after: "꧂" },
  { key: "whiteBrackets", before: "『", after: "』" },
  { key: "blackBrackets", before: "【", after: "】" },
  { key: "hollowBrackets", before: "〖", after: "〗" },
  { key: "stars", before: "★", after: "★" },
  { key: "waves", before: "彡★", after: "★彡" },
  { key: "crown", before: "♛", after: "♛" },
  { key: "seal", before: "亗", after: "亗" },
  { key: "cross", before: "乂", after: "乂" },
  { key: "khanda", before: "☬", after: "☬" },
  { key: "sparkle", before: "✦", after: "✦" },
  { key: "chevrons", before: "⫷", after: "⫸" },
  { key: "rifle", before: "︻デ═一", after: "" },
];

export function decorate(name: string, decoration: Decoration): string {
  return name === "" ? "" : `${decoration.before}${name}${decoration.after}`;
}

/** Maximum input length, in code points: no game would accept anything longer. */
export const INPUT_MAX = 32;

/**
 * Characters stripped from the input: controls, invisible format characters
 * (zero-width spaces, direction marks, joiners), private use, unassigned code
 * points, and the "fake blanks" used for invisible nicknames (Hangul fillers,
 * blank Braille pattern...). A nickname copied from the page must contain
 * nothing the player cannot see.
 */
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}\p{Zl}\p{Zp}\u115f\u1160\u3164\uffa0\u2800\u180e\ufe00-\ufe0f]/gu;

/** Cleans the input: invisible characters removed, spaces collapsed, length capped. */
export function sanitize(input: string): string {
  const clean = input
    .normalize("NFC")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s+/gu, " ")
    .trim()
    // A leading combining accent has nothing to attach to: it would render on a dotted circle.
    .replace(/^\p{M}+/u, "");
  return codePoints(clean).slice(0, INPUT_MAX).join("").trimEnd();
}

/**
 * Two lengths, since we do not know which one the game uses: in code points
 * (a bold "A" counts 1) and in UTF-16 units (the same bold "A" counts 2), the
 * native measure of many game engines.
 */
export function measure(text: string): { codePoints: number; utf16Units: number } {
  return { codePoints: codePoints(text).length, utf16Units: text.length };
}

/**
 * Length reported by a third-party guide (1v9, January 2025), for lack of an
 * official source: neither the wiki nor Moonton publishes it. It is only a
 * reference point, never a limit enforced on the input.
 */
export const GUIDE_LENGTH = {
  min: 3,
  max: 16,
  source: "https://1v9.gg/blog/mobile-legends-mlbb-how-to-change-your-name",
} as const;

/** Wiki page that lists the Rename Card among the shop items. */
export const SHOP_SOURCE = "https://mobilelegends.fandom.com/wiki/Shop";

/** Random style and decoration; `random` returns a number in [0, 1), like `Math.random`. */
export function pickRandom(random: () => number = Math.random): { style: Style; decoration: Decoration } {
  const index = (n: number) => Math.min(n - 1, Math.floor(random() * n));
  // "none" is left out: a random pick without decoration would disappoint.
  const decorated = DECORATIONS.slice(1);
  return { style: STYLES[index(STYLES.length)], decoration: decorated[index(decorated.length)] };
}

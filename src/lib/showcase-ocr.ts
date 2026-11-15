/**
 * Reading a screenshot of one of the Showcase's collection points overviews
 * (Profile > Showcase > Collection), after the OCR has turned it into words.
 *
 * The skin panel lists seven counted rows, from Legend to painted skins, each
 * with "owned/total" then the row's points, and a shining row that has only
 * points. The two other panels, the in-match items (ten rows) and the
 * out-of-match items (seven rows), have the same layout, but their items are
 * worth varying points: only the rows' points and the panel's total are read
 * there (`readItems`), and `readPanel` tells the three apart.
 * Nothing here reads the tier names: they change with the client's language.
 * The rows are recognised by their numbers and their order, and checked
 * against what the game is known to do: a row's points are its owned count
 * times the tier's points, the header total is the sum of the rows, and the
 * "skin collection" line is the sum of the counts.
 *
 * Pure module: the OCR runs in the browser (`showcase-ocr-client.ts`), the
 * parser is tested on its output.
 */

import { POINTS, type PointGroup, type Tier } from "./account-value";

/** The rows the panel counts, top to bottom. The shining row shows no count: it is never read. */
export const READ_TIERS = ["legend", "grand", "exquisite", "deluxe", "exceptional", "common", "painted"] as const satisfies readonly Tier[];
export type ReadTier = (typeof READ_TIERS)[number];

/** Width the image is brought to before the OCR: the panel's small digits read best around it. */
export const WIDTH = 2400;
export const MAX_WIDTH = 3200;
/**
 * Black-and-white thresholds tried in turn, until a reading checks out: the
 * panel's text is light on a translucent dark background, more or less dark
 * depending on the skins behind it.
 */
export const THRESHOLDS = [135, 110, 150];
/**
 * Digits and the slash only: the tier names are not read, whatever the
 * client's language. Tesseract also runs in sparse text mode
 * (`PSM.SPARSE_TEXT`), the panel being columns of numbers over pictures.
 */
export const OCR_PARAMETERS = {
  tessedit_char_whitelist: "0123456789/",
  // A screenshot carries no resolution: set one, rather than let Tesseract
  // estimate it and log the guess as an error in the console.
  user_defined_dpi: "300",
};

/** Words of a Tesseract result read with the `blocks` output. */
export function wordsOf(data: {
  blocks?: { paragraphs: { lines: { words: OcrWord[] }[] }[] }[] | null;
}): OcrWord[] {
  return (data.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words.map((w) => ({ text: w.text, bbox: w.bbox })))),
  );
}

/** Quality of a skin reading: rows confirmed by their points, then the header and the collection line. */
const skinQuality = (r: ShowcaseReading) =>
  r.rows.filter((x) => x.checked).length * 2 + r.rows.length + (r.header?.matches ? 3 : 0) + (r.collection ? 2 : 0);
/** Quality of a reading of any panel; a confirmed total weighs most. */
const quality = (r: PanelReading | null) =>
  !r ? -1 : r.kind === "skins" ? skinQuality(r.reading) : r.reading.rows.length + (r.reading.header?.matches ? 10 : 0);
/** The better of two readings of the same image. */
export const better = (a: PanelReading | null, b: PanelReading | null) => (quality(b) > quality(a) ? b : a);
/** Every row read and confirmed, and the header total too: no need to try another threshold. */
export const complete = (r: PanelReading | null) =>
  !!r &&
  (r.kind === "skins"
    ? r.reading.rows.length === READ_TIERS.length && r.reading.rows.every((x) => x.checked) && !!r.reading.header?.matches
    : !!r.reading.header?.matches);

/** A word of the OCR output, with its box in image pixels. */
export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface ShowcaseRow {
  tier: ReadTier;
  owned: number;
  /** Skins of the tier in the game, as the panel says; null when it could not be read. */
  total: number | null;
  /** The row's points as read, when they could be. */
  points: number | null;
  /** True when the points read are the owned count times the tier's points. */
  checked: boolean;
}

export interface ShowcaseReading {
  rows: ShowcaseRow[];
  /**
   * Points of the shining row, below the painted one, when read: the header
   * total counts them, the skin count does not.
   */
  shining: number | null;
  /** Header total, when read; `matches` when it equals the sum of the rows' points and the shining ones. */
  header: { value: number; matches: boolean } | null;
  /** "Skin collection owned/total" line, when found and consistent with the rows. */
  collection: { owned: number; total: number } | null;
}

const digits = (s: string) => s.replace(/[^\d/]/g, "");

/**
 * Ways to read "owned/total" from a token. The slash is thin and the OCR
 * sometimes drops it ("117" for 1/17) or reads it as a 1 or a 7 ("197115"
 * for 19/115): every split is offered, the points then pick the right one.
 */
export function fractionReadings(token: string): { owned: number; total: number; exact: boolean }[] {
  const t = digits(token);
  const out: { owned: number; total: number; exact: boolean }[] = [];
  const add = (a: string, b: string, exact: boolean) => {
    if (!a || !b || a.length > 4 || b.length > 4) return;
    const owned = Number(a);
    const total = Number(b);
    // A clean "a/b" is kept even when the total was misread below the count: the points still tell.
    if ((exact || owned <= total) && total > 0 && !out.some((o) => o.owned === owned && o.total === total)) out.push({ owned, total, exact });
  };
  const parts = t.split("/").filter(Boolean);
  if (parts.length === 2) add(parts[0], parts[1], true);
  if (parts.length > 1) return out;
  const s = parts[0] ?? "";
  for (let i = 1; i < s.length; i += 1) {
    add(s.slice(0, i), s.slice(i), false);
    if ("17".includes(s[i])) add(s.slice(0, i), s.slice(i + 1), false);
  }
  return out;
}

/**
 * A number read after the coin icon, which the OCR often turns into an extra
 * leading digit ("238000" for 38000): it matches when it is the expected
 * value, or ends with it after one stray character.
 */
export function pointsMatch(token: string, expected: number): boolean {
  const t = digits(token).replace(/\//g, "");
  const e = String(expected);
  return t === e || (t.length === e.length + 1 && t.endsWith(e));
}

interface Line {
  y: number;
  height: number;
  words: OcrWord[];
}

/** Words grouped into lines: two words share a line when their boxes overlap vertically by half. */
function linesOf(words: readonly OcrWord[]): Line[] {
  const lines: Line[] = [];
  for (const w of [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
    const h = w.bbox.y1 - w.bbox.y0;
    const mid = (w.bbox.y0 + w.bbox.y1) / 2;
    const line = lines.find((l) => Math.abs(l.y - mid) < Math.max(l.height, h) / 2);
    if (line) {
      line.words.push(w);
      line.y = (line.y * (line.words.length - 1) + mid) / line.words.length;
      line.height = Math.max(line.height, h);
    } else lines.push({ y: mid, height: h, words: [w] });
  }
  for (const l of lines) l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  return lines.sort((a, b) => a.y - b.y);
}

/** A possible row: a count token and the token right after it on the same line. */
interface Candidate {
  line: number;
  count: OcrWord;
  points: OcrWord | null;
}

function rowOn(c: Candidate, tier: ReadTier, catalog: Partial<Record<Tier, number>>): { row: ShowcaseRow; score: number } | null {
  const readings = fractionReadings(c.count.text);
  const known = catalog[tier];
  // The game lists at least about what the catalogue does, and rarely much more.
  const plausible = (r: { owned: number; total: number }) =>
    r.owned <= r.total && (known == null || (r.total >= known * 0.9 && r.total <= known * 1.5 + 10));
  const rank = (r: { owned: number; total: number; exact: boolean }) => Number(plausible(r)) * 2 + Number(r.exact);
  const byRank = [...readings].sort((x, y) => rank(y) - rank(x));
  const pointsRead = c.points ? Number(digits(c.points.text).replace(/\//g, "")) : NaN;
  const p = POINTS[tier];
  // Points read whole that are a plausible count times the tier's points: a
  // stray-digit match against another count ("2/111" with 36000) is a conflict.
  const whole = Number.isInteger(pointsRead / p) && readings.some((r) => pointsRead / p <= Math.max(r.total, known ?? 0) * 1.5) ? pointsRead / p : null;
  const sameValue = byRank.filter((r) => r.owned * p === pointsRead);
  const stray = whole == null && c.points ? byRank.filter((r) => pointsMatch(c.points!.text, r.owned * p)) : [];
  const matching = sameValue.length ? sameValue : stray;
  const fallback = whole != null && readings.length ? { ...byRank[0], owned: whole } : byRank.find((r) => r.exact);
  const pick = matching[0] ?? fallback;
  if (!pick) return null;
  const checked = matching.length > 0;
  return {
    row: {
      tier,
      owned: pick.owned,
      total: plausible(pick) ? pick.total : null,
      points: checked ? pick.owned * POINTS[tier] : Number.isFinite(pointsRead) ? pointsRead : null,
      checked,
    },
    score: (checked ? 3 : 0.5) + (plausible(pick) ? 1 : 0),
  };
}

/**
 * The seven rows, read from the OCR words. The candidates are matched to the
 * tiers in reading order (each tier on a lower line than the one before),
 * keeping the matching that checks the most rows. Null when fewer than four
 * rows could be placed: not a Showcase panel, or an unreadable one.
 */
export function readShowcase(words: readonly OcrWord[], catalog: Partial<Record<Tier, number>> = {}): ShowcaseReading | null {
  const lines = linesOf(words.filter((w) => /\d/.test(w.text)));
  const candidates: Candidate[] = [];
  lines.forEach((l, i) =>
    l.words.forEach((w, j) => {
      if (digits(w.text).replace(/\//g, "").length >= 2 || w.text.includes("/"))
        candidates.push({ line: i, count: w, points: l.words[j + 1] ?? null });
    }),
  );

  // Best alignment of the tiers onto the candidates, both in order, each
  // tier on a lower line than the one before: dynamic programming over
  // (tiers placed or skipped, candidates seen).
  type Cell = { score: number; rows: (ShowcaseRow & { line: number })[] };
  const lastLine = (c: Cell) => c.rows.at(-1)?.line ?? -1;
  const better = (a: Cell, b: Cell) => (b.score > a.score ? b : a);
  const n = candidates.length;
  let previous: Cell[] = Array.from({ length: n + 1 }, () => ({ score: 0, rows: [] }));
  for (const tier of READ_TIERS) {
    const current: Cell[] = [previous[0]];
    for (let k = 0; k < n; k += 1) {
      let cell = better(current[k], previous[k + 1]);
      const c = candidates[k];
      const placed = c.line > lastLine(previous[k]) ? rowOn(c, tier, catalog) : null;
      if (placed) cell = better(cell, { score: previous[k].score + placed.score, rows: [...previous[k].rows, { ...placed.row, line: c.line }] });
      current.push(cell);
    }
    previous = current;
  }
  const found = previous[n].rows;
  if (found.length < 4) return null;

  const rows: ShowcaseRow[] = found.map((r) => ({ tier: r.tier, owned: r.owned, total: r.total, points: r.points, checked: r.checked }));
  const sum = rows.reduce((s, r) => s + r.owned * POINTS[r.tier], 0);
  const owned = rows.reduce((s, r) => s + r.owned, 0);
  const firstLine = found[0].line;

  // Shining row: a number alone below the painted row, in its points column.
  const painted = found.at(-1)!.tier === "painted" ? found.at(-1)! : null;
  const column = painted ? candidates.find((c) => c.line === painted.line && c.count.text.includes("/"))?.points ?? null : null;
  const shiningWord = column
    ? candidates.find(
        (c) =>
          c.line > painted!.line &&
          !c.count.text.includes("/") &&
          Math.abs(c.count.bbox.x0 - column.bbox.x0) < (column.bbox.y1 - column.bbox.y0) * 2,
      )?.count ?? null
    : null;

  // Header: a number above the first row that is the points total, with the
  // shining points when there are some. Read with or without a stray first
  // digit (the coin icon).
  let header: ShowcaseReading["header"] = null;
  let shining: number | null = null;
  const above = candidates.filter((c) => c.line < firstLine && !c.count.text.includes("/"));
  const headers = above.flatMap((c) => {
    const d = digits(c.count.text);
    return d.length > 1 ? [Number(d), Number(d.slice(1))] : [Number(d)];
  });
  const extra = shiningWord ? headers.map((x) => x - sum).find((x) => x > 0 && pointsMatch(shiningWord.text, x)) : undefined;
  if (extra != null) {
    shining = extra;
    header = { value: sum + extra, matches: true };
  } else if (above.some((c) => pointsMatch(c.count.text, sum))) {
    // The total has no room for shining points: whatever was read below is noise.
    shining = shiningWord ? 0 : null;
    header = { value: sum, matches: true };
  } else {
    if (shiningWord) shining = Number(digits(shiningWord.text).replace(/\//g, "")) || 0;
    const last = above.filter((c) => digits(c.count.text).length >= 4).at(-1);
    if (last) header = { value: Number(digits(last.count.text)), matches: false };
  }

  // "Skin collection owned/total" elsewhere on the screen: the sum of the counts.
  let collection: ShowcaseReading["collection"] = null;
  const totals = rows.every((r) => r.total != null) ? rows.reduce((s, r) => s + r.total!, 0) : null;
  for (const c of candidates) {
    const r = fractionReadings(c.count.text).find((f) => f.exact && f.owned === owned && (totals == null || f.total === totals));
    if (r) {
      collection = { owned: r.owned, total: r.total };
      break;
    }
  }
  return { rows, shining, header, collection };
}

// ── The two item panels ────────────────────────────────────────────

/** Rows of the in-match items panel; the out-of-match one has seven. */
export const IN_MATCH_ROWS = 10;

export interface ItemsReading {
  /** Which panel: told by its number of rows. */
  group: Exclude<PointGroup, "shining">;
  /** The rows' points, top to bottom, and their count when read cleanly. */
  rows: { owned: number | null; total: number | null; points: number }[];
  /** Points of the panel: the header when it checks out, else the sum of the rows. */
  points: number;
  header: { value: number; matches: boolean } | null;
}

/**
 * The rows of an item panel: lines holding a count token then a number. A
 * row's points may carry a stray digit before them (the coin icon), which only
 * the header total can tell: of every way to read the rows, with or without
 * that digit, the one whose sum is the header is kept, the fewest digits
 * dropped first. Null when fewer than five rows were found.
 */
export function readItems(words: readonly OcrWord[]): ItemsReading | null {
  const lines = linesOf(words.filter((w) => /\d/.test(w.text)));
  type Row = { line: number; x: number; height: number; owned: number | null; total: number | null; options: number[] };
  const found: Row[] = [];
  lines.forEach((l, i) => {
    for (let j = 0; j + 1 < l.words.length; j += 1) {
      const count = l.words[j];
      const value = l.words[j + 1];
      // A count then a bare number: "128/392" or a header total is no row's points.
      if (value.text.includes("/") || (!count.text.includes("/") && digits(count.text).length < 2)) continue;
      const v = digits(value.text);
      if (!v) continue;
      const exact = fractionReadings(count.text).find((r) => r.exact);
      // Nothing owned is worth nothing, whatever the OCR made of the zero.
      const options = exact?.owned === 0 ? [0] : [Number(v), ...(v.length > 1 ? [Number(v.slice(1))] : [])];
      found.push({ line: i, x: value.bbox.x0, height: value.bbox.y1 - value.bbox.y0, owned: exact?.owned ?? null, total: exact?.total ?? null, options });
      break;
    }
  });
  // The rows' points stand in one column: keep the lines whose number is in
  // the column most of them share.
  const xs = found.map((r) => r.x).sort((a, b) => a - b);
  const column = xs[xs.length >> 1];
  const rows = found.filter((r) => Math.abs(r.x - column) < r.height * 2);
  if (rows.length < 5) return null;

  // Header: a lone number above the first row.
  const above = lines.slice(0, rows[0].line).flatMap((l) => l.words.filter((w) => !w.text.includes("/") && digits(w.text).length >= 3));
  const headers = above.flatMap((w) => {
    const d = digits(w.text);
    return [Number(d), ...(d.length > 1 ? [Number(d.slice(1))] : [])];
  });

  // Every combination of the rows' readings, fewest stray digits first.
  const first = rows.map((r) => r.options[0]);
  let pick = first;
  let header: ItemsReading["header"] = null;
  const ambiguous = rows.map((r, k) => (r.options.length > 1 ? k : -1)).filter((k) => k >= 0);
  if (ambiguous.length <= 12) {
    const combos = Array.from({ length: 2 ** ambiguous.length }, (_, mask) => mask).sort(
      (a, b) => bits(a) - bits(b) || a - b,
    );
    for (const mask of combos) {
      const values = rows.map((r, k) => {
        const bit = ambiguous.indexOf(k);
        return bit >= 0 && mask & (1 << bit) ? r.options[1] : r.options[0];
      });
      const sum = values.reduce((a, b) => a + b, 0);
      if (headers.includes(sum)) {
        pick = values;
        header = { value: sum, matches: true };
        break;
      }
    }
  }
  const sum = pick.reduce((a, b) => a + b, 0);
  if (!header && above.length) header = { value: Number(digits(above.at(-1)!.text)), matches: false };
  return {
    group: rows.length >= IN_MATCH_ROWS - 1 ? "inMatch" : "outMatch",
    rows: rows.map((r, k) => ({ owned: r.owned, total: r.total, points: pick[k] })),
    points: sum,
    header,
  };
}

const bits = (n: number) => n.toString(2).replace(/0/g, "").length;

export type PanelReading = { kind: "skins"; reading: ShowcaseReading } | { kind: "items"; reading: ItemsReading };

/**
 * Which of the three panels a screenshot shows, read. The skin panel is the
 * one whose rows check against the tiers' points (a row with something
 * owned, since an empty row checks against any tier); an item panel's rows
 * check against nothing but their total. Null when neither reads.
 */
export function readPanel(words: readonly OcrWord[], catalog: Partial<Record<Tier, number>> = {}): PanelReading | null {
  const skins = readShowcase(words, catalog);
  const items = readItems(words);
  const confirmed = skins ? skins.rows.filter((r) => r.checked && r.owned > 0).length : 0;
  if (skins?.header?.matches && confirmed >= 3) return { kind: "skins", reading: skins };
  if (items?.header?.matches) return { kind: "items", reading: items };
  if (skins && confirmed >= 4) return { kind: "skins", reading: skins };
  if (items) return { kind: "items", reading: items };
  return null;
}

/**
 * Pixels prepared for the OCR, in place: grey, then the light text of the
 * panel turned dark on white, every pixel either black or white.
 */
export function binarize(rgba: Uint8ClampedArray, threshold: number): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const grey = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    const v = grey >= threshold ? 0 : 255;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
    rgba[i + 3] = 255;
  }
}

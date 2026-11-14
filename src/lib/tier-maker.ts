/**
 * Tier list maker: state, operations and sharing by link.
 *
 * Pure module, without data: the page passes it the roster. Each operation
 * returns a new state; the interface only has to store it.
 *
 * The shared link carries the whole list in `?l=`: title, rows (name,
 * color, heroes by slug), as compressed text then base64url. Slugs
 * rather than indices: a link stays valid when a hero is added to the
 * roster. A 133-hero link fits in under one kilobyte.
 */

import { decodeText, encodeText } from "./link-code";

export interface Row {
  id: string;
  name: string;
  color: string;
  heroes: string[];
}

export interface StateTier {
  title: string;
  rows: Row[];
}

export const ROWS_DEFAULT: { name: string; color: string }[] = [
  { name: "S+", color: "#ff5a5f" },
  { name: "S", color: "#ff9f43" },
  { name: "A", color: "#ffd166" },
  { name: "B", color: "#06d6a0" },
  { name: "C", color: "#4da3ff" },
  { name: "D", color: "#a78bfa" },
];

/** Colors offered in one click; the browser picker provides the rest. */
export const PALETTE = [...ROWS_DEFAULT.map((r) => r.color), "#f472b6", "#94a3b8"];

export const MAX_ROWS = 12;
export const NAME_MAX = 20;
export const TITLE_MAX = 60;
const COLOR_NEUTRAL = "#94a3b8";
/** Beyond this, a link is rejected without being read: no legitimate list comes close. */
const CODE_MAX = 12_000;
const TEXT_MAX = 40_000;

export function stateDefault(title = ""): StateTier {
  return { title, rows: ROWS_DEFAULT.map((r, i) => ({ id: `d${i}`, ...r, heroes: [] })) };
}

export function rowOf(state: StateTier, slug: string): Row | undefined {
  return state.rows.find((r) => r.heroes.includes(slug));
}

/**
 * Places a hero in a row, before `before` if it is there, otherwise at the end;
 * a null `target` returns it to the pool.
 */
export function place(state: StateTier, slug: string, target: string | null, before?: string | null): StateTier {
  const tierRows = state.rows.map((r) => ({ ...r, heroes: r.heroes.filter((s) => s !== slug) }));
  const r = target ? tierRows.find((x) => x.id === target) : undefined;
  if (r) {
    const i = before ? r.heroes.indexOf(before) : -1;
    r.heroes.splice(i >= 0 ? i : r.heroes.length, 0, slug);
  }
  return { ...state, rows: tierRows };
}

/** Moves a hero forward or back within its row. */
export function shift(state: StateTier, slug: string, delta: number): StateTier {
  return {
    ...state,
    rows: state.rows.map((r) => {
      const i = r.heroes.indexOf(slug);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= r.heroes.length) return r;
      const heroes = [...r.heroes];
      [heroes[i], heroes[j]] = [heroes[j], heroes[i]];
      return { ...r, heroes };
    }),
  };
}

/** Moves a hero up or down one row, at the end of the new one. */
export function changeOfRow(state: StateTier, slug: string, delta: number): StateTier {
  const i = state.rows.findIndex((r) => r.heroes.includes(slug));
  const target = state.rows[i + delta];
  return i < 0 || !target ? state : place(state, slug, target.id);
}

export function addRow(state: StateTier, id: string, name: string): StateTier {
  if (state.rows.length >= MAX_ROWS) return state;
  const color = PALETTE[state.rows.length % PALETTE.length];
  return { ...state, rows: [...state.rows, { id, name: clean(name, NAME_MAX), color, heroes: [] }] };
}

/** Removes a row; its heroes go back to the pool. */
export function deleteRow(state: StateTier, id: string): StateTier {
  if (state.rows.length <= 1) return state;
  return { ...state, rows: state.rows.filter((r) => r.id !== id) };
}

export function moveRow(state: StateTier, id: string, delta: number): StateTier {
  const i = state.rows.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.rows.length) return state;
  const tierRows = [...state.rows];
  [tierRows[i], tierRows[j]] = [tierRows[j], tierRows[i]];
  return { ...state, rows: tierRows };
}

export function editRow(state: StateTier, id: string, fields: Partial<Pick<Row, "name" | "color">>): StateTier {
  return {
    ...state,
    rows: state.rows.map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            ...(fields.name !== undefined ? { name: fields.name.replace(/[\t\n\r]/g, " ").slice(0, NAME_MAX) } : {}),
            ...(fields.color && /^#[0-9a-f]{6}$/i.test(fields.color) ? { color: fields.color.toLowerCase() } : {}),
          },
    ),
  };
}

export function clearRows(state: StateTier): StateTier {
  return { ...state, rows: state.rows.map((r) => ({ ...r, heroes: [] })) };
}

/**
 * Starting list taken from our tier list: `groups` gives, tier by
 * tier (S+ to C), the indices of heroes in `slugs`, from strongest to
 * weakest. The D row stays empty: our ranking stops at C.
 */
export function prefill(slugs: string[], groups: number[][], title = ""): StateTier {
  const state = stateDefault(title);
  return {
    ...state,
    rows: state.rows.map((r, i) => ({ ...r, heroes: (groups[i] ?? []).flatMap((n) => slugs[n] ?? []) })),
  };
}

/** Readable text on a background of this color: dark on light, light on dark. */
export function colorText(background: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(background);
  if (!m) return "#ffffff";
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#0a0e1a" : "#ffffff";
}

// ─────────────────────────────────────────────────────────────
// Sharing by link
// ─────────────────────────────────────────────────────────────

function clean(text: string, max: number): string {
  return text.replace(/[\t\n\r]/g, " ").trim().slice(0, max);
}

/** One line for the title, then one per row: name, color, heroes. */
export function serialize(state: StateTier): string {
  return [
    clean(state.title, TITLE_MAX),
    ...state.rows.map((r) =>
      [clean(r.name, NAME_MAX), r.color.replace(/^#/, "").toLowerCase(), r.heroes.join(",")].join("\t"),
    ),
  ].join("\n");
}

/**
 * Reads a list back, without trusting the link: unknown heroes and duplicates
 * dropped, invalid colors replaced, number of rows capped.
 */
export function deserialize(text: string, known: Set<string>): StateTier | null {
  const [title = "", ...rows] = text.split("\n");
  if (!rows.length) return null;
  const seen = new Set<string>();
  const tierRows = rows.slice(0, MAX_ROWS).map((row, i) => {
    const [name = "", color = "", list = ""] = row.split("\t");
    const heroes: string[] = [];
    for (const slug of list.split(",")) {
      if (known.has(slug) && !seen.has(slug)) {
        seen.add(slug);
        heroes.push(slug);
      }
    }
    return {
      id: `p${i}`,
      name: clean(name, NAME_MAX),
      color: /^[0-9a-f]{6}$/i.test(color) ? `#${color.toLowerCase()}` : COLOR_NEUTRAL,
      heroes,
    };
  });
  return { title: clean(title, TITLE_MAX), rows: tierRows };
}

/**
 * Link code: "2" + compressed text, or "1" + raw text when
 * compression is unavailable or gains nothing (an almost empty list).
 */
export async function encodeTier(state: StateTier, compress = true): Promise<string> {
  return encodeText(serialize(state), compress);
}

export async function decodeTier(code: string, known: Set<string>): Promise<StateTier | null> {
  const text = await decodeText(code, { codeMax: CODE_MAX, textMax: TEXT_MAX });
  return text === null ? null : deserialize(text, known);
}

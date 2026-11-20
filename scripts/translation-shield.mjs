/**
 * Proper names hidden from the translation service.
 *
 * The service translates a proper name like any word: Chip came back as
 * "Puce", Joy as "Joie", and the game itself as "Légendes mobiles : Bang
 * Bang". No rule on its answer can reliably undo that in a Latin alphabet, so
 * the names are sent behind numbered markers and come back as the game
 * writes them. Kept apart from `translate-data.mjs`, which translates as soon
 * as it is loaded, so that it can be tested.
 */

export const MARK = String.fromCharCode(0xe000);

/**
 * The game's own name, in every spelling the sources use. "Bang Bang" is only
 * protected as part of the name: on its own it is an ordinary sound.
 */
export const GAME_NAME = String.raw`Mobile Legends(?:\s*:\s*Bang Bang|\s+Bang Bang)?|MLBB`;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One pattern for a list of names (whole words, as written, longest first)
 * and, optionally, the game's name.
 */
export function namesPattern(names, { game = true } = {}) {
  const literal = [...new Set(names)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escape);
  const parts = [...(game ? [GAME_NAME] : []), ...literal];
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

/**
 * A shield for `prepare`: the text with its names replaced by markers, and
 * `restore`, which puts them back in the service's answer, or returns null
 * when a marker did not come back (the text is then sent again as is).
 */
export function shieldWith(pattern) {
  const marker = () => new RegExp(`${MARK}\\s*(\\d+)\\s*${MARK}`, "g");
  return (text) => {
    // A text may already carry markers (the tags of an HTML block): the
    // names are numbered after them, and only theirs are put back.
    const base = Math.max(-1, ...[...String(text).matchAll(marker())].map((m) => Number(m[1]))) + 1;
    const names = [];
    const shielded = String(text).replace(pattern, (m) => `${MARK}${base + names.push(m) - 1}${MARK}`);
    return {
      text: shielded,
      restore(output) {
        const found = new Set();
        const back = output.replace(marker(), (whole, n) => {
          const i = Number(n) - base;
          if (i < 0) return whole;
          found.add(i);
          return names[i] ?? "";
        });
        return found.size === names.length ? back : null;
      },
    };
  };
}

/**
 * Drops from `cache` the translations that lost a protected name of their
 * source (made before the name was shielded, or by a service that rendered
 * it): the next `prepare` translates them again, names shielded. Returns the
 * keys dropped.
 */
export function forgetLost(cache, texts, sl, tl, pattern) {
  const dropped = [];
  for (const text of new Set(texts.map((x) => String(x).trim()))) {
    const key = `${sl}|${tl}|${text}`;
    const out = cache[key];
    if (typeof out !== "string") continue;
    const names = text.match(pattern) ?? [];
    if (names.some((n) => !out.includes(n))) {
      delete cache[key];
      dropped.push(key);
    }
  }
  return dropped;
}

// ── List labels ────────────────────────────────────────────────────

/**
 * Patch notes number their headings and lists with a letter or a Roman
 * numeral: "a. Rare Skins", "E. New Skin", "VII. Bug Fixes". The service reads
 * the letter as a word: "a." came back as "un." in French, "um." in
 * Portuguese, "UN." in Italian, "gramo." (g) in Spanish, "Ako." (I) in
 * Filipino, Cyrillic "Дж." (J) in Russian, and "H. Bush Vision" as "Optimisations
 * de la vision H. Bush". A label is one letter or up to four Roman numerals
 * and a full stop, at the start of a text: only the tags of its HTML block
 * (markers) and spaces may come before it.
 */
const LEAD = `(?:${MARK}\\d+${MARK}|\\s)*`;
const LABEL = String.raw`(?:[A-Za-z]|[IVX]{2,4})\.(?=\s)`;
const LABEL_RE = new RegExp(`(?<=^${LEAD})${LABEL}`, "u");
const OUTPUT_LABEL_RE = new RegExp(`^(${LEAD})([^\\s.${MARK}]{1,5}\\.)(?=\\s)`, "u");

/** The list label a text starts with ("a.", "VII."), or null. */
export const listLabel = (text) => String(text ?? "").match(LABEL_RE)?.[0] ?? null;

/** Whether `output` starts with `label` and a space, past its leading markers. */
const startsWithLabel = (output, label) => new RegExp(`^${LEAD}${label.replace(".", "\\.")}(?=\\s)`, "u").test(output);

/** A shield for the list label: hidden behind a marker, it comes back as written. */
export const shieldLabels = shieldWith(new RegExp(LABEL_RE.source, "gu"));

/**
 * Several shields, applied in turn: each numbers its markers after those of
 * the previous ones, and the last applied is undone first.
 */
export function combineShields(...shields) {
  return (text) => {
    const steps = [];
    let current = String(text);
    for (const shield of shields) {
      const step = shield(current);
      steps.push(step);
      current = step.text;
    }
    return {
      text: current,
      restore(output) {
        let back = output;
        for (const step of [...steps].reverse()) {
          if (back === null) return null;
          back = step.restore(back);
        }
        return back;
      },
    };
  };
}

/**
 * Output correction, applied after the cache: a translation that starts
 * with a word in place of its source's label ("un. Peaux rares" for "a. Rare
 * Skins") gets the label back. A translation that lost the label elsewhere
 * is left to `forgetLostLabels`.
 */
export function restoreListLabel(output, source) {
  if (typeof output !== "string") return output;
  const label = listLabel(source);
  if (!label || startsWithLabel(output, label)) return output;
  return output.replace(OUTPUT_LABEL_RE, (_, lead) => `${lead}${label}`);
}

/**
 * Drops from `cache` the translations that lost their source's list label
 * beyond what `restoreListLabel` puts back ("Optimisations de la vision H.
 * Bush", "Uma briga" for "A. Brawl"): translated again with the label
 * shielded, they keep it. One that only turned the label into a word stays,
 * corrected on output, with no new request. Returns the keys dropped.
 */
export function forgetLostLabels(cache, texts, sl, tl) {
  const dropped = [];
  for (const text of new Set(texts.map((x) => String(x).trim()))) {
    const label = listLabel(text);
    if (!label) continue;
    const key = `${sl}|${tl}|${text}`;
    const out = cache[key];
    if (typeof out === "string" && !startsWithLabel(restoreListLabel(out, text), label)) {
      delete cache[key];
      dropped.push(key);
    }
  }
  return dropped;
}

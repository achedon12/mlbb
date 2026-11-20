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

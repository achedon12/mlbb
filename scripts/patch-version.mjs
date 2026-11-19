/**
 * Patch version numbers, as the game numbers them: three numeric parts and,
 * for a hotfix, a letter ("2.2.16a", the second build of 2.2.16). Liquipedia
 * writes some hotfixes with a capital ("1.9.20B"): versions are kept in lower
 * case, so that one patch has one spelling, one URL and one sort position.
 *
 * Mirrors `src/lib/patch-version.ts`, which the site uses: the scripts cannot
 * import TypeScript.
 */

const VERSION = /(?<![\d.])(\d+)\.(\d+)\.(\d+)([a-z])?(?![\d.a-z])/i;

/** Version read in a title or a user's input; null when there is none. */
export function readVersion(text) {
  const m = VERSION.exec(String(text ?? ""));
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}${(m[4] ?? "").toLowerCase()}`;
}

/** Numeric parts and hotfix letter ("" for the base build). */
function parts(version) {
  const m = /^(\d+(?:\.\d+)*)([a-z]?)/i.exec(String(version ?? "").trim());
  if (!m) return { numbers: [], letter: "" };
  return { numbers: m[1].split(".").map(Number), letter: m[2].toLowerCase() };
}

/**
 * Sorts 1.9.40 after 1.9.9 (which an alphabetical sort does not), and a
 * hotfix right after its base build: 2.2.16 < 2.2.16a < 2.2.16b < 2.2.23.
 */
export function compareVersions(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.numbers.length, y.numbers.length); i += 1) {
    const d = (x.numbers[i] ?? 0) - (y.numbers[i] ?? 0);
    if (d) return d;
  }
  return x.letter < y.letter ? -1 : x.letter > y.letter ? 1 : 0;
}

/** Base build of a hotfix: "2.2.16a" → "2.2.16". */
export const baseVersion = (version) => String(version).replace(/[a-z]$/i, "");

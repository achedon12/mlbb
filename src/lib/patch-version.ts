/**
 * Patch version numbers: three numeric parts and, for a hotfix, a lower-case
 * letter ("2.2.16a", the second build of 2.2.16). The sync writes them in that
 * form (`scripts/patch-version.mjs`, which this file mirrors): the version is
 * also the patch's URL segment, `/patch-notes/2.2.16a`.
 */

function parts(version: string): { numbers: number[]; letter: string } {
  const m = /^(\d+(?:\.\d+)*)([a-z]?)/i.exec(version.trim());
  if (!m) return { numbers: [], letter: "" };
  return { numbers: m[1]!.split(".").map(Number), letter: m[2]!.toLowerCase() };
}

/**
 * Sorts 1.8.100 after 1.8.92 (which an alphabetical sort does not), and a
 * hotfix right after its base build: 2.2.16 < 2.2.16a < 2.2.16b < 2.2.23.
 */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.numbers.length, y.numbers.length); i += 1) {
    const d = (x.numbers[i] ?? 0) - (y.numbers[i] ?? 0);
    if (d) return d;
  }
  return x.letter < y.letter ? -1 : x.letter > y.letter ? 1 : 0;
}

/** Newest first: the order of every patch list on the site. */
export const newestFirst = <P extends { version: string }>(a: P, b: P): number => compareVersions(b.version, a.version);

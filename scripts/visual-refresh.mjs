/**
 * Keeping downloaded visuals in step with the wiki.
 *
 * The wiki often uploads a first version of an artwork (test server, low
 * resolution, before a revamp) and replaces it later under the same file
 * name: Bruno's "The Protector" went from 1024×637 to 1920×1080, then to an
 * "HD" version, within three days of September 2026. A download that skips
 * every file already on disk keeps the first version for good: fifteen
 * artworks were found that way in November 2026 (Clint, Eudora, Brody,
 * Fanny, Masha, Bruno…).
 *
 * Each file the sync writes is therefore recorded in a manifest
 * (`src/data/game/visual-sources.json`): the wiki file it comes from and the
 * SHA-1 the wiki gives for its current version. The next run compares that
 * SHA-1 with the wiki's and downloads again only when it changed.
 */

/**
 * What to do with one planned visual.
 *
 * - `exists`: whether the local file is there;
 * - `recorded`: the manifest entry of the last download (`{ file, sha1 }`),
 *   or undefined;
 * - `current`: what the wiki says of the file now (`{ file, sha1 }`), or
 *   undefined when the source gives no fingerprint (the game API's icons).
 *
 * Returns `download` (missing, or replaced on the wiki since), `keep`
 * (unchanged, or nothing to compare against), or `verify`: a file on disk
 * the manifest does not know yet, downloaded before the manifest existed.
 * Its bytes cannot tell which wiki version they came from, so it is fetched
 * again and compared by content (`differentImages`), replaced only when
 * the picture differs: re-encoding the same picture must not rewrite a
 * thousand files.
 */
export function refreshDecision({ exists, recorded, current }) {
  if (!exists) return "download";
  if (!current?.sha1) return "keep";
  if (!recorded?.sha1) return "verify";
  if (recorded.sha1 !== current.sha1 || (recorded.file && current.file && recorded.file !== current.file)) {
    return "download";
  }
  return "keep";
}

/** Side of the thumbnails compared, and the mean gap (0–255) above which two pictures differ. */
const SIDE = 32;
const THRESHOLD = 6;

/**
 * Mean absolute gap between two pictures, on small greyscale thumbnails of
 * the same size, from 0 (identical) to 255. Re-encoding a picture (WebP at
 * another quality, another resize) stays under 2; a new version of an
 * artwork (new composition, retouched colours) lands well above 10.
 */
export async function pictureGap(a, b) {
  const sharp = (await import("sharp")).default;
  const thumb = (data) =>
    sharp(data).resize(SIDE, SIDE, { fit: "fill" }).greyscale().raw().toBuffer();
  const [x, y] = await Promise.all([thumb(a), thumb(b)]);
  let total = 0;
  for (let i = 0; i < x.length; i += 1) total += Math.abs(x[i] - y[i]);
  return total / x.length;
}

/** Whether two encoded pictures show a different image (see `pictureGap`). */
export async function differentImages(a, b, threshold = THRESHOLD) {
  return (await pictureGap(a, b)) > threshold;
}

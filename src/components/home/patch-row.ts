/** Portraits per direction at most; the rest is one link away, in the notes. */
export const PER_DIRECTION = 8;
/** Portraits on the home page's one wide row of the patch, buffs and nerfs together. */
export const PER_ROW = 10;

/**
 * How many buffs and nerfs the patch's wide row shows (`HomePatch`): each
 * direction up to `PER_DIRECTION`, both together up to `PER_ROW`, the longer
 * list giving way first, so neither direction is ever squeezed out.
 */
export function splitRow(buffs: number, nerfs: number): [number, number] {
  let b = Math.min(buffs, PER_DIRECTION);
  let n = Math.min(nerfs, PER_DIRECTION);
  while (b + n > PER_ROW) {
    if (b >= n) b--;
    else n--;
  }
  return [b, n];
}

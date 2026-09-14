/**
 * Anchors renamed since their links were shared.
 *
 * A section anchor ends up in links posted elsewhere ("#rang-mythic",
 * "#histoire"): renaming it must not break them. Each page lists its old
 * anchors; a key ending in "-" is a prefix ("rang-" → "rank-" covers
 * "#rang-mythic").
 */
export type AnchorAliases = Readonly<Record<string, string>>;

/** Current anchor for an old one, or null when `hash` is not an old anchor. */
export function resolveAnchor(hash: string, aliases: AnchorAliases): string | null {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!id) return null;
  if (Object.hasOwn(aliases, id) && !id.endsWith("-")) return aliases[id];
  for (const [from, to] of Object.entries(aliases)) {
    if (from.endsWith("-") && id.startsWith(from) && id.length > from.length) return to + id.slice(from.length);
  }
  return null;
}

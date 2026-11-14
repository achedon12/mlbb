/**
 * Heroes an article talks about, for the "heroes in this article" column of a
 * reading page.
 *
 * A name counts when it appears as a whole word, with its capital: "Ruby"
 * the hero, not "ruby" the stone. They come back in the order the text first
 * names them, which is the order of importance an article usually follows.
 */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function heroesMentioned<H extends { name: string }>(text: string, heroes: readonly H[], limit = 8): H[] {
  const found: { hero: H; at: number }[] = [];
  for (const hero of heroes) {
    // Letters around the name would make it part of another word ("Lunox" in "Lunoxes" is still fine to skip).
    const match = new RegExp(`(?<![\\p{L}\\p{N}])${escape(hero.name)}(?![\\p{L}\\p{N}])`, "u").exec(text);
    if (match) found.push({ hero, at: match.index });
  }
  return found
    .sort((a, b) => a.at - b.at || b.hero.name.length - a.hero.name.length)
    .slice(0, limit)
    .map((f) => f.hero);
}

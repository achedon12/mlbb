/**
 * Splitting a page's opening paragraph.
 *
 * Every page used to open on its full lead: four or five lines before the
 * first hero card, the first tier row or the first field of a tool. The first
 * sentence says what the page is; the rest details how it is built, and can
 * wait for the reader who asks for it.
 *
 * The split happens at render time, on the translated string: no catalogue
 * key is duplicated, and the five languages behave the same. A lead that has
 * no second sentence, or whose first sentence is too short to stand alone, is
 * left whole.
 */

/** Below this, a lead already fits on two lines: nothing to fold. */
export const LEAD_SHORT = 100;

/** A lead shorter than this is never split, even when it has two sentences. */
const LEAD_SPLITTABLE = 130;

/** Minimum length of each half, so the fold never hides a handful of words. */
const HALF_MIN = 45;

/**
 * End of sentence: a full stop, question or exclamation mark, then a space,
 * then the start of a new sentence. `2.1.90` and `Mobile Legends: Bang Bang`
 * are not matched — no space after the stop, and a colon ends nothing.
 */
const SENTENCE = /(?<=[.!?…])\s+(?=[«"“„(]?[A-ZÀ-ÖØ-Þ])/u;

/**
 * The lead as it is shown, and what is folded under it (`null` when the whole
 * lead stays visible).
 */
export function splitLead(lead: string): { visible: string; rest: string | null } {
  const text = lead.trim();
  if (text.length < LEAD_SPLITTABLE) return { visible: text, rest: null };
  const cut = text.search(SENTENCE);
  if (cut < HALF_MIN) return { visible: text, rest: null };
  const rest = text.slice(cut).trim();
  if (rest.length < HALF_MIN) return { visible: text, rest: null };
  return { visible: text.slice(0, cut).trim(), rest };
}

/**
 * Official names in the translated game data.
 *
 * A name the game gives (an item's passive or active effect, an Arcade
 * sub-mode, a rank, a currency) is written as the game writes it. The French
 * client's names cannot be checked in any source the project reads, so the
 * site keeps the game's English name in every language, never a translation
 * of its own: the service had turned "Deter" into "Dissuasion" on one item
 * and left "Lifebane" in English on the next, "Boommander" into "Boummandre"
 * and "Chess TD" into "Échecs TD". The choices, with their sources, are listed
 * in `content/fr/lore/GLOSSAIRE.md` ("Noms officiels").
 *
 * Like the rest of the translation pipeline, it works on output: the cache
 * keeps what the service returned, so a rule changed here only needs a rerun.
 */

// ── Item effects ───────────────────────────────────────────────────

/**
 * An effect name opening a sentence of an item text: "Deter: When hit…",
 * "… for 3 seconds. Lifebane: Upon dealing damage…". One to five words, each
 * capitalised ("of" and "the" aside), then a colon and a space.
 */
const SOURCE_LABEL =
  /(?:^|(?<=[.!?)]\s+))([A-Z][\w'’&-]*(?:\s+(?:of|the|[A-Z][\w'’&-]*)){0,4}):\s/gu;

/**
 * Labels that open a sentence the same way but are not names: "Cooldown: 60
 * seconds." Counted to pair the labels, translated like the prose.
 */
const NOT_NAMES = new Set(["Cooldown", "Note", "Duration", "Range"]);

/** The labels opening the sentences of an English item text, in order. */
const sourceLabels = (source) => [...String(source ?? "").matchAll(SOURCE_LABEL)].map((m) => m[1]);

/** The effect names of an English item text, in order. */
export function effectNames(source) {
  return sourceLabels(source).filter((n) => !NOT_NAMES.has(n));
}

/**
 * The labels of a translated item text: what precedes a colon at the start of
 * the text or of a sentence, six words at most and no figure ("20 % :" is not
 * a name). Thai writes no full stop: there a label follows a space.
 */
function outputLabels(output) {
  const thai = /\p{sc=Thai}/u.test(output);
  const start = thai ? String.raw`(?:^|(?<=\s))` : String.raw`(?:^|(?<=[.!?)。]\s+))`;
  // Thai: a name the service kept in Latin letters may hold spaces ("Armor Buster").
  const body = thai
    ? String.raw`(?:[A-Za-z][\w'’&-]*(?:\s+[A-Za-z][\w'’&-]*){0,4}|[^\s:：]{1,60}?)`
    : String.raw`[^\s.!?:：\d][^.!?:：\d]{0,60}?`;
  const re = new RegExp(`${start}(${body})(\\s?[:：])(?=\\s)`, "gu");
  return [...output.matchAll(re)]
    .filter((m) => m[1].trim().split(/\s+/).length <= 6)
    .map((m) => ({ index: m.index, text: m[1] }));
}

/**
 * `output` with the effect names of its English `source` put back: "Dissuasion :
 * lorsqu'il…" becomes "Deter : lorsqu'il…", the language's own spacing before
 * the colon kept. The labels are matched in order; when the translation does
 * not have as many as the source, only an opening one is restored, which
 * keeps a colon in the prose untouched.
 */
export function restoreEffectNames(output, source) {
  if (typeof output !== "string" || !output) return output;
  const names = sourceLabels(source);
  if (!effectNames(source).length) return output;
  const labels = outputLabels(output);
  let pairs;
  if (labels.length === names.length) pairs = labels.map((l, i) => [l, names[i]]);
  else if (labels[0]?.index === 0 && String(source).startsWith(`${names[0]}:`)) pairs = [[labels[0], names[0]]];
  else return output;
  let out = output;
  // From the end, so that the indexes before stay valid.
  for (const [label, name] of pairs.reverse()) {
    if (NOT_NAMES.has(name)) continue;
    out = out.slice(0, label.index) + name + out.slice(label.index + label.text.length);
  }
  return out;
}

// ── Effect names in the patch notes ────────────────────────────────

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The effect names of the items, where the patch notes name them: after
 * "Unique Passive -", "Passive -" or "Active -" ("[Unique Passive - Deter]").
 * Elsewhere "Shield", "Gift" or "Magic" are ordinary words, so the pattern
 * only matches them there.
 */
export function effectNamesPattern(names) {
  const list = [...new Set(names)]
    .filter((n) => n && n.length > 2)
    .sort((a, b) => b.length - a.length)
    .map(escape);
  return new RegExp(`(?<=\\b(?:Passive|Active)\\s?[-–]\\s?)(?:${list.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

/**
 * A heading of the form "Unique Passive - Lifebane" whose translation kept
 * the dash: the part after it goes back to the source's name ("Passif unique
 * - Dissuasion" becomes "Passif unique - Deter").
 */
export function restoreDashName(output, source) {
  if (typeof output !== "string") return output;
  const m = /^\s*(?:Unique\s+)?(?:Passive|Active)\s*[-–]\s*(.+?)\s*$/u.exec(String(source ?? ""));
  if (!m) return output;
  const dash = /\s[-–]\s/u.exec(output) ?? /[-–]/u.exec(output);
  if (!dash) return output;
  return `${output.slice(0, dash.index + dash[0].length)}${m[1]}`;
}

// ── Arcade sub-modes ───────────────────────────────────────────────

/**
 * Modes whose sections are named after the game's own sub-modes (Arcade's
 * "Mayhem", "Ravage", "Chess TD", "Boommander"): their titles stay as the
 * game writes them, in every language.
 */
export const MODES_NAMED_SECTIONS = new Set(["arcade-mode"]);

/** Section titles of the other modes that are game names, not headings. */
export const MODE_SECTION_NAMES = new Set(["Draft Pick", "Rank Protection Card"]);

/**
 * Names of the Arcade sub-modes that are no ordinary word, protected in the
 * modes' prose too ("A fascinating competition called Boommander"). "Mirror",
 * "Survival" or "Arena" are words as well: only their section title keeps
 * them.
 */
export const SUB_MODE_NAMES = ["Brawl&Mirror", "Boommander", "Chess TD", "Deathbattle", "Magic Chess", "Shadow Brawl", "Mayhem"];

// ── Names in the interface and the game data ───────────────────────

/**
 * The game's names the French catalogue writes in English (the glossary's
 * "Noms officiels"): ranks, skin rarities and series, emblems, currencies,
 * modes and pick modes, stats with a name of their own. Hidden from the
 * service in every language, so that "Mythical Glory" does not come back as
 * "Gloria Mítica". Words French also uses ("Grand", "Collector") are left
 * out: on their own they would hide a French word.
 */
export const OFFICIAL_NAMES = [
  // Ranks.
  "Mythical Immortal",
  "Mythical Glory",
  "Mythical Honor",
  "Grandmaster",
  "Warrior",
  "Elite",
  "Master",
  "Epic",
  "Legend",
  "Mythic",
  // Skin rarities and series.
  "Supreme",
  "Exquisite",
  "Deluxe",
  "Exceptional",
  "Common",
  "Special",
  "Limited",
  "Seasons",
  "Lucky Box",
  "StarLight",
  "Valentine's Day",
  // Emblems.
  "Tank Emblem",
  "Fighter Emblem",
  "Assassin Emblem",
  "Mage Emblem",
  "Marksman Emblem",
  "Support Emblem",
  // Currencies.
  "Battle Points",
  "Battle Point",
  "Diamonds",
  "Diamond",
  "Hero Fragments",
  "Premium Skin Fragments",
  "Magic Cores",
  "Myth Coins",
  "Tickets",
  "Gems",
  // Modes and pick modes.
  "Classic",
  "Ranked",
  "Brawl",
  "Survival",
  "Draft Pick",
  "Blind Pick",
  ...SUB_MODE_NAMES,
  // A stat the game names on its own.
  "Spell Vamp",
];

/**
 * The same names in the game data, whose source is English: only those no
 * English sentence uses as ordinary words. "Epic", "Common" or "Limited
 * time" are prose there.
 */
export const DATA_NAMES = [
  "Mythical Immortal",
  "Mythical Glory",
  "Mythical Honor",
  "Grandmaster",
  "Lucky Box",
  "Tank Emblem",
  "Fighter Emblem",
  "Assassin Emblem",
  "Mage Emblem",
  "Marksman Emblem",
  "Support Emblem",
  "Battle Points",
  "Hero Fragments",
  "Premium Skin Fragments",
  "Magic Cores",
  "Myth Coins",
  "Draft Pick",
  "Blind Pick",
  ...SUB_MODE_NAMES,
  "Spell Vamp",
];

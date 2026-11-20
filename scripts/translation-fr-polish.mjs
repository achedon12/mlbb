/**
 * French proofreading of the game data translated from English: skills,
 * items, modes, combos and the Advance Server notes (not the patch notes,
 * which `patch-translation.mjs` handles).
 *
 * The official French community turned the site down for its machine
 * translation. Beyond the shared vocabulary (`translation-glossary.mjs`), the
 * service leaves English stat names in French sentences ("10 % de Physical
 * Attack"), conjugates a cooldown label as a verb ("Refroidir"), writes
 * "dommages", "vrais dégâts", "1 pile(s)" or "1ère Compétence", turns
 * "Minotaur" into "le Minotaure" and leaves whole English sentences in a
 * French paragraph. It also translates the game's own names, which the site
 * keeps as the game writes them (`translation-official-names.mjs`): ranks,
 * modes, "Spell Vamp". This module puts that right on output; the cache keeps
 * what the service returned, so a rule changed here only needs a rerun.
 *
 * It also finds the cached translations that left a sentence of their source
 * in English (`forgetUntranslated`), so that the next run translates them
 * again instead of keeping them for good.
 */

// ── Hand translations of short labels ──────────────────────────────

/**
 * Item summaries (the line under an item's name), keyed by their English
 * source: out of context the service read "Spell Vamp" as a vampire's spell
 * (the game's name for the stat, kept), "One-Hit Slow" as a slow hit and
 * "Counter High HP" as "PV contre-élevé".
 */
export const FR_SOURCE = new Map([
  ["Attack Speed", "Vitesse d'attaque"],
  ["CD Reduction", "Réduction du temps de recharge"],
  ["CD Reduction & Crit", "Réduction du temps de recharge et critique"],
  ["Counter High HP", "Contre les PV élevés"],
  ["Crit & Attack Speed", "Critique et vitesse d'attaque"],
  ["Crit Chance & Damage", "Chances et dégâts critiques"],
  ["Damage for Tanks", "Dégâts pour les tanks"],
  ["Enhance Attack Effects", "Effets d'attaque renforcés"],
  ["Healing Reduction", "Réduction des soins"],
  ["Low-HP Retaliation", "Riposte à PV faibles"],
  ["Low-HP Shield", "Bouclier à PV faibles"],
  ["Magic Basic Attacks", "Attaques de base magiques"],
  ["Mana Regen & CD Reduction", "Régénération de mana et réduction du temps de recharge"],
  ["One-Hit Slow", "Ralentissement à l'impact"],
  ["Physical Attack Reduction", "Réduction de l'attaque physique"],
  ["Physical Damage Immunity", "Immunité aux dégâts physiques"],
  ["Protect Teammates", "Protection des alliés"],
  ["Reduce Enemy Attack Speed", "Réduction de la vitesse d'attaque ennemie"],
  ["Resist Burst Magic Damage", "Résistance aux pics de dégâts magiques"],
  ["Slow on Skill Hit", "Ralentissement à l'impact des compétences"],
  ["Speed Boost Shield", "Bouclier et bonus de vitesse"],
  ["Spell Vamp", "Spell Vamp"],
  ["Splash Damage", "Dégâts de zone"],
  ["Stackable Physical Defense", "Défense physique cumulable"],
  ["Ultimate CD Reduction", "Réduction du temps de recharge de l'ultime"],
]);

/**
 * Stats as the site names them (`stats` in `src/i18n/messages/fr.json`),
 * longest first so that "Hybrid Lifesteal" wins over "Lifesteal". Spell Vamp
 * keeps the game's name: the site had both "vampirisme des sorts" and "vol de
 * vie magique" for it, two inventions.
 */
const STATS = [
  ["Crit Damage Reduction", "réduction des dégâts critiques"],
  ["Cooldown Reduction", "réduction du temps de recharge"],
  ["Physical Penetration", "pénétration physique"],
  ["Magic Penetration", "pénétration magique"],
  ["Adaptive Penetration", "pénétration adaptative"],
  ["Physical Defense", "défense physique"],
  ["Magic Defense", "défense magique"],
  ["Hybrid Defense", "défense hybride"],
  ["Hybrid Lifesteal", "vol de vie hybride"],
  ["Magic Lifesteal", "vol de vie magique"],
  ["Physical Attack", "attaque physique"],
  ["Adaptive Attack", "attaque adaptative"],
  ["Movement Speed", "vitesse de déplacement"],
  ["Slow Reduction", "réduction des ralentissements"],
  ["Healing Effect", "effet de soin"],
  ["Attack Speed", "vitesse d'attaque"],
  ["Crit Chance", "chances de coup critique"],
  ["Crit Damage", "dégâts critiques"],
  ["Magic Power", "puissance magique"],
  ["Mana Regen", "régénération de mana"],
  ["Spell Vamp", "Spell Vamp"],
  ["HP Regen", "régénération de PV"],
  ["Lifesteal", "vol de vie"],
  ["Mana", "mana"],
  ["HP", "PV"],
];
const STAT_NAMES = new Map(STATS);
const STAT = new RegExp(`^\\+(\\d+(?:\\.\\d+)?)(%?) (${STATS.map(([en]) => en).join("|")})$`);

/**
 * An item's stat line ("+30 Physical Attack, +10% Lifesteal"), written the
 * same way on every item: the service rendered each one differently ("+15
 * Attaque Physique", "+15 de puissance magique", "Régénération +4 PV").
 * Null when the text is not a stat line.
 */
export function frenchStatLine(source) {
  const parts = String(source ?? "")
    .trim()
    .replace(/,$/, "")
    .split(/,\s*/);
  const out = [];
  for (const part of parts) {
    const m = part.match(STAT);
    if (!m) return null;
    const [, n, percent, stat] = m;
    out.push(`+${n.replace(".", ",")}${percent ? " %" : ""} ${STAT_NAMES.get(stat)}`);
  }
  return out.length ? out.join(", ") : null;
}

/**
 * Whole labels of the Advance Server notes, as the service returned them:
 * "Cooldown" came back as the verb "Refroidir", "Cast Range" as a range of
 * cast iron.
 */
export const FR_LABELS = new Map([
  ["Refroidir", "Temps de recharge"],
  ["Coût énergétique", "Coût en énergie"],
  ["Lent", "Ralentissement"],
  ["Gamme de fonte", "Portée de lancement"],
  ["Gamme de lancer", "Portée de lancer"],
  ["Chemin de construction", "Recette"],
  ["Régénération PV", "Régénération de PV"],
  ["Exp fournie", "EXP fournie"],
  ["Piles maximales", "Cumuls maximum"],
  ["Buff par pile", "Bonus par cumul"],
  ["Condition d'empilage", "Condition de cumul"],
  ["Attaque Affect Hérité", "Effets d'attaque hérités"],
  ["Effet pile complète", "Effet à cumuls complets"],
  ["Vitesse d'attaque Durée lente", "Vitesse d'attaque, durée du ralentissement"],
]);

// ── Rules on any translated text ───────────────────────────────────

const cap = (word, like) => (/^\p{Lu}/u.test(like) ? word[0].toUpperCase() + word.slice(1) : word);
/** French rank names the service writes, back to the game's. */
const RANKS = { Guerrier: "Warrior", Élite: "Elite", Maître: "Master", Épique: "Epic", Légende: "Legend", Mythique: "Mythic" };
const PILE = { une: "un", la: "le", sa: "son", cette: "ce", chaque: "chaque", par: "par", de: "de", des: "des", les: "les", ses: "ses", aux: "aux" };

/** [pattern, replacement]: case-sensitive, in order. */
export const FR_RULES = [
  // Hero names the service translated, article included: "le Minotaure".
  [/\b([Dd])u Minotaure\b/g, "$1e Minotaur"],
  [/\b([Aa])u Minotaure\b/g, (_, a) => `${a === "A" ? "À" : "à"} Minotaur`],
  [/\b(?:[Ll]e )?Minotaure\b/g, "Minotaur"],
  [/\bGuenièvre\b/g, "Guinevere"],
  [/\b[Ll]a [Bb]êta\b/g, "Beta"],
  // Ranks keep the game's names: no source gives the French client's, and
  // the service invents them ("Gloire mythique", "Épique V").
  [/\b(?:Honneur|Honor) mythique\b/gi, "Mythical Honor"],
  [/\bGloire mythique\b/gi, "Mythical Glory"],
  [/\bImmortel mythique\b/gi, "Mythical Immortal"],
  [/\bMythic Honou?r\b/g, "Mythical Honor"],
  [/\bMythic Glory\b/g, "Mythical Glory"],
  [/\bMythic Immortal\b/g, "Mythical Immortal"],
  [/\bGrand[- ]?[Mm]aître\b/g, "Grandmaster"],
  [/(?<!\p{L})(Guerrier|Élite|Maître|Épique|Légende|Mythique) (I{1,3}|IV|V)\b/gu, (_, r, n) => `${RANKS[r]} ${n}`],
  [/(?<!\p{L})([Rr]angs?|atteint|atteignez|atteindre) (Guerrier|Élite|Maître|Épique|Légende|Mythique)\b/gu, (_, w, r) => `${w} ${RANKS[r]}`],
  // A list of ranks: "Guerrier / Élite / Maître", "Épique/Légende/Mythique".
  [/(?<!\p{L})(Guerrier|Élite|Maître|Épique|Légende|Mythique)(?=\s?\/\s?(?:Guerrier|Élite|Maître|Grandmaster|Épique|Légende|Mythique|Warrior|Elite|Master|Epic|Legend|Mythic)\b)/gu, (r) => RANKS[r]],
  [/(?<=\/\s?)(Guerrier|Élite|Maître|Épique|Légende|Mythique)(?!\p{L})/gu, (r) => RANKS[r]],
  // Modes and game words.
  [/\b[Cc]hoix de repêchage\b/g, "Draft Pick"],
  [/\brepêchage\b/g, "draft"],
  // Mode names stay as the game writes them (Brawl, Magic Chess: the glossary).
  [/\bGrabuge\b/g, "Mayhem"],
  [/\bde Classic\b/g, "du mode Classic"],
  [/\bClassique\b/g, "Classic"],
  [/(?<!\p{L})(modes?|en|le mode|du mode|Classic et|Classic,) Classé(?!\p{L})/gu, "$1 Ranked"],
  [/(?<!\p{L})Classé(?= et (?:Classic|Brawl)\b)/gu, "Ranked"],
  [/\b[Cc]hoix à l['’]aveugle\b/g, "Blind Pick"],
  [/\b(?:([Ll])e |([Dd])u |([Aa])u )?Pays de l['’]Aube\b/g, (_, l, d, a) => `${l ? `${l}a ` : d ? `${d}e la ` : a ? `${a === "A" ? "À" : "à"} la ` : ""}Terre de l'Aube`],
  [/\bDéfense des Anciens\s*:\s*Allstars\b/g, "Defense of the Ancients: Allstars"],
  [/\bgançant\b/g, "gankant"],
  [/\bdégâts éclatés\b/g, "dégâts en rafale"],
  // English stats left in a French sentence.
  [/\bMax (?:HP|PV)\b/g, "PV max"],
  [/\bMax Mana\b/g, "mana max"],
  [/\b(?:Hero Level|Hero level|niveau de héros)\b/g, "niveau du héros"],
  [/\b(?:(?:son |sa |le |du )?(?:sort de vampire|vampire magique|vampire des sorts|vampirisme des sorts|vampirisme magique))\b/gi, (m) => {
    const det = m.match(/^(son|sa|le|du) /i)?.[1].toLowerCase();
    return `${det ? `${det === "sa" ? "son" : det} ` : ""}Spell Vamp`;
  }],
  [/\b[Rr]atio de vampire\b/g, (m) => `${m[0]}atio de Spell Vamp`],
  [/\b(?:son |sa )?sort Vamp\b/g, (m) => (m.startsWith("s") && m !== "sort Vamp" ? "son " : "") + "Spell Vamp"],
  [/\bExtra (?:Max PV|PV max|Max HP)\b/g, "PV max supplémentaires"],
  [/\bEffets d['’]Attaque\b/g, "effets d'attaque"],
  ...STATS.filter(([en]) => en !== "HP" && en !== "Mana").map(([en, fr]) => [new RegExp(`\\b${en}\\b(?!\\s+\\p{Lu})`, "gu"), fr]),
  [/(?<=[\p{Ll}\d,(] ?)Mana\b(?!\s+\p{Lu})/gu, "mana"],
  [/\bmanas\b/g, "mana"],
  [/\bratio (Spell Vamp|vol de vie)\b/g, "ratio de $1"],
  [/\bdéclencher (vol de vie|Spell Vamp)\b/g, "déclencher le $1"],
  [/\bBasic Attacks\b/g, "attaques de base"],
  [/\bBasic Attack\b/g, "attaque de base"],
  [/\b([Aa])ttaque(s?) de Base\b/g, "$1ttaque$2 de base"],
  [/\b(ses|les|des|sa|son|une|ces|leurs?|d['’]|l['’]) ?Attaque(s?) de base\b/g, (m) => m.replace("Attaque", "attaque")],
  // "Ultimate" stays English only in a skill's name ("Ultimate Snipe").
  [/(?<!\p{Lu}\p{L}*\s)\bUltimate\b(?!\s+\p{Lu})/gu, (m, offset, whole) => (offset === 0 || /[.!?:]\s*$/.test(whole.slice(0, offset)) ? "Ultime" : "ultime")],
  [/\b(son|sa|l['’]|d['’]|un|leur|cet|de|du) ?Ultime\b/g, (m) => m.replace("Ultime", "ultime")],
  [/\bcharges ultime\b/g, "charges d'ultime"],
  // Damage: "dégâts", never "dommages"; true damage is "dégâts réels".
  [/\b([Ll])e dommage\b/g, "$1es dégâts"],
  [/\b([Dd])u dommage\b/g, "$1es dégâts"],
  [/\bDommages?\b/g, "Dégâts"],
  [/\bdommages?\b/g, "dégâts"],
  // "60 (+30 %) de vrais dégâts" is a quantity, "inflige de vrais dégâts" an article.
  [/(?<=[\d)]\s)de vrais dégâts\b/g, "de dégâts réels"],
  [/\b([Dd])e vrais dégâts\b/g, "$1es dégâts réels"],
  [/\b[Vv]rais dégâts\b/g, (m) => cap("dégâts réels", m)],
  // Stacks: "cumuls", the word the data already uses most.
  [/\b(\d+(?:[,.]\d+)?) (?:stack|pile|cumul)\s?\(s\)/g, (_, n) => `${n} ${n === "1" ? "cumul" : "cumuls"}`],
  [/\b(\d+(?:[,.]\d+)?) charge\s?\(s\)/g, (_, n) => `${n} ${n === "1" ? "charge" : "charges"}`],
  // Any other "(s)" after a number: "1 boulon(s) supplémentaire(s)", "4 arme(s)".
  [/\b(\d+(?:[,.]\d+)?) ([\p{L}-]+)\(s\)(?: ([\p{L}-]+)\(s\))?/gu, (_, n, a, b) => {
    const s = n === "1" ? "" : "s";
    return `${n} ${a}${s}${b ? ` ${b}${s}` : ""}`;
  }],
  [/\bstacks\b/g, "cumuls"],
  [/\bstack\b/g, "cumul"],
  [/\b(\d+|[Uu]ne|[Ll]a|[Ss]a|[Cc]ette|[Cc]haque|par|de|des|[Ll]es|ses|aux|maximum de|max de) piles?\b/g, (m, d) => {
    const lower = d.toLowerCase();
    const plural = /s$/.test(m) || /^\d/.test(d) && d !== "1";
    const det = /^\d/.test(d) || lower.startsWith("max") ? d : cap(PILE[lower] ?? lower, d);
    return `${det} ${plural ? "cumuls" : "cumul"}`;
  }],
  [/\bPiles maximales\b/g, "Cumuls maximum"],
  // "pile" was feminine, "cumul" is not: "les cumuls sont complets".
  [/\b(cumuls? (?:sont |est )?)(complète|consommée|maximale|active|cumulée)(s?)\b/g,
    (_, w, a, s) => `${w}${{ complète: "complet", consommée: "consommé", maximale: "maximal", active: "actif", cumulée: "cumulé" }[a]}${s}`],
  [/\b(\d+(?:[,.]\d+)?) défenses physiques et magiques\b/g, "$1 points de défense physique et magique"],
  // "Toutes les 100 attaques physiques": every 100 points of the stat.
  [/\b([Tt])outes les (\d+(?:[,.]\d+)?) (attaques|défenses) (physiques|magiques|hybrides|adaptatives)\b/g,
    (_, t, n, stat, kind) => `${t}ous les ${n} points ${stat === "attaques" ? "d'attaque" : "de défense"} ${kind.slice(0, -1)}`],
  // "+4 défenses hybrides" is a quantity of a stat: "4 points de défense hybride".
  [/(?<!(?:[Ll]es|[Cc]haque|[Tt]outes les|[Tt]ous les) )\b(\d+(?:[,.]\d+)?(?: à \d+(?:[,.]\d+)?)?) (attaques|défenses) (physiques|magiques|hybrides|adaptatives)\b/g,
    (_, n, stat, kind) => `${n} points ${stat === "attaques" ? "d'attaque" : "de défense"} ${kind.slice(0, -1)}`],
  // Labels of the Advance Server notes.
  [/\b([Ee])ffets lents\b/g, "$1ffets de ralentissement"],
  [/\b([Ee])ffet lent\b/g, "$1ffet de ralentissement"],
  [/\b([Dd])urée lente\b/g, "$1urée du ralentissement"],
  [/^Lent pour\b/g, "Ralentissement pour"],
  [/\bCroissance des attaques physiques\b/g, "Croissance de l'attaque physique"],
  [/\bréduction de lenteur\b/g, "réduction des ralentissements"],
  // Ordinals: "1re", "2e", never "1ère" or "2ème"; no capital on the noun after.
  [/\b1(?:ère|ere)\b/g, "1re"],
  [/\b(\d+)(?:ème|eme)\b/g, "$1e"],
  [/\b(\d+(?:re|e)|première|deuxième|troisième|quatrième|sa|son|ses|la|les|une|cette|chaque) Compétence(s?)\b/g, "$1 compétence$2"],
];

/**
 * The French text to publish for `output`, the service's translation of
 * `source`. A stat line or a known label is rewritten whole; otherwise the
 * rules apply.
 */
export function polishFrench(output, source) {
  if (typeof output !== "string" || !output) return output;
  const key = typeof source === "string" ? source.trim() : "";
  if (FR_SOURCE.has(key)) return FR_SOURCE.get(key);
  const stats = frenchStatLine(key);
  if (stats) return stats;
  const text = FR_RULES.reduce((s, [re, by]) => s.replace(re, by), output);
  return FR_LABELS.get(text.trim()) ?? text;
}

// ── Translations that left English behind ──────────────────────────

const ENGLISH = /\b(?:the|of|a|an|to|and|is|are|with|for|by|in|on|at|his|her|its|their|from|that|this|will|be|can|when|while|after|before|but|if|or|has|have)\b/gi;

/**
 * The sentences of `source` (six words or more, three English function
 * words or more) found word for word in `output`: the service skipped them.
 * Skill and item names are a few words without "the", "and", "is": they do
 * not count.
 */
export function untranslatedSentences(source, output) {
  if (typeof source !== "string" || typeof output !== "string") return [];
  return source
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6 && (s.match(ENGLISH) ?? []).length >= 3 && output.includes(s));
}

/**
 * Drops from `cache` the translations into `tl` that kept an English sentence
 * of their source, so that the next `prepare` sends them again. Returns the
 * keys dropped.
 */
export function forgetUntranslated(cache, texts, sl, tl) {
  const dropped = [];
  for (const text of new Set(texts.map((x) => String(x).trim()))) {
    const key = `${sl}|${tl}|${text}`;
    if (typeof cache[key] === "string" && untranslatedSentences(text, cache[key]).length) {
      delete cache[key];
      dropped.push(key);
    }
  }
  return dropped;
}

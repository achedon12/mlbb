/**
 * The wiki's `{{scale}}` template, written out as text.
 *
 * Skill descriptions on the wiki give their numbers through it: the damage,
 * the shield, the heal. Dropping it, as the site long did, left "dealing
 * damage" with no figure in 265 of 627 descriptions.
 */
/**
 * `{{scale|base=300-400|total-pa=50|pd}}` as the game words it:
 * "300-400 (+50% Total Physical Attack) Physical Damage". Named arguments
 * are the scaling terms, the bare one the kind of effect. A term the table
 * does not know is left out rather than guessed.
 */
const SCALE_TERMS = {
  "total-pa": "Total Physical Attack",
  "extra-pa": "Extra Physical Attack",
  "total-mp": "Total Magic Power",
  "total-hp": "Max HP",
  "extra-hp": "Extra HP",
  "lost-hp": "Lost HP",
  "max-hp": "Max HP",
  "total-pdef": "Total Physical Defense",
  "extra-pd": "Extra Physical Defense",
  "total-mdef": "Total Magic Defense",
  "total-mana": "Max Mana",
  "extra-atk-spd": "Extra Attack Speed",
};
const SCALE_KINDS = {
  pd: "Physical Damage",
  md: "Magic Damage",
  td: "True Damage",
  hp: "HP",
  shield: "Shield",
};

export function renderScale(args) {
  let base = null;
  const terms = [];
  let kind = null;
  for (const part of String(args).split("|")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      const k = SCALE_KINDS[part.trim().toLowerCase()];
      if (k) kind = k;
      continue;
    }
    const name = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (!value) continue;
    if (name === "base") base = value;
    else if (name === "level") terms.push(`(+${value}*Hero Level)`);
    else if (SCALE_TERMS[name]) {
      // "lost-hp=Aamon's 3": the owner comes first, the percentage after.
      const m = /^(.*?)\s*(-?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)$/.exec(value);
      if (!m) continue;
      terms.push(m[1] ? `(+${m[2]}% of ${m[1]} ${SCALE_TERMS[name]})` : `(+${m[2]}% ${SCALE_TERMS[name]})`);
    }
  }
  return [base, ...terms, kind].filter(Boolean).join(" ");
}

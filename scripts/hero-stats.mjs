/**
 * Hero base stats: which source wins, field by field.
 *
 * Three sources, none complete on its own:
 *
 * - **the official patch notes** (`patches.json`, the notes Moonton publishes,
 *   read from the wikis): each "Attributes" section gives the value after the
 *   patch ("Base HP 2440 → 2500", "HP Growth 180 → 195"). Dated and official,
 *   but they only say what changed, and only for the patches the site keeps
 *   in detail;
 * - **Liquipedia** (`{{Infobox hero}}`): level-1 values for every hero, kept up
 *   to date by its editors after each patch (93 of the 117 changes of the
 *   2026 notes applied in November 2026). No level-15 values, no growth, no
 *   attack range;
 * - **the Fandom data module** (`Module:Hero/data`): levels 1 and 15 and the
 *   basic attack range for every hero, but no longer maintained for the
 *   attributes (15 of the same 117 changes applied).
 *
 * The rules:
 *
 * - **level 1**: the most recent patch note value, when one of the detailed
 *   patches changed that attribute; Liquipedia otherwise; Fandom last. The
 *   note wins over Liquipedia because it is the official text of the change,
 *   with its version: a Liquipedia page not yet edited after a patch lags
 *   behind it, never the other way round;
 * - **level 15**: level 1 plus 14 times the growth per level (the game's
 *   formula: Fandom's own values satisfy `v15 = v1 + 14 × growth`). The
 *   growth comes from the most recent patch note that changed it, else from
 *   Fandom's two values. Rebuilding level 15 this way keeps it consistent with
 *   the corrected level 1, instead of pairing a new base with an old curve;
 * - **attack range**: patch note, else Fandom (Liquipedia does not give it).
 *
 * A value no source gives stays absent, as before. The disagreements between
 * Liquipedia and the patch notes are returned to the caller, which reports
 * them in the sync log: they are the values worth checking in game.
 */
import { splitUnlabelled } from "./patch-parser.mjs";
import { compareVersions } from "./patch-version.mjs";

/** Pairs read at levels 1 and 15, by field prefix. */
const LEVELLED = ["hp", "mana", "physical_atk", "physical_def", "magic_def"];

/** Patch note labels of the "Attributes" section, to the stat they set. */
const LABELS = [
  [/^(?:base )?hp$/i, ["hp1"]],
  [/^hp growth(?: per level|\/level)?$/i, ["hp_growth"]],
  [/^(?:base )?mana$/i, ["mana1"]],
  [/^mana growth(?: per level|\/level)?$/i, ["mana_growth"]],
  [/^(?:base )?(?:physical )?attack$/i, ["physical_atk1"]],
  [/^(?:base )?physical attack$/i, ["physical_atk1"]],
  [/^(?:physical )?attack growth(?: per level|\/level)?$/i, ["physical_atk_growth"]],
  [/^(?:base )?physical defense$/i, ["physical_def1"]],
  [/^physical defense growth(?: per level|\/level)?$/i, ["physical_def_growth"]],
  [/^(?:base )?magic defense$/i, ["magic_def1"]],
  [/^magic defense growth(?: per level|\/level)?$/i, ["magic_def_growth"]],
  [/^(?:base )?hybrid defense$/i, ["physical_def1", "magic_def1"]],
  [/^(?:base )?hp regen(?:eration)?(?: per second|\/s)?$/i, ["hp_regen1"]],
  [/^(?:base )?movement speed$/i, ["movement_spd"]],
  [/^basic attack range$/i, ["basic_atk_range"]],
];

const number = (v) => {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(v ?? ""));
  return m ? Number(m[1]) : null;
};

/**
 * A patch note value: a number, or a number followed by its unit ("22.4 per
 * second", Marcel's HP regen in 2.1.88; "22.4/s"). A percentage or any other
 * text is not a base value.
 */
const noteNumber = (v) => {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:per second|\/\s*s(?:ec(?:ond)?)?)?\s*$/i.exec(String(v ?? ""));
  return m ? Number(m[1]) : null;
};

/** Number as the stats are stored: a string, at most two decimals, no trailing zeros. */
const text = (n) => String(Math.round(n * 100) / 100);

/**
 * Attribute values set by the detailed patch notes, per hero slug: for each
 * stat field, the value after the most recent patch that changed it, and that
 * patch's version. Only the hero's "Attributes" section counts: a skill
 * section can carry a "Movement Speed" that is a buff, not a base value.
 */
export function patchAttributes(details) {
  const out = {};
  const versions = Object.keys(details ?? {}).sort(compareVersions);
  for (const version of versions) {
    for (const a of details[version]?.adjustments ?? []) {
      if (!a?.slug) continue;
      for (const s of a.sections ?? []) {
        if (!/^(?:base )?attributes?$/i.test(String(s?.name ?? "").trim()) || s.category) continue;
        for (const c of s.changes ?? []) {
          const value = noteNumber(c?.after);
          // A label written without its colon was read as part of the old
          // value by earlier syncs ("Base HP 2594", Hanzo in 2.1.88): it is
          // recovered here, so the notes already stored count too.
          const label = c?.label ?? (c?.before ? splitUnlabelled(c.before).label : null);
          if (value === null || !label) continue;
          const rule = LABELS.find(([re]) => re.test(label.trim()));
          if (!rule) continue;
          for (const field of rule[1]) (out[a.slug] ??= {})[field] = { value, version };
        }
      }
    }
  }
  return out;
}

/**
 * Final stats of one hero. `fandom` and `liquipedia` are stat records as in
 * `heroes.json` (strings), `patch` the hero's entry of `patchAttributes`.
 * Returns the stats, the source of each field, and the fields where
 * Liquipedia and the patch notes disagree.
 */
export function mergeHeroStats({ fandom, liquipedia, patch } = {}) {
  const f = fandom ?? {};
  const lp = liquipedia ?? {};
  const p = patch ?? {};
  const stats = {};
  const sources = {};
  const conflicts = [];

  const level1 = (key) => {
    const fromLp = number(lp[key]);
    if (p[key]) {
      if (fromLp !== null && fromLp !== p[key].value) conflicts.push({ field: key, liquipedia: fromLp, patch: p[key].value, version: p[key].version });
      return [p[key].value, `patch ${p[key].version}`];
    }
    if (fromLp !== null) return [fromLp, "liquipedia"];
    const fromFandom = number(f[key]);
    return fromFandom !== null ? [fromFandom, "fandom"] : [null, null];
  };

  for (const prefix of LEVELLED) {
    const [v1, source] = level1(`${prefix}1`);
    if (v1 === null) continue;
    stats[`${prefix}1`] = text(v1);
    sources[`${prefix}1`] = source;
    const f1 = number(f[`${prefix}1`]);
    const f15 = number(f[`${prefix}15`]);
    const growth = p[`${prefix}_growth`]?.value ?? (f1 !== null && f15 !== null && f15 >= f1 ? (f15 - f1) / 14 : null);
    // A growth of zero on a stat whose level 1 is not zero is a hole in the
    // module (Zetian's physical attack: 0 and 0), not a flat curve.
    if (growth === null || (growth === 0 && v1 !== 0 && !p[`${prefix}_growth`])) continue;
    stats[`${prefix}15`] = text(v1 + 14 * growth);
    sources[`${prefix}15`] = p[`${prefix}_growth`] ? `patch ${p[`${prefix}_growth`].version}` : "fandom growth";
  }

  for (const key of ["hp_regen1", "movement_spd"]) {
    const [v, source] = level1(key);
    if (v === null) continue;
    stats[key] = text(v);
    sources[key] = source;
  }

  // The module sometimes writes the range as a sentence ("1.8 / 2.6 (Flash
  // Strike)"): kept as it is, the simulator ignores what is not a number.
  if (p.basic_atk_range) {
    stats.basic_atk_range = text(p.basic_atk_range.value);
    sources.basic_atk_range = `patch ${p.basic_atk_range.version}`;
  } else if (f.basic_atk_range) {
    stats.basic_atk_range = number(f.basic_atk_range) === null ? String(f.basic_atk_range) : text(number(f.basic_atk_range));
    sources.basic_atk_range = "fandom";
  }

  return { stats: Object.keys(stats).length ? orderedStats(stats) : null, sources, conflicts };
}

// The stored order of `heroes.json`, kept so a sync diff shows values, not moves.
const ORDER = [
  "hp1", "hp15", "hp_regen1", "mana1", "mana15",
  "physical_atk1", "physical_atk15", "physical_def1", "physical_def15",
  "magic_def1", "magic_def15", "movement_spd", "basic_atk_range",
];

/** Stats in the stored field order. */
export function orderedStats(stats) {
  if (!stats) return null;
  return Object.fromEntries(ORDER.filter((k) => k in stats).map((k) => [k, stats[k]]));
}

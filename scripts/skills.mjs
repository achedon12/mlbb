/**
 * Hero skills: official text first, wiki second.
 *
 * Two sources describe each skill:
 *
 * - **the official hero sheet** published by Moonton, read through the
 *   community API arena.rone.dev (`/api/heroes/<name>`, `heroskilllist`): the
 *   in-game name, the in-game description with every number in it, and the
 *   cooldown and cost (`skillcd&cost`, "CD: 3.5   Energy Cost: 12");
 * - **the Fandom wiki** (`{{Ability}}` on the hero page): the same skills,
 *   written by its editors, with cooldown and cost per skill level. It lags
 *   behind the game: in November 2026 a third of its numbers no longer matched
 *   the official text, and revamped kits (Kagura, Masha) still had their old
 *   descriptions.
 *
 * So for each slot (passive, skill 1, skill 2, ultimate) the official skill
 * wins — name, description, cooldown, cost — and the wiki fills what the
 * sheet does not give. The official skill is found by name, else by position
 * when the sheet has exactly the four skills of the slots (a revamp renames
 * skills: Masha's "Life Recovery" no longer exists). A hero with a fifth
 * official skill (Yu Zhong, Zhask…) and no name in common keeps the wiki's.
 */
import { withoutTags } from "./wikitext.mjs";

const key = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Attribute placeholders the official texts leave unexpanded ("8% of the
 * target's <1005>"), read from their contexts: "Current <1005>", "for every
 * 100 <1030>" (freeze per Magic Power), "ignores 30% of the target's <1060>",
 * Carmilla "steals 6-13 <1999>". `<1998>` is left out: its contexts (Aamon's
 * lost HP, Belerick's max HP) do not settle it.
 */
const ATTRIBUTE_CODES = {
  1005: "HP",
  1020: "Physical Attack",
  1030: "Magic Power",
  1060: "Physical Defense",
  1070: "Magic Defense",
  1997: "HP",
  1999: "Hybrid Defense",
};

/**
 * True when an official text cannot be shown as it is: an attribute
 * placeholder no one could read, or a damage with its base value missing
 * ("dealing (+100% Total Physical Attack)", Tigreal's Sacred Hammer). The
 * wiki's text is then preferred.
 */
export function officialTextDefective(raw) {
  const text = String(raw ?? "");
  if ([...text.matchAll(/<(\d{4})>/g)].some((m) => !ATTRIBUTE_CODES[m[1]])) return true;
  return /\b(?:deal|deals|dealing|equal to)\s+\(\+/i.test(cleanOfficialText(text));
}

/** Cleans an official description: font tags, line breaks, entities. */
export function cleanOfficialText(raw) {
  return withoutTags(
    String(raw ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<(\d{4})>/g, (m, code) => ATTRIBUTE_CODES[code] ?? ""),
  )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    // "250 (+55% Total Physical Attack)": the colour tags sat right against
    // the number and leave no space before the parenthesis once removed.
    .replace(/(\d)\(/g, "$1 (")
    .trim();
}

const numbers = (text) =>
  String(text ?? "")
    .split(/\s*\/\s*/)
    .map((v) => Number(v.trim()))
    .filter((n, _, all) => all.length > 0 && Number.isFinite(n));

/**
 * "CD: 3.5   Energy Cost: 12" → { cooldown: [3.5], cost: [12] }. The sheet gives
 * one value, the first level's; a field it does not give is left out.
 */
export function parseCooldownCost(text) {
  const out = {};
  const cd = /CD\s*:\s*(\d+(?:\.\d+)?)/i.exec(String(text ?? ""));
  if (cd) out.cooldown = [Number(cd[1])];
  const cost = /([A-Za-z]+)\s+Cost\s*:\s*(\d+(?:\.\d+)?)/i.exec(String(text ?? ""));
  if (cost) out.cost = [Number(cost[2])];
  return out;
}

/**
 * Per-level values of a wiki field ("9.0 / 8.5 / 8.0"), or null when the
 * field holds anything but numbers.
 */
export function levelValues(text) {
  const raw = String(text ?? "").trim();
  if (!raw || !/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*$/.test(raw)) return null;
  const list = numbers(raw);
  return list.length ? list : null;
}

/**
 * Skills of an official sheet (`hero.data` of the API), every form included,
 * in order. `group` is the form: 0 for the base kit, then the transformed
 * ones (Lunox's Order and Chaos, Beatrix's guns…).
 */
export function officialSkills(sheet) {
  return (sheet?.heroskilllist ?? []).flatMap((g, group) =>
    (g?.skilllist ?? []).map((s) => ({
      // Game identifier: combos refer to the skill through it.
      id: s.skillid ?? null,
      group,
      name: String(s.skillname ?? "").trim(),
      description: cleanOfficialText(s.skilldesc) || null,
      ...(officialTextDefective(s.skilldesc) ? { defective: true } : {}),
      icon: s.skillicon ? String(s.skillicon) : null,
      ...parseCooldownCost(s["skillcd&cost"]),
    })),
  );
}

const SLOTS = 4;

/**
 * The official skill of each slot, or null. `wiki` is the list of the
 * hero page (one entry per slot, null for an empty one), `official` that of
 * `officialSkills`.
 */
export function matchOfficial(wiki, official) {
  const base = (official ?? []).filter((s) => s.group === 0 && s.name);
  const byName = new Map(base.map((s) => [key(s.name), s]));
  const used = new Set();
  const out = Array.from({ length: SLOTS }, (_, i) => {
    const s = wiki?.[i]?.name ? byName.get(key(wiki[i].name)) : undefined;
    if (s) used.add(s);
    return s ?? null;
  });
  if (base.length === SLOTS) {
    for (let i = 0; i < SLOTS; i += 1) if (!out[i] && !used.has(base[i])) out[i] = base[i];
  }
  return out;
}

/**
 * Final skills of a hero: one entry per slot, `{ name, description,
 * cooldown?, cost? }`, or null for a slot no source fills. `previous` is the
 * list of the last sync, the last resort when both sources fail.
 */
export function mergeSkills({ wiki = [], official = [], previous = [] } = {}) {
  const matched = matchOfficial(wiki, official);
  const list = [];
  for (let i = 0; i < SLOTS; i += 1) {
    const o = matched[i];
    const w = wiki[i] ?? null;
    const old = previous[i] ?? null;
    const name = o?.name || w?.name || old?.name || null;
    // The wiki only completes the official skill it describes: on a renamed
    // (revamped) skill, its text and figures belong to the old kit.
    const wikiSame = !o || (w?.name && key(w.name) === key(o.name)) ? w : null;
    // A defective official text gives way to the wiki's text of the same skill.
    const officialText = o?.defective && wikiSame?.description ? null : o?.description;
    const description = officialText ?? wikiSame?.description ?? old?.description ?? null;
    if (!name && !description) {
      list.push(null);
      continue;
    }
    const entry = { name, description };
    const cooldown = o?.cooldown ?? wikiSame?.cooldown ?? null;
    const cost = o?.cost ?? wikiSame?.cost ?? null;
    if (cooldown) entry.cooldown = cooldown;
    if (cost) entry.cost = cost;
    list.push(entry);
  }
  // A hero no source describes keeps nothing rather than four empty slots.
  return list.some(Boolean) ? list : [];
}

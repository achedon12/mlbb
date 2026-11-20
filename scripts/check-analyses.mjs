/**
 * Checks the hand-written hero analyses (`src/data/heroes/`, in French)
 * against the official skills (`src/data/game/skills/en.json`, the wiki's
 * names and English descriptions).
 *
 * The hero page shows each written skill next to the official one of the same
 * slot: its description and figures win over the game's. A written skill out
 * of place, or an effect told on the wrong skill, then puts a false sentence
 * under a real name ("Thorned Rose marks the enemies hit", where Lancelot's
 * Puncture does). Reported here:
 *
 * - `name`: a written skill that is not in the hero's kit, or not in its slot;
 * - `figures`: a cooldown or cost the official sheet does not give;
 * - `effect`: an effect (mark, slow, stun, shield…) that a skill's written
 *   description, or a sentence naming that skill, gives to it while the
 *   official description gives it to another skill of the kit;
 * - `foreign`: a skill name of another hero cited in an analysis.
 *
 * The effects are read through keywords, French on one side and English on
 * the other: a hint, not a proof. A finding checked by hand and kept goes in
 * `REVIEWED`, with the reason. `node scripts/check-analyses.mjs` prints the
 * findings and fails when one is left; `tests/unit/check-analyses.test.mjs`
 * runs the same check.
 */
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SLOTS = ["Passive", "Skill 1", "Skill 2", "Ultimate"];

/**
 * Effects, as the analyses write them and as the official descriptions do.
 * Only effects a description names in so many words: damage, range or
 * "burst" are everywhere.
 */
export const EFFECTS = {
  mark: { fr: /\bmarqu|\bmarque\b/i, en: /\bmark/i },
  slow: { fr: /ralenti/i, en: /\bslow|reduc\w*[^.]{0,30}movement speed|movement speed[^.]{0,30}reduc/i },
  stun: { fr: /étourdi/i, en: /\bstun/i },
  airborne: { fr: /en l'air|projette les ennemis|repouss|soulève/i, en: /airborne|knock|launch|push/i },
  shield: { fr: /bouclier/i, en: /\bshield/i },
  invulnerable: { fr: /invulnérab|intouchable|inciblable|insensible aux dégâts/i, en: /invincib|untargetable|immune|invulnerab/i },
  invisible: { fr: /invisib|camoufl/i, en: /camouflag|invisib|stealth/i },
  immobilize: { fr: /immobilis|enracin/i, en: /immobiliz|root|bind|petrif/i },
  silence: { fr: /silence/i, en: /silenc/i },
  pull: { fr: /\battir|\baspir/i, en: /\bpull|\bdrag|\bsuck|\bdraw/i },
  taunt: { fr: /provoqu/i, en: /taunt/i },
  summon: { fr: /invoqu/i, en: /summon/i },
  transform: { fr: /transform/i, en: /transform|\bform\b/i },
  reset: { fr: /réinitialis|recharge (?:est )?(?:réduite|remise)/i, en: /cooldown|reset/i },
  heal: { fr: /\bsoign|\bsoins?\b|régénèr|récupère des PV|restaure des PV/i, en: /\bheal|restor|regen|recover|lifesteal|spell vamp/i },
};

/** "sa compétence 2", "son ultime", "le passif": a slot named in a sentence. */
const SLOT_WORDS = [
  [/\bpassif\b/i, 0],
  [/\bcompétence 1\b|\bpremière compétence\b/i, 1],
  [/\bcompétence 2\b|\bdeuxième compétence\b/i, 2],
  [/\bultime\b/i, 3],
];

/**
 * Findings checked by hand and kept: `slug|kind|detail` → reason. The
 * keyword reading cannot tell, for instance, an ultimate that "boosts" a
 * skill from one that has the effect itself.
 */
export const REVIEWED = new Map([
  ["selena|effect|Primal Darkness|stun", "The summary lists her two forms: the stun is the arrow's, named first."],
  ["selena|effect|Primal Darkness|mark", "The sentence says the abyssal form consumes the marks: the passive's own text."],
  ["novaria|effect|Star Trail|summon", "\"The spheres she summons\": summoned by her skills 1 and 2, slowed by the passive, as written."],
  ["rafaela|effect|Holy Baptism|slow", "The slow named is the skill 1's, as the sentence says."],
  ["minotaur|effect|Minoan Fury|heal", "The summary: he heals (skill 2, passive) and his ultimate sends him into rage."],
]);

/** A data file written in TypeScript: it only imports types, so once transpiled it is plain data. */
async function importTs(file) {
  const { default: ts } = await import("typescript");
  const js = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

/** The hand-written analyses, every role. */
export async function loadAnalyses(dir = "src/data/heroes") {
  const out = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".ts") && f !== "index.ts").sort()) {
    for (const list of Object.values(await importTs(`${dir}/${file}`))) if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

const effectsIn = (text, side) => Object.keys(EFFECTS).filter((k) => EFFECTS[k][side].test(text ?? ""));
const sameFigures = (a, b) => !a || (Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]));

/** Clauses of a paragraph: a skill named at the start of one is the subject of its effects. */
const clauses = (text) =>
  String(text ?? "")
    .split(/(?<=[.;!?])\s+|,\s+(?=(?:sa|son|ses|et sa|et son|puis|puis sa|puis son)\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);

/** The slots a clause names, by slot word or by skill name. */
function slotsNamed(clause, kit) {
  const found = new Set();
  for (const [re, i] of SLOT_WORDS) if (re.test(clause)) found.add(i);
  kit.forEach((s, i) => {
    if (s?.name && clause.includes(s.name)) found.add(i);
  });
  return [...found];
}

/**
 * The findings for one analysis. `kit`: the hero's official skills, in slot
 * order. `others`: skill name → hero, for the other heroes.
 */
export function checkAnalysis(a, kit, others = new Map(), items = new Set()) {
  const findings = [];
  const push = (kind, detail, message) => {
    if (!REVIEWED.has(`${a.slug}|${kind}|${detail}`)) findings.push({ slug: a.slug, kind, detail, message });
  };
  if (!kit?.length) {
    push("name", "kit", "no official skills for this hero");
    return findings;
  }
  const names = kit.map((s) => s?.name);

  // Written skills: in the kit, in their slot, with the official figures.
  a.skills.forEach((s, i) => {
    const slot = SLOTS.indexOf(s.type);
    const at = names.indexOf(s.name);
    if (at === -1) push("name", s.name, `${s.type} "${s.name}" is not in the kit (${names.join(", ")})`);
    else if (at !== i || slot !== at) push("name", s.name, `"${s.name}" is ${SLOTS[at]} in the kit, written as ${s.type} in position ${i + 1}`);
    const official = kit[at];
    if (official) {
      if (!sameFigures(s.cooldown, official.cooldown)) push("figures", `${s.name}|cooldown`, `${s.name}: cooldown ${JSON.stringify(s.cooldown)}, official ${JSON.stringify(official.cooldown ?? null)}`);
      if (!sameFigures(s.cost, official.cost)) push("figures", `${s.name}|cost`, `${s.name}: cost ${JSON.stringify(s.cost)}, official ${JSON.stringify(official.cost ?? null)}`);
    }
  });

  // Effects, told on a skill that does not have them while another one does.
  const officialEffects = kit.map((s) => new Set(effectsIn(s?.description, "en")));
  // A description may give an effect to another skill of the kit ("Enemies
  // hit by Energy Wave are marked", in Guinevere's passive): that skill has it.
  kit.forEach((s) => {
    for (const sentence of String(s?.description ?? "").split(/(?<=[.!?])\s+/)) {
      names.forEach((n, i) => {
        if (n && sentence.includes(n)) for (const e of effectsIn(sentence, "en")) officialEffects[i].add(e);
      });
    }
  });
  const check = (slot, text, where) => {
    for (const e of effectsIn(text, "fr")) {
      if (officialEffects[slot].has(e)) continue;
      const holders = officialEffects.flatMap((set, i) => (set.has(e) ? [names[i]] : []));
      if (holders.length) push("effect", `${names[slot]}|${e}`, `${where}: "${e}" told on ${names[slot]}, the kit gives it to ${holders.join(", ")}`);
    }
  };
  a.skills.forEach((s) => {
    const at = names.indexOf(s.name);
    if (at !== -1) check(at, s.description, `skill ${s.name}`);
  });
  // The builds talk about items ("Dominance Ice reduces healing"): not checked for effects.
  const prose = [a.summary, ...a.analysis.split("\n\n"), ...a.strengths, ...a.weaknesses];
  for (const paragraph of prose) {
    for (const clause of clauses(paragraph)) {
      const slots = slotsNamed(clause, kit);
      if (slots.length === 1) check(slots[0], clause, `"${clause.slice(0, 90)}"`);
    }
  }

  // Another hero's skill named in this analysis.
  const text = [...prose, ...a.builds.map((b) => b.context), ...a.skills.map((s) => s.description)].join("\n");
  for (const [name, hero] of others) {
    // "Malefic Gun" is Layla's skill and an item.
    if (hero === a.slug || names.includes(name) || items.has(name)) continue;
    if (new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(text)) {
      push("foreign", name, `cites "${name}", a skill of ${hero}`);
    }
  }
  return findings;
}

/** Every finding, for every analysis. */
export async function checkAll() {
  const analyses = await loadAnalyses();
  const skills = JSON.parse(await readFile("src/data/game/skills/en.json", "utf8"));
  // Skill names of two words or more: a one-word name ("Rampage") is often a plain word.
  const others = new Map();
  for (const [hero, kit] of Object.entries(skills)) {
    for (const s of kit) if (s?.name && s.name.split(/\s+/).length >= 2) others.set(s.name, hero);
  }
  const items = new Set(JSON.parse(await readFile("src/data/game/items/en.json", "utf8")).map((o) => o.name));
  return analyses.flatMap((a) => checkAnalysis(a, skills[a.slug], others, items));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const findings = await checkAll();
  for (const f of findings) console.log(`${f.slug} [${f.kind}] ${f.message}`);
  console.log(findings.length ? `${findings.length} findings.` : "Every analysis matches the official skills.");
  process.exitCode = findings.length ? 1 : 0;
}

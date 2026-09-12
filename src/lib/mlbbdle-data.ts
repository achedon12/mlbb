import type { Langue } from "@/i18n/config";
import { cleValeur, libelleHeros, valeurWiki, type ChampHeros } from "@/i18n/donnees-heros";
import { creerT } from "@/i18n/traductions";
import { heros, histoires } from "./donnees";
import {
  drawSecrets,
  eligibleFrom,
  EPOCH,
  puzzleNumber,
  type Candidate,
  type DaySecrets,
  type Gender,
  type MlbbdleHero,
  type MlbbdlePuzzle,
  type SkillPuzzle,
} from "./mlbbdle";
import { decalerJour, hacher } from "./quiz";
import { poolQuiz } from "./quiz-donnees";

/**
 * MLBBdle data, prepared on the server: the compared roster (traits as
 * language-independent keys, labels on the side) and each day's puzzle.
 *
 * Skills come from the quiz pool: same icons, same names and excerpts with
 * the hero name already masked, and skill-mode practice reuses the file the
 * browser may already have cached (`/quiz/<language>.json`).
 */

/**
 * Gender is not in the game infobox: it comes from the story sheet, read in
 * English so the key does not depend on the translation.
 */
function genderOf(slug: string): Gender | null {
  const raw = histoires("en")[slug]?.profile?.gender?.trim().toLowerCase() ?? "";
  if (/^(man|male)$/.test(raw)) return "male";
  if (/^(wom[ae]n|female)$/.test(raw)) return "female";
  if (raw.startsWith("genderless")) return "none";
  return null;
}

const keyOf = (value: string | null) => (value ? cleValeur(value) : null);

type Roster = { heroes: MlbbdleHero[]; labels: Record<string, string> };
const ROSTERS = new Map<Langue, Roster>();

/**
 * Page roster and the label of every value, under `<column>.<key>`
 * (`damage.magic`, `roles.Tank`). One dictionary rather than labels on every
 * hero keeps the page light.
 */
export function mlbbdleRoster(locale: Langue): Roster {
  const cached = ROSTERS.get(locale);
  if (cached) return cached;
  const t = creerT(locale);
  const labels: Record<string, string> = {};
  const note = (column: string, field: ChampHeros, raw: string | null) => {
    const key = keyOf(raw);
    if (raw && key) labels[`${column}.${key}`] = libelleHeros(t, field, raw) ?? raw;
    return key;
  };

  const heroes = heros
    .map((h): MlbbdleHero => {
      const gender = genderOf(h.slug);
      if (gender) labels[`gender.${gender}`] = t(`pages.mlbbdleUI.genders.${gender}`);
      for (const r of h.roles) labels[`roles.${r}`] = t(`roles.${r}`);
      for (const l of h.lanes) labels[`lanes.${l}`] = t(`lanes.${l}`);
      return {
        slug: h.slug,
        name: h.name,
        icon: h.images.icon ?? h.images.portrait,
        gender,
        roles: h.roles,
        lanes: h.lanes,
        specialties: h.specialties.flatMap((s) => {
          const key = note("specialties", "specialty", s);
          return key ? [key] : [];
        }),
        damage: note("damage", "damage", h.damageType),
        range: note("range", "attack", h.attackType),
        resource: note("resource", "resource", h.resource),
        region: note("region", "region", h.region),
        year: Number(h.year) || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const roster = { heroes, labels };
  ROSTERS.set(locale, roster);
  return roster;
}

/** Draw candidates: language-independent, so everyone gets the same secret. */
export function mlbbdleCandidates(): Candidate[] {
  const skills = poolQuiz("en").competences;
  return heros.map((h) => ({
    slug: h.slug,
    since: eligibleFrom(h.release ? valeurWiki(h.release) : null),
    hasSkill: Boolean(skills[h.slug]?.length),
  }));
}

/** Secrets unrolled from the epoch, kept between requests. */
let history: DaySecrets[] = [];

function secretsOf(day: string): DaySecrets | undefined {
  if (day < EPOCH) return drawSecrets(mlbbdleCandidates(), day, day)[0];
  if (!history.length || history.at(-1)!.day < day) history = drawSecrets(mlbbdleCandidates(), day);
  return history[puzzleNumber(day) - 1];
}

/**
 * Skill of the day: picked in the English pool by its icon, then read back
 * in the requested language. All four languages show the same icon.
 */
function skillPuzzle(slug: string, day: string, locale: Langue): SkillPuzzle | null {
  const list = poolQuiz("en").competences[slug];
  if (!list?.length) return null;
  const chosen = list[hacher(`mlbbdle:skill:${day}:${slug}`) % list.length];
  const translated = poolQuiz(locale).competences[slug]?.find((c) => c.icone === chosen.icone) ?? chosen;
  return { answer: slug, name: translated.nom, icon: chosen.icone, excerpt: translated.extrait };
}

export function mlbbdlePuzzle(locale: Langue, day: string): MlbbdlePuzzle | null {
  const secrets = secretsOf(day);
  if (!secrets?.classic) return null;
  const previousDay = decalerJour(day, -1);
  const yesterday = previousDay >= EPOCH ? secretsOf(previousDay) : undefined;
  return {
    day,
    number: puzzleNumber(day),
    classic: secrets.classic,
    skill: secrets.skill ? skillPuzzle(secrets.skill, day, locale) : null,
    yesterday: yesterday ? { classic: yesterday.classic, skill: yesterday.skill } : null,
  };
}

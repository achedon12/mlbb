import generatedVisuals from "@/data/game/visuals.json";
import type { Locale } from "@/i18n/config";
import { heroLabel } from "@/i18n/hero-data";
import { createT } from "@/i18n/translations";
import { skills, allHeroes, stories, illustrations, itemsFor, sync, visualsSkills } from "./data";
import {
  cut,
  generateChallenge,
  hash,
  MASK,
  maskName,
  type SkillQuiz,
  type Challenge,
  type QuizHero,
  type ItemQuiz,
  type ItemRoster,
  type PoolQuiz,
  type SkinQuiz,
} from "./quiz";
import { rankingFull, measure } from "./tier-list";
import type { Hero } from "./types";

/**
 * Quiz pool, prepared server-side in each language: skills,
 * story excerpts, skins, items and win rates, already reduced to what
 * the rounds display, hero names masked. The full catalogue weighs
 * several megabytes; the pool, about a hundred KB, and the daily challenge
 * a few KB.
 */

const ICONS_ITEMS = (generatedVisuals as unknown as { items: Record<string, string> }).items;

/**
 * Per hero: enough to vary practice without bloating the pool. Three
 * skills and two 340-character excerpts brought it down from 400 to 250 KB.
 */
const SKINS_BY_HERO = 3;
const SKILLS_BY_HERO = 3;
const EXCERPTS_BY_HERO = 2;
const LENGTH_EXCERPT = 340;
const LENGTH_DESCRIPTION = 150;
const LENGTH_PASSIVE = 200;

/**
 * Wiki template leftovers in descriptions: "Passif|e", "Prowler|e",
 * "Mark|mark". The word is kept, what follows the pipe is dropped.
 */
function cleanWiki(text: string): string {
  return text.replace(/\|[\p{L}-]*/gu, "").replace(/\s{2,}/g, " ");
}

/** Hero name and full name from their story ("Aamon Paxley"): to be masked everywhere. */
function namesOf(h: Hero, locale: Locale): string[] {
  const full = stories(locale)[h.slug]?.profile?.fullName;
  return full ? [h.name, full] : [h.name];
}

function quizHeroes(locale: Locale): QuizHero[] {
  const t = createT(locale);
  return allHeroes.map((h) => ({
    slug: h.slug,
    nom: h.name,
    icone: h.images.icon ?? h.images.portrait,
    roles: h.roles,
    lanes: h.lanes,
    annee: Number(h.year) || null,
    region: heroLabel(t, "region", h.region),
  }));
}

function skillsQuiz(h: Hero, locale: Locale): SkillQuiz[] {
  const icons = visualsSkills[h.slug] ?? {};
  const names = namesOf(h, locale);
  return (skills(locale)[h.slug] ?? [])
    .flatMap((c) =>
      c && icons[c.name]
        ? [
            {
              nom: maskName(c.name, names),
              icone: icons[c.name],
              extrait: c.description
                ? cut(maskName(cleanWiki(c.description), names), LENGTH_DESCRIPTION)
                : null,
            },
          ]
        : [],
    )
    .sort((a, b) => hash(`${h.slug}:${a.icone}`) - hash(`${h.slug}:${b.icone}`))
    .slice(0, SKILLS_BY_HERO);
}

/**
 * Paragraphs of the lore, headings and tagline excluded. Those where the hero's name
 * appeared come first: they are about the hero, not a side
 * character.
 */
function excerptsStory(h: Hero, locale: Locale): string[] {
  const story = stories(locale)[h.slug];
  if (!story) return [];
  const names = namesOf(h, locale);
  const excerpts = story.lore
    .filter((p) => !p.startsWith("=") && p.length >= 90 && p !== story.tagline)
    .map((p) => cut(maskName(cleanWiki(p), names), LENGTH_EXCERPT));
  return [...excerpts.filter((e) => e.includes(MASK)), ...excerpts.filter((e) => !e.includes(MASK))].slice(
    0,
    EXCERPTS_BY_HERO,
  );
}

/** A few illustrations per hero, always the same from one build to the next. */
function skinsQuiz(h: Hero, locale: Locale): SkinQuiz[] {
  const names = namesOf(h, locale);
  return Object.entries(illustrations[h.slug] ?? {})
    .sort(([a], [b]) => hash(`${h.slug}:${a}`) - hash(`${h.slug}:${b}`))
    .slice(0, SKINS_BY_HERO)
    .map(([name, image]) => ({ nom: maskName(name, names), image }));
}

function itemsQuiz(locale: Locale): ItemQuiz[] {
  const t = createT(locale);
  const list = itemsFor(locale);
  const bySlug = new Map(list.map((o) => [o.slug, o]));
  // Recipes list components by their English name.
  const slugByName = new Map([...itemsFor("en"), ...list].map((o) => [o.name, o.slug]));
  return list
    .filter((o) => o.price && o.bonus)
    .map((o) => {
      const category = t(`categories.${o.category}`);
      const passive = o.passive ?? o.unique ?? o.active;
      return {
        slug: o.slug,
        nom: o.name,
        icone: ICONS_ITEMS[o.slug] ?? null,
        prix: o.price,
        categorie: category === `categories.${o.category}` ? o.category : category,
        bonus: o.bonus!,
        recette: o.recipe.map((name) => {
          const slug = slugByName.get(name);
          return { nom: (slug && bySlug.get(slug)?.name) || name, icone: (slug && ICONS_ITEMS[slug]) || null };
        }),
        passif: passive ? cut(maskName(cleanWiki(passive), [o.name]), LENGTH_PASSIVE) : null,
      };
    });
}

const POOLS = new Map<Locale, PoolQuiz>();

export function poolQuiz(locale: Locale): PoolQuiz {
  let pool = POOLS.get(locale);
  if (!pool) {
    const collect = <T>(f: (h: Hero) => T[]) =>
      Object.fromEntries(allHeroes.flatMap((h) => {
        const list = f(h);
        return list.length ? [[h.slug, list]] : [];
      }));
    pool = {
      version: hash(`${sync.date}|${measure}`).toString(36),
      mesure: measure,
      heros: quizHeroes(locale),
      competences: collect((h) => skillsQuiz(h, locale)),
      histoires: collect((h) => excerptsStory(h, locale)),
      skins: collect((h) => skinsQuiz(h, locale)),
      objets: itemsQuiz(locale),
      victoires: Object.fromEntries(
        rankingFull.filter((e) => !e.lowSample).map((e) => [e.hero.slug, e.winRate]),
      ),
    };
    POOLS.set(locale, pool);
  }
  return pool;
}

/** What the page sends up front: enough to suggest and compare answers. */
export function rosterQuiz(locale: Locale): { heroes: QuizHero[]; items: ItemRoster[] } {
  const pool = poolQuiz(locale);
  return {
    heroes: pool.heros,
    items: pool.objets.map(({ slug, nom: name, icone: icon, prix: price, categorie: category }) => ({ slug, nom: name, icone: icon, prix: price, categorie: category })),
  };
}

export function challengeOfDay(locale: Locale, day: string): Challenge {
  return generateChallenge(poolQuiz(locale), day);
}

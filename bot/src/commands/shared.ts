import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import type { Context } from "../discord/types.js";
import { notFoundEmbed, offersInvite } from "../embeds/common.js";
import { bestBuild, type BuildView, type CounterView } from "../embeds/game.js";
import { inviteUrl } from "../links.js";
import { RANKS, type HeroDetail, type HeroSummary, type Rank, type RankingEntry } from "../site/game-data.js";
import { EMBLEMS } from "../catalog.js";
import { normalize, resolveByName, searchByName, suggest, toChoices, type Named } from "../search.js";

/** Lookups shared by several commands: heroes, rankings, builds, counters. */

export async function heroChoices(interaction: AutocompleteInteraction, ctx: Context) {
  const heroes = await ctx.services.data.heroes();
  return toChoices(searchByName(heroes, String(interaction.options.getFocused())));
}

export async function findHero(ctx: Context, value: string): Promise<HeroSummary | null> {
  return resolveByName(await ctx.services.data.heroes(), value);
}

/** A hero's full record from an option value, or null after telling the user, with the closest names. */
export async function heroOrReply(interaction: ChatInputCommandInteraction, ctx: Context, value: string): Promise<HeroDetail | null> {
  const heroes = await ctx.services.data.heroes();
  const summary = resolveByName(heroes, value);
  const hero = summary ? await ctx.services.data.hero(summary.slug) : null;
  if (!hero) await replyNotFound(interaction, ctx, value, heroes);
  return hero;
}

/** "Nothing found for …", with the names of `candidates` closest to what was typed. */
export async function replyNotFound(
  interaction: ChatInputCommandInteraction,
  ctx: Context,
  query: string,
  candidates: readonly Named[] = [],
): Promise<void> {
  // Public for most commands: what was typed is quoted escaped (see `plain`).
  await interaction.editReply({ embeds: [notFoundEmbed(ctx, query, suggest(candidates, query).map((c) => c.name))] });
}

/** The invite offered under a reply, or null in the community server (see `offersInvite`). */
export function inviteFor(ctx: Context, guildId: string | null): string | null {
  return offersInvite(guildId, ctx.services.config.SUPPORT_GUILD_ID) ? inviteUrl(ctx.services.clientId) : null;
}

export function parseRank(value: string | null): Rank {
  return value && (RANKS as readonly string[]).includes(value) ? (value as Rank) : "all";
}

/** The hero's line in the all-ranks ranking; a failed lookup only hides the rates. */
export async function rankingOf(ctx: Context, slug: string): Promise<RankingEntry | null> {
  try {
    return (await ctx.services.data.rankings()).heroes.find((h) => h.slug === slug) ?? null;
  } catch {
    return null;
  }
}

/**
 * Item names in the reply language. Builds name items in English (the stats
 * API's language); the localized list is matched on the English one by slug.
 */
export async function localizeItems(ctx: Context, names: string[]): Promise<string[]> {
  if (ctx.locale === "en") return names;
  try {
    const [en, local] = await Promise.all([ctx.services.data.items("en"), ctx.services.data.items(ctx.locale)]);
    const slugByName = new Map(en.map((i) => [i.name, i.slug]));
    const nameBySlug = new Map(local.map((i) => [i.slug, i.name]));
    return names.map((n) => nameBySlug.get(slugByName.get(n) ?? "") ?? n);
  } catch {
    return names;
  }
}

/** Measured builds for a rank, else the written ones; the rank is null for written builds. */
export async function buildsOf(ctx: Context, hero: HeroDetail, rank: Rank): Promise<{ builds: BuildView[]; rank: Rank | null }> {
  const measured = await ctx.services.data.builds(hero.slug).catch(() => null);
  if (measured) {
    const list = Object.entries(measured)
      .flatMap(([lane, byRank]) => (byRank[rank] ?? []).map((b) => ({ ...b, lane })))
      .sort((a, b) => (b.pickRate ?? 0) - (a.pickRate ?? 0))
      .slice(0, 5);
    if (list.length) {
      const builds = await Promise.all(
        list.map(async (b) => ({ ...b, items: await localizeItems(ctx, b.items) })),
      );
      return { builds, rank };
    }
  }
  const written = hero.analysis?.builds ?? [];
  const builds = await Promise.all(written.map((b) => writtenBuild(ctx, b)));
  return { builds, rank: null };
}

/** The build the hero sheet shows: the most played measured one, or the first written one. */
export async function topBuildOf(ctx: Context, hero: HeroDetail): Promise<BuildView | null> {
  const measured = bestBuild(await ctx.services.data.builds(hero.slug).catch(() => null));
  if (measured) return { ...measured, items: await localizeItems(ctx, measured.items) };
  const written = hero.analysis?.builds[0];
  return written ? writtenBuild(ctx, written) : null;
}

type WrittenBuild = NonNullable<HeroDetail["analysis"]>["builds"][number];

async function writtenBuild(ctx: Context, b: WrittenBuild): Promise<BuildView> {
  return { items: await localizeItems(ctx, b.items), emblem: await localizeEmblem(ctx, b.emblem), spell: b.spell || null };
}

/**
 * The analyses are written in French, the site's first language, emblems
 * included ("Emblème de soutien") while items keep their English names. The
 * emblem is recognised in either language and named in the reply's.
 */
const EMBLEM_WORDS: Record<string, string> = {
  tank: "tank", fighter: "combattant", assassin: "assassin", mage: "mage", marksman: "tireur", support: "soutien",
};

export function emblemSlug(name: string): string | null {
  const n = normalize(name);
  for (const e of EMBLEMS) {
    if (n === normalize(e.name) || n === normalize(`Emblème de ${EMBLEM_WORDS[e.slug]}`) || n === normalize(`Emblème d'${EMBLEM_WORDS[e.slug]}`)) return e.slug;
  }
  return null;
}

export async function localizeEmblem(ctx: Context, name: string): Promise<string | null> {
  if (!name) return null;
  const slug = emblemSlug(name);
  if (!slug) return name;
  const localized = (await ctx.services.data.emblems(ctx.locale).catch(() => null))?.find((e) => e.slug === slug)?.name;
  return localized ?? EMBLEMS.find((e) => e.slug === slug)!.name;
}

export async function countersOf(ctx: Context, hero: HeroDetail, rank: Rank): Promise<CounterView> {
  const heroes = await ctx.services.data.heroes();
  const name = (slug: string) => heroes.find((h) => h.slug === slug)?.name ?? slug;
  const measured = await ctx.services.data.counters(hero.slug).catch(() => null);
  const byRank = measured?.[rank] ?? measured?.all;
  if (byRank && (byRank.strong.length || byRank.weak.length)) {
    return {
      strong: byRank.strong.map((c) => ({ name: name(c.slug), advantage: c.advantage })),
      weak: [...byRank.weak].sort((a, b) => a.advantage - b.advantage).map((c) => ({ name: name(c.slug), advantage: c.advantage })),
    };
  }
  return {
    strong: (hero.analysis?.strongAgainst ?? []).map((s) => ({ name: name(s) })),
    weak: (hero.analysis?.weakAgainst ?? []).map((s) => ({ name: name(s) })),
  };
}

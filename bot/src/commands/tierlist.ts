import { choiceOption, optionName, slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { label, openRow } from "../embeds/common.js";
import { tierlistEmbed } from "../embeds/game.js";
import { LANES, RANKS, ROLES, type HeroSummary, type Lane, type Rank, type RankingEntry, type Role } from "../site/game-data.js";
import { parseRank } from "./shared.js";

export interface TierlistFilters {
  rank: Rank;
  lane: Lane | null;
  role: Role | null;
}

export function parseTierlistOptions(raw: { rank: string | null; lane: string | null; role: string | null }): TierlistFilters {
  return {
    rank: parseRank(raw.rank),
    lane: raw.lane && (LANES as readonly string[]).includes(raw.lane) ? (raw.lane as Lane) : null,
    role: raw.role && (ROLES as readonly string[]).includes(raw.role) ? (raw.role as Role) : null,
  };
}

/**
 * Page of the site matching the filters. The site has one page per rank, per
 * lane and per role, not per combination: the most specific single filter wins.
 */
export function tierlistPath(f: TierlistFilters): string {
  if (f.lane) return `/tier-list/lane/${f.lane.toLowerCase()}`;
  if (f.role) return `/tier-list/role/${f.role.toLowerCase()}`;
  return f.rank === "all" ? "/tier-list" : `/tier-list/${f.rank}`;
}

export function filterRanking(entries: RankingEntry[], heroes: HeroSummary[], f: TierlistFilters): RankingEntry[] {
  if (!f.lane && !f.role) return entries;
  const bySlug = new Map(heroes.map((h) => [h.slug, h]));
  return entries.filter((e) => {
    const h = bySlug.get(e.slug);
    return h && (!f.lane || h.lanes.includes(f.lane)) && (!f.role || h.roles.includes(f.role));
  });
}

export const tierlist: Command = {
  key: "tierlist",
  data: () =>
    slash("tierlist")
      .addStringOption(choiceOption("tierlist", "rank", "rank", RANKS))
      .addStringOption(choiceOption("tierlist", "lane", "lane", LANES))
      .addStringOption(choiceOption("tierlist", "role", "role", ROLES))
      .toJSON(),
  async execute(interaction, ctx) {
    const f = parseTierlistOptions({
      rank: interaction.options.getString(optionName("tierlist", "rank")),
      lane: interaction.options.getString(optionName("tierlist", "lane")),
      role: interaction.options.getString(optionName("tierlist", "role")),
    });
    let rankings = await ctx.services.data.rankings(f.rank);
    let note: string | null = null;
    // The site may not filter by rank yet: it then answers without `rank`, and
    // showing those figures under a rank's name would be a lie.
    const fellBack = f.rank !== "all" && rankings.rank !== f.rank;
    if (fellBack) {
      rankings = await ctx.services.data.rankings("all");
      note = ctx.t("ui.common.allRanksFallback");
    }
    if (rankings.measuredAt) {
      const measured = ctx.t("ui.common.measuredAt", { date: rankings.measuredAt.slice(0, 10) });
      note = note ? `${note}\n${measured}` : measured;
    }
    const entries = filterRanking(rankings.heroes, f.lane || f.role ? await ctx.services.data.heroes() : [], f);
    const filter = [
      f.rank !== "all" && !fellBack ? ctx.t(`choices.rank.${f.rank}`) : null,
      f.lane ? label(ctx, "labels.lanes", f.lane) : null,
      f.role ? label(ctx, "labels.roles", f.role) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const path = tierlistPath(f);
    await interaction.editReply({ embeds: [tierlistEmbed(ctx, entries, filter || null, path, note)], components: [openRow(ctx, path)] });
  },
};

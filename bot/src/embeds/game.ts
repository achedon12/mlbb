import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type EmbedBuilder } from "discord.js";
import type { CatalogEntry } from "../catalog.js";
import type { BuildPlayed, EventEntry, HeroDetail, Item, NamedEntry, Patch, PatchDetail, RankingEntry, SkinEntry } from "../site/game-data.js";
import { baseEmbed, clip, COLORS, label, laneLabels, linkButton, listOr, roleLabels, TIER_COLORS, type View } from "./common.js";

/**
 * Embeds of the game-data commands. Pure functions of the data: the commands
 * fetch, these lay out, and the tests check the layout without Discord.
 */

/** A build as the hero and build embeds show it: measured or written. */
export interface BuildView {
  items: string[];
  emblem: string | null;
  spell: string | null;
  winRate?: number | null;
  pickRate?: number | null;
  lane?: string;
}

/** The measured build to show first: the most played of the "all ranks" measure. */
export function bestBuild(builds: Record<string, Record<string, BuildPlayed[]>> | null, rank = "all"): (BuildPlayed & { lane: string }) | null {
  if (!builds) return null;
  let best: (BuildPlayed & { lane: string }) | null = null;
  for (const [lane, byRank] of Object.entries(builds)) {
    for (const b of byRank[rank] ?? []) {
      if (!best || (b.pickRate ?? 0) > (best.pickRate ?? 0)) best = { ...b, lane };
    }
  }
  return best;
}

export function heroEmbed(view: View, hero: HeroDetail, ranking: RankingEntry | null, build: BuildView | null): EmbedBuilder {
  const embed = baseEmbed(view, ranking ? (TIER_COLORS[ranking.tier] ?? COLORS.brand) : COLORS.brand)
    .setTitle(clip(hero.title ? `${hero.name} — ${hero.title}` : hero.name, 256))
    .setURL(view.link(`/heroes/${hero.slug}`))
    .addFields(
      { name: view.t("ui.hero.role"), value: listOr(view, roleLabels(view, hero.roles)), inline: true },
      { name: view.t("ui.hero.lanes"), value: listOr(view, laneLabels(view, hero.lanes)), inline: true },
    );
  const thumbnail = view.asset(hero.images.icon ?? hero.images.portrait);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (ranking) {
    embed.addFields(
      { name: view.t("ui.hero.tier"), value: ranking.tier, inline: true },
      { name: view.t("ui.hero.winRate"), value: view.percent(ranking.winRate), inline: true },
      { name: view.t("ui.hero.pickRate"), value: view.percent(ranking.pickRate), inline: true },
      { name: view.t("ui.hero.banRate"), value: view.percent(ranking.banRate), inline: true },
    );
  }
  if (build) {
    embed.addFields({ name: view.t("ui.hero.build"), value: listOr(view, build.items, " · ") });
    if (build.emblem) embed.addFields({ name: view.t("ui.hero.emblem"), value: build.emblem, inline: true });
    if (build.spell) embed.addFields({ name: view.t("ui.hero.spell"), value: build.spell, inline: true });
  }
  const skills = hero.skills.flatMap((s) => (s ? [s.name] : []));
  if (skills.length) embed.addFields({ name: view.t("ui.hero.skills"), value: listOr(view, skills, " · ") });
  return embed;
}

/** Build · Counters · Skins buttons, then the link to the hero page. */
export function heroButtons(view: View, slug: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`hero:build:${slug}`).setStyle(ButtonStyle.Secondary).setLabel(view.t("ui.hero.buttonBuild")),
    new ButtonBuilder().setCustomId(`hero:counter:${slug}`).setStyle(ButtonStyle.Secondary).setLabel(view.t("ui.hero.buttonCounters")),
    new ButtonBuilder().setCustomId(`hero:skins:${slug}`).setStyle(ButtonStyle.Secondary).setLabel(view.t("ui.hero.buttonSkins")),
    linkButton(view.t("ui.common.open"), view.link(`/heroes/${slug}`)),
  );
}

export function buildEmbed(view: View, hero: { slug: string; name: string }, builds: BuildView[], measuredRank: string | null): EmbedBuilder {
  const embed = baseEmbed(view)
    .setTitle(view.t("ui.build.title", { hero: hero.name }))
    .setURL(view.link(`/builds/${hero.slug}`));
  if (!builds.length) return embed.setDescription(view.t("ui.build.none"));
  embed.setDescription(
    measuredRank ? view.t("ui.build.measured", { rank: view.t(`choices.rank.${measuredRank}`) }) : view.t("ui.build.written"),
  );
  builds.slice(0, 5).forEach((b, i) => {
    const head = [b.lane ? label(view, "labels.lanes", b.lane) : null, b.emblem, b.spell].filter(Boolean).join(" · ");
    const rates =
      b.winRate !== undefined || b.pickRate !== undefined
        ? `\n${view.t("ui.build.rates", { win: view.percent(b.winRate), pick: view.percent(b.pickRate) })}`
        : "";
    embed.addFields({ name: clip(`${i + 1}. ${head || view.t("ui.build.items")}`, 256), value: clip(`${b.items.join(" · ")}${rates}`) });
  });
  return embed;
}

export interface CounterView {
  strong: { name: string; advantage?: number }[];
  weak: { name: string; advantage?: number }[];
}

function counterLine(view: View, list: CounterView["strong"]): string {
  return listOr(
    view,
    list.slice(0, 8).map((c) => (c.advantage === undefined ? c.name : `${c.name} (${c.advantage > 0 ? "+" : ""}${c.advantage.toFixed(1)})`)),
    "\n",
  );
}

export function counterEmbed(view: View, hero: { slug: string; name: string }, counters: CounterView): EmbedBuilder {
  const embed = baseEmbed(view, COLORS.blood)
    .setTitle(view.t("ui.counter.title", { hero: hero.name }))
    .setURL(view.link(`/heroes/${hero.slug}/counters`));
  if (!counters.strong.length && !counters.weak.length) return embed.setDescription(view.t("ui.counter.none"));
  return embed.addFields(
    { name: view.t("ui.counter.weak"), value: counterLine(view, counters.weak), inline: true },
    { name: view.t("ui.counter.strong"), value: counterLine(view, counters.strong), inline: true },
  );
}

export const TIER_ORDER = ["S+", "S", "A", "B", "C"];

export function tierlistEmbed(view: View, entries: RankingEntry[], filter: string | null, path: string, note: string | null): EmbedBuilder {
  const embed = baseEmbed(view)
    .setTitle(filter ? view.t("ui.tierlist.filtered", { filter }) : view.t("ui.tierlist.title"))
    .setURL(view.link(path));
  if (!entries.length) return embed.setDescription(view.t("ui.tierlist.empty"));
  // The top three tiers: below that, a list in a chat window stops being read.
  for (const tier of TIER_ORDER.slice(0, 3)) {
    const names = entries.filter((e) => e.tier === tier).map((e) => e.name);
    if (names.length) embed.addFields({ name: tier, value: listOr(view, names) });
  }
  if (note) embed.setDescription(note);
  return embed;
}

export function compareEmbed(
  view: View,
  a: { hero: HeroDetail; ranking: RankingEntry | null },
  b: { hero: HeroDetail; ranking: RankingEntry | null },
  path: string,
): EmbedBuilder {
  const column = (x: typeof a) =>
    [
      `**${view.t("ui.hero.role")}**: ${listOr(view, roleLabels(view, x.hero.roles))}`,
      `**${view.t("ui.hero.lanes")}**: ${listOr(view, laneLabels(view, x.hero.lanes))}`,
      `**${view.t("ui.hero.tier")}**: ${x.ranking?.tier ?? "—"}`,
      `**${view.t("ui.hero.winRate")}**: ${view.percent(x.ranking?.winRate)}`,
      `**${view.t("ui.hero.pickRate")}**: ${view.percent(x.ranking?.pickRate)}`,
      `**${view.t("ui.hero.banRate")}**: ${view.percent(x.ranking?.banRate)}`,
    ].join("\n");
  return baseEmbed(view, COLORS.azure)
    .setTitle(view.t("ui.compare.title", { a: a.hero.name, b: b.hero.name }))
    .setURL(view.link(path))
    .addFields(
      { name: a.hero.name, value: clip(column(a)), inline: true },
      { name: b.hero.name, value: clip(column(b)), inline: true },
    );
}

export function itemEmbed(view: View, item: Item): EmbedBuilder {
  const embed = baseEmbed(view)
    .setTitle(clip(item.name, 256))
    .setURL(view.link(`/items/${item.slug}`))
    .addFields({ name: view.t("ui.item.category"), value: item.category, inline: true });
  if (item.summary) embed.setDescription(clip(item.summary, 4096));
  if (item.price !== null) embed.addFields({ name: view.t("ui.item.price"), value: String(item.price), inline: true });
  if (item.bonus) embed.addFields({ name: view.t("ui.item.stats"), value: clip(item.bonus) });
  if (item.unique) embed.addFields({ name: view.t("ui.item.unique"), value: clip(item.unique) });
  if (item.passive) embed.addFields({ name: view.t("ui.item.passive"), value: clip(item.passive) });
  if (item.active) embed.addFields({ name: view.t("ui.item.active"), value: clip(item.active) });
  if (item.recipe.length) embed.addFields({ name: view.t("ui.item.recipe"), value: listOr(view, item.recipe, " + ") });
  return embed;
}

export function emblemEmbed(view: View, emblem: CatalogEntry, details: NamedEntry | null): EmbedBuilder {
  const embed = baseEmbed(view)
    .setTitle(details?.name ?? emblem.name)
    .setURL(view.link(`/emblems/${emblem.slug}`))
    .addFields({ name: view.t("ui.emblem.role"), value: listOr(view, roleLabels(view, emblem.roles)) });
  if (details?.description) embed.setDescription(clip(details.description, 4096));
  return embed;
}

export function spellEmbed(view: View, spell: CatalogEntry, details: NamedEntry | null): EmbedBuilder {
  const cooldown = details?.cooldown ?? spell.cooldown;
  const embed = baseEmbed(view, COLORS.azure)
    .setTitle(details?.name ?? spell.name)
    .setURL(view.link(`/spells/${spell.slug}`))
    .addFields({ name: view.t("ui.spell.roles"), value: listOr(view, roleLabels(view, spell.roles)) });
  if (cooldown) embed.addFields({ name: view.t("ui.spell.cooldown"), value: view.t("ui.spell.seconds", { n: cooldown }), inline: true });
  if (details?.description) embed.setDescription(clip(details.description, 4096));
  return embed;
}

export function patchEmbed(view: View, patch: Patch, detail: PatchDetail | null, latest: boolean): EmbedBuilder {
  const embed = baseEmbed(view, COLORS.green)
    .setTitle(clip(detail?.title ?? patch.title, 256))
    .setURL(view.link(`/patch-notes/${patch.version}`));
  if (latest) embed.setAuthor({ name: view.t("ui.patch.latest") });
  if (detail?.balance) {
    embed.addFields(
      { name: view.t("ui.patch.buffs"), value: String(detail.balance.buff), inline: true },
      { name: view.t("ui.patch.nerfs"), value: String(detail.balance.nerf), inline: true },
      { name: view.t("ui.patch.adjustments"), value: String(detail.balance.adjust), inline: true },
    );
  }
  const changed = detail?.adjustments ?? [];
  if (changed.length) {
    const mark = (type: string | null) => (type === "buff" ? "▲" : type === "nerf" ? "▼" : "◆");
    embed.addFields({ name: view.t("ui.patch.heroes"), value: listOr(view, changed.slice(0, 30).map((h) => `${mark(h.type)} ${h.name}`), "  ") });
  }
  return embed;
}

export function heroSkinsEmbed(view: View, hero: HeroDetail): EmbedBuilder {
  const embed = baseEmbed(view)
    .setTitle(view.t("ui.skins.title", { hero: hero.name }))
    .setURL(view.link(`/heroes/${hero.slug}/skins`));
  if (!hero.skins.length) return embed.setDescription(view.t("ui.skins.none"));
  // Newest first: the wiki lists skins in release order.
  const skins = [...hero.skins].reverse();
  embed.setDescription(
    clip(
      `${view.t("ui.skins.count", { n: hero.skins.length })}\n\n${skins
        .slice(0, 25)
        .map((s) => `• ${s.name}${s.rarity ? ` — ${s.rarity}` : ""}`)
        .join("\n")}`,
      4096,
    ),
  );
  const newest = skins[0];
  const image = newest ? view.asset(hero.images.skins[newest.id]) : undefined;
  if (image) embed.setImage(image);
  return embed;
}

export function newestSkinsEmbed(view: View, skins: SkinEntry[], heroName: (slug: string) => string): EmbedBuilder {
  const embed = baseEmbed(view).setTitle(view.t("ui.skins.newest")).setURL(view.link("/skins"));
  if (!skins.length) return embed.setDescription(view.t("ui.skins.none"));
  embed.setDescription(
    clip(skins.slice(0, 15).map((s) => `• **${s.name}** — ${heroName(s.hero)}${s.release ? ` (${s.release})` : ""}`).join("\n"), 4096),
  );
  const image = view.asset(skins[0]?.image);
  if (image) embed.setImage(image);
  return embed;
}

export function eventsEmbed(view: View, events: EventEntry[], now = Date.now()): EmbedBuilder {
  const embed = baseEmbed(view, COLORS.azure).setTitle(view.t("ui.events.title")).setURL(view.link("/events"));
  const time = (d: string | null) => (d && !Number.isNaN(Date.parse(d)) ? Date.parse(d) : null);
  const current = events.filter((e) => (time(e.start) ?? 0) <= now && (time(e.end) ?? Infinity) >= now);
  const upcoming = events.filter((e) => (time(e.start) ?? 0) > now).sort((a, b) => (time(a.start) ?? 0) - (time(b.start) ?? 0));
  // Discord timestamps render in each reader's own timezone and language.
  const stamp = (ms: number | null, style: "R" | "d") => (ms === null ? "" : ` — <t:${Math.floor(ms / 1000)}:${style}>`);
  const line = (e: EventEntry) => `• ${e.name}${current.includes(e) ? stamp(time(e.end), "R") : stamp(time(e.start), "d")}`;
  if (!current.length && !upcoming.length) return embed.setDescription(view.t("ui.events.none"));
  if (current.length) embed.addFields({ name: view.t("ui.events.current"), value: clip(current.slice(0, 12).map(line).join("\n")) });
  if (upcoming.length) embed.addFields({ name: view.t("ui.events.upcoming"), value: clip(upcoming.slice(0, 12).map(line).join("\n")) });
  return embed;
}

/** The "not in Discord yet" answer: a sentence and the page that has it. */
export function unavailableEmbed(view: View, path: string): EmbedBuilder {
  return baseEmbed(view, COLORS.night).setDescription(view.t("ui.common.unavailable")).setURL(view.link(path));
}

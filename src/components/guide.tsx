import Image from "next/image";
import Link from "@/components/link";
import { HeroTile } from "@/components/hero-tile";
import { DexSays } from "@/components/mascot";
import { AsideBlock, ReadingLayout } from "@/components/reading-layout";
import { artOf } from "@/components/sheet-poster";
import { BadgeTier, Score } from "@/components/ui";
import motion from "@/components/catalogue-motion.module.css";
import article from "@/components/guide-article.module.css";
import { findEmblem } from "@/data/emblems";
import { buildsPlayed, itemsFor } from "@/lib/data";
import { keyChoice, spellVisual, visualEmblem, visualItem, visualTalent } from "@/lib/build-visuals";
import { imageLane } from "@/lib/emblems";
import { longDate, dateMeasure, percentage } from "@/lib/freshness";
import { laneKit, shownKit, type KitChoice, type KitPart } from "@/lib/guide-lanes";
import type { Guide, GuideHeading, GuidePart } from "@/lib/guides";
import { cleanGuideHtml } from "@/lib/html";
import { BASE } from "@/lib/sections";
import { filterRanking, pathFilter } from "@/lib/tier-list-filters";
import { rankingFull } from "@/lib/tier-list";
import { nameTalent, textChoice } from "@/lib/usage-sheets";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";

/**
 * Guide pages: the hub card, the reading layout, and the two live blocks of a
 * role guide (the lane's heroes and what the lane builds).
 *
 * A guide is an illustrated article: it opens on the artwork of a hero who
 * plays what it teaches, Dex — the site's mascot, reading his map — tells
 * the point of it in a bubble, and the live blocks pull their figures out
 * large (the lane's best win rate, the share of the most built pieces).
 */

/**
 * The hero whose artwork opens a strategy guide: one who plays what the
 * guide teaches. A role guide takes the lane's best ranked hero of the day.
 */
const ART_HEROES: Record<string, string> = {
  "climbing-ranked": "alucard",
  "drafting-basics": "valentina",
  "farming-wave-management": "miya",
  "jungle-objectives": "lancelot",
  "laning-phase": "chou",
  "macro-split-push": "zilong",
  "roaming-vision": "franco",
  "teamfight-positioning": "atlas",
};

/** Hero shown on a guide: the lane's leader for a role guide, the chosen one otherwise. */
export function guideHero(g: Guide): string | null {
  if (g.lane) return laneHeroes(g.lane)[0]?.hero.slug ?? null;
  return ART_HEROES[g.slug] ?? null;
}

/** Artwork of a guide, from the hero it is about; nothing when that hero has none. */
export function guideArt(g: Guide): string | null {
  return artOf(guideHero(g));
}

/**
 * Card of the hub and of the "related guides" list: the guide's artwork,
 * its title in the display face over the foot of it, then its summary. On
 * the hub the section title already names the kind: the card only repeats
 * it among related guides. `large` is the hub's lead card.
 */
export function GuideCard({
  guide,
  minutes,
  locale,
  showKind = true,
  large = false,
  compact = false,
}: {
  guide: Guide;
  minutes: number;
  locale: Locale;
  showKind?: boolean;
  large?: boolean;
  /** The aside of a guide: a smaller card, the summary left out. */
  compact?: boolean;
}) {
  const t = createT(locale);
  const lane = guide.lane ? imageLane(guide.lane) : undefined;
  const art = guideArt(guide);
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className={cn("bevel-lg group flex h-full flex-col overflow-hidden bg-night-900 hover:bg-night-850", motion.lift)}
    >
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden bg-night-800",
          large ? "aspect-[16/10] lg:aspect-auto lg:min-h-[22rem] lg:flex-1" : compact ? "aspect-[16/7]" : "aspect-[16/9]",
          motion.art,
        )}
      >
        {art && (
          <Image
            src={art}
            alt=""
            fill
            sizes={large ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw"}
            className="object-cover object-[55%_22%]"
          />
        )}
        <span aria-hidden className="absolute inset-0 bg-linear-to-t from-night-900 via-night-900/40 to-transparent" />
        {lane && (
          <span aria-hidden className="bevel-sm absolute left-3 top-3 grid size-10 place-items-center bg-night-950/85">
            <Image src={lane} alt="" width={28} height={28} className="size-7 object-contain" />
          </span>
        )}
        <span
          className={cn(
            "display-caps absolute inset-x-0 bottom-0 block p-4 text-chalk-100 transition-colors group-hover:text-gold-300 sm:p-5",
            large ? "text-[clamp(2rem,1.3rem+2.4vw,3.4rem)]" : compact ? "text-[1.45rem]" : "text-[1.8rem]",
          )}
        >
          {guide.short}
        </span>
      </span>
      <span className={cn("flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5", large && "lg:flex-none")}>
        <span aria-hidden className="eclat mb-3 h-[3px] w-14 opacity-80 transition-[width] duration-300 group-hover:w-24" />
        {!compact && (
          <>
            <span className={cn("font-heading font-bold leading-snug text-chalk-100", large ? "text-xl" : "text-base")}>{guide.title}</span>
            <span className={cn("mt-1.5 text-sm leading-relaxed text-chalk-400", large ? "line-clamp-3" : "line-clamp-2")}>
              {guide.summary}
            </span>
          </>
        )}
        <span className="mt-auto flex items-center gap-2 pt-3 text-xs text-chalk-500">
          {showKind && (
            <>
              <span className="font-heading text-sm font-bold text-gold-400">{t(`pages.guides.kind.${guide.kind}`)}</span>
              <span aria-hidden className="text-chalk-600">·</span>
            </>
          )}
          <span>{t("pages.guides.readingTime", { n: minutes })}</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Link from another page to a guide, by its short name: "Guide: Drafting
 * basics →". Nothing when the guide does not exist, so a page never shows a
 * dead link.
 */
export function GuideLink({ guide: g, locale, className }: { guide: Guide | undefined; locale: Locale; className?: string }) {
  if (!g) return null;
  const t = createT(locale);
  return (
    <Link
      href={`/guides/${g.slug}`}
      className={className ?? "font-semibold text-gold-400 transition-colors hover:text-gold-500"}
    >
      {t("pages.guides.readGuide", { title: g.short })} →
    </Link>
  );
}

/**
 * Reading layout of a guide (`ReadingLayout`): the table of contents on the
 * left, the text held to about seventy characters, and the `aside` — related
 * guides and the tools the guide leads to — on the right on a wide screen.
 * Dex opens the text: the guide's point, in his bubble.
 */
export function GuideBody({
  guide,
  parts,
  headings,
  aside,
  locale,
}: {
  guide: Guide;
  parts: GuidePart[];
  headings: GuideHeading[];
  aside?: React.ReactNode;
  locale: Locale;
}) {
  const t = createT(locale);
  return (
    <ReadingLayout toc={headings} tocLabel={t("common.contents")} aside={aside} className="pt-6 sm:pt-12">
      {guide.summary && (
        <DexSays pose="carte" height={132} className="mb-8 sm:mb-10">
          <p className="text-base leading-relaxed text-chalk-100 sm:text-lg">{guide.summary}</p>
        </DexSays>
      )}
      {parts.map((part, i) =>
        part.type === "html" ? (
          <div
            key={i}
            className={cn("prose-mlbb", article.body)}
            dangerouslySetInnerHTML={{ __html: cleanGuideHtml(part.html, locale) }}
          />
        ) : guide.lane ? (
          <div key={i} className="my-10">
            {part.block === "heroes" ? (
              <LaneHeroes lane={guide.lane} locale={locale} />
            ) : (
              <LaneKitBlock lane={guide.lane} locale={locale} />
            )}
          </div>
        ) : null,
      )}
    </ReadingLayout>
  );
}

/** Tools a guide leads to, with the label and description of the site menu. */
export function GuideTools({ tools, locale }: { tools: string[]; locale: Locale }) {
  const t = createT(locale);
  const entries = tools.flatMap((href) => BASE.filter((e) => e.href === href));
  if (entries.length === 0) return null;
  return (
    <AsideBlock id="guide-tools" title={t("pages.guides.tools")}>
      <p className="-mt-1 mb-3 text-sm text-chalk-500">{t("pages.guides.toolsLead")}</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {entries.map(({ href, key, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn("bevel-sm group flex h-full items-start gap-3 bg-night-900 p-3 hover:bg-night-800", motion.lift)}
            >
              <span className="bevel-sm grid size-9 shrink-0 place-items-center bg-night-800 text-gold-400 transition-colors group-hover:bg-gold-400 group-hover:text-night-950">
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-base font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                  {t(`nav.${key}.label`)}
                </span>
                <span className="mt-0.5 block text-xs text-chalk-500">{t(`nav.${key}.desc`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AsideBlock>
  );
}

// -- Live blocks ----------------------------------------------------------------

/** Heroes shown for a lane: the top of its tier list, enough to choose from. */
const HEROES_SHOWN = 8;

/** The lane's best ranked heroes, all ranks, with reliable measurements only. */
export function laneHeroes(lane: Lane) {
  return filterRanking(rankingFull, { type: "lane", value: lane })
    .filter((e) => !e.lowSample)
    .slice(0, HEROES_SHOWN);
}

/**
 * The lane's heroes of the moment: the leader pulled out large — artwork,
 * tier crest and win rate as the block's one big figure — then the others
 * as a row of portraits with their rate in gold.
 */
function LaneHeroes({ lane, locale }: { lane: Lane; locale: Locale }) {
  const t = createT(locale);
  const name = t(`pages.tierList.laneSeo.${lane}`);
  const list = laneHeroes(lane);
  if (list.length === 0) return <p className="text-sm text-chalk-500">{t("pages.guides.heroesEmpty")}</p>;
  const [first, ...rest] = list;
  const art = artOf(first.hero.slug);
  return (
    <div>
      <p className="text-sm leading-relaxed text-chalk-500">
        {t("pages.guides.heroesLead", { lane: name, date: longDate(locale, dateMeasure) })}
      </p>
      <div className="mt-4 space-y-2">
          <Link
            href={`/heroes/${first.hero.slug}`}
            className={cn("bevel-lg group relative isolate flex min-h-56 items-end overflow-hidden bg-night-800 p-5 sm:min-h-64 sm:p-6", motion.art)}
          >
            {art && (
              <Image src={art} alt="" fill sizes="(min-width: 1024px) 70ch, 100vw" className="-z-10 object-cover object-[60%_25%]" />
            )}
            <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-night-950 via-night-950/70 to-night-950/10" />
            <span className="score score-outline absolute right-5 top-4 text-5xl" aria-hidden>
              1
            </span>
            <span className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-2">
              <span aria-hidden>
                <BadgeTier tier={first.tier} size="lg" />
              </span>
              <span className="sr-only">{t("pages.tierList.tier", { p: first.tier })}</span>
              <span className="min-w-0">
                <span className="display-caps block text-[2.6rem] text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-[3.4rem]">
                  {first.hero.name}
                </span>
                <span className="mt-2 flex items-baseline gap-2">
                  <Score value={percentage(locale, first.winRate)} className="text-[2.6rem]" />
                  <span className="text-sm text-chalk-300">{t("pages.tierList.win")}</span>
                </span>
              </span>
            </span>
          </Link>
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5" start={2}>
            {rest.map((e) => (
              <li key={e.hero.slug}>
                <HeroTile
                  href={`/heroes/${e.hero.slug}`}
                  name={e.hero.name}
                  portrait={e.hero.images.portrait ?? e.hero.images.icon}
                  figure={percentage(locale, e.winRate)}
                  label={`${t("pages.tierList.tier", { p: e.tier })} · ${t("pages.tierList.win")} ${percentage(locale, e.winRate)}`}
                  sizes="(min-width: 640px) 9rem, 30vw"
                />
              </li>
            ))}
          </ol>
      </div>
      <Link
        href={pathFilter({ type: "lane", value: lane })}
        className="mt-4 inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
      >
        {t("pages.guides.heroesLink", { lane: name })} →
      </Link>
    </div>
  );
}

/** A kit choice as shown: localized name, icon, and its page when it has one. */
interface ShownChoice {
  key: string;
  name: string;
  image: string | null;
  href?: string;
  share: number;
}

function resolveChoice(part: KitPart, c: KitChoice, t: T, locale: Locale): ShownChoice {
  if (part === "items") {
    const v = visualItem(c.name);
    const item = v.slug ? itemsFor(locale).find((o) => o.slug === v.slug) : undefined;
    return { key: c.name, name: item?.name ?? c.name, image: v.image, href: v.slug ? `/items/${v.slug}` : undefined, share: c.share };
  }
  if (part === "spells") {
    // Spells keep the name players see in a match, in every language.
    const v = spellVisual(c.name);
    return { key: c.name, name: c.name, image: v.image, href: v.href, share: c.share };
  }
  if (part === "emblems") {
    const v = visualEmblem(c.name);
    const record = findEmblem(c.name);
    const name = record ? textChoice(t, record.key, "name", record.name)! : t("pages.buildSimulator.commonEmblem");
    return { key: c.name, name, image: v.image, href: v.href, share: c.share };
  }
  const v = visualTalent(c.name);
  return { key: c.name, name: nameTalent(t, keyChoice(c.name)), image: v.image, share: c.share };
}

const KIT_PARTS: KitPart[] = ["items", "spells", "emblems", "talents"];

/** A hero's builds weigh by its popularity: its pick rate, all ranks. */
const WEIGHTS = Object.fromEntries(rankingFull.map((e) => [e.hero.slug, e.pickRate]));

/**
 * What the lane builds: one panel per part (items, spells, emblems,
 * talents), the most built choice pulled out with its icon large and its
 * share as the panel's figure, the others listed under it.
 */
function LaneKitBlock({ lane, locale }: { lane: Lane; locale: Locale }) {
  const t = createT(locale);
  const kit = shownKit(laneKit(buildsPlayed, WEIGHTS, lane));
  if (KIT_PARTS.every((p) => kit[p].length === 0)) {
    return <p className="text-sm text-chalk-500">{t("pages.guides.kitEmpty")}</p>;
  }
  return (
    <div>
      <p className="text-sm leading-relaxed text-chalk-500">
        {t("pages.guides.kitLead", { lane: t(`pages.tierList.laneSeo.${lane}`), date: longDate(locale, dateMeasure) })}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-3">
        {KIT_PARTS.filter((p) => kit[p].length > 0).map((part) => {
          const [lead, ...others] = kit[part].map((c) => resolveChoice(part, c, t, locale));
          const name = (s: ShownChoice, className: string) =>
            s.href ? (
              <Link href={s.href} className={cn(className, "transition-colors hover:text-gold-400")}>
                {s.name}
              </Link>
            ) : (
              <span className={className}>{s.name}</span>
            );
          return (
            <section key={part} className="bevel-lg bg-night-900 p-4 sm:p-5">
              <h3 className="flex items-baseline justify-between gap-3">
                <span className="display-caps text-2xl text-chalk-100">{t(`pages.guides.kitParts.${part}`)}</span>
                <span className="text-xs font-normal text-chalk-500">{t("pages.guides.kitShare")}</span>
              </h3>
              <div className="mt-3 flex items-center gap-3">
                <span className={cn("bevel-sm grid size-16 shrink-0 place-items-center bg-night-800 shadow-[inset_0_3px_0_var(--color-gold-400)]", motion.zoom)}>
                  {lead.image ? (
                    <Image src={lead.image} alt="" width={52} height={52} className="size-13 object-contain" />
                  ) : (
                    <span aria-hidden className="size-12" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  {name(lead, "block truncate font-heading text-lg font-bold text-chalk-100")}
                  <Score value={percentage(locale, lead.share)} className="mt-1 block text-[2rem]" />
                </span>
              </div>
              {others.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-night-700 pt-3">
                  {others.map((s) => (
                    <li key={s.key} className="flex items-center gap-2.5 text-sm">
                      {s.image ? (
                        <Image src={s.image} alt="" width={30} height={30} className="size-7.5 shrink-0 object-contain" />
                      ) : (
                        <span aria-hidden className="size-7.5 shrink-0 bg-night-800" />
                      )}
                      {name(s, "min-w-0 flex-1 truncate text-chalk-200")}
                      <span className="shrink-0 tabular-nums text-chalk-400">{percentage(locale, s.share)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <Link
        href="/tools/build"
        className="mt-4 inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
      >
        {t("pages.guides.kitLink")} →
      </Link>
    </div>
  );
}

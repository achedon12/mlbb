import Image from "next/image";
import Link from "@/components/link";
import { Foldable } from "@/components/foldable";
import { HeroPortrait } from "@/components/hero-portrait";
import { PatchToc } from "@/components/patch-toc";
import { BadgeTier, SectionTitle } from "@/components/ui";
import { emblems } from "@/data/emblems";
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
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";

/**
 * Guide pages: the hub card, the reading layout, and the two live blocks of a
 * role guide (the lane's heroes and what the lane builds).
 */

/**
 * Card of the hub and of the "related guides" list. On the hub the section
 * title already names the kind: the card only repeats it among related guides.
 */
export function GuideCard({
  guide,
  minutes,
  locale,
  showKind = true,
}: {
  guide: Guide;
  minutes: number;
  locale: Locale;
  showKind?: boolean;
}) {
  const t = createT(locale);
  const lane = guide.lane ? imageLane(guide.lane) : undefined;
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="bevel group flex h-full flex-col border border-night-700/70 bg-night-900/60 p-5 transition-colors hover:border-gold-500/60"
    >
      <span className="flex items-center gap-2.5 text-xs">
        {lane && <Image src={lane} alt="" width={24} height={24} className="size-6 shrink-0 object-contain" />}
        {showKind && (
          <>
            <span className="font-semibold uppercase tracking-wide text-gold-400">{t(`pages.guides.kind.${guide.kind}`)}</span>
            <span aria-hidden className="text-chalk-600">·</span>
          </>
        )}
        <span className="text-chalk-500">{t("pages.guides.readingTime", { n: minutes })}</span>
      </span>
      <span className="mt-2.5 font-heading text-lg font-bold leading-snug text-chalk-100 transition-colors group-hover:text-gold-400">
        {guide.title}
      </span>
      <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-chalk-500">{guide.summary}</span>
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

/** Table of contents as a plain list, for the folded version on narrow screens. */
function TocList({ headings }: { headings: GuideHeading[] }) {
  return (
    <ol className="space-y-1.5">
      {headings.map((h) => (
        <li key={h.anchor}>
          <a href={`#${h.anchor}`} className="text-chalk-300 transition-colors hover:text-gold-400">
            {h.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Reading layout: the table of contents beside the text from `lg` up, sticky
 * and following the reading; folded above the text below. The text column is
 * held to about seventy characters, the width a long text stays readable at.
 */
export function GuideBody({
  guide,
  parts,
  headings,
  locale,
}: {
  guide: Guide;
  parts: GuidePart[];
  headings: GuideHeading[];
  locale: Locale;
}) {
  const t = createT(locale);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:pt-10 lg:grid lg:grid-cols-[14rem_minmax(0,70ch)] lg:justify-center lg:gap-12">
      {headings.length > 1 && (
        <>
          <Foldable label={t("common.contents")} className="mb-6 lg:hidden">
            <TocList headings={headings} />
          </Foldable>
          <aside className="hidden lg:block">
            <PatchToc entries={headings} />
          </aside>
        </>
      )}
      <article className="min-w-0 max-w-[70ch]">
        {parts.map((part, i) =>
          part.type === "html" ? (
            <div
              key={i}
              className="prose-mlbb"
              dangerouslySetInnerHTML={{ __html: cleanGuideHtml(part.html, locale) }}
            />
          ) : guide.lane ? (
            <div key={i} className="my-6">
              {part.block === "heroes" ? (
                <LaneHeroes lane={guide.lane} locale={locale} />
              ) : (
                <LaneKitBlock lane={guide.lane} locale={locale} />
              )}
            </div>
          ) : null,
        )}
      </article>
    </div>
  );
}

/** Tools a guide leads to, with the label and description of the site menu. */
export function GuideTools({ tools, locale }: { tools: string[]; locale: Locale }) {
  const t = createT(locale);
  const entries = tools.flatMap((href) => BASE.filter((e) => e.href === href));
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="guide-tools">
      <SectionTitle id="guide-tools" lead={t("pages.guides.toolsLead")}>
        {t("pages.guides.tools")}
      </SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ href, key, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="bevel-sm group flex h-full items-start gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
            >
              <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
              <span className="min-w-0">
                <span className="block font-semibold text-chalk-100 transition-colors group-hover:text-gold-400">
                  {t(`nav.${key}.label`)}
                </span>
                <span className="mt-0.5 block text-sm text-chalk-500">{t(`nav.${key}.desc`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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

function LaneHeroes({ lane, locale }: { lane: Lane; locale: Locale }) {
  const t = createT(locale);
  const name = t(`pages.tierList.laneSeo.${lane}`);
  const list = laneHeroes(lane);
  if (list.length === 0) return <p className="text-sm text-chalk-500">{t("pages.guides.heroesEmpty")}</p>;
  return (
    <div>
      <p className="text-sm leading-relaxed text-chalk-500">
        {t("pages.guides.heroesLead", { lane: name, date: longDate(locale, dateMeasure) })}
      </p>
      <ol className="mt-4 space-y-1.5">
        {list.map((e) => (
          <li key={e.hero.slug}>
            <Link href={`/heroes/${e.hero.slug}`} className="tier-row">
              <HeroPortrait source={e.hero.images.icon ?? e.hero.images.portrait} name={e.hero.name} size="icon" decorative />
              <span className="tier-row-identity sm:w-auto sm:flex-1">
                <span className="tier-row-name">{e.hero.name}</span>
                <span className="tier-row-lanes">{e.hero.roles.map((r) => t(`roles.${r}`)).join(" · ")}</span>
              </span>
              <span className="sr-only">{t("pages.tierList.tier", { p: e.tier })}</span>
              <span aria-hidden>
                <BadgeTier tier={e.tier} />
              </span>
              <dl className="tier-row-rates">
                <div>
                  <dt>{t("pages.tierList.win")}</dt>
                  <dd>{percentage(locale, e.winRate)}</dd>
                </div>
                <div>
                  <dt>{t("pages.tierList.ban")}</dt>
                  <dd>{percentage(locale, e.banRate)}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href={pathFilter({ type: "lane", value: lane })}
        className="mt-3 inline-block text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
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
    const record = emblems.find((e) => e.role === c.name || e.name === c.name);
    const name = record ? textChoice(t, record.key, "name", record.name)! : t("pages.buildSimulator.commonEmblem");
    return { key: c.name, name, image: v.image, href: v.href, share: c.share };
  }
  const v = visualTalent(c.name);
  return { key: c.name, name: nameTalent(t, keyChoice(c.name)), image: v.image, share: c.share };
}

const KIT_PARTS: KitPart[] = ["items", "spells", "emblems", "talents"];

/** A hero's builds weigh by its popularity: its pick rate, all ranks. */
const WEIGHTS = Object.fromEntries(rankingFull.map((e) => [e.hero.slug, e.pickRate]));

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
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {KIT_PARTS.filter((p) => kit[p].length > 0).map((part) => (
          <section key={part} className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
            <h3 className="flex items-baseline justify-between gap-3 font-heading text-sm font-bold uppercase tracking-wide text-gold-400">
              {t(`pages.guides.kitParts.${part}`)}
              <span className="text-[0.65rem] font-medium normal-case tracking-normal text-chalk-500">
                {t("pages.guides.kitShare")}
              </span>
            </h3>
            <ul className="mt-3 space-y-2">
              {kit[part].map((c) => {
                const s = resolveChoice(part, c, t, locale);
                const label = (
                  <>
                    {s.image ? (
                      <Image src={s.image} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />
                    ) : (
                      <span aria-hidden className="size-8 shrink-0 bg-night-800" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  </>
                );
                return (
                  <li key={s.key} className="flex items-center gap-3 text-sm">
                    {s.href ? (
                      <Link href={s.href} className="flex min-w-0 flex-1 items-center gap-3 text-chalk-100 transition-colors hover:text-gold-400">
                        {label}
                      </Link>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-center gap-3 text-chalk-100">{label}</span>
                    )}
                    <span className="shrink-0 tabular-nums text-chalk-500">{percentage(locale, s.share)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <Link
        href="/tools/build"
        className="mt-3 inline-block text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
      >
        {t("pages.guides.kitLink")} →
      </Link>
    </div>
  );
}

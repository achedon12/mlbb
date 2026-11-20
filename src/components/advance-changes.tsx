import { ArrowRight, FlaskConical, Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { HeroTile } from "@/components/hero-tile";
import { Dex } from "@/components/mascot";
import { BalanceFigures } from "@/components/patch-visuals";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import {
  LIVE_TYPE,
  type AdvanceChange,
  type AdvanceChangeGroup,
  type AdvanceEntry,
  type AdvanceHeroChange,
  type AdvanceLine,
  type AdvanceVersion,
  type ChangeDirection,
  type ChangeTag,
} from "@/lib/advance-server";
import { heroesBySlug } from "@/lib/data";
import { longDate } from "@/lib/freshness";
import { groupAdjustments, ADJUSTMENT_DIRECTIONS } from "@/lib/meta-report";
import type { AdjustmentType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Server-rendered building blocks of the Advance Server pages. Every change
 * is in the HTML from the start, unlike the live notes list that unfolds on
 * demand: test notes are short, and a reader comes for the details.
 */

/** Ally blue for buffs, enemy red for nerfs, chalk for the plain adjustments; `edge` marks a card's left side. */
const DIRECTION_STYLE: Record<ChangeDirection, { text: string; edge: string; Icon: typeof TrendingUp }> = {
  buff: { text: "text-azure-400", edge: "shadow-[inset_3px_0_0_var(--color-azure-400)]", Icon: TrendingUp },
  nerf: { text: "text-blood-400", edge: "shadow-[inset_3px_0_0_var(--color-blood-400)]", Icon: TrendingDown },
  adjust: { text: "text-chalk-300", edge: "shadow-[inset_3px_0_0_var(--color-chalk-400)]", Icon: Minus },
};

const DIRECTION_OF = Object.fromEntries(
  Object.entries(LIVE_TYPE).map(([direction, live]) => [live, direction]),
) as Record<AdjustmentType, ChangeDirection>;

/** "Buff", "Nerf", "Adjustment", with the colour and icon of the live notes. */
export function DirectionBadge({ type, t }: { type: ChangeDirection; t: T }) {
  const { text, Icon } = DIRECTION_STYLE[type];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", text)}>
      <Icon size={14} aria-hidden />
      {t(`patchHeroes.${LIVE_TYPE[type]}`)}
    </span>
  );
}

/** "New", "Removed", "Rework"… as marked by the notes. */
export function TagBadge({ tag, t }: { tag: ChangeTag; t: T }) {
  return (
    <span className="bevel-sm inline-block bg-gold-400 px-1.5 py-0.5 font-heading text-xs font-bold uppercase text-night-950">
      {t(`pages.advanceServer.tags.${tag}`)}
    </span>
  );
}

/** "Under test" when the build is ahead of the live patch, otherwise "Older than patch X". */
export function StatusBadge({ underTest, live, t }: { underTest: boolean; live: string; t: T }) {
  return underTest ? (
    <span className="bevel-sm inline-flex items-center gap-1 bg-azure-400 px-2 py-0.5 font-heading text-sm font-bold uppercase text-night-950">
      <FlaskConical size={12} aria-hidden />
      {t("pages.advanceServer.badgeUnderTest")}
    </span>
  ) : (
    <span className="bevel-sm inline-block bg-night-800 px-2 py-0.5 text-xs font-medium text-chalk-400">
      {t("pages.advanceServer.badgeOlder", { live })}
    </span>
  );
}

/** Date of a version, saying where it comes from: the notes, or the wiki's publication. */
export function VersionDate({
  version,
  locale,
  t,
}: {
  version: Pick<AdvanceVersion, "date" | "dateSource">;
  locale: Locale;
  t: T;
}) {
  if (!version.date) return <>{t("pages.advanceServer.noDate")}</>;
  const key = version.dateSource === "notes" ? "pages.advanceServer.dateNotes" : "pages.advanceServer.dateWiki";
  return <time dateTime={version.date}>{t(key, { date: longDate(locale, version.date) })}</time>;
}

/** Warning shown wherever test changes appear: they may change or never ship. */
export function TestNotice({ t, children }: { t: T; children?: React.ReactNode }) {
  return (
    <div role="note" className="flex items-end gap-3 text-sm leading-relaxed text-chalk-300 sm:gap-4">
      <Dex pose="reflexion" height={110} className="hidden sm:inline-block" />
      <div className="dex-bubble min-w-0 flex-1">
        <p className="flex items-center gap-2 font-heading text-base font-bold uppercase text-gold-400">
          <FlaskConical size={16} aria-hidden />
          {t("pages.advanceServer.warningTitle")}
        </p>
        <p className="mt-1">{t("pages.advanceServer.warning")}</p>
        {children}
      </div>
    </div>
  );
}

/** Heroes per direction: three figures in the display face, coloured by direction. */
export function BalanceSummary({ balance, t, size = "md" }: { balance: AdvanceVersion["balance"]; t: T; size?: "sm" | "md" | "lg" }) {
  return <BalanceFigures balance={{ buff: balance.buff, nerf: balance.nerf, adjust: balance.adjust }} t={t} size={size} />;
}

/**
 * Changed heroes in three groups (buffed, nerfed, adjusted): buffs and nerfs
 * as rows of portraits with the direction's arrow in its colour, the plain
 * adjustments as a line of names. Each hero links to its page when the site
 * has one. A hero named twice appears once.
 */
export function HeroChips({
  heroes,
  t,
  headingLevel = 3,
}: {
  heroes: AdvanceHeroChange[];
  t: T;
  headingLevel?: 3 | 4;
}) {
  const Heading = `h${headingLevel}` as const;
  const groups = groupAdjustments(heroes.map((h) => ({ ...h, type: h.type ? LIVE_TYPE[h.type] : null })));
  return (
    <div className="space-y-8">
      {ADJUSTMENT_DIRECTIONS.map((direction) => {
        if (groups[direction].length === 0) return null;
        const { text, Icon } = DIRECTION_STYLE[DIRECTION_OF[direction]];
        return (
          <div key={direction}>
            <Heading className={cn("flex items-center gap-2 type-subtitle", text)}>
              <Icon size={18} aria-hidden />
              {t(`patchHeroes.plural.${direction}`)}
              <span className="font-heading text-base font-bold text-chalk-500">{groups[direction].length}</span>
            </Heading>
            {direction === "adjust" ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {groups[direction].map((h) => {
                  const page = heroesBySlug.get(h.slug);
                  const content = (
                    <>
                      <HeroPortrait
                        source={page?.images.icon ?? page?.images.portrait ?? null}
                        name={page?.name ?? h.name}
                        size="small"
                        decorative
                      />
                      <span className="font-heading font-bold uppercase text-chalk-200 transition-colors group-hover:text-gold-400">
                        {page?.name ?? h.name}
                      </span>
                    </>
                  );
                  const classes = "bevel-sm group flex items-center gap-2 bg-night-900 py-1 pl-1 pr-3";
                  return (
                    <li key={h.slug}>
                      {page ? (
                        <Link href={`/heroes/${h.slug}`} className={cn(classes, "transition-colors hover:bg-night-800")}>
                          {content}
                        </Link>
                      ) : (
                        <span className={classes}>{content}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 lg:grid-cols-8">
                {groups[direction].map((h) => {
                  const page = heroesBySlug.get(h.slug);
                  const name = page?.name ?? h.name;
                  return (
                    <li key={h.slug}>
                      {page ? (
                        <HeroTile
                          href={`/heroes/${h.slug}`}
                          name={name}
                          portrait={page.images.portrait ?? page.images.icon ?? null}
                          figure={direction === "buff" ? "▲" : "▼"}
                          label={t(`patchHeroes.${direction}`)}
                          tone={direction === "buff" ? "ally" : "enemy"}
                          sizes="(min-width: 1024px) 8vw, (min-width: 640px) 15vw, 23vw"
                        />
                      ) : (
                        <span className="bevel grid aspect-[3/4] place-items-center bg-night-800 p-2 text-center font-heading font-bold uppercase text-chalk-200">
                          {name}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One change: "label: before → after", or a sentence. */
function ChangeItem({ change, t }: { change: AdvanceChange; t: T }) {
  if ("text" in change) return <span className="text-chalk-300">{change.text}</span>;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {change.label && <span className="text-chalk-500">{t("patchHeroes.label", { label: change.label })}</span>}
      <span className="sr-only">{t("pages.advanceServer.before")}</span>
      <span className="text-chalk-500 line-through decoration-blood-400/60">{change.before}</span>
      <ArrowRight size={12} aria-hidden className="shrink-0 self-center text-chalk-500" />
      <span className="sr-only">{t("pages.advanceServer.after")}</span>
      <span className="font-medium text-chalk-100">{change.after}</span>
    </span>
  );
}

/** Changes of an entry, by skill, attribute or passive. */
function ChangeGroups({ groups, t, headingLevel }: { groups: AdvanceChangeGroup[]; t: T; headingLevel: 4 | 5 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="space-y-4">
      {groups.map((g, i) => {
        const badges = (g.type || g.tag) && (
          <span className="inline-flex flex-wrap items-center gap-2">
            {g.type && <DirectionBadge type={g.type} t={t} />}
            {g.tag && <TagBadge tag={g.tag} t={t} />}
          </span>
        );
        return (
          <div key={i}>
            {g.name ? (
              <Heading className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-sm font-bold text-gold-400">
                {g.name}
                {g.slot && <span className="text-xs font-medium text-chalk-500">{g.slot}</span>}
                {badges}
              </Heading>
            ) : (
              badges && <div>{badges}</div>
            )}
            {g.changes.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-sm">
                {g.changes.map((c, j) => (
                  <li key={j} className="break-words">
                    <ChangeItem change={c} t={t} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A changed hero, item, emblem or spell: name, direction, the designers'
 * reason, then every change. `portrait` shows a hero icon; `href` adds a
 * link to the page the site has for it.
 */
export function EntryCard({
  entry,
  t,
  portrait,
  href,
  id,
  headingLevel = 3,
}: {
  entry: AdvanceEntry;
  t: T;
  portrait?: string | null;
  href?: string;
  id?: string;
  headingLevel?: 3 | 4;
}) {
  const Heading = `h${headingLevel}` as const;
  const style = entry.type ? DIRECTION_STYLE[entry.type] : null;
  return (
    <article
      id={id}
      className={cn("bevel scroll-mt-24 bg-night-900 p-4 sm:p-5", style?.edge)}
    >
      <div className="flex items-center gap-3">
        {portrait !== undefined && <HeroPortrait source={portrait} name={entry.name} size="medium" decorative />}
        <div className="min-w-0 flex-1">
          <Heading className="display-caps break-words text-[1.75rem] font-extrabold text-chalk-100">{entry.name}</Heading>
          {(entry.type || entry.tag) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {entry.type && <DirectionBadge type={entry.type} t={t} />}
              {entry.tag && <TagBadge tag={entry.tag} t={t} />}
            </div>
          )}
        </div>
      </div>
      {entry.intro && <p className="mt-3 text-sm leading-relaxed text-chalk-300">{entry.intro}</p>}
      {entry.sections.length > 0 && (
        <div className="mt-4 border-t border-night-800 pt-4">
          <ChangeGroups groups={entry.sections} t={t} headingLevel={headingLevel === 3 ? 4 : 5} />
        </div>
      )}
      {href && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
        >
          {t("pages.advanceServer.openPage", { name: entry.name })}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </article>
  );
}

/** Lines outside any entry: paragraphs, list items and sub-items. */
export function LineList({ lines, t }: { lines: AdvanceLine[]; t: T }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => (
        <li
          key={i}
          className={cn(
            "break-words",
            line.level > 0 && "relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:-skew-x-[25deg] before:bg-gold-400",
            line.level === 2 && "ml-4",
          )}
        >
          {line.type && (
            <span className="mr-2">
              <DirectionBadge type={line.type} t={t} />
            </span>
          )}
          <ChangeItem change={line} t={t} />
        </li>
      ))}
    </ul>
  );
}

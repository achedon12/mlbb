import { ArrowRight, FlaskConical, Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/traductions";
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
import { herosParSlug } from "@/lib/donnees";
import { dateLongue } from "@/lib/fraicheur";
import { grouperAjustements, SENS_AJUSTEMENT } from "@/lib/rapport-meta";
import type { TypeAjustement } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Server-rendered building blocks of the Advance Server pages. Every change
 * is in the HTML from the start, unlike the live notes list that unfolds on
 * demand: test notes are short, and a reader comes for the details.
 */

const DIRECTION_STYLE: Record<ChangeDirection, { text: string; border: string; Icon: typeof TrendingUp }> = {
  buff: { text: "text-emerald-400", border: "border-emerald-500/30", Icon: TrendingUp },
  nerf: { text: "text-blood-500", border: "border-blood-500/30", Icon: TrendingDown },
  adjust: { text: "text-azure-400", border: "border-azure-500/30", Icon: Minus },
};

const DIRECTION_OF = Object.fromEntries(
  Object.entries(LIVE_TYPE).map(([direction, live]) => [live, direction]),
) as Record<TypeAjustement, ChangeDirection>;

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
    <span className="inline-block border border-gold-500/40 bg-gold-500/10 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-gold-400">
      {t(`pages.advanceServer.tags.${tag}`)}
    </span>
  );
}

/** "Under test" when the build is ahead of the live patch, otherwise "Older than patch X". */
export function StatusBadge({ underTest, live, t }: { underTest: boolean; live: string; t: T }) {
  return underTest ? (
    <span className="inline-flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
      <FlaskConical size={12} aria-hidden />
      {t("pages.advanceServer.badgeUnderTest")}
    </span>
  ) : (
    <span className="inline-block border border-night-700 px-2 py-0.5 text-xs font-medium text-chalk-500">
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
  locale: Langue;
  t: T;
}) {
  if (!version.date) return <>{t("pages.advanceServer.noDate")}</>;
  const key = version.dateSource === "notes" ? "pages.advanceServer.dateNotes" : "pages.advanceServer.dateWiki";
  return <time dateTime={version.date}>{t(key, { date: dateLongue(locale, version.date) })}</time>;
}

/** Warning shown wherever test changes appear: they may change or never ship. */
export function TestNotice({ t, children }: { t: T; children?: React.ReactNode }) {
  return (
    <div
      role="note"
      className="flex gap-3 border border-gold-500/40 bg-gold-500/5 p-4 text-sm leading-relaxed text-chalk-300"
    >
      <FlaskConical size={20} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
      <div className="min-w-0">
        <p className="font-semibold text-chalk-100">{t("pages.advanceServer.warningTitle")}</p>
        <p className="mt-1">{t("pages.advanceServer.warning")}</p>
        {children}
      </div>
    </div>
  );
}

/** Heroes per direction: three counters. */
export function BalanceSummary({ balance, t }: { balance: AdvanceVersion["balance"]; t: T }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {(Object.keys(DIRECTION_STYLE) as ChangeDirection[]).map((type) => {
        const { text, Icon } = DIRECTION_STYLE[type];
        return (
          <li key={type} className="flex items-center gap-1.5">
            <Icon size={14} aria-hidden className={text} />
            <span className="font-semibold tabular-nums text-chalk-100">{balance[type]}</span>
            <span className="text-chalk-500">{t(`patchHeroes.plural.${LIVE_TYPE[type]}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Changed heroes in three lists (buffed, nerfed, adjusted), each hero linking
 * to its page when the site has one. A hero named twice appears once.
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
  const groups = grouperAjustements(heroes.map((h) => ({ ...h, type: h.type ? LIVE_TYPE[h.type] : null })));
  return (
    <div className="space-y-5">
      {SENS_AJUSTEMENT.map((sens) => {
        if (groups[sens].length === 0) return null;
        const { text, border, Icon } = DIRECTION_STYLE[DIRECTION_OF[sens]];
        return (
          <div key={sens}>
            <Heading className={cn("flex items-center gap-2 font-heading text-base font-bold", text)}>
              <Icon size={16} aria-hidden />
              {t(`patchHeroes.plural.${sens}`)}
              <span className="text-sm font-medium text-chalk-500">{groups[sens].length}</span>
            </Heading>
            <ul className="mt-2 flex flex-wrap gap-2">
              {groups[sens].map((h) => {
                const page = herosParSlug.get(h.slug);
                const content = (
                  <>
                    <PortraitHeros
                      source={page?.images.icon ?? page?.images.portrait ?? null}
                      nom={page?.name ?? h.name}
                      taille="micro"
                      decoratif
                    />
                    <span className="font-medium text-chalk-100">{page?.name ?? h.name}</span>
                  </>
                );
                const classes = cn("flex items-center gap-2 border bg-night-900/60 py-1 pl-1 pr-2.5 text-sm", border);
                return (
                  <li key={h.slug}>
                    {page ? (
                      <Link href={`/heroes/${h.slug}`} className={cn(classes, "transition-colors hover:border-gold-500/60")}>
                        {content}
                      </Link>
                    ) : (
                      <span className={classes}>{content}</span>
                    )}
                  </li>
                );
              })}
            </ul>
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
      {change.label && <span className="text-chalk-500">{t("patchHeroes.label", { libelle: change.label })}</span>}
      <span className="sr-only">{t("pages.advanceServer.before")}</span>
      <span className="text-chalk-500 line-through decoration-blood-500/50">{change.before}</span>
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
      className={cn("bevel scroll-mt-24 border bg-night-900/60 p-4", style?.border ?? "border-night-700/70")}
    >
      <div className="flex items-center gap-3">
        {portrait !== undefined && <PortraitHeros source={portrait} nom={entry.name} taille="moyenne" decoratif />}
        <div className="min-w-0 flex-1">
          <Heading className="break-words font-heading text-lg font-bold text-chalk-100">{entry.name}</Heading>
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
            line.level > 0 && "relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:bg-gold-500/60",
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

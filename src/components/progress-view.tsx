"use client";

import { Award, CalendarCheck, Crosshair, Flame, Globe, Lock, Puzzle, Settings, Star, Swords, Target, Trophy, type LucideIcon } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import { BADGES, type Badge, type Progress } from "@/lib/account-sync";
import { heroesBySlug } from "@/lib/data-client";
import { cn } from "@/lib/utils";

/**
 * A player's progress, as figures and badges: the same view on the player's
 * own account page (from this browser's copy) and on their public page (only
 * the parts its owner chose: a part left out is not passed).
 *
 * Everything a server page hands these components is plain data — icons go
 * by name — so the public page renders on the server without passing a
 * function to the client.
 */

const BADGE_ICON: Record<Badge, LucideIcon> = {
  streak7: Flame,
  streak30: Flame,
  mlbbdle10: Puzzle,
  mlbbdle50: Puzzle,
  firstTry: Crosshair,
  quiz10: CalendarCheck,
  allGames: Swords,
  favourites5: Star,
};

/** Section icons by name: a server page cannot hand a component to this client one. */
const SECTION_ICONS = { award: Award, trophy: Trophy, puzzle: Puzzle, star: Star, globe: Globe, settings: Settings } satisfies Record<string, LucideIcon>;
export type SectionIcon = keyof typeof SECTION_ICONS;

function Figure({ label, value, icon: Icon, lead = false }: { label: string; value: string | number; icon: LucideIcon; lead?: boolean }) {
  return (
    <div className={cn("bevel relative overflow-hidden p-3.5 sm:p-4", lead ? "bg-gold-500/10 shadow-[inset_0_0_0_1px_rgb(245_196_81/0.35)]" : "bg-night-950/70")}>
      <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-chalk-400">
        <Icon size={13} aria-hidden className="shrink-0 text-gold-400" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn("score mt-1.5 text-[2.3rem] leading-none tabular-nums sm:text-[2.6rem]", lead ? "text-gold-300" : "text-chalk-100")}>{value}</dd>
    </div>
  );
}

export function QuizFigures({ quiz }: { quiz: Progress["quiz"] }) {
  const t = useT();
  return (
    <dl className="grid grid-cols-2 gap-2">
      <Figure icon={Flame} label={t("pages.progress.streak")} value={quiz.streak} lead={quiz.streak > 0} />
      <Figure icon={Trophy} label={t("pages.progress.bestStreak")} value={quiz.bestStreak} />
      <Figure icon={CalendarCheck} label={t("pages.progress.quizDays")} value={quiz.days} />
      <Figure icon={Target} label={t("pages.progress.quizBest")} value={quiz.bestScore ?? "—"} />
    </dl>
  );
}

export function MlbbdleFigures({ mlbbdle }: { mlbbdle: Progress["mlbbdle"] }) {
  const t = useT();
  return (
    <dl className="grid grid-cols-2 gap-2">
      <Figure icon={Flame} label={t("pages.progress.streak")} value={mlbbdle.streak} lead={mlbbdle.streak > 0} />
      <Figure icon={Trophy} label={t("pages.progress.bestStreak")} value={mlbbdle.bestStreak} />
      <Figure icon={Puzzle} label={t("pages.progress.solved")} value={mlbbdle.solved} />
      <Figure icon={Crosshair} label={t("pages.progress.fewest")} value={mlbbdle.fewestGuesses ?? "—"} />
    </dl>
  );
}

/** Every badge, earned or still locked: the locked ones say what earns them. */
export function Badges({ earned, showLocked = true }: { earned: readonly Badge[]; showLocked?: boolean }) {
  const t = useT();
  const has = new Set(earned);
  const list = showLocked ? [...BADGES].sort((a, b) => Number(has.has(b)) - Number(has.has(a))) : BADGES.filter((b) => has.has(b));
  if (list.length === 0) return <p className="text-sm text-chalk-400">{t("pages.progress.noBadge")}</p>;
  return (
    <div>
      {showLocked && (
        <p className="mb-3 flex items-center gap-3 text-sm text-chalk-300">
          <span className="score text-2xl leading-none text-gold-300 tabular-nums">
            {has.size}
            <span className="text-chalk-500">/{BADGES.length}</span>
          </span>
          <span aria-hidden className="h-1.5 flex-1 overflow-hidden bg-night-800">
            <span className="block h-full bg-linear-to-r from-gold-600 via-gold-400 to-gold-300" style={{ width: `${(has.size / BADGES.length) * 100}%` }} />
          </span>
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {list.map((b) => {
          const on = has.has(b);
          const Icon = on ? BADGE_ICON[b] : Lock;
          return (
            <li
              key={b}
              className={cn(
                "bevel flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-3",
                on ? "bg-linear-to-br from-gold-500/15 to-night-900 shadow-[inset_0_0_0_1px_var(--color-gold-500)]" : "bg-night-900/80",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "bevel-sm grid size-10 shrink-0 place-items-center",
                  on ? "bg-gold-400 text-night-950 shadow-[0_0_18px_rgb(245_196_81/0.35)]" : "bg-night-800 text-chalk-500",
                )}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className={cn("block font-heading text-sm font-bold uppercase leading-tight", on ? "text-chalk-100" : "text-chalk-300")}>
                  {t(`pages.progress.badges.${b}.name`)}
                  <span className="sr-only"> · {on ? t("pages.progress.earned") : t("pages.progress.locked")}</span>
                </span>
                <span className={cn("mt-0.5 block text-xs leading-snug", on ? "text-chalk-300" : "text-chalk-500")}>{t(`pages.progress.badges.${b}.text`)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FavouriteList({ favourites }: { favourites: readonly string[] }) {
  const t = useT();
  if (favourites.length === 0) return <p className="text-sm text-chalk-400">{t("pages.progress.noFavourite")}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {favourites.map((slug) => (
        <li key={slug}>
          <Link
            href={`/heroes/${slug}`}
            className="bevel-sm flex min-h-10 items-center gap-1.5 border border-night-700 bg-night-900/60 px-3 py-2 text-sm text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
          >
            <Star size={13} aria-hidden fill="currentColor" className="text-gold-500" />
            {heroesBySlug[slug] ?? slug}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * A panel of the progress: a bevelled night card with a gold edge, its icon
 * in a crest, its title, and an optional link (play today's quiz…).
 */
export function ProgressCard({
  id,
  title,
  icon = "award",
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  icon?: SectionIcon;
  /** `name`: the link's full name for assistive technology, when its label is short ("Play →"). */
  action?: { href: string; label: string; name?: string };
  className?: string;
  children: React.ReactNode;
}) {
  const Icon = SECTION_ICONS[icon];
  return (
    <section aria-labelledby={id} className={cn("bevel-lg bg-night-900 p-4 shadow-[inset_0_3px_0_var(--color-gold-500)] sm:p-6", className)}>
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden className="bevel-sm grid size-10 shrink-0 place-items-center bg-night-800 text-gold-400">
          <Icon size={20} />
        </span>
        <h3 id={id} className="min-w-0 flex-1 font-heading text-xl font-bold uppercase leading-tight text-chalk-100 sm:text-2xl">
          {title}
        </h3>
        {action && (
          <Link href={action.href} aria-label={action.name} className="inline-flex min-h-10 shrink-0 items-center font-heading text-sm font-bold uppercase text-gold-400 transition-colors hover:text-gold-300">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

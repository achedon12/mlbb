"use client";

import { Award, CalendarCheck, Crosshair, Flame, Globe, Lock, Puzzle, Star, Swords, Target, Trophy, type LucideIcon } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import { BADGES, type Badge, type Progress } from "@/lib/account-sync";
import { heroesBySlug } from "@/lib/data-client";
import { cn } from "@/lib/utils";

/**
 * A player's progress, as figures and badges: the same view on the player's
 * own page (from this browser's copy) and on their public page (only the
 * parts its owner chose: a part left out is not passed).
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

function Figure({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="bevel bg-night-900 p-4">
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-chalk-400">
        <Icon size={14} aria-hidden className="text-gold-400" />
        {label}
      </dt>
      <dd className="score mt-1 text-[2.4rem] leading-none text-chalk-100 tabular-nums">{value}</dd>
    </div>
  );
}

export function QuizFigures({ quiz }: { quiz: Progress["quiz"] }) {
  const t = useT();
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Figure icon={Flame} label={t("pages.progress.streak")} value={quiz.streak} />
      <Figure icon={Trophy} label={t("pages.progress.bestStreak")} value={quiz.bestStreak} />
      <Figure icon={CalendarCheck} label={t("pages.progress.quizDays")} value={quiz.days} />
      <Figure icon={Target} label={t("pages.progress.quizBest")} value={quiz.bestScore ?? "—"} />
    </dl>
  );
}

export function MlbbdleFigures({ mlbbdle }: { mlbbdle: Progress["mlbbdle"] }) {
  const t = useT();
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Figure icon={Flame} label={t("pages.progress.streak")} value={mlbbdle.streak} />
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
  const list = showLocked ? BADGES : BADGES.filter((b) => has.has(b));
  if (list.length === 0) return <p className="text-sm text-chalk-400">{t("pages.progress.noBadge")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((b) => {
        const on = has.has(b);
        const Icon = on ? BADGE_ICON[b] : Lock;
        return (
          <li
            key={b}
            className={cn("bevel flex items-start gap-3 p-3", on ? "bg-gold-500/10 shadow-[inset_0_0_0_1px_var(--color-gold-500)]" : "bg-night-900 opacity-70")}
          >
            <span aria-hidden className={cn("bevel-sm grid size-9 shrink-0 place-items-center", on ? "bg-gold-500 text-night-950" : "bg-night-800 text-chalk-500")}>
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-sm font-bold uppercase text-chalk-100">
                {t(`pages.progress.badges.${b}.name`)}
                <span className="sr-only"> · {on ? t("pages.progress.earned") : t("pages.progress.locked")}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-chalk-400">{t(`pages.progress.badges.${b}.text`)}</span>
            </span>
          </li>
        );
      })}
    </ul>
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
            className="bevel-sm flex items-center gap-1.5 border border-night-700 bg-night-900/60 px-3 py-2 text-sm text-chalk-100 transition-colors hover:text-gold-400"
          >
            <Star size={13} aria-hidden fill="currentColor" className="text-gold-500" />
            {heroesBySlug[slug] ?? slug}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Section icons by name: a server page cannot hand a component to this client one. */
const SECTION_ICONS = { award: Award, trophy: Trophy, puzzle: Puzzle, star: Star, globe: Globe } satisfies Record<string, LucideIcon>;
export type SectionIcon = keyof typeof SECTION_ICONS;

export function ProgressSection({ id, title, icon = "award", children }: { id: string; title: string; icon?: SectionIcon; children: React.ReactNode }) {
  const Icon = SECTION_ICONS[icon];
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="flex items-center gap-2 font-heading text-xl font-bold uppercase text-chalk-100">
        <Icon size={20} aria-hidden className="text-gold-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

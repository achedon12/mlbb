"use client";

import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import { useRank } from "@/components/rank-picker";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Adversaire resolu par le serveur : le navigateur n'a pas le catalogue. */
export interface CounterShown {
  slug: string;
  name: string;
  portrait: string | null;
  /** Ecart de taux de victoire, en points (positif = avantage). */
  advantage: number;
}

export interface CountersShown {
  strong: CounterShown[];
  weak: CounterShown[];
  winRate: number | null;
}

/**
 * Contres etablis sur les taux de victoire du jeu, rang par rang.
 *
 * Chaque ligne porte l'ecart en points, sa vraie information : « fort contre
 * Wanwan » ne dit rien, « +3,3 points contre Wanwan » situe l'avantage. Les
 * portraits rendent la lecture immediate — on reconnait un heros a sa tete
 * avant son nom.
 *
 * Un matchup ne pese pas pareil en Epique et en Gloire mythique : le rang de la
 * fiche bascule d'une mesure a l'autre. Toutes arrivent avec la page, qui reste
 * statique — changer de rang ne declenche aucune requete.
 */
export function MeasuredCounters({
  name,
  byRank,
}: {
  name: string;
  byRank: Partial<Record<MeasuredRank, CountersShown>>;
}) {
  const t = useT();
  const rank = useRank();
  // Le rang de la fiche peut manquer ici : on retombe sur tous rangs.
  const current = byRank[rank] ?? byRank.all;
  if (!current) return null;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-chalk-500">
        {t("pages.heroDetail.countersIntro", { nom: name })}
        {current.winRate !== null && (
          <span className="text-chalk-300">
            {" "}{t("pages.heroDetail.countersRef", { taux: current.winRate })}
          </span>
        )}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Column
          title={t("counters.strong")}
          icon={<TrendingUp size={17} aria-hidden />}
          tone="good"
          entries={current.strong}
        />
        <Column
          title={t("counters.difficulty")}
          icon={<TrendingDown size={17} aria-hidden />}
          tone="bad"
          entries={current.weak}
        />
      </div>
    </div>
  );
}

/**
 * Coequipiers qui font le plus gagner le heros, au rang de la fiche : l'ecart
 * est celui de son taux de victoire quand ils jouent ensemble.
 */
export function TeammatesByRank({
  name,
  byRank,
}: {
  name: string;
  byRank: Partial<Record<MeasuredRank, CounterShown[]>>;
}) {
  const t = useT();
  const rank = useRank();
  const list = byRank[rank] ?? byRank.all;
  if (!list?.length) return null;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.heroDetail.teammatesIntro", { nom: name })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Column title={t("pages.heroDetail.teammates")} icon={<Users size={17} aria-hidden />} tone="good" entries={list} />
      </div>
    </div>
  );
}

function Column({
  title,
  icon,
  tone,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "good" | "bad";
  entries: CounterShown[];
}) {
  const t = useT();
  const color = tone === "good" ? "text-emerald-400" : "text-blood-500";

  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <h3 className={cn("flex items-center gap-2 font-heading font-bold", color)}>
        {icon}
        {title}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {entries.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/heroes/${e.slug}`}
              className="flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-night-850"
            >
              <HeroPortrait source={e.portrait} name={e.name} size="small" decorative />
              <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">{e.name}</span>
              <span className={cn("shrink-0 text-xs font-semibold tabular-nums", color)}>
                {e.advantage > 0 ? "+" : ""}
                {e.advantage.toFixed(1)} {t("counters.pts")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { CircleAlert, ShieldAlert, ThumbsDown, Trophy } from "lucide-react";
import { RankBadge } from "@/components/rank-badge";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { classesChip } from "@/components/chip";
import { Card } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import { reconnect } from "@/lib/actions";
import { formatGap, formatCount, formatPercent, plural } from "@/lib/player-format";
import type { StatsPlayer } from "@/lib/player-api";
import {
  MARGIN_POINTS,
  MATCHES_MIN,
  type SummarySeason,
  type Nemesis,
  type ShownHero,
  type HeroRow,
} from "@/lib/player-profile";
import type { ReadableRank } from "@/lib/ranks";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { measure } from "@/lib/tier-list";
import { cn, formatShortDate } from "@/lib/utils";

/**
 * Blocs du profil de joueur.
 *
 * Composants serveur sans etat : ils recoivent des donnees deja lues et la
 * fonction de traduction, si bien que les tests les rendent avec des reponses
 * d'exemple, sans session ni appel au service.
 */

/** Section du profil : titre, filet dore, chapeau facultatif. */
export function SectionProfile({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="font-heading text-2xl font-bold text-chalk-100">
        {title}
      </h2>
      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      {lead && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chalk-500">{lead}</p>}
      {children}
    </section>
  );
}

/**
 * Etat de page entiere : session expiree, source coupee ou compte sans
 * partie. Chacun dit quoi faire — se reconnecter, attendre, aller jouer.
 */
export function StateProfile({ type, t }: { type: "expired" | "unavailable" | "empty"; t: T }) {
  const keys = {
    expired: ["expiredTitle", "expiredText"],
    unavailable: ["unavailableTitle", "unavailableText"],
    empty: ["emptyTitle", "emptyText"],
  }[type];

  return (
    <Card className="border-gold-500/30">
      <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-gold-400">
        <CircleAlert size={20} aria-hidden />
        {t(`pages.accountProfile.${keys[0]}`)}
      </h1>
      <p className="mt-3 leading-relaxed text-chalk-300">{t(`pages.accountProfile.${keys[1]}`)}</p>
      {type === "expired" ? (
        <form action={reconnect} className="mt-5">
          <button
            type="submit"
            className="bevel-sm bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
          >
            {t("pages.accountProfile.signInAgain")}
          </button>
        </form>
      ) : (
        <Link
          href="/account"
          className="mt-5 inline-block text-sm text-chalk-500 underline underline-offset-4 transition-colors hover:text-gold-400"
        >
          {t("pages.accountProfile.backToAccount")}
        </Link>
      )}
    </Card>
  );
}

/** A la place d'une section dont la source ne repond pas : le reste du profil s'affiche. */
export function SectionUnavailable({ t }: { t: T }) {
  return (
    <Card className="mt-6 border-gold-500/25">
      <p className="text-sm leading-relaxed text-chalk-300">{t("pages.accountProfile.sectionUnavailable")}</p>
    </Card>
  );
}

/** Choix de la saison : de simples liens, qui marchent sans JavaScript. */
export function NavSeasons({ seasons, current, t }: { seasons: number[]; current: number; t: T }) {
  return (
    <nav aria-label={t("pages.accountProfile.seasonChoice")} className="mt-6 flex flex-wrap items-center gap-2">
      <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-chalk-500">
        {t("pages.accountProfile.seasonChoice")}
      </span>
      {seasons.map((s) => (
        <Link
          key={s}
          href={`/account/profile?saison=${s}`}
          prefetch={false}
          aria-current={s === current ? "page" : undefined}
          className={classesChip(s === current, true)}
        >
          {t("pages.accountProfile.season", { n: s })}
        </Link>
      ))}
    </nav>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-gold-400">{children}</dd>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-chalk-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-chalk-100">{children}</dd>
    </div>
  );
}

/** Bilan de la saison, puis, plus discret, celui de toutes les saisons suivies. */
export function PlayerSummary({
  summary,
  full,
  rank,
  stats,
  t,
  locale,
}: {
  summary: SummarySeason;
  full: boolean;
  rank: ReadableRank;
  stats: StatsPlayer | null;
  t: T;
  locale: Locale;
}) {
  const seasons = stats ? [...stats.seasons].sort((a, b) => a - b).map(String) : [];

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bevel col-span-2 border border-night-700/70 bg-night-900/60 p-4 lg:col-span-1">
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.account.currentRank")}</dt>
          <dd className="mt-2">
            <RankBadge rank={rank} />
          </dd>
        </div>
        <Figure label={t("pages.accountProfile.games")}>{formatCount(summary.matches, locale)}</Figure>
        <Figure label={t("pages.heroDetail.stat.winRate")}>
          {summary.rate !== null ? formatPercent(summary.rate, locale) : "—"}
        </Figure>
        <Figure label={t("pages.accountProfile.heroesPlayed")}>{formatCount(summary.heroes, locale)}</Figure>
      </dl>
      {!full && <p className="mt-3 text-xs text-chalk-500">{t("pages.accountProfile.partialSummary")}</p>}

      {stats && stats.matches > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-chalk-300">
            {seasons.length > 0
              ? t("pages.accountProfile.overSeasons", {
                  liste: new Intl.ListFormat(LOCALE_HTML[locale], { type: "conjunction" }).format(seasons),
                })
              : t("pages.accountProfile.overAllSeasons")}
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Mini label={t("pages.accountProfile.games")}>{formatCount(stats.matches, locale)}</Mini>
            <Mini label={t("pages.heroDetail.stat.winRate")}>
              {formatPercent((stats.wins / stats.matches) * 100, locale)}
            </Mini>
            {stats.mvp !== null && (
              <Mini label={t("pages.accountProfile.mvp")}>{formatCount(stats.mvp, locale)}</Mini>
            )}
            {stats.bestStreak !== null && (
              <Mini label={t("pages.accountProfile.bestStreak")}>{formatCount(stats.bestStreak, locale)}</Mini>
            )}
          </dl>
        </div>
      )}
    </>
  );
}

function HeroLink({
  hero: heroes,
  className,
  children,
}: {
  hero: ShownHero;
  className?: string;
  children: React.ReactNode;
}) {
  return heroes.slug ? (
    <Link href={`/heroes/${heroes.slug}`} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

/**
 * Heros les plus joues, face a la moyenne de la tranche. Un tableau : on y
 * compare des colonnes de chiffres, et les lecteurs d'ecran annoncent chaque
 * valeur avec son en-tete.
 */
export function HeroTable({
  rows,
  bucket,
  t,
  locale,
}: {
  rows: HeroRow[];
  bucket: MeasuredRank;
  t: T;
  locale: Locale;
}) {
  const fallback = rows.some((l) => l.bucketAverage !== null && l.bucketAverage !== bucket);

  return (
    <>
      <div className="mt-6 relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("pages.accountProfile.heroesTitle")}</caption>
          <thead>
            <tr className="border-b border-night-700 text-xs uppercase tracking-wide text-chalk-500">
              <th scope="col" className="py-2 pr-2 text-left font-medium">
                {t("pages.accountProfile.colHero")}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t("pages.accountProfile.you")}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t("pages.accountProfile.rankAverage", { rang: t(`measuredRanks.${bucket}`) })}
              </th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">
                {t("pages.accountProfile.gap")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night-800">
            {rows.map((l) => {
              // En dessous du minimum de parties, l'ecart s'affiche sans couleur : il ne dit rien encore.
              const reliable = l.matches >= MATCHES_MIN && l.gap !== null;
              const color = !reliable
                ? "text-chalk-400"
                : l.gap! >= MARGIN_POINTS
                  ? "text-emerald-400"
                  : l.gap! <= -MARGIN_POINTS
                    ? "text-blood-500"
                    : "text-chalk-300";
              return (
                <tr key={`${l.hero.slug ?? l.hero.name}`}>
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                    <HeroLink hero={l.hero} className="group flex min-w-0 items-center gap-2.5">
                      <HeroPortrait source={l.hero.portrait} name={l.hero.name} size="small" decorative />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-chalk-100 transition-colors group-hover:text-gold-400">
                          {l.hero.name}
                        </span>
                        <span className="block text-xs text-chalk-500">
                          {t(`pages.accountProfile.nGames.${plural(l.matches, locale)}`, { n: l.matches })}
                        </span>
                      </span>
                    </HeroLink>
                  </th>
                  <td className="whitespace-nowrap px-2 text-right font-semibold tabular-nums text-chalk-100">
                    {formatPercent(l.rate, locale)}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums text-chalk-300">
                    {l.average !== null ? (
                      <>
                        {formatPercent(l.average, locale)}
                        {l.bucketAverage !== bucket && <span aria-hidden>*</span>}
                      </>
                    ) : (
                      <WithoutMeasure t={t} />
                    )}
                  </td>
                  <td className={cn("whitespace-nowrap pl-2 text-right font-semibold tabular-nums", color)}>
                    {l.gap !== null ? `${formatGap(l.gap, locale)} ${t("counters.pts")}` : <WithoutMeasure t={t} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {fallback && <p className="mt-3 text-xs text-chalk-500">* {t("pages.accountProfile.allRanksNote")}</p>}
      <p className="mt-2 text-xs text-chalk-500">
        {t("pages.accountProfile.sourceAverage", { date: formatShortDate(measure, LOCALE_HTML[locale]) })}
      </p>
    </>
  );
}

function WithoutMeasure({ t }: { t: T }) {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{t("pages.accountProfile.noMeasure")}</span>
    </>
  );
}

const TONES = { good: "text-emerald-400", bad: "text-blood-500", alert: "text-gold-400" } as const;

function CardTip({
  title,
  text,
  tone,
  icon,
  children,
}: {
  title: string;
  text: string;
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <h3 className={cn("flex items-center gap-2 font-heading font-bold", TONES[tone])}>
        {icon}
        {title}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-chalk-500">{text}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ListHeroTip({ entries, empty }: { entries: { hero: ShownHero; detail: string }[]; empty: string }) {
  if (entries.length === 0) return <p className="text-sm leading-relaxed text-chalk-400">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {entries.map(({ hero: heroes, detail }) => (
        <li key={heroes.slug ?? heroes.name}>
          <HeroLink
            hero={heroes}
            className="group flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-night-850"
          >
            <HeroPortrait source={heroes.portrait} name={heroes.name} size="small" decorative />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-chalk-100 transition-colors group-hover:text-gold-400">
                {heroes.name}
              </span>
              <span className="block text-xs text-chalk-500">{detail}</span>
            </span>
          </HeroLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Conseils : points forts, heros sous la moyenne de la tranche, et les
 * adversaires qui reviennent dans les defaites. Ces derniers demandent le
 * detail de plusieurs parties : la page les passe deja enveloppes dans un
 * `Suspense`, pour que le reste s'affiche sans les attendre.
 */
export function HeroTips({
  rows,
  best,
  belowAverage,
  bucket,
  opponents,
  t,
  locale,
}: {
  /** null quand la liste des heros n'a pas pu etre lue. */
  rows: HeroRow[] | null;
  best: HeroRow[];
  belowAverage: HeroRow[];
  bucket: MeasuredRank;
  opponents: React.ReactNode;
  t: T;
  locale: Locale;
}) {
  const rank = t(`measuredRanks.${bucket}`);
  const unavailable = t("pages.accountProfile.sectionUnavailable");

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <CardTip
        tone="good"
        icon={<Trophy size={17} aria-hidden />}
        title={t("pages.accountProfile.bestTitle")}
        text={t("pages.accountProfile.bestText")}
      >
        <ListHeroTip
          empty={rows ? t("pages.accountProfile.bestEmpty") : unavailable}
          entries={best.map((l) => ({
            hero: l.hero,
            detail: t("pages.accountProfile.bestDetail", { taux: formatPercent(l.rate, locale), n: l.matches }),
          }))}
        />
      </CardTip>

      <CardTip
        tone="bad"
        icon={<ThumbsDown size={17} aria-hidden />}
        title={t("pages.accountProfile.belowAverageTitle")}
        text={t("pages.accountProfile.belowAverageText", { rang: rank })}
      >
        <ListHeroTip
          empty={rows ? t("pages.accountProfile.belowAverageEmpty") : unavailable}
          entries={belowAverage.map((l) => ({
            hero: l.hero,
            detail: t("pages.accountProfile.belowAverageDetail", {
              taux: formatPercent(l.rate, locale),
              moyenne: formatPercent(l.average ?? 0, locale),
            }),
          }))}
        />
      </CardTip>

      <CardTip
        tone="alert"
        icon={<ShieldAlert size={17} aria-hidden />}
        title={t("pages.accountProfile.nemesesTitle")}
        text={t("pages.accountProfile.nemesesText")}
      >
        {opponents}
      </CardTip>
    </div>
  );
}

/** Adversaires les plus presents dans les defaites recentes. */
export function ListNemeses({
  analysis,
  t,
  locale,
}: {
  analysis: { list: Nemesis[]; analyzed: number };
  t: T;
  locale: Locale;
}) {
  if (analysis.analyzed === 0) {
    return <p className="text-sm leading-relaxed text-chalk-400">{t("pages.accountProfile.nemesesNoTeams")}</p>;
  }
  return (
    <>
      <ListHeroTip
        empty={t("pages.accountProfile.nemesesEmpty")}
        entries={analysis.list.map((b) => ({
          hero: b.hero,
          detail: t("pages.accountProfile.nemesisDetail", { d: b.defeats, n: b.encounters }),
        }))}
      />
      <p className="mt-3 text-xs text-chalk-500">
        {t(`pages.accountProfile.nemesesSource.${plural(analysis.analyzed, locale)}`, { n: analysis.analyzed })}
      </p>
    </>
  );
}

/**
 * Attente d'une section lue a part, annoncee sans interrompre la lecture.
 * `texte` remplace le message par defaut ; `className` reserve la place de la
 * section a venir, pour que la page ne saute pas a son arrivee.
 */
export function AnalysisInProgress({ t, text, className }: { t: T; text?: string; className?: string }) {
  return (
    <p role="status" className={cn("animate-pulse text-sm text-chalk-500", className)}>
      {text ?? t("pages.accountProfile.analysisPending")}
    </p>
  );
}

import Image from "next/image";
import { ArrowRight, Flame, Swords, TrendingDown, Trophy } from "lucide-react";
import { BuildPicker } from "@/components/build-picker";
import { RateCurve } from "@/components/rate-curve";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import {
  WINDOW_SHAPE,
  MATCHES_MIN_ROLE,
  type SummaryRoles,
  type Evolution,
  type HeroRankSheet,
} from "@/lib/player-analysis";
import type { ResolvedItem } from "@/components/builds-by-rank";
import { formatDateMatch, formatGap, formatCount, formatPercent, plural } from "@/lib/player-format";
import { MARGIN_POINTS, MATCHES_MIN } from "@/lib/player-profile";
import type { MeasuredRank } from "@/lib/measured-ranks";
import type { Lane, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Analyses du profil de joueur : roles et positions, evolution, et ce que
 * joue le rang du joueur sur ses heros.
 *
 * Composants serveur sans etat, comme ceux de `profil-joueur` : ils recoivent
 * des chiffres deja calcules et la fonction de traduction. Seule la courbe est
 * un composant client ; elle ne recoit que des nombres et des dates.
 */

// ─────────────────────────────────────────────────────────────
// Roles et positions
// ─────────────────────────────────────────────────────────────

/** Tableau des parties par role ou par position, points fort et faible signales. */
export function TableRoles<C extends Role | Lane>({
  type,
  title,
  source,
  summary,
  t,
  locale,
}: {
  type: "roles" | "lanes";
  title: string;
  source: string;
  summary: SummaryRoles<C>;
  t: T;
  locale: Locale;
}) {
  const name = (key: C) => t(`${type}.${key}`);
  const column = type === "roles" ? t("pages.accountProfile.colRole") : t("builds.position");
  const keyExcluded = type === "roles" ? "noRole" : "noPosition";

  return (
    <div className="min-w-0">
      <h3 className="font-heading text-lg font-bold text-chalk-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-chalk-500">{source}</p>

      {summary.rows.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-chalk-400">
          {type === "roles"
            ? t("pages.accountProfile.heroesEmpty")
            : summary.excluded > 0
              ? t("pages.accountProfile.positionsEmpty")
              : t("pages.accountProfile.gamesEmpty")}
        </p>
      ) : (
        <>
          <div className="mt-4 relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-night-700 text-xs uppercase tracking-wide text-chalk-500">
                  <th scope="col" className="py-2 pr-2 text-left font-medium">
                    {column}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    {t("pages.accountProfile.games")}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    {t("pages.accountProfile.colShare")}
                  </th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">
                    {t("pages.accountProfile.colWin")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {summary.rows.map((l) => {
                  const strong = l.key === summary.strong;
                  const weak = l.key === summary.weak;
                  return (
                    <tr key={l.key}>
                      <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                        <span className="block font-semibold text-chalk-100">{name(l.key)}</span>
                        {(strong || weak) && (
                          <span
                            className={cn(
                              "mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide",
                              strong ? "text-emerald-400" : "text-blood-500",
                            )}
                          >
                            {strong ? <Trophy size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                            {t(strong ? "pages.accountProfile.strongPoint" : "pages.accountProfile.toImprove")}
                          </span>
                        )}
                      </th>
                      <td className="whitespace-nowrap px-2 text-right tabular-nums text-chalk-300">
                        {formatCount(l.matches, locale)}
                      </td>
                      <td className="px-2 text-right tabular-nums text-chalk-300">
                        <span className="whitespace-nowrap">{formatPercent(l.part, locale)}</span>
                        {/* Jauge de la part : un repere de plus, la valeur est ecrite a cote. */}
                        <span aria-hidden className="ml-auto mt-1 block h-1 w-14 max-w-full bg-night-800">
                          <span className="block h-full bg-gold-500/70" style={{ width: `${Math.min(100, l.part)}%` }} />
                        </span>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap pl-2 text-right font-semibold tabular-nums",
                          strong ? "text-emerald-400" : weak ? "text-blood-500" : "text-chalk-100",
                        )}
                      >
                        {formatPercent(l.rate, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-chalk-300">
            {summary.strong && summary.weak
              ? t("pages.accountProfile.rolesSummary", {
                  fort: name(summary.strong),
                  tauxFort: formatPercent(summary.rows.find((l) => l.key === summary.strong)!.rate, locale),
                  faible: name(summary.weak),
                  tauxFaible: formatPercent(summary.rows.find((l) => l.key === summary.weak)!.rate, locale),
                })
              : t("pages.accountProfile.rolesFew", { n: MATCHES_MIN_ROLE })}
          </p>
          {summary.excluded > 0 && (
            <p className="mt-2 text-xs text-chalk-500">
              {t(`pages.accountProfile.${keyExcluded}.${plural(summary.excluded, locale)}`, { n: summary.excluded })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Evolution
// ─────────────────────────────────────────────────────────────

function Tile({ label, tone, children }: { label: string; tone?: "good" | "bad"; children: React.ReactNode }) {
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-heading text-xl font-bold tabular-nums",
          tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-blood-500" : "text-gold-400",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

const day = (d: string, locale: Locale) => formatDateMatch(Date.parse(`${d}T00:00:00Z`) / 1000, locale, false);

/** Series et forme recente, puis la courbe du taux de victoire partie apres partie. */
export function EvolutionPlayer({
  evo,
  end,
  t,
  locale,
}: {
  evo: Evolution;
  /** Vrai quand l'historique lu couvre toute la saison. */
  end: boolean;
  t: T;
  locale: Locale;
}) {
  if (evo.matches === 0) return <p className="mt-6 text-sm text-chalk-500">{t("pages.accountProfile.gamesEmpty")}</p>;

  const series = evo.ongoingSeries;
  const countOf = (n: number) => formatCount(n, locale);
  const runKey = series?.win ? "winStreak" : "lossStreak";
  const keySource = end ? "trendSeason" : "trendSource";
  const curve = evo.curve;
  const summary = curve
    ? t("pages.accountProfile.curveSummary", {
        f: WINDOW_SHAPE,
        debut: day(curve.dates[0], locale),
        fin: day(curve.dates.at(-1)!, locale),
        depart: formatPercent(curve.rolling[0], locale),
        arrivee: formatPercent(curve.rolling.at(-1)!, locale),
        min: formatPercent(Math.min(...curve.rolling), locale),
        max: formatPercent(Math.max(...curve.rolling), locale),
      })
    : "";

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label={t("pages.accountProfile.currentStreak")}
          tone={series ? (series.win ? "good" : "bad") : undefined}
        >
          {series ? (
            <span className="inline-flex items-center gap-1.5">
              {series.win && series.length >= 3 && <Flame size={18} aria-hidden />}
              {t(`pages.accountProfile.${runKey}.${plural(series.length, locale)}`, { n: countOf(series.length) })}
            </span>
          ) : (
            "—"
          )}
        </Tile>
        <Tile label={t("pages.accountProfile.longestWinStreak")}>{countOf(evo.bestStreak)}</Tile>
        <Tile label={t("pages.accountProfile.longestLossStreak")}>{countOf(evo.worstStreak)}</Tile>
        <Tile label={t("pages.accountProfile.recentGames", { n: WINDOW_SHAPE })}>
          {evo.shape !== null ? formatPercent(evo.shape, locale) : "—"}
        </Tile>
      </dl>

      {curve ? (
        <div className="bevel mt-4 border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
          <RateCurve
            dates={curve.dates}
            series={[
              {
                name: t("pages.accountProfile.rollingSeries", { n: WINDOW_SHAPE }),
                values: curve.rolling,
                color: "text-gold-400",
              },
              {
                name: t("pages.accountProfile.cumulativeSeries"),
                values: curve.cumulative,
                color: "text-azure-400",
                dashes: true,
              },
            ]}
            decimals={0}
            label={summary}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-chalk-400">
          {t("pages.accountProfile.curveShort", { n: WINDOW_SHAPE + 1 })}
        </p>
      )}

      <p className="mt-3 text-xs text-chalk-500">
        {t(`pages.accountProfile.${keySource}.${plural(evo.matches, locale)}`, {
          n: countOf(evo.matches),
          taux: formatPercent((evo.wins / evo.matches) * 100, locale),
        })}
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Ce que joue le rang
// ─────────────────────────────────────────────────────────────

function ItemIconData({ item }: { item: ResolvedItem }) {
  const content = (
    <>
      <span className="relative mx-auto block size-9">
        {item.image ? (
          <Image src={item.image} alt="" fill unoptimized className="object-contain" />
        ) : (
          <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">{item.name.charAt(0)}</span>
        )}
      </span>
      <span className="mt-1 block text-[0.65rem] leading-tight text-chalk-300">{item.name}</span>
    </>
  );
  const cssClass = "bevel-sm block h-full border border-night-700 bg-night-850 p-1.5 text-center";
  return item.slug ? (
    <Link href={`/items#${item.slug}`} className={cn(cssClass, "transition-colors hover:border-gold-500/60")}>
      {content}
    </Link>
  ) : (
    <span className={cssClass}>{content}</span>
  );
}

function LinkTab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-400 underline-offset-4 transition-colors hover:text-gold-300 hover:underline"
    >
      {children}
      <ArrowRight size={13} aria-hidden />
    </Link>
  );
}

/**
 * Heros les plus joues face a ce que joue le rang : l'ecart au taux moyen,
 * le build le plus joue a ce rang et les heros qui le mettent en difficulte.
 * Chaque bloc mene a l'onglet correspondant de la fiche du heros.
 */
export function HeroRankSheets({
  sheets,
  bucket,
  t,
  locale,
}: {
  sheets: HeroRankSheet[];
  bucket: MeasuredRank;
  t: T;
  locale: Locale;
}) {
  const nameRank = (r: MeasuredRank) => t(`measuredRanks.${r}`);
  const nameEmblem = (name: string) => {
    const role = t(`roles.${name}`);
    return role === `roles.${name}` ? name : role;
  };

  return (
    <div className="mt-10">
      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.accountProfile.vsRankTitle")}</h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-chalk-500">
        {t("pages.accountProfile.vsRankIntro", { rang: nameRank(bucket) })}
      </p>

      {sheets.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-chalk-400">{t("pages.accountProfile.vsRankEmpty")}</p>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sheets.map(({ row, lane, build, rankBuild, weak, rankCounters }) => {
            const { slug, name } = row.hero;
            const reliable = row.matches >= MATCHES_MIN && row.gap !== null;
            return (
              <li key={slug} className="bevel flex min-w-0 flex-col border border-night-700/70 bg-night-900/60 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <HeroPortrait source={row.hero.portrait} name={name} size="small" decorative />
                  <div className="min-w-0">
                    <Link
                      href={`/heroes/${slug}`}
                      className="block truncate font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
                    >
                      {name}
                    </Link>
                    <p className="text-xs text-chalk-500">
                      {t(`pages.accountProfile.nGames.${plural(row.matches, locale)}`, { n: row.matches })}
                      {row.average !== null && (
                        <>
                          {" · "}
                          {t("pages.accountProfile.belowAverageDetail", {
                            taux: formatPercent(row.rate, locale),
                            moyenne: formatPercent(row.average, locale),
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {row.gap !== null && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-sm font-semibold tabular-nums",
                        !reliable
                          ? "text-chalk-400"
                          : row.gap >= MARGIN_POINTS
                            ? "text-emerald-400"
                            : row.gap <= -MARGIN_POINTS
                              ? "text-blood-500"
                              : "text-chalk-300",
                      )}
                    >
                      {`${formatGap(row.gap, locale)} ${t("counters.pts")}`}
                    </span>
                  )}
                </div>

                {build && rankBuild && (
                  <section className="mt-4 border-t border-night-800 pt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-chalk-400">
                      {t("pages.accountProfile.buildRank", { rang: nameRank(rankBuild) })}
                    </h4>
                    <p className="mt-0.5 text-xs text-chalk-500">
                      {[
                        lane ? t("pages.accountProfile.positionBuild", { lane: t(`lanes.${lane}`) }) : null,
                        build.win !== null
                          ? t("builds.win", { taux: formatCount(build.win, locale, 1) })
                          : null,
                        build.selection !== null
                          ? t("builds.pick", { taux: formatCount(build.selection, locale, 1) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ul aria-label={t("builds.items")} className="mt-2 grid grid-cols-3 gap-1.5">
                      {build.items.map((o, i) => (
                        <li key={`${o.name}-${i}`}>
                          <ItemIconData item={o} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {build.emblem && (
                        <BuildPicker
                          label={t("builds.emblem")}
                          name={nameEmblem(build.emblem.name)}
                          image={build.emblem.image}
                        />
                      )}
                      {build.sort && (
                        <BuildPicker label={t("builds.spell")} name={build.sort.name} image={build.sort.image} />
                      )}
                    </div>
                    {build.talents.length > 0 && (
                      <p className="mt-2 text-xs leading-relaxed text-chalk-300">
                        <span className="block text-[0.65rem] uppercase tracking-wide text-chalk-500">
                          {t("builds.talents")}
                        </span>
                        {build.talents.map((x) => x.name).join(", ")}
                      </p>
                    )}
                    <LinkTab href={`/heroes/${slug}#builds`}>
                      {t("pages.accountProfile.seeBuilds", { nom: name })}
                    </LinkTab>
                  </section>
                )}

                {weak.length > 0 && rankCounters && (
                  <section className="mt-4 border-t border-night-800 pt-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-chalk-400">
                      <Swords size={13} aria-hidden />
                      {t("pages.accountProfile.countersRank", { rang: nameRank(rankCounters) })}
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {weak.map((c) => (
                        <li key={c.hero.slug}>
                          <Link
                            href={`/heroes/${c.hero.slug}`}
                            className="group flex items-center gap-2 rounded-sm px-1 py-0.5 transition-colors hover:bg-night-850"
                          >
                            <HeroPortrait source={c.hero.portrait} name={c.hero.name} size="icon" decorative />
                            <span className="min-w-0 flex-1 truncate text-sm text-chalk-100 transition-colors group-hover:text-gold-400">
                              {c.hero.name}
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-blood-500">
                              {`${formatGap(c.advantage, locale)} ${t("counters.pts")}`}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <LinkTab href={`/heroes/${slug}#contres`}>
                      {t("pages.accountProfile.seeCounters", { nom: name })}
                    </LinkTab>
                  </section>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

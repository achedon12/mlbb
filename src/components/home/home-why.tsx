import Link from "@/components/link";
import { Score, SectionTitle } from "@/components/ui";
import { LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { botPublished } from "@/lib/bot/public";
import { detailedPatches, sync } from "@/lib/data";
import { historyOf, historyStart } from "@/lib/evolution";
import { dateMeasure, longDate, patchCurrent } from "@/lib/freshness";
import { EPOCH } from "@/lib/mlbbdle";
import { ADJUSTMENT_DIRECTIONS, groupAdjustments } from "@/lib/meta-report";
import { rankingFull } from "@/lib/tier-list";
import { DAYS_IMPACT, daysBetween, impactsOfPatch } from "@/lib/trends";
import { cn } from "@/lib/utils";
import { DAILY_DAYS } from "../../../scripts/measures.mjs";

interface Point {
  key: string;
  title: string;
  text: string;
  links: { href: string; label: string }[];
}

/**
 * « Pourquoi MLBBDex »: what the site does itself and no other source gives,
 * each point with the page that shows it. Every figure is read from the data
 * at render time (heroes measured, days of history kept, heroes whose patch
 * effect is measured), so none of them goes stale; the bot's point only
 * appears when the bot is deployed.
 *
 * One figure leads, the length of the history, in the score face; the points
 * follow as a two-column list of short lines, no frame around each.
 */
export function HomeWhy({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const measured = dateMeasure.slice(0, 10);
  const start = historyStart();
  const days = start ? daysBetween(start, measured) + 1 : 0;
  const top = rankingFull[0]?.hero ?? null;

  const patch = detailedPatches(locale)[patchCurrent.version] ?? patchCurrent;
  const groups = groupAdjustments(patch.adjustments);
  const changed = ADJUSTMENT_DIRECTIONS.reduce((n, d) => n + groups[d].length, 0);
  const impacts = Object.keys(impactsOfPatch(patch, historyOf)).length;

  const points: Point[] = [
    {
      key: "daily",
      title: t("why.daily.title"),
      text: t("why.daily.text", { n: rankingFull.length, date: longDate(locale, dateMeasure) }),
      links: [{ href: "/statistics", label: t("why.daily.link") }],
    },
    ...(start && top
      ? [
          {
            key: "history",
            title: t("why.history.title"),
            text: t("why.history.text", { date: longDate(locale, start), daily: DAILY_DAYS }),
            links: [{ href: `/heroes/${top.slug}#stats`, label: t("why.history.link", { hero: top.name }) }],
          },
        ]
      : []),
    {
      key: "tierList",
      title: t("why.tierList.title"),
      text: t("why.tierList.text", { formula: t("pages.tierList.scoreBold") }),
      links: [{ href: "/tier-list", label: t("why.tierList.link") }],
    },
    {
      key: "patch",
      title: t("why.patch.title"),
      text:
        impacts > 0
          ? t("why.patch.text", { days: DAYS_IMPACT, version: patch.version, n: impacts, changed })
          : t("why.patch.textPending", { days: DAYS_IMPACT, version: patch.version }),
      links: [{ href: `/patch-notes/${patch.version}`, label: t("why.patch.link", { version: patch.version }) }],
    },
    {
      key: "draft",
      title: t("why.draft.title"),
      text: t("why.draft.text"),
      links: [{ href: "/draft", label: t("why.draft.link") }],
    },
    {
      key: "games",
      title: t("why.games.title"),
      text: t("why.games.text", { date: longDate(locale, EPOCH) }),
      links: [
        { href: "/mlbbdle", label: t("nav.mlbbdle.label") },
        { href: "/quiz", label: t("nav.quiz.label") },
      ],
    },
    {
      key: "builds",
      title: t("why.builds.title"),
      text: t("why.builds.text"),
      links: [{ href: "/builds", label: t("why.builds.link") }],
    },
    ...(botPublished()
      ? [{ key: "bot", title: t("why.bot.title"), text: t("why.bot.text"), links: [{ href: "/bot", label: t("why.bot.link") }] }]
      : []),
    {
      key: "languages",
      title: t("why.languages.title", { n: LOCALES.length }),
      text: t("why.languages.text", { others: LOCALES.length - 1 }),
      links: [{ href: "/methodology", label: t("editorial.methodology.title") }],
    },
  ];

  return (
    <section aria-labelledby="home-why" data-home-why className={className}>
      <SectionTitle id="home-why" lead={t("why.lead")} action={{ href: "/methodology", label: t("editorial.methodology.title") }}>
        {t("why.title")}
      </SectionTitle>

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        {days > 0 && start && (
          <p className="min-w-0">
            <Score value={days} className="text-[clamp(4.5rem,3rem+5vw,7rem)] leading-none" />
            <span className="mt-2 block max-w-[16rem] font-heading text-lg font-semibold leading-snug text-chalk-100">
              {t("why.figure", { date: longDate(locale, start) })}
            </span>
          </p>
        )}
        <ul className={cn("grid min-w-0 gap-x-10 gap-y-6 sm:grid-cols-2", !(days > 0 && start) && "lg:col-span-2")}>
          {points.map((p) => (
            <li key={p.key} className="min-w-0 border-t border-night-800 pt-4">
              <h3 className="font-heading text-xl font-bold uppercase leading-tight text-chalk-100">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-chalk-400">{p.text}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {p.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
                  >
                    {l.label} <span aria-hidden>→</span>
                  </Link>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-8 text-sm text-chalk-500">{t("home.syncLead", { date: longDate(locale, sync.date) })}</p>
    </section>
  );
}

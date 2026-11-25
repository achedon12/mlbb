import Link from "@/components/link";
import { interpolate } from "@/components/esports-parts";
import { LOCALE_INTL, LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { historyStart } from "@/lib/evolution";
import { dateMeasure } from "@/lib/freshness";
import { leaderOf, rankingFull } from "@/lib/tier-list";
import { daysBetween } from "@/lib/trends";

/**
 * « Pourquoi MLBBDex », in one sentence set large, its figures read from the
 * data at render time so none goes stale: the days of history the site
 * keeps, the heroes it measures every day, the languages it is written in,
 * and that it is free with no ads. Under it, the pages that prove each
 * figure and how they are made. Dark ink: it sits on the azure band of the
 * community section (`HomeCommunity`).
 */
export function HomeWhy({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const start = historyStart();
  const days = start ? daysBetween(start, dateMeasure.slice(0, 10)) + 1 : 0;
  const top = leaderOf(rankingFull)?.hero ?? null;
  const number = new Intl.NumberFormat(LOCALE_INTL[locale]);
  const figure = (value: number) => <span className="figure">{number.format(value)}</span>;

  const proofs = [
    ...(days > 0 && top ? [{ href: `/heroes/${top.slug}#stats`, label: t("why.history.link", { hero: top.name }) }] : []),
    { href: "/statistics", label: t("why.daily.link") },
    { href: "/methodology", label: t("editorial.methodology.title") },
  ];

  return (
    <section aria-labelledby="home-why" data-home-why className={className}>
      <h2 id="home-why" className="font-heading text-xl font-bold uppercase text-night-950/75">
        {t("why.title")}
      </h2>
      <p className="display-caps mt-4 max-w-[24ch] text-balance text-[clamp(2.2rem,1.2rem+3.4vw,4.75rem)] leading-[0.92] text-night-950">
        {interpolate(t(days > 0 ? "why.manifesto" : "why.manifestoShort"), {
          days: figure(days),
          heroes: figure(rankingFull.length),
          languages: figure(LOCALES.length),
        })}
      </p>
      <ul className="mt-6 flex flex-wrap gap-x-7">
        {proofs.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="inline-flex min-h-11 items-center font-semibold text-night-950 underline decoration-2 underline-offset-4 hover:decoration-4"
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from "@/components/link";
import { interpolate } from "@/components/esports-parts";
import { LOCALE_INTL, LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { sync } from "@/lib/data";
import { historyStart } from "@/lib/evolution";
import { dateMeasure, longDate } from "@/lib/freshness";
import { leaderOf, rankingFull } from "@/lib/tier-list";
import { daysBetween } from "@/lib/trends";

/**
 * « Pourquoi MLBBDex », in one sentence set very large, its figures read
 * from the data at render time so none goes stale: the days of history the
 * site keeps, the heroes it measures every day, the languages it is written
 * in, and that it is free with no ads. Under it, the pages that prove each
 * figure, and how they are made (the methodology page).
 */
export function HomeWhy({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const measured = dateMeasure.slice(0, 10);
  const start = historyStart();
  const days = start ? daysBetween(start, measured) + 1 : 0;
  const top = leaderOf(rankingFull)?.hero ?? null;
  const number = new Intl.NumberFormat(LOCALE_INTL[locale]);
  const figure = (value: number) => <span className="text-gold-400">{number.format(value)}</span>;

  const proofs = [
    ...(start && days > 0 && top ? [{ href: `/heroes/${top.slug}#stats`, label: t("why.history.link", { hero: top.name }) }] : []),
    { href: "/statistics", label: t("why.daily.link") },
    { href: "/methodology", label: t("editorial.methodology.title") },
  ];

  return (
    <section aria-labelledby="home-why" data-home-why className={className}>
      <h2 id="home-why" className="font-heading text-xl font-bold uppercase text-chalk-300">
        {t("why.title")}
      </h2>
      <p className="display-caps mt-6 max-w-[22ch] text-balance text-[clamp(2.6rem,1rem+5.4vw,7rem)] leading-[0.92] text-chalk-100">
        {interpolate(t(start && days > 0 ? "why.manifesto" : "why.manifestoShort"), {
          days: figure(days),
          heroes: figure(rankingFull.length),
          languages: figure(LOCALES.length),
        })}
      </p>
      <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
        {proofs.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="inline-flex min-h-11 items-center font-heading text-lg font-bold uppercase text-gold-400 underline decoration-1 underline-offset-[6px] transition-colors hover:text-gold-300"
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-chalk-500">
        {start && t("why.since", { date: longDate(locale, start) })} {t("home.syncLead", { date: longDate(locale, sync.date) })}
      </p>
    </section>
  );
}

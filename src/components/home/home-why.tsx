import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import { Score, SectionTitle } from "@/components/ui";
import { LOCALE_INTL, LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { sync } from "@/lib/data";
import { historyStart } from "@/lib/evolution";
import { dateMeasure, longDate } from "@/lib/freshness";
import { leaderOf, rankingFull } from "@/lib/tier-list";
import { daysBetween } from "@/lib/trends";

interface Proof {
  key: string;
  figure: string;
  text: string;
  link?: { href: string; label: string };
}

/**
 * « Pourquoi MLBBDex », in four proofs: the days of history the site keeps,
 * the heroes it measures every day, the languages it is written in, and that
 * it is free with no ads. Each is a real figure read from the data at render
 * time, so none goes stale, with the page that shows it; how each is made
 * is on the methodology page, the section's link.
 */
export function HomeWhy({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const measured = dateMeasure.slice(0, 10);
  const start = historyStart();
  const days = start ? daysBetween(start, measured) + 1 : 0;
  const top = leaderOf(rankingFull)?.hero ?? null;
  const number = new Intl.NumberFormat(LOCALE_INTL[locale]);

  const proofs: Proof[] = [
    ...(start && days > 0
      ? [
          {
            key: "history",
            figure: number.format(days),
            text: t("why.figure", { date: longDate(locale, start) }),
            link: top ? { href: `/heroes/${top.slug}#stats`, label: t("why.history.link", { hero: top.name }) } : undefined,
          },
        ]
      : []),
    {
      key: "measured",
      figure: number.format(rankingFull.length),
      text: t("why.proof.measured"),
      link: { href: "/statistics", label: t("why.daily.link") },
    },
    {
      key: "languages",
      figure: number.format(LOCALES.length),
      text: t("why.proof.languages", { others: LOCALES.length - 1 }),
      link: { href: "/methodology", label: t("editorial.methodology.title") },
    },
    { key: "free", figure: t("why.proof.free"), text: t("why.proof.freeText") },
  ];

  return (
    <section aria-labelledby="home-why" data-home-why className={className}>
      <SectionTitle id="home-why" lead={t("why.lead")} action={{ href: "/methodology", label: t("editorial.methodology.title") }}>
        {t("why.title")}
      </SectionTitle>

      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {proofs.map((p) => (
          <li key={p.key} className="bevel flex min-w-0 flex-col bg-night-950 p-5 shadow-[inset_0_3px_0_var(--color-gold-400)] sm:p-6">
            <Score value={p.figure} className="pr-[0.1em] text-[clamp(3.25rem,2.4rem+3vw,4.75rem)] leading-none" />
            <p className="mt-3 font-heading text-lg font-semibold leading-snug text-chalk-100">{p.text}</p>
            {p.link && (
              <Link
                href={p.link.href}
                className="group mt-auto inline-flex min-h-11 items-center gap-1.5 pt-3 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
              >
                {p.link.label}
                <ArrowRight size={15} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-chalk-500">{t("home.syncLead", { date: longDate(locale, sync.date) })}</p>
    </section>
  );
}

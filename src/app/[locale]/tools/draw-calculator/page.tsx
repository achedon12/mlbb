import type { Metadata } from "next";
import { DrawCalculator } from "@/components/draw-calculator";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { CRYSTAL_SOURCE, OUT_OF_MODEL_SOURCES, PRESETS, chanceWithin, drawsForChance, type DrawEvent } from "@/lib/draw-odds";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/tools/draw-calculator";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.drawCalculator.title"),
    description: t("pages.seo.drawCalculator.description"),
    chemin: PATH,
    motsCles: ["MLBB draw calculator", "diamonds", "event skin", "odds", "pity", "Mobile Legends", "MLBB"],
  });
}

const sectionTitle = "font-heading text-2xl font-bold text-chalk-100";
const sourceLink = "underline transition-colors hover:text-gold-400";

/** FAQ example: 100 draws at 1 %, without pity. */
const EXAMPLE: DrawEvent = { cost: 1, tenCost: null, chance: 1, pity: null };
const EXAMPLE_DRAWS = 100;

export default async function DrawCalculatorPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const integer = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const percent = new Intl.NumberFormat(LOCALE_HTML[locale], { style: "percent", maximumFractionDigits: 0 });
  const structuredData = donneesOutil(locale, {
    nom: t("pages.drawCalculator.title"),
    description: t("pages.seo.drawCalculator.description"),
    chemin: PATH,
    categorie: "UtilitiesApplication",
  });
  const example = { draws: integer.format(EXAMPLE_DRAWS), p: percent.format(EXAMPLE.chance / 100) };
  // One entry per wiki page, even when two presets share it.
  const sources = [
    ...new Map(PRESETS.map((p) => [p.source, p.name])).entries(),
    [CRYSTAL_SOURCE, "Crystal of Aurora"] as const,
    ...OUT_OF_MODEL_SOURCES.map((s) => [s.url, s.name] as const),
  ];

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.drawCalculatorUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage titre={t("pages.drawCalculator.title")} chapeau={t("pages.drawCalculator.lead")} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <DrawCalculator />

        <section aria-labelledby="method-title">
          <h2 id="method-title" className={sectionTitle}>
            {t("pages.drawCalculator.methodTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.drawCalculator.method1")}</p>
            <p>{t("pages.drawCalculator.method2")}</p>
            <p>{t("pages.drawCalculator.method3")}</p>
            <p>{t("pages.drawCalculator.method4")}</p>
          </div>
        </section>

        <section aria-labelledby="limits-title">
          <h2 id="limits-title" className={sectionTitle}>
            {t("pages.drawCalculator.limitsTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.drawCalculator.limit1")}</p>
            <p>{t("pages.drawCalculator.limit2")}</p>
          </div>
        </section>

        <section aria-labelledby="find-title">
          <h2 id="find-title" className={sectionTitle}>
            {t("pages.drawCalculator.findTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.drawCalculator.find1")}</p>
        </section>

        <section aria-labelledby="faq-title">
          <h2 id="faq-title" className={sectionTitle}>
            {t("pages.drawCalculator.faqTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <dl className="mt-4 space-y-5">
            <div>
              <dt className="font-semibold text-chalk-100">{t("pages.drawCalculator.q1", example)}</dt>
              <dd className="mt-1 leading-relaxed text-chalk-300">
                {t("pages.drawCalculator.a1", {
                  ...example,
                  chance: percent.format(chanceWithin(EXAMPLE_DRAWS, EXAMPLE)),
                  n: integer.format(drawsForChance(0.99, EXAMPLE)),
                })}
              </dd>
            </div>
            {(["2", "3"] as const).map((q) => (
              <div key={q}>
                <dt className="font-semibold text-chalk-100">{t(`pages.drawCalculator.q${q}`)}</dt>
                <dd className="mt-1 leading-relaxed text-chalk-300">{t(`pages.drawCalculator.a${q}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/tools/collection" className="font-semibold text-gold-400 hover:text-gold-500">
            {t("pages.drawCalculator.collectionLink")} →
          </Link>
          <Link href="/skins/calendar" className="font-semibold text-gold-400 hover:text-gold-500">
            {t("pages.drawCalculator.calendarLink")} →
          </Link>
        </p>

        <section aria-labelledby="sources-title" className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          <h2 id="sources-title" className="font-semibold text-chalk-300">
            {t("pages.drawCalculator.sourcesTitle")}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {sources.map(([url, name]) => (
              <li key={url}>
                <a href={url} rel="noopener" className={sourceLink}>
                  {t("pages.drawCalculator.sourceWiki", { page: name })}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </CompleterMessages>
  );
}

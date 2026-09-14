import type { Metadata } from "next";
import { RetributionTrainer } from "@/components/retribution-trainer";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import {
  RETRIBUTION_BASE,
  RETRIBUTION_BY_LEVEL,
  OBJECTIVE_KEYS,
  DIFFICULTY_ORDER,
  ROUNDS_PER_RUN,
  LEVEL_MAX,
  LEVEL_MIN,
  OBJECTIVES,
  WEIGHT_ACCURACY,
  WEIGHT_SPEED,
  REACTION_NONE_MS,
  REACTION_FULL_MS,
  COOLDOWN_RETRIBUTION_S,
  SETTINGS,
  SOURCE_RETRIBUTION,
  damageRetribution,
} from "@/lib/retribution";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/tools/retribution";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.retribution.title"),
    description: t("pages.seo.retribution.description"),
    path: PATH,
    keywords: ["retribution", "retribution test", "jungle", "Lord", "Turtle", "timing", "Mobile Legends", "MLBB"],
  });
}

const titleSection = "font-heading text-2xl font-bold text-chalk-100";

export default async function RetributionPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const integer = new Intl.NumberFormat(locale);
  const structuredData = dataTool(locale, {
    name: t("pages.retribution.title"),
    description: t("pages.seo.retribution.description"),
    path: PATH,
    category: "GameApplication",
  });
  const levels = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);
  // Echelles des graphiques : la plus grande valeur de chaque serie remplit la barre.
  const damageMax = damageRetribution(LEVEL_MAX);
  const hpMaxObjectives = Math.max(...OBJECTIVE_KEYS.map((c) => OBJECTIVES[c].hp));
  const reactionMax = Math.max(...DIFFICULTY_ORDER.map((d) => SETTINGS[d].reactionEnemy[1]));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader title={t("pages.retribution.title")} lead={t("pages.retribution.lead")} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <RetributionTrainer address={`${site.url}/${locale}${PATH}`} />

        <section aria-labelledby="regles-titre">
          <h2 id="regles-titre" className={titleSection}>
            {t("pages.retribution.rulesTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.retribution.rule1")}</p>
            <p>{t("pages.retribution.rule2", { recharge: COOLDOWN_RETRIBUTION_S })}</p>
            <p>
              {t("pages.retribution.rule3", {
                precision: WEIGHT_ACCURACY,
                vitesse: WEIGHT_SPEED,
                pleine: REACTION_FULL_MS,
                nulle: integer.format(REACTION_NONE_MS),
              })}
            </p>
            <p>{t("pages.retribution.rule4", { n: ROUNDS_PER_RUN })}</p>
          </div>
        </section>

        <section aria-labelledby="valeurs-titre">
          <h2 id="valeurs-titre" className={titleSection}>
            {t("pages.retribution.valuesTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">
            {t("pages.retribution.damageIntro", { base: RETRIBUTION_BASE, parNiveau: RETRIBUTION_BY_LEVEL })}
          </p>
          <ol className="mt-5 space-y-1.5">
            {levels.map((n) => {
              const damage = damageRetribution(n);
              return (
                <li key={n} className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="text-chalk-500">{t("pages.retribution.level", { n })}</span>
                  <span aria-hidden className="h-3 bg-night-800">
                    <span
                      className="block h-full bg-linear-to-r from-gold-600 to-gold-400"
                      style={{ width: `${(damage / damageMax) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-heading font-bold tabular-nums text-chalk-100">{integer.format(damage)}</span>
                </li>
              );
            })}
          </ol>

          <h3 className="mt-10 font-heading text-xl font-bold text-chalk-100">{t("pages.retribution.monstersTitle")}</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {OBJECTIVE_KEYS.map((key) => {
              const o = OBJECTIVES[key];
              const segment = (o.segment / o.hp) * 100;
              return (
                <li key={key} className="bevel-sm flex items-center gap-4 border border-night-700/70 bg-night-900/60 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- portrait local, deja reduit */}
                  <img
                    src={o.image}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    className="size-14 shrink-0 rounded-full border border-night-600 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold text-chalk-100">{t(`tools.retribution.objective.${key}`)}</span>
                      <span className="font-heading font-bold tabular-nums text-chalk-100">
                        {t("tools.retribution.maxHp", { pv: integer.format(o.hp) })}
                      </span>
                    </p>
                    {/* Longueur relative au plus gros objectif ; un trait par segment de la barre de vie. */}
                    <div aria-hidden className="mt-2 h-2.5 bg-night-950">
                      <div
                        className="h-full bg-linear-to-r from-blood-500 to-[#ff7a66]"
                        style={{
                          width: `${(o.hp / hpMaxObjectives) * 100}%`,
                          backgroundImage: `repeating-linear-gradient(to right, transparent 0 calc(${segment}% - 1px), rgba(6, 8, 15, 0.9) calc(${segment}% - 1px) ${segment}%), linear-gradient(to right, #d94848, #ff7a66)`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-chalk-500">
                      <span>
                        {t("pages.retribution.colSegment")} : <span className="tabular-nums">{integer.format(o.segment)}</span>
                      </span>
                      <a href={o.source} rel="noopener" className="underline transition-colors hover:text-gold-400">
                        {t("pages.retribution.wiki")}
                      </a>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-chalk-500">{t("pages.retribution.monstersNote")}</p>

          <h3 className="mt-10 font-heading text-xl font-bold text-chalk-100">{t("pages.retribution.difficultiesTitle")}</h3>
          <div className="mt-3 relative overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="border-b border-night-700 text-xs uppercase tracking-wide text-chalk-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.retribution.colDifficulty")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.retribution.colEnemy")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.retribution.colMarker")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.retribution.colHpNumbers")}</th>
                </tr>
              </thead>
              <tbody>
                {DIFFICULTY_ORDER.map((d) => {
                  const r = SETTINGS[d];
                  return (
                    <tr key={d} className="border-b border-night-800">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-chalk-100">
                        {t(`tools.retribution.difficulty.${d}`)}
                      </th>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-3">
                          <span aria-hidden className="relative h-2 w-20 shrink-0 bg-night-800 sm:w-32">
                            <span
                              className="absolute inset-y-0 bg-blood-500"
                              style={{
                                left: `${(r.reactionEnemy[0] / reactionMax) * 100}%`,
                                width: `${((r.reactionEnemy[1] - r.reactionEnemy[0]) / reactionMax) * 100}%`,
                              }}
                            />
                          </span>
                          <span className="whitespace-nowrap tabular-nums text-chalk-200">
                            {integer.format(r.reactionEnemy[0])}–{integer.format(r.reactionEnemy[1])} ms
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-chalk-300">
                        {r.marker ? t("pages.retribution.yes") : t("pages.retribution.no")}
                      </td>
                      <td className="py-2.5 text-chalk-300">
                        {r.hpFigures ? t("pages.retribution.yes") : t("pages.retribution.no")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-chalk-500">{t("pages.retribution.trainingValues")}</p>
        </section>

        <section aria-labelledby="sources-titre" className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          <h2 id="sources-titre" className="font-semibold text-chalk-300">{t("pages.retribution.sourcesTitle")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SOURCE_RETRIBUTION} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.retribution.sourceRetribution")}
              </a>
            </li>
            <li>{t("pages.retribution.sourceMonsters")}</li>
          </ul>
        </section>
      </div>
    </>
  );
}

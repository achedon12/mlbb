import type { Metadata } from "next";
import { DraftModes } from "@/components/draft-modes";
import Link from "@/components/link";
import { Card, PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { heroLabel } from "@/i18n/hero-data";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import type { T } from "@/i18n/t";
import { createT, messagesPage } from "@/i18n/translations";
import type { TypeDamage } from "@/lib/composition";
import { allHeroes } from "@/lib/data";
import {
  GAME_TIMERS,
  RANKED_BANS,
  sequence,
  SOURCES,
  TOURNAMENT_BANS,
  type SourceKey,
  type Step,
} from "@/lib/draft-simulation";
import { longDate, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { metaByRank, simulationHeroes } from "@/lib/simulation-catalog";
import { RANKS_CLASSES } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/** Description built from data: covered heroes, measurement date and patch. */
function descriptionDraft(locale: Locale): string {
  const t = createT(locale);
  return t("pages.seo.draft.simulatorDescription", { n: allHeroes.length, date: longDate(locale), v: patchCurrent.version });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.draft.simulatorTitle"),
    description: descriptionDraft(locale),
    share: t("pages.draft.simulatorOg"),
    path: "/draft",
    keywords: ["draft simulator", "ban pick", "MPL", "ranked draft", "counter pick", "Mobile Legends", "MLBB"],
  });
}

/** Order of the sources in the list: the [n] references of the rules point to it. */
const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[];

function SourceRefs({ keys, t }: { keys: SourceKey[]; t: T }) {
  return (
    <>
      {keys.map((key) => (
        <sup key={key} className="ml-0.5">
          <a
            href={`#source-${key}`}
            aria-label={t("pages.draft.rules.sourceRef", { site: SOURCES[key].site, page: SOURCES[key].page })}
            className="text-gold-400 hover:text-gold-500"
          >
            [{SOURCE_KEYS.indexOf(key) + 1}]
          </a>
        </sup>
      ))}
    </>
  );
}

/** A format's table, step by step: side, ban or pick, count. */
function StepList({ steps, t }: { steps: Step[]; t: T }) {
  return (
    <ol aria-label={t("pages.draft.rules.order")} className="mt-4 flex flex-wrap gap-1.5">
      {steps.map((s, i) => (
        <li
          key={i}
          className={cn(
            "bevel-sm border px-2 py-1 text-xs text-chalk-100",
            s.side === "blue" ? "border-azure-500/70" : s.side === "red" ? "border-blood-500/70" : "border-gold-500/70",
          )}
        >
          {t("pages.draft.rules.step", {
            side: t(`pages.draft.rules.shortSides.${s.side}`),
            action: t(`pages.draft.rules.actions.${s.action}`),
            n: s.count,
          })}
        </li>
      ))}
    </ol>
  );
}

export default async function DraftPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const structuredData = dataTool(locale, {
    name: t("pages.draft.toolsTitle"),
    description: descriptionDraft(locale),
    path: "/draft",
    category: "GameApplication",
  });
  // The `heroData` catalog stays on the server: damage labels leave
  // already resolved, as for the team analyzer.
  const damage = (key: TypeDamage) => heroLabel(t, "damage", key) ?? key;
  const heading2 = "font-heading text-2xl font-bold text-chalk-100";
  const heading3 = "font-heading text-lg font-bold text-chalk-100";
  const list = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-chalk-300";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader title={t("pages.draft.toolsTitle")} lead={t("pages.draft.toolsLead")}>
        <Link
          href="/tools/team"
          className="mt-5 inline-block text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {t("pages.draft.teamLink")} →
        </Link>
      </PageHeader>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <ExtendMessages messages={messagesPage(locale, ["pages.draftSimulatorUI"])}>
          <DraftModes
            heroes={simulationHeroes()}
            ranks={RANKS_CLASSES}
            meta={metaByRank()}
            damageLabels={{ physical: damage("physical"), magic: damage("magic"), mixed: damage("mixed") }}
          />
        </ExtendMessages>

        {/* -- Format rules ------------------------------------------- */}
        <section id="rules" aria-labelledby="rules-title" className="mt-16 space-y-6">
          <div>
            <h2 id="rules-title" className={heading2}>
              {t("pages.draft.rules.title")}
            </h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            <p className="mt-4 max-w-3xl leading-relaxed text-chalk-300">{t("pages.draft.rules.intro")}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className={heading3}>{t("pages.draft.rules.rankedTitle")}</h3>
              <ul className={list}>
                <li>
                  {t("pages.draft.rules.rankedAccess")}
                  <SourceRefs keys={["ranked"]} t={t} />
                </li>
                <li>
                  {t("pages.draft.rules.rankedBans", {
                    epic: RANKED_BANS.epic,
                    legend: RANKED_BANS.legend,
                    mythic: RANKED_BANS.mythic,
                  })}
                  <SourceRefs keys={["ranked", "patch1866"]} t={t} />
                </li>
                <li>
                  {t("pages.draft.rules.rankedSimultaneous")}
                  <SourceRefs keys={["patch1866", "draftPick"]} t={t} />
                </li>
                <li>
                  {t("pages.draft.rules.picks")}
                  <SourceRefs keys={["draftPick"]} t={t} />
                </li>
                <li>
                  {t("pages.draft.rules.timers", { ban: GAME_TIMERS.ban, pick: GAME_TIMERS.pick })}
                  <SourceRefs keys={["timers", "draftPick"]} t={t} />
                </li>
              </ul>
              <StepList steps={sequence("ranked", "mythic")} t={t} />
              <p className="mt-2 text-xs text-chalk-500">{t("pages.draft.rules.rankedExample")}</p>
            </Card>

            <Card>
              <h3 className={heading3}>{t("pages.draft.rules.tournamentTitle")}</h3>
              <ul className={list}>
                <li>
                  {t("pages.draft.rules.tournamentBans", { n: TOURNAMENT_BANS, total: 2 * TOURNAMENT_BANS })}
                  <SourceRefs keys={["draftPick", "draftGenerator"]} t={t} />
                </li>
                <li>
                  {t("pages.draft.rules.tournamentOrder")}
                  <SourceRefs keys={["firstBan", "alternatingBans"]} t={t} />
                </li>
                <li>
                  {t("pages.draft.rules.picks")}
                  <SourceRefs keys={["draftPick"]} t={t} />
                </li>
                <li>{t("pages.draft.rules.tournamentLimit")}</li>
              </ul>
              <StepList steps={sequence("tournament", "mythic")} t={t} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className={heading3}>{t("pages.draft.rules.botTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chalk-300">{t("pages.draft.rules.bot")}</p>
            </div>
            <div>
              <h3 className={heading3}>{t("pages.draft.rules.advantageTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chalk-300">{t("pages.draft.rules.advantage")}</p>
            </div>
          </div>

          <div>
            <h3 className={heading3}>{t("pages.draft.rules.sources")}</h3>
            <ol className="mt-3 space-y-1.5 text-sm">
              {SOURCE_KEYS.map((key, i) => (
                <li key={key} id={`source-${key}`} className="flex gap-2 text-chalk-300">
                  <span className="shrink-0 tabular-nums text-chalk-500">[{i + 1}]</span>
                  <a
                    href={SOURCES[key].url}
                    rel="noopener noreferrer"
                    className="break-words text-gold-400 underline-offset-2 hover:text-gold-500 hover:underline"
                  >
                    {SOURCES[key].site} · {SOURCES[key].page}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <p className="mt-14 border-t border-night-800 pt-6 text-sm leading-relaxed text-chalk-500">{t("pages.draft.rating")}</p>
      </div>
    </>
  );
}

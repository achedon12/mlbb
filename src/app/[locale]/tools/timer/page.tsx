import type { Metadata } from "next";
import Link from "@/components/lien";
import { ObjectiveTimer } from "@/components/objective-timer";
import { EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { donneesLd } from "@/lib/html";
import { ALERT_THRESHOLDS, BUFFS, CAMPS, CHECKED_ON, GUIDE_EVENTS, LORD, SOURCES, TURTLE, formatTime } from "@/lib/objectives";
import { formaterDate } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/tools/timer";

/** Alert thresholds quoted by the texts, so they never drift from the timer itself. */
const THRESHOLDS = { soon: ALERT_THRESHOLDS[0], urgent: ALERT_THRESHOLDS[1] };
const SEO_VALUES = { turtle: formatTime(TURTLE.firstSpawn), ...THRESHOLDS };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.timer.title"),
    description: t("pages.seo.timer.description", SEO_VALUES),
    chemin: PATH,
    motsCles: ["MLBB timer", "Lord spawn time", "Turtle spawn time", "buff respawn", "jungle timer", "Mobile Legends", "MLBB"],
  });
}

const sectionTitle = "font-heading text-2xl font-bold text-chalk-100";

/** Link text of a source: the wiki page's own title, read from its address. */
const wikiPageName =(url: string) => decodeURIComponent(url.split("/wiki/")[1] ?? url).replaceAll("_", " ");

export default async function TimerPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const structuredData = donneesOutil(locale, {
    nom: t("pages.timer.title"),
    description: t("pages.seo.timer.description", SEO_VALUES),
    chemin: PATH,
    categorie: "GameApplication",
  });

  const timings = [
    {
      title: t("pages.timer.turtleTitle"),
      texts: [
        t("pages.timer.turtleText", {
          first: formatTime(TURTLE.firstSpawn),
          respawn: TURTLE.respawn,
          cutoff: formatTime(TURTLE.cutoff),
          after: LORD.afterTurtle / 60,
          lordFrom: formatTime(TURTLE.lordFrom),
          idle: TURTLE.lordIdle,
          latest: formatTime(TURTLE.lordAtLatest),
          max: TURTLE.max,
        }),
        t("pages.timer.turtleReward", {
          gold1: TURTLE.goldPerHero[0],
          gold2: TURTLE.goldPerHero[1],
          gold3: TURTLE.goldPerHero[2],
          shield: TURTLE.shield,
        }),
      ],
    },
    {
      title: t("pages.timer.lordTitle"),
      texts: [
        t("pages.timer.lordText", {
          after: LORD.afterTurtle / 60,
          lordFrom: formatTime(TURTLE.lordFrom),
          lateFrom: formatTime(LORD.lateFrom),
          respawn: LORD.respawn,
          late: LORD.lateRespawn,
          infobox: formatTime(LORD.lateRespawnInfobox),
        }),
      ],
    },
    {
      title: t("pages.timer.buffsTitle"),
      texts: [
        t("pages.timer.buffsText", {
          orange: formatTime(BUFFS["orange-buff"].firstSpawn),
          purple: formatTime(BUFFS["purple-buff"].firstSpawn),
          respawn: BUFFS["purple-buff"].respawn,
          duration: BUFFS["purple-buff"].duration,
        }),
      ],
    },
    {
      title: t("pages.timer.campsTitle"),
      texts: [
        t("pages.timer.campsText", {
          litho: formatTime(CAMPS.lithowanderer.firstSpawn),
          lithoRespawn: CAMPS.lithowanderer.respawn,
          cyclone: formatTime(CAMPS.cyclone.firstSpawn),
          cycloneRecharge: CAMPS.cyclone.respawn,
          littleCrab: formatTime(CAMPS["little-crab"].firstSpawn),
          littleCrabRespawn: CAMPS["little-crab"].respawn,
          crab: formatTime(CAMPS.crab.firstSpawn),
          crabGuide: formatTime(GUIDE_EVENTS.crabUpgrade),
          crabRespawn: CAMPS.crab.respawn,
        }),
      ],
    },
  ];

  const sources = [
    SOURCES.turtle,
    SOURCES.lord,
    SOURCES.purpleBuff,
    SOURCES.orangeBuff,
    SOURCES.crab,
    SOURCES.lithowanderer,
    SOURCES.cyclone,
    SOURCES.guide,
  ];

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.timerUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage titre={t("pages.timer.title")} chapeau={t("pages.timer.lead", THRESHOLDS)} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <ObjectiveTimer />

        <section aria-labelledby="timings-title">
          <h2 id="timings-title" className={sectionTitle}>
            {t("pages.timer.timingsTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {timings.map((r) => (
              <div key={r.title} className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
                <dt className="font-heading font-bold text-gold-400">{r.title}</dt>
                {r.texts.map((text) => (
                  <dd key={text} className="mt-1.5 text-sm leading-relaxed text-chalk-300">
                    {text}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="usage-title">
          <h2 id="usage-title" className={sectionTitle}>
            {t("pages.timer.usageTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.timer.usage1", { start: t("pages.timerUI.start"), apply: t("pages.timerUI.apply") })}</p>
            <p>{t("pages.timer.usage2")}</p>
            <p>{t("pages.timer.usage3", THRESHOLDS)}</p>
            <p>{t("pages.timer.usage4")}</p>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/map" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
                {t("pages.timer.mapLink")} →
              </Link>
            </li>
            <li>
              <Link href="/tools/retribution" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
                {t("pages.timer.retributionLink")} →
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="sources-title" className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          <h2 id="sources-title" className="font-semibold text-chalk-300">
            {t("pages.timer.sourcesTitle")}
          </h2>
          <p className="mt-2">{t("pages.timer.sourcesIntro", { date: formaterDate(CHECKED_ON, LOCALE_HTML[locale]) })}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {sources.map((url) => (
              <li key={url}>
                <a href={url} rel="noopener" className="underline transition-colors hover:text-gold-400">
                  {wikiPageName(url)}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">{t("pages.timer.sourcesNote", { lateFrom: formatTime(LORD.lateFrom) })}</p>
        </section>
      </div>
    </CompleterMessages>
  );
}

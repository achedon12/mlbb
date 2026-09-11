import type { Metadata } from "next";
import { BuildSimulatorWithPublishing } from "@/components/build-simulator-publishing";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import { SOURCE_EMBLEMS } from "@/data/emblem-attributes";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { simulatorData } from "@/lib/build-catalog";
import { SOURCES } from "@/lib/build-simulator";
import { dateLongue } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/tools/build";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.buildSimulator.title"),
    description: t("pages.seo.buildSimulator.description"),
    chemin: PATH,
    motsCles: ["build", "simulator", "calculator", "items", "emblems", "stats", "Mobile Legends", "MLBB"],
  });
}

const sectionTitle = "font-heading text-2xl font-bold text-chalk-100";

/** "https://.../wiki/Cooldown_reduction" to "Cooldown reduction": the wiki page's own title. */
const wikiPage = (url: string) => decodeURIComponent(url.split("/wiki/")[1] ?? url).replace(/_/g, " ");

export default async function BuildSimulatorPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const data = simulatorData(locale, t);
  const structuredData = donneesOutil(locale, {
    nom: t("pages.buildSimulator.title"),
    description: t("pages.seo.buildSimulator.description"),
    chemin: PATH,
    categorie: "GameApplication",
  });
  const sources = [...Object.values(SOURCES), SOURCE_EMBLEMS];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage titre={t("pages.buildSimulator.title")} chapeau={t("pages.buildSimulator.lead")} />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <CompleterMessages messages={messagesPage(locale, ["pages.buildSimulatorUI", "pages.communityBuildsUI"])}>
          <BuildSimulatorWithPublishing data={data} pageUrl={`${site.url}/${locale}${PATH}`} measuredDate={dateLongue(locale)} />
        </CompleterMessages>

        <section aria-labelledby="method-title" className="max-w-3xl">
          <h2 id="method-title" className={sectionTitle}>
            {t("pages.buildSimulator.methodTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.buildSimulator.method1")}</p>
            <p>{t("pages.buildSimulator.method2")}</p>
            <p>{t("pages.buildSimulator.method3")}</p>
            <p>{t("pages.buildSimulator.method4")}</p>
            <p>{t("pages.buildSimulator.method5")}</p>
          </div>
        </section>

        <section aria-labelledby="community-title" className="max-w-3xl">
          <h2 id="community-title" className={sectionTitle}>
            {t("pages.buildSimulator.communityTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.buildSimulator.communityText")}</p>
          <Link href="/builds" className="mt-3 inline-flex min-h-11 items-center text-gold-400 underline underline-offset-4 hover:text-gold-500">
            {t("pages.buildSimulator.communityLink")}
          </Link>
        </section>

        <section aria-labelledby="sources-title" className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          <h2 id="sources-title" className="font-semibold text-chalk-300">
            {t("pages.buildSimulator.sourcesTitle")}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {sources.map((url) => (
              <li key={url}>
                <a href={url} rel="noopener" className="underline transition-colors hover:text-gold-400">
                  {t("pages.buildSimulator.sourceWiki", { page: wikiPage(url) })}
                </a>
              </li>
            ))}
            <li>{t("pages.buildSimulator.sourceItems")}</li>
            <li>{t("pages.buildSimulator.sourceMeasured")}</li>
          </ul>
        </section>
      </div>
    </>
  );
}

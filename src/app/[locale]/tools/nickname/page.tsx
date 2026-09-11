import type { Metadata } from "next";
import Link from "@/components/lien";
import { NicknameGenerator } from "@/components/nickname-generator";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { donneesLd } from "@/lib/html";
import { GUIDE_LENGTH, SHOP_SOURCE, STYLES } from "@/lib/nicknames";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/tools/nickname";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.nickname.title"),
    description: t("pages.seo.nickname.description", { n: STYLES.length }),
    chemin: PATH,
    motsCles: [
      "mlbb stylish name",
      "ML stylish name",
      "nama ML keren",
      "pseudo stylé mlbb",
      "nickname generator",
      "Mobile Legends name symbols",
      "MLBB",
    ],
  });
}

const sectionTitle = "font-titre text-2xl font-bold text-craie-100";
const sourceLink = "underline transition-colors hover:text-or-400";

export default async function NicknamePage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const structuredData = donneesOutil(locale, {
    nom: t("pages.nickname.title"),
    description: t("pages.seo.nickname.description", { n: STYLES.length }),
    chemin: PATH,
    categorie: "UtilitiesApplication",
  });
  const questions = ["1", "2", "3"] as const;

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.nicknameUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage titre={t("pages.nickname.title")} chapeau={t("pages.nickname.lead", { n: STYLES.length })} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <NicknameGenerator />

        <section aria-labelledby="how-title">
          <h2 id="how-title" className={sectionTitle}>
            {t("pages.nickname.howTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-craie-300">
            <p>{t("pages.nickname.how1")}</p>
            <p>{t("pages.nickname.how2")}</p>
          </div>
        </section>

        <section aria-labelledby="rules-title">
          <h2 id="rules-title" className={sectionTitle}>
            {t("pages.nickname.rulesTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-craie-300">
            <p>{t("pages.nickname.rule1")}</p>
            <p>{t("pages.nickname.rule2", { min: GUIDE_LENGTH.min, max: GUIDE_LENGTH.max })}</p>
            <p>{t("pages.nickname.rule3")}</p>
            <p>{t("pages.nickname.rule4")}</p>
          </div>
        </section>

        <section aria-labelledby="faq-title">
          <h2 id="faq-title" className={sectionTitle}>
            {t("pages.nickname.faqTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <dl className="mt-4 space-y-5">
            {questions.map((q) => (
              <div key={q}>
                <dt className="font-semibold text-craie-100">{t(`pages.nickname.q${q}`)}</dt>
                <dd className="mt-1 leading-relaxed text-craie-300">{t(`pages.nickname.a${q}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="leading-relaxed text-craie-300">
          {t("pages.nickname.drawLink")}{" "}
          <Link href="/tools/draw-calculator" className="font-semibold text-or-400 hover:text-or-500">
            {t("pages.nickname.drawLinkAction")} →
          </Link>
        </p>

        <section aria-labelledby="sources-title" className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          <h2 id="sources-title" className="font-semibold text-craie-300">
            {t("pages.nickname.sourcesTitle")}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SHOP_SOURCE} rel="noopener" className={sourceLink}>
                {t("pages.nickname.sourceShop")}
              </a>
            </li>
            <li>
              <a href={GUIDE_LENGTH.source} rel="noopener" className={sourceLink}>
                {t("pages.nickname.sourceGuide")}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </CompleterMessages>
  );
}

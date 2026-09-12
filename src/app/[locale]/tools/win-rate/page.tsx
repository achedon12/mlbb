import type { Metadata } from "next";
import { CalculateurTaux } from "@/components/calculateur-taux";
import { EnTetePage } from "@/components/ui";
import { donneesLd } from "@/lib/html";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { donneesOutil, metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.winRate.title"),
    description: t("pages.seo.winRate.description"),
    chemin: "/tools/win-rate",
    motsCles: ["win rate", "winrate", "calculator", "Mobile Legends", "MLBB"],
  });
}

export default async function PageTauxVictoire({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.winRate.title"),
    description: t("pages.seo.winRate.description"),
    chemin: "/tools/win-rate",
    categorie: "UtilitiesApplication",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage titre={t("pages.winRate.title")} chapeau={t("pages.winRate.lead")} />
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-12">
        <CalculateurTaux />

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.winRate.methodTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-4 leading-relaxed text-chalk-300">
            <p>{t("pages.winRate.method1")}</p>
            <p>{t("pages.winRate.method2")}</p>
          </div>
        </section>
      </div>
    </>
  );
}

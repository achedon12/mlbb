import type { Metadata } from "next";
import { CalculateurCollection } from "@/components/calculateur-collection";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { catalogueSkins } from "@/lib/catalogue-skins-serveur";
import { couverturePrix } from "@/lib/collection";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue }> };

const CHEMIN = "/tools/collection";

function description(locale: Langue): string {
  const t = creerT(locale);
  const c = couverturePrix(catalogueSkins());
  return t("pages.seo.collection.description", { heros: c.heros, skins: c.skins });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.collection.title"),
    description: description(locale),
    chemin: CHEMIN,
    motsCles: ["MLBB collection value", "skin value", "diamonds", "Mobile Legends skins", "calculator"],
  });
}

export default async function PageCollection({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const nombre = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const c = couverturePrix(catalogueSkins());
  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.collection.title"),
    description: description(locale),
    chemin: CHEMIN,
    categorie: "UtilitiesApplication",
  });

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.collectionUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage titre={t("pages.collection.title")} chapeau={t("pages.collection.lead")}>
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        <p role="note" className="bevel-sm max-w-3xl border border-gold-500/30 bg-gold-500/5 p-4 text-sm leading-relaxed text-chalk-200">
          {t("pages.collection.warning")}
        </p>

        <CalculateurCollection />

        <section className="max-w-3xl">
          <TitreSection>{t("pages.collection.methodTitle")}</TitreSection>
          <div className="space-y-4 leading-relaxed text-chalk-300">
            <p>
              {t("pages.collection.methodHeroes", {
                heros: nombre.format(c.heros),
                diamants: nombre.format(c.herosDiamants),
              })}
            </p>
            <p>
              {t("pages.collection.methodSkins", {
                skins: nombre.format(c.skins),
                diamants: nombre.format(c.skinsDiamants),
                autres: nombre.format(c.skinsAutreMonnaie),
                sansPrix: nombre.format(c.skins - c.skinsDiamants - c.skinsAutreMonnaie),
              })}
            </p>
            <p>{t("pages.collection.methodStorage")}</p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/skins/calendar" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.collection.calendarLink")} →
              </Link>
              <Link href="/skins" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.collection.skinsLink")} →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </CompleterMessages>
  );
}

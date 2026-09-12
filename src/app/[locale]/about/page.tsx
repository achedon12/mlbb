import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.about.title"),
    description: t("pages.about.metaDescription"),
    chemin: "/about",
  });
}

export default async function PageAPropos({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage titre={t("pages.about.title")} chapeau={t("pages.about.lead")} />
      <Prose langue={locale} cle="about" variables={{ depot: site.depot }} />
    </>
  );
}

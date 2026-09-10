import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.about.titre"),
    description: t("pages.about.metaDescription"),
    alternates: metaLangues(locale, "/about"),
  };
}

export default async function PageAPropos({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage titre={t("pages.about.titre")} chapeau={t("pages.about.chapeau")} />
      <Prose langue={locale} cle="about" variables={{ depot: site.depot }} />
    </>
  );
}

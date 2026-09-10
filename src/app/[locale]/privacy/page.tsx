import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { legal } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.privacy.titre"),
    description: t("pages.privacy.metaDescription"),
    alternates: metaLangues(locale, "/privacy"),
  };
}

export default async function PageConfidentialite({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage titre={t("pages.privacy.titre")} chapeau={t("pages.privacy.chapeau")} />
      <Prose langue={locale} cle="privacy" variables={{ contact: legal.contact }} />
    </>
  );
}

import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { legal, site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.legal.titre"),
    description: t("pages.legal.metaDescription"),
    alternates: metaLangues(locale, "/legal"),
  };
}

export default async function PageMentionsLegales({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage titre={t("pages.legal.titre")} chapeau={t("pages.legal.chapeau")} />
      <Prose
        langue={locale}
        cle="legal"
        variables={{
          editeur: legal.editeur,
          editeurSite: legal.editeurSite,
          contact: legal.contact,
          hebergeur: legal.hebergeur,
          hebergeurSite: legal.hebergeurSite,
          depot: site.depot,
        }}
      />
    </>
  );
}

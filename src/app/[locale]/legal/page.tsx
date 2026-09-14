import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { legal, site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.legal.title"),
    description: t("pages.legal.metaDescription"),
    path: "/legal",
  });
}

export default async function LegalPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <>
      <PageHeader title={t("pages.legal.title")} lead={t("pages.legal.lead")} />
      <Prose
        locale={locale}
        messageKey="legal"
        variables={{
          // Keys are the {placeholders} of the catalogue text.
          editeur: legal.publisher,
          editeurSite: legal.publisherSite,
          contact: legal.contact,
          hebergeur: legal.host,
          hebergeurSite: legal.hostSite,
          depot: site.depot,
        }}
      />
    </>
  );
}

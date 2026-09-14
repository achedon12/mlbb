import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.about.title"),
    description: t("pages.about.metaDescription"),
    path: "/about",
  });
}

export default async function AboutPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <>
      <PageHeader title={t("pages.about.title")} lead={t("pages.about.lead")} />
      <Prose locale={locale} messageKey="about" variables={{ depot: site.depot }} />
    </>
  );
}

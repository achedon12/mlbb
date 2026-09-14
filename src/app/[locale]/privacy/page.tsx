import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { legal } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.privacy.title"),
    description: t("pages.privacy.metaDescription"),
    path: "/privacy",
  });
}

export default async function PrivacyPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <>
      <PageHeader title={t("pages.privacy.title")} lead={t("pages.privacy.lead")} />
      <Prose locale={locale} messageKey="privacy" variables={{ contact: legal.contact }} />
      {/*
        Notifications de patch : seule donnee conservee par le serveur, et
        seulement a la demande. Toujours decrites : la page est generee au
        build, qui ne sait pas si les cles VAPID seront posees.
      */}
      <section aria-labelledby="notifications-push" className="prose-mlbb mx-auto -mt-14 max-w-3xl px-4 pb-14">
        <h2 id="notifications-push">{t("prose.push.title")}</h2>
        <p>{t("prose.push.intro")}</p>
        <ul>
          <li>{t("prose.push.endpoint")}</li>
          <li>{t("prose.push.language")}</li>
          <li>{t("prose.push.favourites")}</li>
        </ul>
        <p>{t("prose.push.usage")}</p>
        <p>{t("prose.push.unsubscribe")}</p>
      </section>
    </>
  );
}

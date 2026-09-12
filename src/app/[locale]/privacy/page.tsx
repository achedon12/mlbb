import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { legal } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.privacy.title"),
    description: t("pages.privacy.metaDescription"),
    chemin: "/privacy",
  });
}

export default async function PageConfidentialite({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage titre={t("pages.privacy.title")} chapeau={t("pages.privacy.lead")} />
      <Prose langue={locale} cle="privacy" variables={{ contact: legal.contact }} />
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

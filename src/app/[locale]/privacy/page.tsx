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
    titre: t("pages.privacy.titre"),
    description: t("pages.privacy.metaDescription"),
    chemin: "/privacy",
  });
}

export default async function PageConfidentialite({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage titre={t("pages.privacy.titre")} chapeau={t("pages.privacy.chapeau")} />
      <Prose langue={locale} cle="privacy" variables={{ contact: legal.contact }} />
      {/*
        Notifications de patch : seule donnee conservee par le serveur, et
        seulement a la demande. Toujours decrites : la page est generee au
        build, qui ne sait pas si les cles VAPID seront posees.
      */}
      <section aria-labelledby="notifications-push" className="prose-mlbb mx-auto -mt-14 max-w-3xl px-4 pb-14">
        <h2 id="notifications-push">{t("proses.push.titre")}</h2>
        <p>{t("proses.push.intro")}</p>
        <ul>
          <li>{t("proses.push.endpoint")}</li>
          <li>{t("proses.push.langue")}</li>
          <li>{t("proses.push.favoris")}</li>
        </ul>
        <p>{t("proses.push.usage")}</p>
        <p>{t("proses.push.desabonner")}</p>
      </section>
    </>
  );
}

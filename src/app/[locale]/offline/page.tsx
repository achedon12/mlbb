import type { Metadata } from "next";
import { metaLangues } from "@/i18n/seo";
import Link from "@/components/lien";
import { WifiOff } from "lucide-react";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";

/**
 * Page « hors ligne ».
 *
 * Le service worker la garde en cache des son installation et la sert a la
 * place d'une page jamais consultee quand le reseau manque. Elle n'a rien a
 * faire dans un moteur de recherche.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return { title: t("pages.offline.titre"), alternates: metaLangues(locale, "/offline"), robots: { index: false, follow: false } };
}

export default async function PageHorsLigne({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <WifiOff size={40} aria-hidden className="mx-auto text-or-400" />
      <h1 className="mt-6 font-titre text-3xl font-bold text-craie-100">{t("pages.offline.titre")}</h1>
      <div aria-hidden className="filet-or mx-auto mt-3 h-0.5 w-16" />
      <p className="mt-5 leading-relaxed text-craie-300">{t("pages.offline.texte")}</p>
      <Link
        href={`/${locale}`}
        className="biseau-sm mt-8 inline-block bg-or-500 px-5 py-2.5 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
      >
        {t("pages.offline.accueil")}
      </Link>
    </div>
  );
}

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
  return { title: t("pages.offline.title"), alternates: metaLangues(locale, "/offline"), robots: { index: false, follow: false } };
}

export default async function PageHorsLigne({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <WifiOff size={40} aria-hidden className="mx-auto text-gold-400" />
      <h1 className="mt-6 font-heading text-3xl font-bold text-chalk-100">{t("pages.offline.title")}</h1>
      <div aria-hidden className="gold-rule mx-auto mt-3 h-0.5 w-16" />
      <p className="mt-5 leading-relaxed text-chalk-300">{t("pages.offline.text")}</p>
      <Link
        href={`/${locale}`}
        className="bevel-sm mt-8 inline-block bg-gold-500 px-5 py-2.5 font-semibold text-night-950 transition-colors hover:bg-gold-400"
      >
        {t("pages.offline.home")}
      </Link>
    </div>
  );
}

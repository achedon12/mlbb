import type { Metadata } from "next";
import { metaLocales } from "@/i18n/seo";
import Link from "@/components/link";
import { WifiOff } from "lucide-react";
import { DexScreen } from "@/components/dex-screen";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * "Offline" page.
 *
 * The service worker caches it as soon as it installs and serves it in
 * place of a never-visited page when the network is missing. It has no
 * business in a search engine. Without the network, Dex may not load:
 * the page reads the same without it.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return { title: t("pages.offline.title"), alternates: metaLocales(locale, "/offline"), robots: { index: false, follow: false } };
}

export default async function OfflinePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  return (
    <DexScreen
      figure="Off"
      pose="dodo"
      title={t("pages.offline.title")}
      text={t("pages.offline.text")}
      line={t("pages.offline.dexLine")}
      actions={
        <Link href={`/${locale}`} className="btn btn-primary">
          <WifiOff size={17} aria-hidden />
          {t("pages.offline.home")}
        </Link>
      }
    />
  );
}

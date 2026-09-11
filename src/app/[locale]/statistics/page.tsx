import type { Metadata } from "next";
import { CompleterMessages } from "@/i18n/fournisseur";
import type { Langue } from "@/i18n/config";
import { messagesPage } from "@/i18n/traductions";
import { metaStatistiques, Statistiques } from "./contenu";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaStatistiques(locale, "all");
}

export default async function PageStatistiques({ params }: Params) {
  const { locale } = await params;
  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.heroesListe", "pages.statisticsTable"])}>
      <Statistiques locale={locale} rang="all" />
    </CompleterMessages>
  );
}

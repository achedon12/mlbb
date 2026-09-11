import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompleterMessages } from "@/i18n/fournisseur";
import type { Langue } from "@/i18n/config";
import { messagesPage } from "@/i18n/traductions";
import type { RangMesure } from "@/lib/rangs-mesure";
import { RANGS_CLASSES } from "@/lib/tier-list";
import { metaStatistiques, Statistiques } from "../contenu";

type Params = { params: Promise<{ locale: Langue; rang: string }> };

/** Une page par rang mesure ; « tous rangs » reste l'adresse principale. */
const RANGS = RANGS_CLASSES.filter((r) => r !== "all");
const estRang = (r: string): r is RangMesure => (RANGS as string[]).includes(r);

export const dynamicParams = false;

export function generateStaticParams() {
  return RANGS.map((rang) => ({ rang }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, rang } = await params;
  return estRang(rang) ? metaStatistiques(locale, rang) : {};
}

export default async function PageStatistiquesRang({ params }: Params) {
  const { locale, rang } = await params;
  if (!estRang(rang)) notFound();
  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.heroesListe", "pages.statisticsTable"])}>
      <Statistiques locale={locale} rang={rang} />
    </CompleterMessages>
  );
}

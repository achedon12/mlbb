import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { Items, metaItems } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaItems(locale);
}

export default async function ItemsPage({ params }: Params) {
  const { locale } = await params;
  return <Items locale={locale} />;
}

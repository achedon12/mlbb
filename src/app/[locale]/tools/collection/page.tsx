import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { Collection, metaCollection } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaCollection(locale);
}

export default async function CollectionPage({ params }: Params) {
  const { locale } = await params;
  return <Collection locale={locale} />;
}

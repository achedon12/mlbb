import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { Events, metaEvents } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaEvents(locale);
}

export default async function EventsPage({ params }: Params) {
  const { locale } = await params;
  return <Events locale={locale} />;
}

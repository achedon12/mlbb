import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { metaCalendar, SkinsCalendar } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaCalendar(locale);
}

export default async function SkinsCalendarPage({ params }: Params) {
  const { locale } = await params;
  return <SkinsCalendar locale={locale} />;
}

import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { metaTierList, TierList } from "./content";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return metaTierList(locale, "all");
}

export default async function TierListPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <TierList locale={locale} rank="all" />;
}

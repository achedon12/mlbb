import type { Metadata } from "next";
import type { Langue } from "@/i18n/config";
import { metaTierList, TierList } from "./contenu";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  return metaTierList(locale, "all");
}

export default async function PageTierList({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  return <TierList locale={locale} rang="all" />;
}

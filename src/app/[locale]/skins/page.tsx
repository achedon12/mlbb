import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { metaSkins, Skins } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaSkins(locale);
}

export default async function SkinsPage({ params }: Params) {
  const { locale } = await params;
  return <Skins locale={locale} />;
}

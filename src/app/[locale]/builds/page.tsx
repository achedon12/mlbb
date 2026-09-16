import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { CommunityBuilds, metaBuilds } from "./content";

/**
 * Community builds hub. Rendered on each request — votes move all the time —
 * but from its path alone: the pages of the hero list are `/builds/page/n`.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaBuilds(locale);
}

export default async function CommunityBuildsPage({ params }: Params) {
  const { locale } = await params;
  return <CommunityBuilds locale={locale} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { readPage } from "@/lib/pager";
import { CommunityBuilds, metaBuilds } from "../../content";

/**
 * A page of the heroes that have builds. The section grows with its
 * contributions, so the page count is not known ahead of time: the number is
 * only checked for shape here, and a page past the end shows the last one.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Locale; page: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, Number.MAX_SAFE_INTEGER);
  return n ? metaBuilds(locale, n) : {};
}

export default async function CommunityBuildsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, Number.MAX_SAFE_INTEGER);
  if (!n) notFound();
  return <CommunityBuilds locale={locale} page={n} />;
}

import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Answered on each request: a redirect, never a page to prerender. */
export const dynamic = "force-dynamic";

/**
 * The former progress page: the progress is now a section of the account
 * page. The route stays so that old links and bookmarks land there.
 */
export default async function ProgressPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/account#progress`);
}

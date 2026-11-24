import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n/config";

/** Answered on each request: a redirect, never a page to prerender. */
export const dynamic = "force-dynamic";

/**
 * The former progress page: the progress is now a section of the account
 * page. The route stays so that old links and bookmarks land there. Only a
 * known language goes into the address, so a crafted segment can never make
 * it `//another-host`.
 */
export default async function ProgressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  permanentRedirect(`/${locale}/account#progress`);
}

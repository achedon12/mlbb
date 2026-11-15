import type { Metadata } from "next";
import { NotFoundPage } from "@/components/not-found-page";
import { notFoundMetadata } from "@/i18n/seo";

type Params = { params: Promise<{ locale: string }> };

/**
 * Unknown address under a language: the site's 404 page, in its language and
 * with its navigation (see `NotFoundPage` for why it is rendered rather than
 * a bare `notFound()`).
 *
 * The route is static with no prebuilt params (`generateStaticParams`), so
 * each address is rendered on demand as a prerender, the render that turns
 * the 404 signal into the response's status.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return notFoundMetadata((await params).locale);
}

export function generateStaticParams() {
  return [];
}

export default function UnknownAddress() {
  return <NotFoundPage />;
}

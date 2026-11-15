import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotFoundView } from "@/components/not-found-view";
import { isLocale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

type Params = { params: Promise<{ locale: string }> };

/**
 * Unknown address under a language: the site's 404 page, in its language and
 * with its navigation.
 *
 * A bare `notFound()` here gave a 404 whose server HTML was Next's empty error
 * shell (`<html id="__next_error__">`): the error escapes every boundary
 * during server rendering, so the page only appeared once the client started,
 * and crawlers saw an empty body with the home page's canonical. The page
 * therefore renders the 404 view itself, then calls `notFound()` inside a
 * Suspense boundary. Two details make that work:
 *
 * - the route is static with no prebuilt params (`generateStaticParams`), so
 *   each address is rendered on demand as a prerender, the render that turns
 *   an access error inside a Suspense boundary into the response's 404 status
 *   (a dynamic render would answer 200 once the shell is out);
 * - `NotFoundSignal` throws synchronously, before the shell is complete.
 *
 * On the client, `[locale]/not-found.tsx` then takes over with the same
 * markup, so nothing moves. A 404 is never written to the disk cache
 * (`cache-handler.mjs`).
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: createT(locale)("pages.notFound.title"),
    robots: { index: false, follow: true },
    // Not the language root's canonical and alternates, inherited from the
    // layout: this address is not the home page.
    alternates: { canonical: null, languages: {} },
  };
}

export function generateStaticParams() {
  return [];
}

function NotFoundSignal(): never {
  notFound();
}

export default function UnknownAddress() {
  return (
    <>
      <NotFoundView />
      <Suspense fallback={null}>
        <NotFoundSignal />
      </Suspense>
    </>
  );
}

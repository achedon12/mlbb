import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotFoundView } from "@/components/not-found-view";

/**
 * The site's 404 page, for a page that finds nothing to show (unknown hero,
 * patch, player…): `if (!hero) return <NotFoundPage />;` in place of a bare
 * `notFound()`.
 *
 * A bare `notFound()` gives a 404 whose server HTML is Next's empty error
 * shell (`<html id="__next_error__">`): on the server, the error escapes every
 * boundary React knows (`[locale]/not-found.tsx` only catches it in the
 * browser), so the page only appeared once the client started, and crawlers
 * saw an empty body. This component renders the 404 view itself, inside the
 * layout (header, footer, language), then calls `notFound()` inside a
 * Suspense boundary of its own. Two details make that work:
 *
 * - the page is a prerender (built, or rendered on demand like any address
 *   missing from `generateStaticParams`): that render turns an access error
 *   inside a Suspense boundary into the response's 404 status. A dynamic page
 *   (cookies, `force-dynamic`) would answer 200 once the shell is out: those
 *   keep a bare `notFound()`, whose 404 status matters more than the body
 *   (`tests/unit/not-found-pages.test.ts` holds the list);
 * - `NotFoundSignal` throws synchronously, before the shell is complete.
 *
 * In the browser, `[locale]/not-found.tsx` then takes over with the same
 * markup, so nothing moves. The page's `generateMetadata` returns
 * `notFoundMetadata` for the same case (title, `noindex, follow`, no
 * canonical). A 404 is never written to the disk cache (`cache-handler.mjs`).
 */
export function NotFoundPage() {
  return (
    <>
      <NotFoundView />
      <Suspense fallback={null}>
        <NotFoundSignal />
      </Suspense>
    </>
  );
}

function NotFoundSignal(): never {
  notFound();
}

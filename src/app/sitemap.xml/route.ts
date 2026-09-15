import { renderSitemapIndex } from "@/lib/sitemap";

/**
 * Sitemap index: the address submitted to Search Console and named in
 * robots.txt. It lists one child sitemap per page type (`src/lib/sitemap.ts`).
 *
 * Prerendered at build time, with the headers Next gives a `sitemap.ts` route.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(renderSitemapIndex(), {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}

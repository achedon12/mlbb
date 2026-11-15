import type { Locale } from "@/i18n/config";

/**
 * What the build generates, and what waits for its first visitor.
 *
 * Prerendering every page in nine languages produced some 6,500 HTML pages
 * and 32,000 RSC files: 7 GB of `.next/server/app`, most of the 10 GB
 * production image, for pages many of which are never requested between two
 * deployments (a Thai page for a pro player, the eighth page of the 2019 skin
 * calendar). The build now generates the pages that carry the traffic, in
 * the two languages that carry most of it; every other page is rendered on
 * its first request, then kept by the cache (`cache-handler.mjs`) until the
 * next deployment, exactly as if it had been built. The sitemaps and the
 * `hreflang` alternates still list every page in every language.
 *
 * The routes that prerender only some of their pages, or none, say so next
 * to their `generateStaticParams`; all keep `dynamicParams` at its default
 * (true) and answer an unknown address with `notFound()`.
 */
export const PRERENDERED_LOCALES: readonly Locale[] = ["en", "fr"];

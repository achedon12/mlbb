import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/site";

/**
 * Public API responses.
 *
 * The site's data is extracted from a wiki under the CC BY-SA license:
 * republishing it requires crediting the source, which every response does
 * through its headers rather than relying on the consumer's goodwill.
 *
 * Caching is generous: this data only changes at the weekly sync, and
 * nothing justifies recomputing an identical response.
 */
export function responseApi(data: unknown, options: { total?: number } = {}) {
  return NextResponse.json(
    {
      data,
      ...(options.total !== undefined ? { total: options.total } : {}),
      source: {
        name: "Mobile Legends Wiki",
        url: "https://mobilelegends.fandom.com",
        license: "CC BY-SA",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        // The API is meant to be consumed from third-party browsers.
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        // An HTTP header only accepts Latin-1: no em dash here.
        "X-Data-License": "CC BY-SA / Mobile Legends Wiki",
      },
    },
  );
}

export function notFound(what: string) {
  return NextResponse.json(
    { error: `${what} not found` },
    { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

/** Language asked with `?locale=`; English when absent or unknown, as the API always answered. */
export function localeParam(settings: URLSearchParams): Locale {
  const requested = settings.get("locale") ?? DEFAULT_LOCALE;
  return isLocale(requested) ? requested : DEFAULT_LOCALE;
}

/**
 * Absolute address of a site visual: a third party (a Discord embed first)
 * cannot resolve "/visuels/...", and refuses anything but an https URL.
 */
export function absoluteImage(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : absoluteUrl(path);
}

import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { trackApiCall } from "@/lib/api-tracking";
import { clientAddress } from "@/lib/client-address";

/**
 * Two roles:
 *
 * 1. **Language** — the site lives under a language prefix (`/fr`, `/en`…). An
 *    address without a prefix is redirected to the visitor's language, chosen
 *    from their cookie, otherwise from the `Accept-Language` header, otherwise the
 *    default language. Internal links therefore do not need to carry the language:
 *    the redirect restores it, and the cookie keeps it.
 *
 * 2. **API rate limiting** — a fixed window per IP address smooths out
 *    abuse, without external state.
 *
 * 3. **API measurement** — every call to the public API is reported to
 *    Matomo (`lib/api-tracking.ts`). Here rather than in the route handlers:
 *    the static routes are served from the cache without their handler
 *    running, while the proxy sees every request.
 */

// ── Rate limiting ──────────────────────────────────────────────────
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 90;
const buckets = new Map<string, { count: number; reset: number }>();

function address(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Never awaited: `waitUntil` lets the hit finish after the response has left. */
function countApiCall(request: NextRequest, event: NextFetchEvent, status?: number) {
  const ip = clientAddress(request.headers);
  event.waitUntil(
    trackApiCall({ url: request.nextUrl, method: request.method, headers: request.headers, ip, status }),
  );
}

function rateLimitApi(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
  const ip = address(request);
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now > bucket.reset) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
  } else {
    bucket.count += 1;
    if (bucket.count > MAX_PER_WINDOW) {
      // Only the first refusal of a window is counted: a client hammering
      // the API would otherwise turn the rate limit into a flood of hits.
      if (bucket.count === MAX_PER_WINDOW + 1) countApiCall(request, event, 429);
      const retryAfter = Math.max(1, Math.ceil((bucket.reset - now) / 1000));
      return NextResponse.json(
        { error: "Too many requests. Try again in a moment." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }
  if (buckets.size > 10_000) {
    for (const [key, value] of buckets) if (now > value.reset) buckets.delete(key);
  }
  countApiCall(request, event);
  return NextResponse.next();
}

// ── Language ───────────────────────────────────────────────────────
function preferredLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get("langue")?.value;
  if (cookie && isLocale(cookie)) return cookie;

  const header = request.headers.get("accept-language");
  if (header) {
    for (const match of header.split(",")) {
      const code = match.split(";")[0]!.trim().slice(0, 2).toLowerCase();
      if (isLocale(code)) return code;
    }
  }
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) return rateLimitApi(request, event);

  // Path already prefixed with a language: let it through, cookie up to date.
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const response = NextResponse.next();
    if (request.cookies.get("langue")?.value !== first) {
      response.cookies.set("langue", first, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    }
    return response;
  }

  // Otherwise redirect to the visitor's language, keeping the path.
  const locale = preferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url);
  response.cookies.set("langue", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return response;
}

export const config = {
  // Everything except Next's internal files, static assets and the
  // root files served as is (sitemap, robots, feeds, images…).
  matcher: [
    "/((?!_next/|.*\\..*|feed\\.xml|sitemap\\.xml|robots\\.txt|opengraph-image|manifest\\.webmanifest|icon).*)",
    "/api/:path*",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

/**
 * Deux roles :
 *
 * 1. **Langue** — le site vit sous un prefixe de langue (`/fr`, `/en`…). Une
 *    adresse sans prefixe est redirigee vers la langue du visiteur, choisie
 *    d'apres son cookie, sinon d'apres l'en-tete `Accept-Language`, sinon la
 *    langue par defaut. Les liens internes n'ont donc pas a porter la langue :
 *    la redirection la retablit, et le cookie la conserve.
 *
 * 2. **Limitation de debit de l'API** — une fenetre fixe par adresse IP lisse
 *    les abus, sans etat externe.
 */

// ── Limitation de debit ────────────────────────────────────────────
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 90;
const buckets = new Map<string, { count: number; reset: number }>();

function address(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "inconnu";
}

function rateLimitApi(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
  const ip = address(request);
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now > bucket.reset) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
  } else {
    bucket.count += 1;
    if (bucket.count > MAX_PER_WINDOW) {
      const retryAfter = Math.max(1, Math.ceil((bucket.reset - now) / 1000));
      return NextResponse.json(
        { erreur: "Trop de requetes. Reessayez dans un instant." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }
  if (buckets.size > 10_000) {
    for (const [key, value] of buckets) if (now > value.reset) buckets.delete(key);
  }
  return NextResponse.next();
}

// ── Langue ─────────────────────────────────────────────────────────
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) return rateLimitApi(request);

  // Chemin deja prefixe par une langue : on laisse passer, cookie a jour.
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const response = NextResponse.next();
    if (request.cookies.get("langue")?.value !== first) {
      response.cookies.set("langue", first, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    }
    return response;
  }

  // Sinon on redirige vers la langue du visiteur, en conservant le chemin.
  const locale = preferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url);
  response.cookies.set("langue", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return response;
}

export const config = {
  // Tout, sauf les fichiers internes de Next, les ressources statiques et les
  // fichiers racine servis tels quels (plan du site, robots, flux, images…).
  matcher: [
    "/((?!_next/|.*\\..*|feed\\.xml|sitemap\\.xml|robots\\.txt|opengraph-image|manifest\\.webmanifest|icon).*)",
    "/api/:path*",
  ],
};

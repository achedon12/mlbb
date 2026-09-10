import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LANGUE_DEFAUT, estLangue, type Langue } from "@/i18n/config";

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
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 90;
const seaux = new Map<string, { compte: number; reset: number }>();

function adresse(requete: NextRequest): string {
  const transmise = requete.headers.get("x-forwarded-for");
  if (transmise) return transmise.split(",")[0]!.trim();
  return requete.headers.get("x-real-ip") ?? "inconnu";
}

function limiterApi(requete: NextRequest) {
  if (requete.nextUrl.pathname === "/api/sante") return NextResponse.next();
  const ip = adresse(requete);
  const maintenant = Date.now();
  const seau = seaux.get(ip);
  if (!seau || maintenant > seau.reset) {
    seaux.set(ip, { compte: 1, reset: maintenant + FENETRE_MS });
  } else {
    seau.compte += 1;
    if (seau.compte > MAX_PAR_FENETRE) {
      const retryApres = Math.max(1, Math.ceil((seau.reset - maintenant) / 1000));
      return NextResponse.json(
        { erreur: "Trop de requetes. Reessayez dans un instant." },
        { status: 429, headers: { "Retry-After": String(retryApres) } },
      );
    }
  }
  if (seaux.size > 10_000) {
    for (const [cle, valeur] of seaux) if (maintenant > valeur.reset) seaux.delete(cle);
  }
  return NextResponse.next();
}

// ── Langue ─────────────────────────────────────────────────────────
function languePreferee(requete: NextRequest): Langue {
  const cookie = requete.cookies.get("langue")?.value;
  if (cookie && estLangue(cookie)) return cookie;

  const entete = requete.headers.get("accept-language");
  if (entete) {
    for (const partie of entete.split(",")) {
      const code = partie.split(";")[0]!.trim().slice(0, 2).toLowerCase();
      if (estLangue(code)) return code;
    }
  }
  return LANGUE_DEFAUT;
}

export function proxy(requete: NextRequest) {
  const { pathname } = requete.nextUrl;

  if (pathname.startsWith("/api/")) return limiterApi(requete);

  // Chemin deja prefixe par une langue : on laisse passer, cookie a jour.
  const premier = pathname.split("/")[1];
  if (estLangue(premier)) {
    const reponse = NextResponse.next();
    if (requete.cookies.get("langue")?.value !== premier) {
      reponse.cookies.set("langue", premier, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    }
    return reponse;
  }

  // Sinon on redirige vers la langue du visiteur, en conservant le chemin.
  const langue = languePreferee(requete);
  const url = requete.nextUrl.clone();
  url.pathname = `/${langue}${pathname === "/" ? "" : pathname}`;
  const reponse = NextResponse.redirect(url);
  reponse.cookies.set("langue", langue, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return reponse;
}

export const config = {
  // Tout, sauf les fichiers internes de Next, les ressources statiques et les
  // fichiers racine servis tels quels (plan du site, robots, flux, images…).
  matcher: [
    "/((?!_next/|.*\\..*|feed\\.xml|sitemap\\.xml|robots\\.txt|opengraph-image|manifest\\.webmanifest|icon).*)",
    "/api/:path*",
  ],
};

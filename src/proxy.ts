import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Limitation de debit de l'API.
 *
 * L'API publique est ouverte : sans garde-fou, un client trop gourmand — ou
 * malveillant — pourrait la marteler. Une fenetre fixe par adresse IP suffit a
 * lisser les abus, sans etat externe. Le compteur vit en memoire du processus :
 * cale pour un deploiement a une instance, comme celui-ci ; a plusieurs, il
 * faudrait un magasin partage.
 */
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 90;

const seaux = new Map<string, { compte: number; reset: number }>();

function adresse(requete: NextRequest): string {
  const transmise = requete.headers.get("x-forwarded-for");
  if (transmise) return transmise.split(",")[0]!.trim();
  return requete.headers.get("x-real-ip") ?? "inconnu";
}

export function proxy(requete: NextRequest) {
  // Le controle de sante est appele par l'orchestrateur : jamais limite.
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

  // Purge opportuniste : on borne la taille de la table sans tache dediee.
  if (seaux.size > 10_000) {
    for (const [cle, valeur] of seaux) if (maintenant > valeur.reset) seaux.delete(cle);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

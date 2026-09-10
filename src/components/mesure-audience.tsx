import Script from "next/script";

/**
 * Mesure d'audience, sans cookie ni donnee personnelle.
 *
 * Rien n'est charge par defaut. En renseignant `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`,
 * le site inclut le script Plausible — une mesure respectueuse qui n'utilise
 * aucun cookie et ne suit pas les visiteurs d'un site a l'autre, donc sans
 * bandeau de consentement a afficher. La source est configurable pour pointer,
 * au besoin, vers une instance auto-hebergee.
 */
export function MesureAudience() {
  const domaine = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domaine) return null;

  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";
  return <Script defer data-domain={domaine} src={src} strategy="afterInteractive" />;
}

import Script from "next/script";

/**
 * Mesure d'audience Matomo, sans cookie ni donnee personnelle.
 *
 * Rien n'est charge par defaut. En renseignant `NEXT_PUBLIC_MATOMO_URL` et
 * `NEXT_PUBLIC_MATOMO_SITE_ID`, le site inclut le traceur Matomo, configure
 * pour ne poser aucun cookie — donc sans bandeau de consentement a afficher.
 * L'instance est celle, auto-hebergee, de l'editeur.
 */
export function MesureAudience() {
  const url = process.env.NEXT_PUBLIC_MATOMO_URL;
  const siteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  if (!url || !siteId) return null;

  // On garantit un slash final pour construire les URL du traceur.
  const base = url.endsWith("/") ? url : `${url}/`;

  return (
    <Script id="matomo" strategy="lazyOnload">
      {`
        var _paq = (window._paq = window._paq || []);
        _paq.push(["disableCookies"]);
        _paq.push(["trackPageView"]);
        _paq.push(["enableLinkTracking"]);
        (function () {
          var u = ${JSON.stringify(base)};
          _paq.push(["setTrackerUrl", u + "matomo.php"]);
          _paq.push(["setSiteId", ${JSON.stringify(String(siteId))}]);
          var d = document,
            g = d.createElement("script"),
            s = d.getElementsByTagName("script")[0];
          g.async = true;
          g.src = u + "matomo.js";
          s.parentNode.insertBefore(g, s);
        })();
      `}
    </Script>
  );
}

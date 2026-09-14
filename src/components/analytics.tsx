import Script from "next/script";

/**
 * Matomo audience measurement, with no cookie and no personal data.
 *
 * Nothing is loaded by default. Setting `NEXT_PUBLIC_MATOMO_URL` and
 * `NEXT_PUBLIC_MATOMO_SITE_ID` makes the site include the Matomo tracker,
 * configured to set no cookie — so no consent banner is needed. The instance
 * is the publisher's own self-hosted one.
 */
export function Analytics() {
  const url = process.env.NEXT_PUBLIC_MATOMO_URL;
  const siteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  if (!url || !siteId) return null;

  // Ensure a trailing slash to build the tracker URLs.
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

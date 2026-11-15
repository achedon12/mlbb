import Script from "next/script";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { VISITOR_COOKIE_SECONDS } from "@/lib/consent";

/**
 * Matomo audience measurement, with no personal data, and no cookie unless
 * the visitor accepts them.
 *
 * Nothing is loaded by default. Setting `NEXT_PUBLIC_MATOMO_URL` and
 * `NEXT_PUBLIC_MATOMO_SITE_ID` makes the site include the Matomo tracker,
 * from the publisher's own self-hosted instance. `requireCookieConsent`
 * keeps it cookieless until the consent banner (`<ConsentBanner />`,
 * `lib/consent.ts`) records a yes; Matomo then remembers it in its own
 * `mtm_cookie_consent` cookie, and sets its visitor cookie for 13 months
 * at most. Without consent, the measurement goes on as before, cookieless.
 *
 * Page views are not sent here but by `<AnalyticsTracker />`, which also
 * counts the pages reached without a reload. Matomo applies the settings
 * below before anything queued earlier, whatever the order.
 */
export function Analytics() {
  const url = process.env.NEXT_PUBLIC_MATOMO_URL;
  const siteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  if (!url || !siteId) return null;

  // Ensure a trailing slash to build the tracker URLs.
  const base = url.endsWith("/") ? url : `${url}/`;

  return (
    <>
      <Script id="matomo" strategy="lazyOnload">
        {`
          var _paq = (window._paq = window._paq || []);
          _paq.push(["requireCookieConsent"]);
          _paq.push(["setVisitorCookieTimeout", ${VISITOR_COOKIE_SECONDS}]);
          _paq.push(["enableLinkTracking"]);
          _paq.push(["enableHeartBeatTimer"]);
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
      <AnalyticsTracker />
    </>
  );
}

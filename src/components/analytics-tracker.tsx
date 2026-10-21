"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { notFoundTitle, trackEvent, trackPageView } from "@/lib/analytics";

/**
 * Counts every page, not only the first one. The App Router changes page
 * without reloading, and Matomo, left to itself, only saw the landing page:
 * the reports showed one page per visit and a bounce rate to match.
 *
 * The view waits for the page's title: on a client navigation, Next writes
 * the new `<title>` after the address changes — sometimes well after, when
 * the metadata streams in. Past `TITLE_WAIT_MS`, the view leaves with the
 * title it has (two pages can share one). A page marked `data-not-found`
 * (the 404 page) is filed under Matomo's 404 convention, with its origin.
 *
 * Also notes whether the site runs as an installed app — the PWA is only
 * worth its upkeep if people use it.
 */
const TITLE_WAIT_MS = 2000;

export function AnalyticsTracker() {
  const pathname = usePathname();
  const previous = useRef<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const before = previous.current;
    // Already counted: React runs the effect twice in development.
    if (before?.url === window.location.href) return;
    const send = () => {
      observer.disconnect();
      clearTimeout(timer);
      const url = window.location.href;
      const referrer = before?.url ?? document.referrer;
      const notFound = document.querySelector("[data-not-found]") !== null;
      trackPageView({
        url,
        referrer: before?.url,
        title: notFound ? notFoundTitle(window.location.pathname, referrer) : document.title,
      });
      previous.current = { url, title: document.title };
    };
    // The new title is there once it is set and differs from the last page's.
    const ready = () => document.title !== "" && document.title !== before?.title;
    const observer = new MutationObserver(() => ready() && send());
    const timer = setTimeout(send, TITLE_WAIT_MS);
    if (ready()) {
      send();
    } else {
      observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    }
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) trackEvent("App", "Launch installed");
    const installed = () => trackEvent("App", "Install");
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, []);

  return null;
}

/**
 * Matomo audience measurement, from the browser side.
 *
 * Every call goes through Matomo's `_paq` queue: the tracker script, loaded
 * lazily by `<Analytics />`, replays it once it arrives, so a call made
 * before it loads is not lost. Without `NEXT_PUBLIC_MATOMO_URL`, every
 * function does nothing — no queue builds up for a tracker that never comes.
 *
 * Event names follow one scheme, so the Matomo reports stay readable:
 * category = the site feature ("Favourites", "Share"), action = what was done
 * ("Add", "Copy"), name = the subject (a hero slug, a tool), value = a number
 * when there is one (guesses, points). Never personal data.
 */
type Command = [string, ...unknown[]];

declare global {
  interface Window {
    _paq?: Command[];
  }
}

export const analyticsEnabled = Boolean(process.env.NEXT_PUBLIC_MATOMO_URL && process.env.NEXT_PUBLIC_MATOMO_SITE_ID);

function push(...commands: Command[]) {
  if (!analyticsEnabled || typeof window === "undefined") return;
  const queue = (window._paq ??= []);
  queue.push(...commands);
}

/**
 * One page view. The App Router changes page without reloading: Matomo, which
 * only sees the first load, must be told the address, the title and where
 * the visitor came from.
 */
export function trackPageView({ url, referrer, title }: { url: string; referrer?: string; title: string }) {
  push(
    ...(referrer ? [["setReferrerUrl", referrer] as Command] : []),
    ["setCustomUrl", url],
    ["setDocumentTitle", title],
    ["trackPageView"],
  );
}

/**
 * Matomo's convention for a missing page: the title starting with "404/"
 * files it under Behaviour › Page titles, with the address and its origin.
 */
export function notFoundTitle(url: string, referrer: string): string {
  return `404/URL = ${encodeURIComponent(url)}/From = ${encodeURIComponent(referrer)}`;
}

export function trackEvent(category: string, action: string, name?: string, value?: number) {
  const command: Command = ["trackEvent", category, action];
  if (name !== undefined || value !== undefined) command.push(name ?? "");
  if (value !== undefined) command.push(value);
  push(command);
}

/** A search on the site, in Behaviour › Site search; `count` 0 lists it under "no result". */
export function trackSiteSearch(keyword: string, category: string | false, count: number) {
  const term = keyword.trim().toLowerCase();
  if (term) push(["trackSiteSearch", term, category, count]);
}

/** How a result was shared: the native share sheet, or the clipboard. */
export type ShareMethod = "native" | "clipboard" | "image";

export function trackShare(tool: string, method: ShareMethod) {
  trackEvent("Share", tool, method);
}

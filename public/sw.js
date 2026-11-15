/**
 * Service worker: the site stays browsable without a connection, and receives
 * patch notifications.
 *
 * - Pages: network first, cache as fallback. Offline, a page already seen
 *   shows as it was on the last visit; a page never seen leads to the
 *   "offline" page of its locale.
 * - Build files (/_next/static): cache first. Their name carries a hash: a
 *   cached file cannot be stale.
 * - Images and fonts: cache first, with a capped number of entries.
 * - API and React navigation data (RSC): never cached. When an internal
 *   navigation fails for lack of network, Next falls back to a regular page
 *   load — which this service worker can serve.
 * - Signed-in pages: never stored. The account, login, bot dashboard and
 *   admin pages go straight to the network, and so does any response marked
 *   `Cache-Control: private` or `no-store` (every page rendered for a
 *   session: community, builds). A service worker cannot see `Set-Cookie`
 *   (browsers hide it), but the session cookies are only ever set by the
 *   login action and the Discord callback, neither of which is stored. Otherwise a
 *   shared device would show them, offline, after the visitor signed out.
 *   Signing out also wipes any such copy left by an older worker
 *   (`forgetPrivate`).
 * - Notifications: the server sends an encrypted message (title, text,
 *   path); it is shown, and a click opens the path on the site.
 */
// v2: game visuals moved from `.png` to `.webp`. A page cached under v1 still
// names the old addresses, and the optimiser refuses one (`/_next/image` reads
// its `url` parameter, which no redirect can rewrite). Renaming the caches
// drops that stale HTML — and the images that went with it — on the next
// visit, at the cost of one reload.
const VERSION = "v2";
const CACHE_PAGES = `pages-${VERSION}`;
const CACHE_STATIC = `statique-${VERSION}`;
const CACHE_IMAGES = `images-${VERSION}`;
const CACHE_DATA = `donnees-${VERSION}`;
const CACHES = [CACHE_PAGES, CACHE_STATIC, CACHE_IMAGES, CACHE_DATA];
// Same list as LOCALES in src/i18n/config.ts (a service worker cannot import it).
const LOCALES = ["fr", "en", "it", "es", "id", "fil", "th", "pt", "ru"];
const MAX_PAGES = 250;
const MAX_IMAGES = 800;
const MAX_DATA = 300;

/**
 * Pages that belong to a signed-in visitor, with or without the locale
 * prefix. Community pages are only private when signed in: their responses
 * then say so (`private, no-store`), which `cacheable` reads.
 */
const PRIVATE_PATH = /^\/(?:[a-z]{2,3}\/)?(?:account|login|bot\/dashboard|bot\/admin)(?:\/|$)/;
/** Pages showing who is signed in: dropped from the cache on sign-out. */
const SIGNED_IN_PATH = /^\/(?:[a-z]{2,3}\/)?(?:account|login|bot\/dashboard|bot\/admin|community|builds)(?:\/|$)/;
/** Requests that sign out: the game account (a server action posted from the account page) is told by the page itself. */
const SIGN_OUT_PATH = "/api/discord/logout";

/**
 * Plain-text fallback when not even the "offline" page is cached. The service
 * worker cannot load the message catalogs: this small table is the only
 * visitor text it carries.
 */
const OFFLINE_TEXT = {
  fr: "Hors ligne",
  en: "Offline",
  it: "Offline",
  es: "Sin conexión",
  id: "Offline",
  fil: "Offline",
  th: "ออฟไลน์",
  pt: "Sem conexão",
  ru: "Нет сети",
};

/**
 * In development, the service worker is only registered to try out
 * notifications, as "/sw.js?cache=0": without a cache, which would get in the
 * way of hot reloading. In production, the address is "/sw.js".
 */
const CACHE_ENABLED = new URL(self.location.href).searchParams.get("cache") !== "0";

self.addEventListener("install", (event) => {
  if (!CACHE_ENABLED) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  // The "offline" page of each locale must exist before it is ever needed.
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => Promise.allSettled(LOCALES.map((l) => cache.add(`/${l}/offline`))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !CACHE_ENABLED || !CACHES.includes(n)).map((n) => caches.delete(n))),
      )
      // Copies of signed-in pages stored by an earlier version of this worker.
      .then(() => (CACHE_ENABLED ? forgetPrivate(false) : undefined))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHE_ENABLED) return;
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Signing out of Discord: the request goes through untouched, the signed-in pages leave the cache.
  if (url.pathname === SIGN_OUT_PATH) {
    event.waitUntil(forgetPrivate(true));
    return;
  }
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  // A signed-in page: network only, nothing stored, no stale copy served;
  // offline, the "offline" page of its locale.
  if (PRIVATE_PATH.test(url.pathname)) {
    if (request.mode === "navigate") event.respondWith(fetch(request).catch(() => offlinePage(url.pathname)));
    return;
  }
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(page(event, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, CACHE_STATIC));
  } else if (
    url.pathname.startsWith("/visuels/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(png|jpe?g|webp|avif|svg|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(event, CACHE_IMAGES, MAX_IMAGES));
  } else if (
    /^\/(composition|matchups|trends|quiz|quiz\/day)\/[^/]+\.json$/.test(url.pathname) ||
    /^\/[a-z]{2,3}\/search\.json$/.test(url.pathname)
  ) {
    event.respondWith(networkFirst(event, CACHE_DATA, MAX_DATA));
  }
});

/**
 * Messages from the page: prewarming (the list of sections to keep offline),
 * and the game account's sign-out (`forget-private`).
 */
self.addEventListener("message", (event) => {
  if (!CACHE_ENABLED) return;
  if (event.data?.type === "forget-private") {
    event.waitUntil(forgetPrivate(true));
    return;
  }
  if (event.data?.type !== "prewarm" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(prewarm(event.data.urls));
});

/**
 * Patch notification. The browser requires every received message to be shown:
 * even when unreadable, a generic notification is shown rather than nothing.
 */
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { corps: event.data ? event.data.text() : "" };
  }
  const text = (value) => (typeof value === "string" ? value : undefined);
  event.waitUntil(
    self.registration.showNotification(text(message.titre) || "MLBBDex", {
      body: text(message.corps) ?? "",
      icon: "/icons/icon-192.png",
      tag: text(message.tag),
      lang: text(message.langue),
      data: { url: text(message.url) ?? "/" },
    }),
  );
});

/** Click: focus the tab already open at this address, otherwise open it. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(focusOrOpen(safeAddress(event.notification.data?.url)));
});

/** Only the site's own addresses open from a notification. */
function safeAddress(raw) {
  try {
    const url = new URL(raw || "/", self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch {
    /* unreadable address: home page */
  }
  return `${self.location.origin}/`;
}

async function focusOrOpen(address) {
  const withoutHash = (u) => u.split("#")[0];
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((c) => withoutHash(c.url) === withoutHash(address));
  if (open) return open.focus();
  return self.clients.openWindow(address);
}

async function page(event, url) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const response = await fetch(event.request);
    if (cacheable(url, response)) event.waitUntil(store(cache, url, response.clone()));
    return response;
  } catch {
    const cached =
      (await cache.match(url.href)) ?? (await cache.match(url.pathname, { ignoreSearch: true }));
    if (cached) return cached;

    // Internal links have no locale prefix ("/heroes"): online, the proxy
    // restores it. Offline, the page is looked up in the locale of the page we
    // came from, then in the browser's, then in the others.
    const localeOf = (path) =>
      LOCALES.find((l) => path === `/${l}` || path.startsWith(`/${l}/`));
    const prefixed = localeOf(url.pathname);
    const origin = event.request.referrer
      ? localeOf(new URL(event.request.referrer).pathname)
      : undefined;
    const browser = LOCALES.find((l) => (self.navigator.language || "").startsWith(l));
    const order = [...new Set([origin, browser, ...LOCALES].filter(Boolean))];
    if (!prefixed) {
      for (const l of order) {
        const path = url.pathname === "/" ? `/${l}` : `/${l}${url.pathname}`;
        const found = await cache.match(path, { ignoreSearch: true });
        if (found) return found;
      }
    }
    const locale = prefixed ?? order[0] ?? "fr";
    return (
      (await cache.match(`/${locale}/offline`)) ??
      new Response(OFFLINE_TEXT[locale] ?? OFFLINE_TEXT.en, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

/**
 * Stores a page. A response that came through a redirect ("/" to "/fr") cannot
 * serve a navigation: a clean copy is kept, under the requested address as
 * well as under the final one.
 */
async function store(cache, url, response) {
  const clean = response.redirected
    ? new Response(await response.blob(), { status: response.status, headers: response.headers })
    : response;
  await cache.put(url.href, clean.clone());
  if (response.redirected && response.url) await cache.put(response.url, clean);
  await trim(cache, MAX_PAGES);
}

async function cacheFirst(event, name, max) {
  const cache = await caches.open(name);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok) {
    event.waitUntil(
      cache.put(event.request, response.clone()).then(() => (max ? trim(cache, max) : undefined)),
    );
  }
  return response;
}

/**
 * Data loaded on demand (per-rank measures of the team analysis, compare page
 * trends, search index): fresh online, the last copy offline.
 */
async function networkFirst(event, name, max) {
  const cache = await caches.open(name);
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(cache, max)));
    return response;
  } catch {
    return (await cache.match(event.request)) ?? Response.error();
  }
}

async function offlinePage(pathname) {
  const locale = LOCALES.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ?? "fr";
  const cache = await caches.open(CACHE_PAGES);
  return (
    (await cache.match(`/${locale}/offline`)) ??
    new Response(OFFLINE_TEXT[locale] ?? OFFLINE_TEXT.en, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  );
}

/**
 * Whether a page may be kept: a success, not a signed-in page, and nothing
 * in its headers saying it belongs to one visitor. A redirect's final
 * address counts too ("/account" reached from "/").
 */
function cacheable(url, response) {
  if (!response.ok) return false;
  if (PRIVATE_PATH.test(url.pathname)) return false;
  if (response.url && PRIVATE_PATH.test(new URL(response.url).pathname)) return false;
  const control = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !/\b(?:no-store|private)\b/.test(control);
}

/**
 * Drops the cached pages that may show a signed-in visitor: those stored
 * against the rules above, and, on sign-out (`signingOut`), every page of
 * the signed-in areas, whatever their headers said.
 */
async function forgetPrivate(signingOut) {
  const cache = await caches.open(CACHE_PAGES);
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    const response = signingOut && SIGNED_IN_PATH.test(url.pathname) ? null : await cache.match(request);
    if (!response || !cacheable(url, response)) await cache.delete(request);
  }
}

/** The oldest entries go first: `keys()` follows insertion order. */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

async function prewarm(urls) {
  const cache = await caches.open(CACHE_PAGES);
  for (const u of urls) {
    const url = new URL(u, self.location.origin);
    if (await cache.match(url.href)) continue;
    try {
      const response = await fetch(url.href, { credentials: "same-origin" });
      if (cacheable(url, response)) await store(cache, url, response);
    } catch {
      return; // network gone: resume on the next visit
    }
  }
}

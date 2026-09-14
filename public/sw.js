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
 * - Notifications: the server sends an encrypted message (title, text,
 *   path); it is shown, and a click opens the path on the site.
 */
const VERSION = "v1";
const CACHE_PAGES = `pages-${VERSION}`;
const CACHE_STATIQUE = `statique-${VERSION}`;
const CACHE_IMAGES = `images-${VERSION}`;
const CACHE_DONNEES = `donnees-${VERSION}`;
const CACHES = [CACHE_PAGES, CACHE_STATIQUE, CACHE_IMAGES, CACHE_DONNEES];
const LANGUES = ["fr", "en", "it", "es"];
const MAX_PAGES = 250;
const MAX_IMAGES = 800;
const MAX_DONNEES = 300;

/**
 * In development, the service worker is only registered to try out
 * notifications, as "/sw.js?cache=0": without a cache, which would get in the
 * way of hot reloading. In production, the address is "/sw.js".
 */
const CACHE_ACTIF = new URL(self.location.href).searchParams.get("cache") !== "0";

self.addEventListener("install", (event) => {
  if (!CACHE_ACTIF) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  // The "offline" page of each locale must exist before it is ever needed.
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => Promise.allSettled(LANGUES.map((l) => cache.add(`/${l}/offline`))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((n) => !CACHE_ACTIF || !CACHES.includes(n)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHE_ACTIF) return;
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(page(event, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheDabord(event, CACHE_STATIQUE));
  } else if (
    url.pathname.startsWith("/visuels/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(png|jpe?g|webp|avif|svg|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheDabord(event, CACHE_IMAGES, MAX_IMAGES));
  } else if (
    /^\/(composition|trends|quiz|quiz\/day)\/[^/]+\.json$/.test(url.pathname) ||
    /^\/[a-z]{2}\/search\.json$/.test(url.pathname)
  ) {
    event.respondWith(reseauDabord(event, CACHE_DONNEES, MAX_DONNEES));
  }
});

/** Prewarming: the page sends the list of sections to keep offline. */
self.addEventListener("message", (event) => {
  if (!CACHE_ACTIF || event.data?.type !== "prechauffer" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(prechauffer(event.data.urls));
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
  const texte = (valeur) => (typeof valeur === "string" ? valeur : undefined);
  event.waitUntil(
    self.registration.showNotification(texte(message.titre) || "MLBBDex", {
      body: texte(message.corps) ?? "",
      icon: "/icons/icon-192.png",
      tag: texte(message.tag),
      lang: texte(message.langue),
      data: { url: texte(message.url) ?? "/" },
    }),
  );
});

/** Click: focus the tab already open at this address, otherwise open it. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(ouvrir(adresseSure(event.notification.data?.url)));
});

/** Only the site's own addresses open from a notification. */
function adresseSure(brute) {
  try {
    const url = new URL(brute || "/", self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch {
    /* unreadable address: home page */
  }
  return `${self.location.origin}/`;
}

async function ouvrir(adresse) {
  const sansAncre = (u) => u.split("#")[0];
  const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const ouverte = fenetres.find((c) => sansAncre(c.url) === sansAncre(adresse));
  if (ouverte) return ouverte.focus();
  return self.clients.openWindow(adresse);
}

async function page(event, url) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const reponse = await fetch(event.request);
    if (reponse.ok) event.waitUntil(ranger(cache, url, reponse.clone()));
    return reponse;
  } catch {
    const enCache =
      (await cache.match(url.href)) ?? (await cache.match(url.pathname, { ignoreSearch: true }));
    if (enCache) return enCache;

    // Internal links have no locale prefix ("/heroes"): online, the proxy
    // restores it. Offline, the page is looked up in the locale of the page we
    // came from, then in the browser's, then in the others.
    const langueDe = (chemin) =>
      LANGUES.find((l) => chemin === `/${l}` || chemin.startsWith(`/${l}/`));
    const prefixee = langueDe(url.pathname);
    const origine = event.request.referrer
      ? langueDe(new URL(event.request.referrer).pathname)
      : undefined;
    const navigateur = LANGUES.find((l) => (self.navigator.language || "").startsWith(l));
    const ordre = [...new Set([origine, navigateur, ...LANGUES].filter(Boolean))];
    if (!prefixee) {
      for (const l of ordre) {
        const chemin = url.pathname === "/" ? `/${l}` : `/${l}${url.pathname}`;
        const trouve = await cache.match(chemin, { ignoreSearch: true });
        if (trouve) return trouve;
      }
    }
    const langue = prefixee ?? ordre[0] ?? "fr";
    return (
      (await cache.match(`/${langue}/offline`)) ??
      new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

/**
 * Stores a page. A response that came through a redirect ("/" to "/fr") cannot
 * serve a navigation: a clean copy is kept, under the requested address as
 * well as under the final one.
 */
async function ranger(cache, url, reponse) {
  const propre = reponse.redirected
    ? new Response(await reponse.blob(), { status: reponse.status, headers: reponse.headers })
    : reponse;
  await cache.put(url.href, propre.clone());
  if (reponse.redirected && reponse.url) await cache.put(reponse.url, propre);
  await limiter(cache, MAX_PAGES);
}

async function cacheDabord(event, nom, max) {
  const cache = await caches.open(nom);
  const enCache = await cache.match(event.request);
  if (enCache) return enCache;
  const reponse = await fetch(event.request);
  if (reponse.ok) {
    event.waitUntil(
      cache.put(event.request, reponse.clone()).then(() => (max ? limiter(cache, max) : undefined)),
    );
  }
  return reponse;
}

/**
 * Data loaded on demand (per-rank measures of the team analysis, compare page
 * trends, search index): fresh online, the last copy offline.
 */
async function reseauDabord(event, nom, max) {
  const cache = await caches.open(nom);
  try {
    const reponse = await fetch(event.request);
    if (reponse.ok) event.waitUntil(cache.put(event.request, reponse.clone()).then(() => limiter(cache, max)));
    return reponse;
  } catch {
    return (await cache.match(event.request)) ?? Response.error();
  }
}

/** The oldest entries go first: `keys()` follows insertion order. */
async function limiter(cache, max) {
  const cles = await cache.keys();
  for (let i = 0; i < cles.length - max; i += 1) await cache.delete(cles[i]);
}

async function prechauffer(urls) {
  const cache = await caches.open(CACHE_PAGES);
  for (const u of urls) {
    const url = new URL(u, self.location.origin);
    if (await cache.match(url.href)) continue;
    try {
      const reponse = await fetch(url.href, { credentials: "same-origin" });
      if (reponse.ok) await ranger(cache, url, reponse);
    } catch {
      return; // network gone: resume on the next visit
    }
  }
}

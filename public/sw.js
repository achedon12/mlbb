/**
 * Service worker : le site reste consultable sans connexion, et recoit les
 * notifications de patch.
 *
 * - Pages : reseau d'abord, cache en secours. Hors ligne, une page deja vue
 *   s'affiche telle qu'a la derniere visite ; une page jamais vue renvoie vers
 *   la page « hors ligne » de sa langue.
 * - Fichiers du build (/_next/static) : cache d'abord. Leur nom porte une
 *   empreinte : un fichier en cache ne peut pas etre perime.
 * - Images et polices : cache d'abord, nombre d'entrees plafonne.
 * - API et donnees de navigation React (RSC) : jamais mises en cache. Quand une
 *   navigation interne echoue faute de reseau, Next retombe sur un chargement
 *   classique de la page — que ce service worker sait servir.
 * - Notifications : le serveur envoie un message chiffre (titre, texte,
 *   chemin) ; on l'affiche, et un clic ouvre le chemin sur le site.
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
 * En developpement, le service worker n'est enregistre que pour essayer les
 * notifications, sous « /sw.js?cache=0 » : sans cache, qui genererait le
 * rechargement a chaud. En production, l'adresse est « /sw.js ».
 */
const CACHE_ACTIF = new URL(self.location.href).searchParams.get("cache") !== "0";

self.addEventListener("install", (event) => {
  if (!CACHE_ACTIF) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  // La page « hors ligne » de chaque langue doit exister avant tout besoin.
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
    /^\/(composition|tendances|quiz|quiz\/jour)\/[^/]+\.json$/.test(url.pathname) ||
    /^\/[a-z]{2}\/recherche\.json$/.test(url.pathname)
  ) {
    event.respondWith(reseauDabord(event, CACHE_DONNEES, MAX_DONNEES));
  }
});

/** Prechauffage : la page envoie la liste des rubriques a garder hors ligne. */
self.addEventListener("message", (event) => {
  if (!CACHE_ACTIF || event.data?.type !== "prechauffer" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(prechauffer(event.data.urls));
});

/**
 * Notification de patch. Le navigateur exige qu'un message recu s'affiche :
 * meme illisible, on montre une notification generique plutot que rien.
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

/** Clic : on revient sur l'onglet deja ouvert a cette adresse, sinon on l'ouvre. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(ouvrir(adresseSure(event.notification.data?.url)));
});

/** Seules les adresses du site s'ouvrent depuis une notification. */
function adresseSure(brute) {
  try {
    const url = new URL(brute || "/", self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch {
    /* adresse illisible : accueil */
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

    // Les liens internes n'ont pas de prefixe de langue (« /heroes ») : en
    // ligne, le proxy le retablit. Hors ligne, on cherche la page dans la
    // langue de la page d'ou l'on vient, puis dans celle du navigateur, puis
    // dans les autres.
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
 * Range une page. Une reponse issue d'une redirection (« / » vers « /fr ») ne
 * peut pas servir une navigation : on en garde une copie propre, sous
 * l'adresse demandee comme sous l'adresse finale.
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
 * Donnees chargees a la demande (mesures par rang de l'analyse d'equipe,
 * tendances du comparateur, index de la recherche) : fraiches en ligne, la
 * derniere copie hors ligne.
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

/** Les entrees les plus anciennes partent en premier : `keys()` suit l'ordre d'ajout. */
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
      return; // plus de reseau : on reprendra a la prochaine visite
    }
  }
}

import type { Locale } from "@/i18n/config";

/**
 * Notifications de patch, cote navigateur.
 *
 * Abonne ce navigateur aupres de son service de notification (Google,
 * Mozilla, Apple…) avec la cle publique du serveur, puis confie l'abonnement
 * au serveur avec la langue et les favoris. Les favoris vivant dans le
 * navigateur, chaque changement est repercute au serveur.
 *
 * La permission n'est demandee qu'au clic sur l'interrupteur : jamais au
 * chargement d'une page.
 */
export type NotificationState =
  | "unavailable" // fonction desactivee sur le serveur : rien a afficher
  | "unsupported"
  | "ios-install" // iPhone et iPad : seulement une fois le site installe
  | "refused"
  | "inactive"
  | "active";

const FLAG = "mlbb_push";

function readFlag(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function setFlag(active: boolean) {
  try {
    if (active) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* stockage indisponible : la synchronisation attendra la page des favoris */
  }
}

let key: Promise<string | null> | null = null;

/** Cle publique VAPID, demandee une fois par chargement. */
export function publicKey(): Promise<string | null> {
  key ??= fetch("/api/push", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { key?: unknown } | null) => (typeof d?.key === "string" ? d.key : null))
    .catch(() => {
      key = null; // hors ligne : on reessaiera
      return null;
    });
  return key;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function browserSupport(): "ok" | "unsupported" | "ios-install" {
  // Safari sur iOS n'offre les notifications qu'aux sites installes sur l'ecran d'accueil.
  if (isIOS() && !isInstalled()) return "ios-install";
  const full = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return full ? "ok" : "unsupported";
}

/**
 * Enregistrement du service worker. En production, `HorsLigne` l'a deja fait.
 * En developpement, il n'est enregistre qu'a l'activation, sans son cache —
 * qui generait le rechargement a chaud (voir `public/sw.js`).
 */
async function record(create: boolean): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing && !create) return null;
  if (!existing) await navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?cache=0");
  return create ? navigator.serviceWorker.ready : (existing ?? null);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await record(false);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Etat affiche par l'interrupteur, sans rien demander a l'utilisateur. */
export async function stateCurrent(): Promise<NotificationState> {
  if (!(await publicKey())) return "unavailable";
  const support = browserSupport();
  if (support !== "ok") return support;
  if (Notification.permission === "denied") return "refused";
  const active = Notification.permission === "granted" && (await currentSubscription()) !== null;
  if (active) setFlag(true);
  return active ? "active" : "inactive";
}

function bytesOf(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameBytes(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

function call(method: "POST" | "PATCH" | "DELETE", body: object): Promise<Response> {
  return fetch("/api/push/subscription", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Demande la permission, abonne le navigateur et confie l'abonnement au serveur. */
export async function enable(locale: Locale, favourites: readonly string[]): Promise<NotificationState> {
  const vapidKey = await publicKey();
  if (!vapidKey) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "refused";
  if (permission !== "granted") return "inactive";

  const reg = await record(true);
  if (!reg) throw new Error("service worker indisponible");
  const bytes = bytesOf(vapidKey);
  let subscription = await reg.pushManager.getSubscription();
  // Cles changees sur le serveur : l'ancien abonnement ne recevrait plus rien.
  if (subscription && !sameBytes(subscription.options.applicationServerKey, bytes)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });

  const response = await call("POST", { abonnement: subscription.toJSON(), langue: locale, favoris: favourites });
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => {});
    throw new Error(`abonnement refuse (${response.status})`);
  }
  setFlag(true);
  lastSync = syncKey(locale, favourites);
  return "active";
}

/** Desabonne le navigateur et efface l'abonnement du serveur. */
export async function disable(): Promise<NotificationState> {
  setFlag(false);
  const subscription = await currentSubscription();
  if (subscription) {
    // Si le serveur est injoignable, il effacera l'abonnement a son prochain envoi (410).
    await call("DELETE", { abonnement: subscription.toJSON() }).catch(() => {});
    await subscription.unsubscribe();
  }
  lastSync = "";
  return "inactive";
}

const syncKey = (locale: Locale, favourites: readonly string[]) => `${locale}|${favourites.join(",")}`;
let lastSync = "";
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Repercute les favoris (et la langue) au serveur, si ce navigateur est
 * abonne. Appele a chaque changement : les appels rapproches se regroupent.
 */
export function sync(locale: Locale, favourites: readonly string[]): void {
  if (!readFlag() || syncKey(locale, favourites) === lastSync) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    syncNow(locale, favourites).catch(() => {
      /* nouvel essai au prochain changement ou au prochain chargement */
    });
  }, 800);
}

async function syncNow(locale: Locale, favourites: readonly string[]) {
  if (browserSupport() !== "ok" || Notification.permission !== "granted" || !(await publicKey())) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const body = { abonnement: subscription.toJSON(), langue: locale, favoris: favourites };
  let response = await call("PATCH", body);
  // Abonnement efface cote serveur entre-temps : on le recree.
  if (response.status === 404) response = await call("POST", body);
  if (response.ok) lastSync = syncKey(locale, favourites);
}

import type { Locale } from "@/i18n/config";

/**
 * Patch notifications, browser side.
 *
 * Subscribes this browser with its push service (Google, Mozilla, Apple…)
 * using the server's public key, then hands the subscription to the server
 * along with the language and favourites. Since favourites live in the
 * browser, every change is forwarded to the server.
 *
 * Permission is only requested when the toggle is clicked: never on page
 * load.
 */
export type NotificationState =
  | "unavailable" // feature disabled on the server: nothing to show
  | "unsupported"
  | "ios-install" // iPhone and iPad: only once the site is installed
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
    /* storage unavailable: syncing will wait for the favourites page */
  }
}

let key: Promise<string | null> | null = null;

/** VAPID public key, requested once per page load. */
export function publicKey(): Promise<string | null> {
  key ??= fetch("/api/push", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { key?: unknown } | null) => (typeof d?.key === "string" ? d.key : null))
    .catch(() => {
      key = null; // offline: retry later
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
  // Safari on iOS only offers notifications to sites installed on the home screen.
  if (isIOS() && !isInstalled()) return "ios-install";
  const full = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return full ? "ok" : "unsupported";
}

/**
 * Service worker registration. In production, `Offline` has already done it.
 * In development, it is only registered on activation, without its cache —
 * which interfered with hot reloading (see `public/sw.js`).
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

/** State shown by the toggle, without prompting the user. */
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

/** Requests permission, subscribes the browser and hands the subscription to the server. */
export async function enable(locale: Locale, favourites: readonly string[]): Promise<NotificationState> {
  const vapidKey = await publicKey();
  if (!vapidKey) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "refused";
  if (permission !== "granted") return "inactive";

  const reg = await record(true);
  if (!reg) throw new Error("service worker unavailable");
  const bytes = bytesOf(vapidKey);
  let subscription = await reg.pushManager.getSubscription();
  // Keys changed on the server: the old subscription would receive nothing.
  if (subscription && !sameBytes(subscription.options.applicationServerKey, bytes)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });

  const response = await call("POST", { abonnement: subscription.toJSON(), langue: locale, favoris: favourites });
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => {});
    throw new Error(`subscription rejected (${response.status})`);
  }
  setFlag(true);
  lastSync = syncKey(locale, favourites);
  return "active";
}

/** Unsubscribes the browser and deletes the subscription from the server. */
export async function disable(): Promise<NotificationState> {
  setFlag(false);
  const subscription = await currentSubscription();
  if (subscription) {
    // If the server is unreachable, it will delete the subscription on its next send (410).
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
 * Forwards favourites (and language) to the server, if this browser is
 * subscribed. Called on every change: calls close together are batched.
 */
export function sync(locale: Locale, favourites: readonly string[]): void {
  if (!readFlag() || syncKey(locale, favourites) === lastSync) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    syncNow(locale, favourites).catch(() => {
      /* retried on the next change or the next page load */
    });
  }, 800);
}

async function syncNow(locale: Locale, favourites: readonly string[]) {
  if (browserSupport() !== "ok" || Notification.permission !== "granted" || !(await publicKey())) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const body = { abonnement: subscription.toJSON(), langue: locale, favoris: favourites };
  let response = await call("PATCH", body);
  // Subscription deleted server-side in the meantime: recreate it.
  if (response.status === 404) response = await call("POST", body);
  if (response.ok) lastSync = syncKey(locale, favourites);
}

import { isLocale, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { AdjustmentType } from "@/lib/types";

/**
 * Patch notifications: the side-effect-free part.
 *
 * Validation of subscription requests, choice of the subscribers to notify for
 * a patch, and message writing. Nothing here reads the disk or the network:
 * storage and sending live in `push-server.ts`, which keeps these rules
 * testable in isolation.
 */

/** Maximum request body: a subscription and 133 slugs fit in 3 KB. */
export const SIZE_MAX_BODY = 6_000;
/** Cap on favourites per subscription, above the current roster. */
export const MAX_FAVOURITES = 200;
/** Cap on stored subscriptions, so a script cannot fill the disk. */
export const MAX_SUBSCRIBERS = 50_000;
/** Heroes named in a notification; the rest are counted. */
export const MAX_CITED_HEROES = 3;

/**
 * Browser push services. The server sends its requests to the address given
 * by the subscription: restricting it to these hosts prevents turning it into
 * a relay towards internal addresses.
 */
const HOSTS_PUSH = [
  "fcm.googleapis.com", // Chrome, Edge Android, Opera, Samsung Internet, Brave
  "android.googleapis.com",
  "jmt17.google.com", // Chromium other than Google Chrome (Linux distributions…)
  ".push.services.mozilla.com", // Firefox
  ".notify.windows.com", // Edge on Windows
  ".push.apple.com", // Safari (macOS, iOS as an installed app)
];

export interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

/** Subscription as `PushSubscription.toJSON()` describes it, once validated. */
export interface StoredSubscription {
  endpoint: string;
  cles: SubscriptionKeys;
}

export interface Subscriber extends StoredSubscription {
  langue: Locale;
  favoris: string[];
  /** ISO dates of creation and last update. */
  cree: string;
  maj: string;
}

export function hostPushAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTS_PUSH.some((suffix) => (suffix.startsWith(".") ? h.endsWith(suffix) : h === suffix));
}

/** Subscription address: https, no credentials or unusual port, at a known service. */
export function endpointValid(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 1_024) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  return hostPushAllowed(url.hostname) ? url.href : null;
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Byte length of a base64url string, without decoding it. */
function bytes(value: string): number {
  const withoutFill = value.replace(/=+$/, "");
  return Math.floor((withoutFill.length * 3) / 4);
}

/**
 * Encryption keys: `p256dh` is an uncompressed P-256 point (65 bytes),
 * `auth` a 16-byte secret. Any other shape is rejected.
 */
function keysValid(raw: unknown): SubscriptionKeys | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { p256dh, auth } = raw as Record<string, unknown>;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (p256dh.length > 100 || auth.length > 40 || !BASE64URL.test(p256dh) || !BASE64URL.test(auth)) return null;
  if (bytes(p256dh) !== 65 || bytes(auth) !== 16) return null;
  return { p256dh, auth };
}

export function subscriptionValid(raw: unknown): StoredSubscription | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { endpoint, keys } = raw as Record<string, unknown>;
  const address = endpointValid(endpoint);
  const keyPair = keysValid(keys);
  return address && keyPair ? { endpoint: address, cles: keyPair } : null;
}

const SHAPE_SLUG = /^[a-z0-9-]{1,40}$/;

/**
 * Favourites: an array of slugs, deduplicated. An invalid shape rejects the
 * request; a well-formed slug missing from the catalogue (removed hero, old
 * list) is simply dropped, so as not to block the subscription.
 */
export function validFavourites(raw: unknown, known: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FAVOURITES) return null;
  if (!raw.every((s) => typeof s === "string" && SHAPE_SLUG.test(s))) return null;
  return [...new Set(raw as string[])].filter((s) => known.has(s));
}

export type PushRequest =
  | { type: "subscribe"; abonnement: StoredSubscription; langue: Locale; favoris: string[] }
  | { type: "update"; abonnement: StoredSubscription; langue: Locale | null; favoris: string[] }
  | { type: "unsubscribe"; abonnement: StoredSubscription };

/**
 * Validates the body of a subscription API request. Returns `null` as soon as
 * a field is missing or malformed: the route then responds 400.
 */
export function validateRequest(
  type: PushRequest["type"],
  body: unknown,
  known: ReadonlySet<string>,
): PushRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { abonnement: raw, langue: locale, favoris: favourites } = body as Record<string, unknown>;
  const subscription = subscriptionValid(raw);
  if (!subscription) return null;
  if (type === "unsubscribe") return { type, abonnement: subscription };

  const list = validFavourites(favourites, known);
  if (!list) return null;
  if (type === "subscribe") {
    return typeof locale === "string" && isLocale(locale) ? { type, abonnement: subscription, langue: locale, favoris: list } : null;
  }
  if (locale !== undefined && (typeof locale !== "string" || !isLocale(locale))) return null;
  return { type, abonnement: subscription, langue: locale ?? null, favoris: list };
}

// ── Recipients and messages ────────────────────────────────────────

export interface AdjustedPatch {
  version: string;
  adjustments: readonly { slug: string; type: AdjustmentType | null }[];
}

export interface TouchedHero {
  slug: string;
  type: AdjustmentType | null;
}

export interface Send {
  subscriber: Subscriber;
  keys: TouchedHero[];
}

/**
 * Subscribers to notify: those with at least one favourite among the patch
 * adjustments. Affected heroes follow the patch notes order; a hero listed
 * twice appears only once.
 */
export function recipients(subscribers: readonly Subscriber[], patch: AdjustedPatch): Send[] {
  const bySlug = new Map<string, TouchedHero>();
  for (const a of patch.adjustments) if (!bySlug.has(a.slug)) bySlug.set(a.slug, { slug: a.slug, type: a.type });
  const sends: Send[] = [];
  for (const subscriber of subscribers) {
    const favourites = new Set(subscriber.favoris);
    const keys = [...bySlug.values()].filter((h) => favourites.has(h.slug));
    if (keys.length) sends.push({ subscriber, keys });
  }
  return sends;
}

/** Notification content, sent encrypted to the service worker. */
export interface PushMessage {
  titre: string;
  corps: string;
  /** Path on the site, opened on click. */
  url: string;
  /** A single notification per patch: a second one replaces the first. */
  tag: string;
  langue: Locale;
}

/**
 * Writes a subscriber's notification, in their language. A single affected
 * hero: the title names it and a click opens the Stats tab of its page.
 * Several: the title counts them, the body names three and a click opens the patch.
 */
export function buildMessage(
  t: T,
  locale: Locale,
  version: string,
  keys: readonly TouchedHero[],
  names: Readonly<Record<string, string>>,
): PushMessage {
  const name = (slug: string) => names[slug] ?? slug;
  const tag = `patch-${version}`;
  if (keys.length === 1) {
    const [h] = keys;
    return {
      titre: t(`pushNotif.title.${h.type ?? "adjust"}`, { version, name: name(h.slug) }),
      corps: t("pushNotif.bodyOne"),
      url: `/${locale}/heroes/${h.slug}#stats`,
      tag,
      langue: locale,
    };
  }
  const rows = keys.slice(0, MAX_CITED_HEROES).map((h) =>
    t("pushNotif.row", {
      name: name(h.slug),
      type: h.type ? t(`patchHeroes.${h.type}`) : t("favourites.alert.changed"),
    }),
  );
  const rest = keys.length - MAX_CITED_HEROES;
  if (rest > 0) rows.push(t(rest > 1 ? "pushNotif.others" : "pushNotif.other", { n: rest }));
  return {
    titre: t("pushNotif.titleMany", { version, n: keys.length }),
    corps: rows.join("\n"),
    url: `/${locale}/patch-notes/${version}`,
    tag,
    langue: locale,
  };
}

/** Compares two patch versions ("2.1.88" > "1.9.47"). */
export function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

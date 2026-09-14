import { isLocale, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { AdjustmentType } from "@/lib/types";

/**
 * Notifications de patch : la partie sans effet de bord.
 *
 * Validation des demandes d'abonnement, choix des abonnes a prevenir pour un
 * patch et redaction des messages. Rien ici ne lit le disque ni le reseau :
 * le stockage et l'envoi vivent dans `push-serveur.ts`, ce qui garde ces
 * regles testables en isolation.
 */

/** Corps de requete maximal : un abonnement et 133 slugs tiennent en 3 Ko. */
export const SIZE_MAX_BODY = 6_000;
/** Plafond de favoris par abonnement, au-dela du roster actuel. */
export const MAX_FAVOURITES = 200;
/** Plafond d'abonnements conserves, pour qu'un script ne remplisse pas le disque. */
export const MAX_SUBSCRIBERS = 50_000;
/** Heros cites nommement dans une notification ; les suivants sont comptes. */
export const MAX_CITED_HEROES = 3;

/**
 * Services de notification des navigateurs. Le serveur envoie ses requetes a
 * l'adresse fournie par l'abonnement : la restreindre a ces hotes empeche
 * d'en faire un relais vers des adresses internes.
 */
const HOSTS_PUSH = [
  "fcm.googleapis.com", // Chrome, Edge Android, Opera, Samsung Internet, Brave
  "android.googleapis.com",
  "jmt17.google.com", // Chromium hors Google Chrome (distributions Linux…)
  ".push.services.mozilla.com", // Firefox
  ".notify.windows.com", // Edge sous Windows
  ".push.apple.com", // Safari (macOS, iOS en application installee)
];

export interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

/** Abonnement tel que `PushSubscription.toJSON()` le decrit, une fois valide. */
export interface StoredSubscription {
  endpoint: string;
  cles: SubscriptionKeys;
}

export interface Subscriber extends StoredSubscription {
  langue: Locale;
  favoris: string[];
  /** Dates ISO de creation et de derniere mise a jour. */
  cree: string;
  maj: string;
}

export function hostPushAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTS_PUSH.some((suffix) => (suffix.startsWith(".") ? h.endsWith(suffix) : h === suffix));
}

/** Adresse d'abonnement : https, sans identifiants ni port exotique, chez un service connu. */
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

/** Longueur en octets d'une chaine base64url, sans la decoder. */
function bytes(value: string): number {
  const withoutFill = value.replace(/=+$/, "");
  return Math.floor((withoutFill.length * 3) / 4);
}

/**
 * Cles de chiffrement : `p256dh` est un point P-256 non compresse (65 octets),
 * `auth` un secret de 16 octets. Toute autre forme est refusee.
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
 * Favoris : un tableau de slugs, dedoublonne. Une forme invalide refuse la
 * demande ; un slug bien forme mais absent du catalogue (heros retire, liste
 * ancienne) est simplement ecarte, pour ne pas bloquer l'abonnement.
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
 * Valide le corps d'une requete de l'API d'abonnement. Renvoie `null` des
 * qu'un champ manque ou sort de sa forme : la route repond alors 400.
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

// ── Destinataires et messages ──────────────────────────────────────

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
 * Abonnes a prevenir : ceux dont un favori au moins figure dans les
 * ajustements du patch. Les heros touches suivent l'ordre des notes de patch ;
 * un heros cite deux fois n'y figure qu'une fois.
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

/** Contenu d'une notification, transmis chiffre au service worker. */
export interface PushMessage {
  titre: string;
  corps: string;
  /** Chemin sur le site, ouvert au clic. */
  url: string;
  /** Une seule notification par patch : une seconde remplace la premiere. */
  tag: string;
  langue: Locale;
}

/**
 * Redige la notification d'un abonne, dans sa langue. Un seul heros touche :
 * le titre le nomme et le clic ouvre l'onglet Stats de sa fiche. Plusieurs :
 * le titre les compte, le corps en cite trois et le clic ouvre le patch.
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
      titre: t(`pushNotif.title.${h.type ?? "adjust"}`, { version, nom: name(h.slug) }),
      corps: t("pushNotif.bodyOne"),
      url: `/${locale}/heroes/${h.slug}#stats`,
      tag,
      langue: locale,
    };
  }
  const rows = keys.slice(0, MAX_CITED_HEROES).map((h) =>
    t("pushNotif.row", {
      nom: name(h.slug),
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

/** Compare deux versions de patch (« 2.1.88 » > « 1.9.47 »). */
export function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

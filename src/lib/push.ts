import { estLangue, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { TypeAjustement } from "@/lib/types";

/**
 * Notifications de patch : la partie sans effet de bord.
 *
 * Validation des demandes d'abonnement, choix des abonnes a prevenir pour un
 * patch et redaction des messages. Rien ici ne lit le disque ni le reseau :
 * le stockage et l'envoi vivent dans `push-serveur.ts`, ce qui garde ces
 * regles testables en isolation.
 */

/** Corps de requete maximal : un abonnement et 133 slugs tiennent en 3 Ko. */
export const TAILLE_MAX_CORPS = 6_000;
/** Plafond de favoris par abonnement, au-dela du roster actuel. */
export const MAX_FAVORIS = 200;
/** Plafond d'abonnements conserves, pour qu'un script ne remplisse pas le disque. */
export const MAX_ABONNES = 50_000;
/** Heros cites nommement dans une notification ; les suivants sont comptes. */
export const MAX_HEROS_CITES = 3;

/**
 * Services de notification des navigateurs. Le serveur envoie ses requetes a
 * l'adresse fournie par l'abonnement : la restreindre a ces hotes empeche
 * d'en faire un relais vers des adresses internes.
 */
const HOTES_PUSH = [
  "fcm.googleapis.com", // Chrome, Edge Android, Opera, Samsung Internet, Brave
  "android.googleapis.com",
  "jmt17.google.com", // Chromium hors Google Chrome (distributions Linux…)
  ".push.services.mozilla.com", // Firefox
  ".notify.windows.com", // Edge sous Windows
  ".push.apple.com", // Safari (macOS, iOS en application installee)
];

export interface ClesAbonnement {
  p256dh: string;
  auth: string;
}

/** Abonnement tel que `PushSubscription.toJSON()` le decrit, une fois valide. */
export interface AbonnementPush {
  endpoint: string;
  cles: ClesAbonnement;
}

export interface Abonne extends AbonnementPush {
  langue: Langue;
  favoris: string[];
  /** Dates ISO de creation et de derniere mise a jour. */
  cree: string;
  maj: string;
}

export function hotePushAutorise(hote: string): boolean {
  const h = hote.toLowerCase();
  return HOTES_PUSH.some((suffixe) => (suffixe.startsWith(".") ? h.endsWith(suffixe) : h === suffixe));
}

/** Adresse d'abonnement : https, sans identifiants ni port exotique, chez un service connu. */
export function endpointValide(brut: unknown): string | null {
  if (typeof brut !== "string" || brut.length > 1_024) return null;
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  return hotePushAutorise(url.hostname) ? url.href : null;
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Longueur en octets d'une chaine base64url, sans la decoder. */
function octets(valeur: string): number {
  const sansRemplissage = valeur.replace(/=+$/, "");
  return Math.floor((sansRemplissage.length * 3) / 4);
}

/**
 * Cles de chiffrement : `p256dh` est un point P-256 non compresse (65 octets),
 * `auth` un secret de 16 octets. Toute autre forme est refusee.
 */
function clesValides(brut: unknown): ClesAbonnement | null {
  if (typeof brut !== "object" || brut === null) return null;
  const { p256dh, auth } = brut as Record<string, unknown>;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (p256dh.length > 100 || auth.length > 40 || !BASE64URL.test(p256dh) || !BASE64URL.test(auth)) return null;
  if (octets(p256dh) !== 65 || octets(auth) !== 16) return null;
  return { p256dh, auth };
}

export function abonnementValide(brut: unknown): AbonnementPush | null {
  if (typeof brut !== "object" || brut === null) return null;
  const { endpoint, keys } = brut as Record<string, unknown>;
  const adresse = endpointValide(endpoint);
  const cles = clesValides(keys);
  return adresse && cles ? { endpoint: adresse, cles } : null;
}

const FORME_SLUG = /^[a-z0-9-]{1,40}$/;

/**
 * Favoris : un tableau de slugs, dedoublonne. Une forme invalide refuse la
 * demande ; un slug bien forme mais absent du catalogue (heros retire, liste
 * ancienne) est simplement ecarte, pour ne pas bloquer l'abonnement.
 */
export function favorisValides(brut: unknown, connus: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(brut) || brut.length > MAX_FAVORIS) return null;
  if (!brut.every((s) => typeof s === "string" && FORME_SLUG.test(s))) return null;
  return [...new Set(brut as string[])].filter((s) => connus.has(s));
}

export type DemandePush =
  | { type: "abonner"; abonnement: AbonnementPush; langue: Langue; favoris: string[] }
  | { type: "maj"; abonnement: AbonnementPush; langue: Langue | null; favoris: string[] }
  | { type: "desabonner"; abonnement: AbonnementPush };

/**
 * Valide le corps d'une requete de l'API d'abonnement. Renvoie `null` des
 * qu'un champ manque ou sort de sa forme : la route repond alors 400.
 */
export function validerDemande(
  type: DemandePush["type"],
  corps: unknown,
  connus: ReadonlySet<string>,
): DemandePush | null {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return null;
  const { abonnement: brut, langue, favoris } = corps as Record<string, unknown>;
  const abonnement = abonnementValide(brut);
  if (!abonnement) return null;
  if (type === "desabonner") return { type, abonnement };

  const liste = favorisValides(favoris, connus);
  if (!liste) return null;
  if (type === "abonner") {
    return typeof langue === "string" && estLangue(langue) ? { type, abonnement, langue, favoris: liste } : null;
  }
  if (langue !== undefined && (typeof langue !== "string" || !estLangue(langue))) return null;
  return { type, abonnement, langue: langue ?? null, favoris: liste };
}

// ── Destinataires et messages ──────────────────────────────────────

export interface PatchAjuste {
  version: string;
  adjustments: readonly { slug: string; type: TypeAjustement | null }[];
}

export interface HerosTouche {
  slug: string;
  type: TypeAjustement | null;
}

export interface Envoi {
  abonne: Abonne;
  touches: HerosTouche[];
}

/**
 * Abonnes a prevenir : ceux dont un favori au moins figure dans les
 * ajustements du patch. Les heros touches suivent l'ordre des notes de patch ;
 * un heros cite deux fois n'y figure qu'une fois.
 */
export function destinataires(abonnes: readonly Abonne[], patch: PatchAjuste): Envoi[] {
  const parSlug = new Map<string, HerosTouche>();
  for (const a of patch.adjustments) if (!parSlug.has(a.slug)) parSlug.set(a.slug, { slug: a.slug, type: a.type });
  const envois: Envoi[] = [];
  for (const abonne of abonnes) {
    const favoris = new Set(abonne.favoris);
    const touches = [...parSlug.values()].filter((h) => favoris.has(h.slug));
    if (touches.length) envois.push({ abonne, touches });
  }
  return envois;
}

/** Contenu d'une notification, transmis chiffre au service worker. */
export interface MessagePush {
  titre: string;
  corps: string;
  /** Chemin sur le site, ouvert au clic. */
  url: string;
  /** Une seule notification par patch : une seconde remplace la premiere. */
  tag: string;
  langue: Langue;
}

/**
 * Redige la notification d'un abonne, dans sa langue. Un seul heros touche :
 * le titre le nomme et le clic ouvre l'onglet Stats de sa fiche. Plusieurs :
 * le titre les compte, le corps en cite trois et le clic ouvre le patch.
 */
export function construireMessage(
  t: T,
  langue: Langue,
  version: string,
  touches: readonly HerosTouche[],
  noms: Readonly<Record<string, string>>,
): MessagePush {
  const nom = (slug: string) => noms[slug] ?? slug;
  const tag = `patch-${version}`;
  if (touches.length === 1) {
    const [h] = touches;
    return {
      titre: t(`pushNotif.title.${h.type ?? "ajustement"}`, { version, nom: nom(h.slug) }),
      corps: t("pushNotif.bodyOne"),
      url: `/${langue}/heroes/${h.slug}#stats`,
      tag,
      langue,
    };
  }
  const lignes = touches.slice(0, MAX_HEROS_CITES).map((h) =>
    t("pushNotif.row", {
      nom: nom(h.slug),
      type: h.type ? t(`patchHeroes.${h.type}`) : t("favourites.alert.changed"),
    }),
  );
  const reste = touches.length - MAX_HEROS_CITES;
  if (reste > 0) lignes.push(t(reste > 1 ? "pushNotif.others" : "pushNotif.other", { n: reste }));
  return {
    titre: t("pushNotif.titleMany", { version, n: touches.length }),
    corps: lignes.join("\n"),
    url: `/${langue}/patch-notes/${version}`,
    tag,
    langue,
  };
}

/** Compare deux versions de patch (« 2.1.88 » > « 1.9.47 »). */
export function comparerVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

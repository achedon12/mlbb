import type { Langue } from "@/i18n/config";

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
export type EtatNotifications =
  | "indisponible" // fonction desactivee sur le serveur : rien a afficher
  | "non-supporte"
  | "ios-installer" // iPhone et iPad : seulement une fois le site installe
  | "refuse"
  | "inactif"
  | "actif";

const DRAPEAU = "mlbb_push";

function lireDrapeau(): boolean {
  try {
    return localStorage.getItem(DRAPEAU) === "1";
  } catch {
    return false;
  }
}

function poserDrapeau(actif: boolean) {
  try {
    if (actif) localStorage.setItem(DRAPEAU, "1");
    else localStorage.removeItem(DRAPEAU);
  } catch {
    /* stockage indisponible : la synchronisation attendra la page des favoris */
  }
}

let cle: Promise<string | null> | null = null;

/** Cle publique VAPID, demandee une fois par chargement. */
export function clePublique(): Promise<string | null> {
  cle ??= fetch("/api/push", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { cle?: unknown } | null) => (typeof d?.cle === "string" ? d.cle : null))
    .catch(() => {
      cle = null; // hors ligne : on reessaiera
      return null;
    });
  return cle;
}

function estIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function estInstalle(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function supportNavigateur(): "ok" | "non-supporte" | "ios-installer" {
  // Safari sur iOS n'offre les notifications qu'aux sites installes sur l'ecran d'accueil.
  if (estIOS() && !estInstalle()) return "ios-installer";
  const complet = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return complet ? "ok" : "non-supporte";
}

/**
 * Enregistrement du service worker. En production, `HorsLigne` l'a deja fait.
 * En developpement, il n'est enregistre qu'a l'activation, sans son cache —
 * qui generait le rechargement a chaud (voir `public/sw.js`).
 */
async function enregistrement(creer: boolean): Promise<ServiceWorkerRegistration | null> {
  const existant = await navigator.serviceWorker.getRegistration("/");
  if (!existant && !creer) return null;
  if (!existant) await navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?cache=0");
  return creer ? navigator.serviceWorker.ready : (existant ?? null);
}

async function abonnementCourant(): Promise<PushSubscription | null> {
  const reg = await enregistrement(false);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Etat affiche par l'interrupteur, sans rien demander a l'utilisateur. */
export async function etatCourant(): Promise<EtatNotifications> {
  if (!(await clePublique())) return "indisponible";
  const support = supportNavigateur();
  if (support !== "ok") return support;
  if (Notification.permission === "denied") return "refuse";
  const actif = Notification.permission === "granted" && (await abonnementCourant()) !== null;
  if (actif) poserDrapeau(true);
  return actif ? "actif" : "inactif";
}

function octetsDe(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binaire = atob(base64);
  const octets = new Uint8Array(new ArrayBuffer(binaire.length));
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function memesOctets(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const vue = new Uint8Array(a);
  return vue.every((octet, i) => octet === b[i]);
}

function appeler(methode: "POST" | "PATCH" | "DELETE", corps: object): Promise<Response> {
  return fetch("/api/push/abonnement", {
    method: methode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}

/** Demande la permission, abonne le navigateur et confie l'abonnement au serveur. */
export async function activer(langue: Langue, favoris: readonly string[]): Promise<EtatNotifications> {
  const publique = await clePublique();
  if (!publique) return "indisponible";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "refuse";
  if (permission !== "granted") return "inactif";

  const reg = await enregistrement(true);
  if (!reg) throw new Error("service worker indisponible");
  const octets = octetsDe(publique);
  let abonnement = await reg.pushManager.getSubscription();
  // Cles changees sur le serveur : l'ancien abonnement ne recevrait plus rien.
  if (abonnement && !memesOctets(abonnement.options.applicationServerKey, octets)) {
    await abonnement.unsubscribe();
    abonnement = null;
  }
  abonnement ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets });

  const reponse = await appeler("POST", { abonnement: abonnement.toJSON(), langue, favoris });
  if (!reponse.ok) {
    await abonnement.unsubscribe().catch(() => {});
    throw new Error(`abonnement refuse (${reponse.status})`);
  }
  poserDrapeau(true);
  derniereSynchro = cleSynchro(langue, favoris);
  return "actif";
}

/** Desabonne le navigateur et efface l'abonnement du serveur. */
export async function desactiver(): Promise<EtatNotifications> {
  poserDrapeau(false);
  const abonnement = await abonnementCourant();
  if (abonnement) {
    // Si le serveur est injoignable, il effacera l'abonnement a son prochain envoi (410).
    await appeler("DELETE", { abonnement: abonnement.toJSON() }).catch(() => {});
    await abonnement.unsubscribe();
  }
  derniereSynchro = "";
  return "inactif";
}

const cleSynchro = (langue: Langue, favoris: readonly string[]) => `${langue}|${favoris.join(",")}`;
let derniereSynchro = "";
let minuteur: ReturnType<typeof setTimeout> | undefined;

/**
 * Repercute les favoris (et la langue) au serveur, si ce navigateur est
 * abonne. Appele a chaque changement : les appels rapproches se regroupent.
 */
export function synchroniser(langue: Langue, favoris: readonly string[]): void {
  if (!lireDrapeau() || cleSynchro(langue, favoris) === derniereSynchro) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    synchroniserMaintenant(langue, favoris).catch(() => {
      /* nouvel essai au prochain changement ou au prochain chargement */
    });
  }, 800);
}

async function synchroniserMaintenant(langue: Langue, favoris: readonly string[]) {
  if (supportNavigateur() !== "ok" || Notification.permission !== "granted" || !(await clePublique())) return;
  const abonnement = await abonnementCourant();
  if (!abonnement) return;
  const corps = { abonnement: abonnement.toJSON(), langue, favoris };
  let reponse = await appeler("PATCH", corps);
  // Abonnement efface cote serveur entre-temps : on le recree.
  if (reponse.status === 404) reponse = await appeler("POST", corps);
  if (reponse.ok) derniereSynchro = cleSynchro(langue, favoris);
}

/**
 * Connexion au compte de jeu.
 *
 * Moonton n'expose pas d'API, mais son flux officiel de connexion par code
 * existe : le jeu envoie un code a quatre chiffres dans la messagerie du
 * joueur, et ce code, valide cinq minutes, prouve qu'on possede le compte.
 * Une API communautaire relaie ce flux et renvoie un jeton d'acces.
 *
 * Tout passe par le serveur : le jeton n'est jamais expose au navigateur, et
 * aucun mot de passe n'est jamais demande ni transmis.
 */
const BASE = "https://arena.rone.dev/api/user";

/**
 * Sous-systeme d'authentification de Moonton.
 *
 * Distinct du battle-report : c'est le service qui gere les comptes, et il
 * reste en ligne quand les statistiques de partie sont coupees. Le jeton
 * obtenu par le flux de connexion y est directement accepte.
 */
const MOONTON = "https://sg-api.mobilelegends.com/base";
const X_ACTID = "2728785";
const X_APPID = "2713644";
const NAVIGATEUR =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const UA = "MLBB.fr/1.0 (+https://mlbb.leoderoin.fr)";

export interface Ami {
  nom: string;
  /** Chemin de l'avatar sur le CDN, ou null pour l'avatar par defaut. */
  avatar: string | null;
}

export interface Profil {
  roleId: number;
  zoneId: number;
  name: string;
  level: number;
  rangActuel: number;
  rangMax: number;
  pays: string;
  avatar: string | null;
}

async function appel(chemin: string, options: RequestInit = {}) {
  return fetch(`${BASE}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
}

/**
 * Demande l'envoi d'un code de verification dans la messagerie du joueur.
 * Ne revele pas si le compte existe : un identifiant inconnu echoue au meme
 * titre qu'un service indisponible, sans distinction exploitable.
 */
export async function envoyerCode(
  roleId: number,
  zoneId: number,
): Promise<{ ok: boolean; raison?: string }> {
  try {
    const reponse = await appel("/auth/send-vc", {
      method: "POST",
      body: JSON.stringify({ role_id: roleId, zone_id: zoneId }),
    });

    const donnees = (await reponse.json()) as { code?: number; message?: string };
    if (reponse.ok && donnees.code === 0) return { ok: true };

    // errorInvalidZoneId / role null : la saisie ne correspond a aucun compte.
    return { ok: false, raison: "Aucun compte ne correspond a cet identifiant et ce serveur." };
  } catch {
    return { ok: false, raison: "Le service est momentanement indisponible." };
  }
}

/**
 * Echange le code contre un jeton d'acces.
 * Le jeton est un JWT signe par le service, valide plusieurs jours.
 */
export async function connecter(
  roleId: number,
  zoneId: number,
  code: number,
): Promise<{ ok: true; jeton: string } | { ok: false; raison: string }> {
  try {
    const reponse = await appel("/auth/login", {
      method: "POST",
      body: JSON.stringify({ role_id: roleId, zone_id: zoneId, vc: code }),
    });

    const donnees = (await reponse.json()) as {
      code?: number;
      data?: { jwt?: string };
    };

    if (reponse.ok && donnees.code === 0 && donnees.data?.jwt) {
      return { ok: true, jeton: donnees.data.jwt };
    }
    return { ok: false, raison: "Code incorrect ou expire." };
  } catch {
    return { ok: false, raison: "Le service est momentanement indisponible." };
  }
}

/**
 * Etat d'une reponse authentifiee.
 *
 * Trois cas se distinguent, parce qu'ils appellent des reactions differentes :
 * la session a expire (il faut deconnecter), la donnee existe, ou la source
 * Moonton est ponctuellement coupee — ce qu'elle signale par un code a elle,
 * et qui ne doit pas passer pour une panne du site.
 */
export type Resultat<T> =
  | { etat: "ok"; donnees: T }
  | { etat: "expire" }
  | { etat: "indisponible" };

async function authentifie<T>(
  chemin: string,
  jeton: string,
  transformer: (data: unknown) => T,
): Promise<Resultat<T>> {
  try {
    const reponse = await appel(chemin, { headers: { Authorization: `Bearer ${jeton}` } });

    if (reponse.status === 401) return { etat: "expire" };
    if (!reponse.ok) return { etat: "indisponible" };

    const enveloppe = (await reponse.json()) as { code?: number; data?: unknown };
    // 10407 : l'endpoint Moonton relaye est momentanement hors service.
    if (enveloppe.code === 10407 || enveloppe.data == null) return { etat: "indisponible" };

    return { etat: "ok", donnees: transformer(enveloppe.data) };
  } catch {
    return { etat: "indisponible" };
  }
}

/** Profil de base : ce qui reste accessible meme quand les stats sont coupees. */
export function profil(jeton: string): Promise<Resultat<Profil>> {
  return authentifie("/info?lang=en", jeton, (data) => {
    const d = data as Record<string, unknown>;
    return {
      roleId: Number(d.roleId),
      zoneId: Number(d.zoneId),
      name: String(d.name ?? ""),
      level: Number(d.level ?? 0),
      rangActuel: Number(d.rank_level ?? 0),
      rangMax: Number(d.history_rank_level ?? 0),
      pays: String(d.reg_country ?? ""),
      avatar: d.avatar ? String(d.avatar) : null,
    } satisfies Profil;
  });
}

/** Statistiques detaillees. Souvent indisponibles : la source Moonton coupe. */
export function statistiques(jeton: string): Promise<Resultat<Record<string, unknown>>> {
  return authentifie("/stats?lang=en", jeton, (data) => data as Record<string, unknown>);
}

/**
 * Liste d'amis du joueur.
 *
 * Le battle-report expose aussi les amis, mais il est hors ligne ; cette
 * route-ci, sur le sous-systeme d'authentification, renvoie les noms et les
 * avatars. Les identifiants y sont hachés — on ne peut donc pas lier un ami a
 * sa fiche, seulement l'afficher.
 */
export async function amis(jeton: string): Promise<Resultat<Ami[]>> {
  const { roleId, zoneId } = identite(jeton);
  try {
    const reponse = await fetch(`${MOONTON}/getFriendList`, {
      method: "POST",
      headers: {
        authorization: jeton,
        "x-token": jeton,
        "x-actid": X_ACTID,
        "x-appid": X_APPID,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://www.mobilelegends.com",
        Referer: "https://www.mobilelegends.com/",
        "User-Agent": NAVIGATEUR,
      },
      body: new URLSearchParams({
        roleId: String(roleId),
        zoneId: String(zoneId),
      }).toString(),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (reponse.status === 401) return { etat: "expire" };
    if (!reponse.ok) return { etat: "indisponible" };

    const enveloppe = (await reponse.json()) as {
      code?: number;
      data?: Array<{ sName?: string; sFacePath?: string }>;
    };
    if (enveloppe.code !== 0 || !Array.isArray(enveloppe.data)) {
      return { etat: "indisponible" };
    }

    const liste = enveloppe.data.map((a) => ({
      nom: String(a.sName ?? ""),
      avatar: a.sFacePath
        ? `https://akmpicture.youngjoygame.com/${a.sFacePath}`
        : null,
    }));
    return { etat: "ok", donnees: liste };
  } catch {
    return { etat: "indisponible" };
  }
}

/** Charge utile du JWT (claim `Ext`), sans verification de signature. */
function charge(jeton: string): Record<string, unknown> {
  try {
    const p = jeton.split(".")[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return {};
  }
}

/** Identifiant et serveur portes par le jeton. */
export function identite(jeton: string): { roleId: number; zoneId: number } {
  const ext = (charge(jeton).Ext ?? {}) as Record<string, unknown>;
  return { roleId: Number(ext.roleId ?? 0), zoneId: Number(ext.zoneId ?? 0) };
}

/** Lit `exp` du JWT sans en verifier la signature — seul le service la connait. */
export function expiration(jeton: string): number | null {
  const exp = charge(jeton).exp;
  return typeof exp === "number" ? exp : null;
}

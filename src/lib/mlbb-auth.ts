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
import { createHash } from "node:crypto";
import {
  IDENTIFIANT,
  lireDetailPartie,
  lireHerosFrequents,
  lireJson,
  lireParties,
  lireStats,
  saisonsDe,
  type HerosFrequent,
  type Page,
  type Participant,
  type PartieResume,
  type StatsJoueur,
} from "@/lib/joueur-api";
import { journaliserErreur } from "@/lib/journal";

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

const UA = "MLBBDex/1.0 (+https://mlbbdex.com)";

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
    // Les raisons sont des cles du catalogue : le formulaire les traduit.
    return { ok: false, raison: "loginForm.erreurs.inconnu" };
  } catch (e) {
    void journaliserErreur("envoi du code de verification", e);
    return { ok: false, raison: "loginForm.erreurs.indisponible" };
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
    return { ok: false, raison: "loginForm.erreurs.codeIncorrect" };
  } catch (e) {
    void journaliserErreur("echange du code contre un jeton", e);
    return { ok: false, raison: "loginForm.erreurs.indisponible" };
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

    // Lu en texte : curseurs et identifiants de partie depassent la precision
    // des nombres, `lireJson` les garde en chaines.
    const enveloppe = (lireJson(await reponse.text()) ?? {}) as { code?: unknown; data?: unknown };
    // 10407 : l'endpoint Moonton relaye est momentanement hors service. Tout
    // autre code non nul dit de meme qu'il n'y a rien d'exploitable.
    if ((typeof enveloppe.code === "number" && enveloppe.code !== 0) || enveloppe.data == null) {
      return { etat: "indisponible" };
    }

    return { etat: "ok", donnees: transformer(enveloppe.data) };
  } catch (e) {
    void journaliserErreur("appel authentifie au service Moonton", e);
    return { etat: "indisponible" };
  }
}

/**
 * Memoire courte des reponses authentifiees.
 *
 * Une visite du profil appelle le service une quinzaine de fois — saisons,
 * heros, parties, puis le detail des dernieres parties. Recharger la page ou
 * paginer ne doit pas tout redemander : chaque reponse reussie est gardee
 * quelques minutes en memoire du serveur, sous une cle derivee du jeton —
 * jamais le jeton lui-meme. Rien n'est ecrit sur disque ni partage entre
 * joueurs, et un echec n'est jamais retenu. Deux appels simultanes au meme
 * chemin partagent la meme requete.
 */
const MEMOIRE = new Map<string, { fin: number; valeur: Promise<Resultat<unknown>> }>();
const MEMOIRE_MAX = 500;

function memoriser<T>(
  jeton: string,
  chemin: string,
  secondes: number,
  appeler: () => Promise<Resultat<T>>,
): Promise<Resultat<T>> {
  const cle = `${createHash("sha256").update(jeton).digest("base64url")}${chemin}`;
  const maintenant = Date.now();
  const connue = MEMOIRE.get(cle);
  if (connue && connue.fin > maintenant) return connue.valeur as Promise<Resultat<T>>;

  const valeur = appeler();
  MEMOIRE.delete(cle);
  MEMOIRE.set(cle, { fin: maintenant + secondes * 1000, valeur });
  void valeur.then((r) => {
    if (r.etat !== "ok" && MEMOIRE.get(cle)?.valeur === valeur) MEMOIRE.delete(cle);
  });
  // Au-dela du plafond, les entrees les plus anciennes sortent les premieres.
  for (const ancienne of MEMOIRE.keys()) {
    if (MEMOIRE.size <= MEMOIRE_MAX) break;
    MEMOIRE.delete(ancienne);
  }
  return valeur;
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

/** Statistiques d'ensemble, sur les saisons que le service a gardees. Souvent coupees. */
export function statistiques(jeton: string): Promise<Resultat<StatsJoueur>> {
  return memoriser(jeton, "/stats", 300, () => authentifie("/stats?lang=en", jeton, lireStats));
}

/** Saisons ou le joueur a des parties, de la plus recente a la plus ancienne. */
export function saisons(jeton: string): Promise<Resultat<number[]>> {
  return memoriser(jeton, "/season", 3600, () => authentifie("/season?lang=en", jeton, saisonsDe));
}

const saisonValide = (s: number) => Number.isInteger(s) && s > 0 && s < 1000;

/** Une page de parties de la saison, des plus recentes aux plus anciennes. */
export function pageParties(
  jeton: string,
  saison: number,
  curseur: string | null,
  limite = 20,
): Promise<Resultat<Page<PartieResume>>> {
  if (!saisonValide(saison) || (curseur !== null && !IDENTIFIANT.test(curseur))) {
    return Promise.resolve({ etat: "indisponible" });
  }
  const requete = new URLSearchParams({ sid: String(saison), limit: String(limite), lang: "en" });
  if (curseur) requete.set("last_cursor", curseur);
  const chemin = `/matches?${requete}`;
  return memoriser(jeton, chemin, 120, () => authentifie(chemin, jeton, lireParties));
}

/** Parties lues au plus pour l'evolution de la saison : cinq pages de vingt. */
export const HISTORIQUE_MAX = 100;
/** Pages suivies au plus, si le service rendait moins de vingt parties par page. */
const PAGES_HISTORIQUE_MAX = 10;
/** Au-dela, l'historique s'arrete sur ce qui est lu : la section ne doit pas faire attendre. */
const HISTORIQUE_BUDGET_MS = 8000;

/** La promesse, ou null si elle n'a pas abouti dans le delai. Elle continue sans nous : sa reponse ira en memoire. */
function dansLeDelai<T>(promesse: Promise<T>, ms: number): Promise<T | null> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<null>((r) => {
    minuterie = setTimeout(() => r(null), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuterie));
}

/**
 * Parties recentes de la saison, pages enchainees, jusqu'a `max`.
 *
 * Le curseur de chaque page vient de la precedente : les pages ne peuvent pas
 * etre demandees en parallele. Elles passent par la meme memoire que la liste
 * des parties — la premiere est deja lue par la page, les suivantes servent
 * aussi le bouton « parties plus anciennes ». Un budget de temps borne
 * l'attente ; une page qui manque en cours de route arrete la lecture sur ce
 * qui est acquis. `fin` dit si le debut de la saison a ete atteint.
 */
export async function historiqueParties(
  jeton: string,
  saison: number,
  max = HISTORIQUE_MAX,
  budget = HISTORIQUE_BUDGET_MS,
): Promise<Resultat<{ parties: PartieResume[]; fin: boolean }>> {
  if (!saisonValide(saison)) return { etat: "indisponible" };
  const debut = Date.now();
  const vues = new Set<string>();
  const parties: PartieResume[] = [];
  let curseur: string | null = null;

  for (let page = 0; page < PAGES_HISTORIQUE_MAX && parties.length < max; page++) {
    const demande = pageParties(jeton, saison, curseur);
    // La premiere page est attendue sans limite : sans elle, il n'y a rien a montrer.
    const r = page === 0 ? await demande : await dansLeDelai(demande, budget - (Date.now() - debut));
    if (r === null) break;
    if (r.etat !== "ok") {
      if (r.etat === "expire" || page === 0) return r;
      break;
    }
    for (const p of r.donnees.entrees) {
      if (vues.has(p.id)) continue;
      vues.add(p.id);
      parties.push(p);
    }
    // Un curseur qui ne change pas relancerait la meme page sans fin.
    if (!r.donnees.suivant || r.donnees.suivant === curseur) {
      return { etat: "ok", donnees: { parties: parties.slice(0, max), fin: parties.length <= max } };
    }
    curseur = r.donnees.suivant;
  }
  return { etat: "ok", donnees: { parties: parties.slice(0, max), fin: false } };
}

/** Pages de heros suivies au plus : bien plus que le nombre de heros du jeu. */
const PAGES_HEROS_MAX = 5;
const HEROS_PAR_PAGE = 30;

/**
 * Tous les heros joues dans la saison, pages enchainees.
 *
 * Leur somme donne le bilan de la saison, que le service ne fournit pas tout
 * fait. Si une page intermediaire manque, on garde ce qui a ete lu et on le
 * signale : le bilan est alors un minimum, pas un total.
 */
export async function herosDeLaSaison(
  jeton: string,
  saison: number,
): Promise<Resultat<{ heros: HerosFrequent[]; complet: boolean }>> {
  if (!saisonValide(saison)) return { etat: "indisponible" };
  const vus = new Set<number>();
  const heros: HerosFrequent[] = [];
  let curseur: string | null = null;

  for (let page = 0; page < PAGES_HEROS_MAX; page++) {
    const requete = new URLSearchParams({ sid: String(saison), limit: String(HEROS_PAR_PAGE), lang: "en" });
    if (curseur) requete.set("last_cursor", curseur);
    const chemin = `/heroes/frequent?${requete}`;
    const r = await memoriser(jeton, chemin, 300, () => authentifie(chemin, jeton, lireHerosFrequents));

    if (r.etat !== "ok") {
      if (r.etat === "expire" || page === 0) return r;
      return { etat: "ok", donnees: { heros, complet: false } };
    }
    for (const h of r.donnees.entrees) {
      if (vus.has(h.heros.hid)) continue;
      vus.add(h.heros.hid);
      heros.push(h);
    }
    // Un curseur qui ne change pas relancerait la meme page sans fin.
    if (!r.donnees.suivant || r.donnees.suivant === curseur) {
      return { etat: "ok", donnees: { heros, complet: true } };
    }
    curseur = r.donnees.suivant;
  }
  return { etat: "ok", donnees: { heros, complet: false } };
}

/** Detail d'une partie : ses participants, equipes comprises. Une partie jouee ne change plus. */
export function detailPartie(jeton: string, saison: number, id: string): Promise<Resultat<Participant[]>> {
  if (!saisonValide(saison) || !IDENTIFIANT.test(id)) return Promise.resolve({ etat: "indisponible" });
  const chemin = `/matches/${id}?sid=${saison}&lang=en`;
  return memoriser(jeton, chemin, 6 * 3600, () => authentifie(chemin, jeton, lireDetailPartie));
}

/**
 * Detail de plusieurs parties, quatre appels a la fois pour menager le
 * service. Une partie dont le detail manque est simplement absente du
 * resultat ; une session expiree interrompt tout.
 */
export async function detailsParties(
  jeton: string,
  parties: { id: string; saison: number }[],
): Promise<Resultat<Map<string, Participant[]>>> {
  const sortie = new Map<string, Participant[]>();
  const file = [...parties];
  let expire = false;

  const ouvrier = async () => {
    for (let p = file.shift(); p && !expire; p = file.shift()) {
      const r = await detailPartie(jeton, p.saison, p.id);
      if (r.etat === "expire") expire = true;
      else if (r.etat === "ok" && r.donnees.length > 0) sortie.set(p.id, r.donnees);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, file.length) }, ouvrier));

  if (expire) return { etat: "expire" };
  return sortie.size > 0 || parties.length === 0 ? { etat: "ok", donnees: sortie } : { etat: "indisponible" };
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
  } catch (e) {
    void journaliserErreur("appel authentifie au service Moonton", e);
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

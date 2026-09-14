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
  ID,
  readDetailMatch,
  readFrequentHeroes,
  readJson,
  readMatches,
  readStats,
  seasonsOf,
  type FrequentHero,
  type Page,
  type Participant,
  type MatchSummary,
  type StatsPlayer,
} from "@/lib/player-api";
import { logError } from "@/lib/log";

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
const BROWSER =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const UA = "MLBBDex/1.0 (+https://mlbbdex.com)";

export interface Friend {
  nom: string;
  /** Chemin de l'avatar sur le CDN, ou null pour l'avatar par defaut. */
  avatar: string | null;
}

export interface Profile {
  roleId: number;
  zoneId: number;
  name: string;
  level: number;
  rankCurrent: number;
  rankMax: number;
  country: string;
  avatar: string | null;
}

async function apiCall(path: string, options: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
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
export async function sendCode(
  roleId: number,
  zoneId: number,
): Promise<{ ok: boolean; raison?: string }> {
  try {
    const response = await apiCall("/auth/send-vc", {
      method: "POST",
      body: JSON.stringify({ role_id: roleId, zone_id: zoneId }),
    });

    const data = (await response.json()) as { code?: number; message?: string };
    if (response.ok && data.code === 0) return { ok: true };

    // errorInvalidZoneId / role null : la saisie ne correspond a aucun compte.
    // Les raisons sont des cles du catalogue : le formulaire les traduit.
    return { ok: false, raison: "loginForm.errors.unknown" };
  } catch (e) {
    void logError("envoi du code de verification", e);
    return { ok: false, raison: "loginForm.errors.unavailable" };
  }
}

/**
 * Echange le code contre un jeton d'acces.
 * Le jeton est un JWT signe par le service, valide plusieurs jours.
 */
export async function connect(
  roleId: number,
  zoneId: number,
  code: number,
): Promise<{ ok: true; jeton: string } | { ok: false; raison: string }> {
  try {
    const response = await apiCall("/auth/login", {
      method: "POST",
      body: JSON.stringify({ role_id: roleId, zone_id: zoneId, vc: code }),
    });

    const data = (await response.json()) as {
      code?: number;
      data?: { jwt?: string };
    };

    if (response.ok && data.code === 0 && data.data?.jwt) {
      return { ok: true, jeton: data.data.jwt };
    }
    return { ok: false, raison: "loginForm.errors.wrongCode" };
  } catch (e) {
    void logError("echange du code contre un jeton", e);
    return { ok: false, raison: "loginForm.errors.unavailable" };
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
export type Result<T> =
  | { etat: "ok"; donnees: T }
  | { etat: "expired" }
  | { etat: "unavailable" };

async function authenticated<T>(
  path: string,
  token: string,
  transform: (data: unknown) => T,
): Promise<Result<T>> {
  try {
    const response = await apiCall(path, { headers: { Authorization: `Bearer ${token}` } });

    if (response.status === 401) return { etat: "expired" };
    if (!response.ok) return { etat: "unavailable" };

    // Lu en texte : curseurs et identifiants de partie depassent la precision
    // des nombres, `lireJson` les garde en chaines.
    const envelope = (readJson(await response.text()) ?? {}) as { code?: unknown; data?: unknown };
    // 10407 : l'endpoint Moonton relaye est momentanement hors service. Tout
    // autre code non nul dit de meme qu'il n'y a rien d'exploitable.
    if ((typeof envelope.code === "number" && envelope.code !== 0) || envelope.data == null) {
      return { etat: "unavailable" };
    }

    return { etat: "ok", donnees: transform(envelope.data) };
  } catch (e) {
    void logError("appel authentifie au service Moonton", e);
    return { etat: "unavailable" };
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
const MEMORY = new Map<string, { end: number; value: Promise<Result<unknown>> }>();
const MEMORY_MAX = 500;

function remember<T>(
  token: string,
  path: string,
  seconds: number,
  call: () => Promise<Result<T>>,
): Promise<Result<T>> {
  const key = `${createHash("sha256").update(token).digest("base64url")}${path}`;
  const now = Date.now();
  const known = MEMORY.get(key);
  if (known && known.end > now) return known.value as Promise<Result<T>>;

  const value = call();
  MEMORY.delete(key);
  MEMORY.set(key, { end: now + seconds * 1000, value });
  void value.then((r) => {
    if (r.etat !== "ok" && MEMORY.get(key)?.value === value) MEMORY.delete(key);
  });
  // Au-dela du plafond, les entrees les plus anciennes sortent les premieres.
  for (const old of MEMORY.keys()) {
    if (MEMORY.size <= MEMORY_MAX) break;
    MEMORY.delete(old);
  }
  return value;
}

/** Profil de base : ce qui reste accessible meme quand les stats sont coupees. */
export function profile(token: string): Promise<Result<Profile>> {
  return authenticated("/info?lang=en", token, (data) => {
    const d = data as Record<string, unknown>;
    return {
      roleId: Number(d.roleId),
      zoneId: Number(d.zoneId),
      name: String(d.name ?? ""),
      level: Number(d.level ?? 0),
      rankCurrent: Number(d.rank_level ?? 0),
      rankMax: Number(d.history_rank_level ?? 0),
      country: String(d.reg_country ?? ""),
      avatar: d.avatar ? String(d.avatar) : null,
    } satisfies Profile;
  });
}

/** Statistiques d'ensemble, sur les saisons que le service a gardees. Souvent coupees. */
export function statistics(token: string): Promise<Result<StatsPlayer>> {
  return remember(token, "/stats", 300, () => authenticated("/stats?lang=en", token, readStats));
}

/** Saisons ou le joueur a des parties, de la plus recente a la plus ancienne. */
export function seasons(token: string): Promise<Result<number[]>> {
  return remember(token, "/season", 3600, () => authenticated("/season?lang=en", token, seasonsOf));
}

const seasonValid = (s: number) => Number.isInteger(s) && s > 0 && s < 1000;

/** Une page de parties de la saison, des plus recentes aux plus anciennes. */
export function pageMatches(
  token: string,
  season: number,
  cursor: string | null,
  limit = 20,
): Promise<Result<Page<MatchSummary>>> {
  if (!seasonValid(season) || (cursor !== null && !ID.test(cursor))) {
    return Promise.resolve({ etat: "unavailable" });
  }
  const request = new URLSearchParams({ sid: String(season), limit: String(limit), lang: "en" });
  if (cursor) request.set("last_cursor", cursor);
  const path = `/matches?${request}`;
  return remember(token, path, 120, () => authenticated(path, token, readMatches));
}

/** Parties lues au plus pour l'evolution de la saison : cinq pages de vingt. */
export const HISTORY_MAX = 100;
/** Pages suivies au plus, si le service rendait moins de vingt parties par page. */
const PAGES_HISTORY_MAX = 10;
/** Au-dela, l'historique s'arrete sur ce qui est lu : la section ne doit pas faire attendre. */
const HISTORY_BUDGET_MS = 8000;

/** La promesse, ou null si elle n'a pas abouti dans le delai. Elle continue sans nous : sa reponse ira en memoire. */
function inDelay<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const delay = new Promise<null>((r) => {
    timer = setTimeout(() => r(null), ms);
  });
  return Promise.race([promise, delay]).finally(() => clearTimeout(timer));
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
export async function historyMatches(
  token: string,
  season: number,
  max = HISTORY_MAX,
  budget = HISTORY_BUDGET_MS,
): Promise<Result<{ matches: MatchSummary[]; end: boolean }>> {
  if (!seasonValid(season)) return { etat: "unavailable" };
  const start = Date.now();
  const views = new Set<string>();
  const matches: MatchSummary[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < PAGES_HISTORY_MAX && matches.length < max; page++) {
    const request = pageMatches(token, season, cursor);
    // La premiere page est attendue sans limite : sans elle, il n'y a rien a montrer.
    const r = page === 0 ? await request : await inDelay(request, budget - (Date.now() - start));
    if (r === null) break;
    if (r.etat !== "ok") {
      if (r.etat === "expired" || page === 0) return r;
      break;
    }
    for (const p of r.donnees.entries) {
      if (views.has(p.id)) continue;
      views.add(p.id);
      matches.push(p);
    }
    // Un curseur qui ne change pas relancerait la meme page sans fin.
    if (!r.donnees.next || r.donnees.next === cursor) {
      return { etat: "ok", donnees: { matches: matches.slice(0, max), end: matches.length <= max } };
    }
    cursor = r.donnees.next;
  }
  return { etat: "ok", donnees: { matches: matches.slice(0, max), end: false } };
}

/** Pages de heros suivies au plus : bien plus que le nombre de heros du jeu. */
const MAX_HERO_PAGES = 5;
const HEROES_PER_PAGE = 30;

/**
 * Tous les heros joues dans la saison, pages enchainees.
 *
 * Leur somme donne le bilan de la saison, que le service ne fournit pas tout
 * fait. Si une page intermediaire manque, on garde ce qui a ete lu et on le
 * signale : le bilan est alors un minimum, pas un total.
 */
export async function seasonHeroes(
  token: string,
  season: number,
): Promise<Result<{ heroes: FrequentHero[]; full: boolean }>> {
  if (!seasonValid(season)) return { etat: "unavailable" };
  const seen = new Set<number>();
  const heroes: FrequentHero[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_HERO_PAGES; page++) {
    const request = new URLSearchParams({ sid: String(season), limit: String(HEROES_PER_PAGE), lang: "en" });
    if (cursor) request.set("last_cursor", cursor);
    const path = `/heroes/frequent?${request}`;
    const r = await remember(token, path, 300, () => authenticated(path, token, readFrequentHeroes));

    if (r.etat !== "ok") {
      if (r.etat === "expired" || page === 0) return r;
      return { etat: "ok", donnees: { heroes, full: false } };
    }
    for (const h of r.donnees.entries) {
      if (seen.has(h.hero.hid)) continue;
      seen.add(h.hero.hid);
      heroes.push(h);
    }
    // Un curseur qui ne change pas relancerait la meme page sans fin.
    if (!r.donnees.next || r.donnees.next === cursor) {
      return { etat: "ok", donnees: { heroes, full: true } };
    }
    cursor = r.donnees.next;
  }
  return { etat: "ok", donnees: { heroes, full: false } };
}

/** Detail d'une partie : ses participants, equipes comprises. Une partie jouee ne change plus. */
export function detailMatch(token: string, season: number, id: string): Promise<Result<Participant[]>> {
  if (!seasonValid(season) || !ID.test(id)) return Promise.resolve({ etat: "unavailable" });
  const path = `/matches/${id}?sid=${season}&lang=en`;
  return remember(token, path, 6 * 3600, () => authenticated(path, token, readDetailMatch));
}

/**
 * Detail de plusieurs parties, quatre appels a la fois pour menager le
 * service. Une partie dont le detail manque est simplement absente du
 * resultat ; une session expiree interrompt tout.
 */
export async function detailsMatches(
  token: string,
  matches: { id: string; season: number }[],
): Promise<Result<Map<string, Participant[]>>> {
  const output = new Map<string, Participant[]>();
  const file = [...matches];
  let expire = false;

  const worker = async () => {
    for (let p = file.shift(); p && !expire; p = file.shift()) {
      const r = await detailMatch(token, p.season, p.id);
      if (r.etat === "expired") expire = true;
      else if (r.etat === "ok" && r.donnees.length > 0) output.set(p.id, r.donnees);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, file.length) }, worker));

  if (expire) return { etat: "expired" };
  return output.size > 0 || matches.length === 0 ? { etat: "ok", donnees: output } : { etat: "unavailable" };
}

/**
 * Liste d'amis du joueur.
 *
 * Le battle-report expose aussi les amis, mais il est hors ligne ; cette
 * route-ci, sur le sous-systeme d'authentification, renvoie les noms et les
 * avatars. Les identifiants y sont hachés — on ne peut donc pas lier un ami a
 * sa fiche, seulement l'afficher.
 */
export async function friends(token: string): Promise<Result<Friend[]>> {
  const { roleId, zoneId } = identity(token);
  try {
    const response = await fetch(`${MOONTON}/getFriendList`, {
      method: "POST",
      headers: {
        authorization: token,
        "x-token": token,
        "x-actid": X_ACTID,
        "x-appid": X_APPID,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://www.mobilelegends.com",
        Referer: "https://www.mobilelegends.com/",
        "User-Agent": BROWSER,
      },
      body: new URLSearchParams({
        roleId: String(roleId),
        zoneId: String(zoneId),
      }).toString(),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (response.status === 401) return { etat: "expired" };
    if (!response.ok) return { etat: "unavailable" };

    const envelope = (await response.json()) as {
      code?: number;
      data?: Array<{ sName?: string; sFacePath?: string }>;
    };
    if (envelope.code !== 0 || !Array.isArray(envelope.data)) {
      return { etat: "unavailable" };
    }

    const list = envelope.data.map((a) => ({
      nom: String(a.sName ?? ""),
      avatar: a.sFacePath
        ? `https://akmpicture.youngjoygame.com/${a.sFacePath}`
        : null,
    }));
    return { etat: "ok", donnees: list };
  } catch (e) {
    void logError("appel authentifie au service Moonton", e);
    return { etat: "unavailable" };
  }
}

/** Charge utile du JWT (claim `Ext`), sans verification de signature. */
function load(token: string): Record<string, unknown> {
  try {
    const p = token.split(".")[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return {};
  }
}

/** Identifiant et serveur portes par le jeton. */
export function identity(token: string): { roleId: number; zoneId: number } {
  const ext = (load(token).Ext ?? {}) as Record<string, unknown>;
  return { roleId: Number(ext.roleId ?? 0), zoneId: Number(ext.zoneId ?? 0) };
}

/** Lit `exp` du JWT sans en verifier la signature — seul le service la connait. */
export function expiration(token: string): number | null {
  const exp = load(token).exp;
  return typeof exp === "number" ? exp : null;
}

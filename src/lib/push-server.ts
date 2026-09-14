import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import webpush from "web-push";
import { LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data-client";
import { log, logError } from "@/lib/log";
import {
  MAX_SUBSCRIBERS,
  compareVersions,
  buildMessage,
  recipients,
  type Subscriber,
  type StoredSubscription,
  type PushMessage,
  type AdjustedPatch,
} from "@/lib/push";

/**
 * Notifications de patch : stockage des abonnements et envoi.
 *
 * Le site n'a pas de base de donnees : les abonnements tiennent dans un
 * fichier JSON du dossier `DONNEES_DIR`, reecrit en entier a chaque
 * changement — fichier temporaire puis renommage, pour qu'un arret brutal ne
 * laisse jamais un fichier a moitie ecrit. Les ecritures passent l'une apres
 * l'autre dans une file, le serveur etant un processus unique.
 *
 * Le dernier patch notifie est garde a cote : un redemarrage ne renvoie
 * jamais les notifications d'un patch deja annonce.
 */

// ── Configuration ──────────────────────────────────────────────────

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let configWarned = false;

/**
 * Cles VAPID lues dans l'environnement, a l'execution : l'image n'a pas a les
 * connaitre au build. Sans elles, la fonction est simplement absente.
 */
export function configPush(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey && !privateKey && !subject) return null;
  const valid =
    /^[A-Za-z0-9_-]{80,100}$/.test(publicKey) && /^[A-Za-z0-9_-]{40,50}$/.test(privateKey) && /^(mailto:|https:\/\/)/.test(subject);
  if (!valid) {
    if (!configWarned) {
      configWarned = true;
      void log("warning", "notifications : cles VAPID incompletes ou mal formees, fonction desactivee");
    }
    return null;
  }
  return { publicKey, privateKey, subject };
}

// DONNEES_DIR is the former name of DATA_DIR, still read as a fallback: the
// production server may still set only the old name.
const folder = () => (process.env.DATA_DIR ?? process.env.DONNEES_DIR)?.trim() || "donnees-serveur";
const fileSubscribers = () => join(folder(), "push-abonnements.json");
const fileState = () => join(folder(), "push-etat.json");

// ── Fichiers ───────────────────────────────────────────────────────

export class ErrorStorage extends Error {}

async function readJson<T>(filePath: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ErrorStorage(`lecture impossible : ${filePath}`, { cause: error });
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    // Surtout ne pas repartir de zero : la prochaine ecriture effacerait tout.
    throw new ErrorStorage(`fichier illisible : ${filePath}`, { cause: error });
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(folder(), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data) + "\n", { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw new ErrorStorage(`ecriture impossible : ${filePath}`, { cause: error });
  }
}

/** File d'attente : une lecture-modification-ecriture a la fois. */
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

interface Registry {
  abonnes: Subscriber[];
}

async function readSubscribers(): Promise<Subscriber[]> {
  const registry = await readJson<Registry>(fileSubscribers());
  return Array.isArray(registry?.abonnes) ? registry.abonnes : [];
}

function editSubscribers<R>(edit: (subscribers: Subscriber[]) => { subscribers: Subscriber[] | null; result: R }): Promise<R> {
  return serially(async () => {
    const { subscribers, result } = edit(await readSubscribers());
    if (subscribers) await writeJson(fileSubscribers(), { abonnes: subscribers } satisfies Registry);
    return result;
  });
}

export interface PushState {
  dernierPatch: string;
  date: string;
}

const readState = () => readJson<PushState>(fileState()).catch(() => null);
const writeState = (version: string) =>
  writeJson(fileState(), { dernierPatch: version, date: new Date().toISOString() } satisfies PushState);

// ── Abonnements ────────────────────────────────────────────────────

/**
 * Comparaison a temps constant : secret `auth` d'un abonnement (preuve de
 * possession) ou jeton de la route d'administration.
 */
export function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const matches = (subscriber: Subscriber, subscription: StoredSubscription) =>
  subscriber.endpoint === subscription.endpoint && sameSecret(subscriber.cles.auth, subscription.cles.auth);

/** Cree ou remplace l'abonnement de ce navigateur. */
export function saveSubscriber(
  subscription: StoredSubscription,
  locale: Locale,
  favourites: string[],
): Promise<"created" | "replaced" | "full"> {
  return editSubscribers((subscribers) => {
    const now = new Date().toISOString();
    const existing = subscribers.find((a) => a.endpoint === subscription.endpoint);
    if (!existing && subscribers.length >= MAX_SUBSCRIBERS) return { subscribers: null, result: "full" as const };
    const entry: Subscriber = { ...subscription, langue: locale, favoris: favourites, cree: existing?.cree ?? now, maj: now };
    const others = subscribers.filter((a) => a.endpoint !== subscription.endpoint);
    return { subscribers: [...others, entry], result: existing ? ("replaced" as const) : ("created" as const) };
  });
}

/** Met a jour les favoris (et la langue) d'un abonnement connu. */
export function majSubscriber(
  subscription: StoredSubscription,
  favourites: string[],
  locale: Locale | null,
): Promise<"ok" | "unknown"> {
  return editSubscribers((subscribers) => {
    const existing = subscribers.find((a) => matches(a, subscription));
    if (!existing) return { subscribers: null, result: "unknown" as const };
    const unchanged = existing.favoris.join() === favourites.join() && (!locale || locale === existing.langue);
    if (unchanged) return { subscribers: null, result: "ok" as const };
    const maj: Subscriber = { ...existing, favoris: favourites, langue: locale ?? existing.langue, maj: new Date().toISOString() };
    return { subscribers: subscribers.map((a) => (a === existing ? maj : a)), result: "ok" as const };
  });
}

export function deleteSubscriber(subscription: StoredSubscription): Promise<"ok" | "unknown"> {
  return editSubscribers((subscribers) => {
    const remaining = subscribers.filter((a) => !matches(a, subscription));
    return remaining.length === subscribers.length
      ? { subscribers: null, result: "unknown" as const }
      : { subscribers: remaining, result: "ok" as const };
  });
}

/** Identifiant court et stable d'un abonne, pour les bilans : l'adresse n'y figure jamais. */
export const idSubscriber = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 12);

// ── Limitation de debit ────────────────────────────────────────────

/** Fenetre fixe par adresse, comme pour le journal client. */
export function limitByMinute(maximum: number): (address: string) => boolean {
  const tracked = new Map<string, { start: number; count: number }>();
  return (address) => {
    const now = Date.now();
    const tracking = tracked.get(address);
    if (!tracking || now - tracking.start > 60_000) {
      if (tracked.size > 5_000) tracked.clear();
      tracked.set(address, { start: now, count: 1 });
      return true;
    }
    tracking.count += 1;
    return tracking.count <= maximum;
  };
}

export const addressOf = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";

// ── Envoi ──────────────────────────────────────────────────────────

/** Erreur d'envoi : `statusCode` est celui du service de notification. */
export type Sender = (subscription: StoredSubscription, load: string, topic: string) => Promise<void>;

function senderWebPush(config: PushConfig): Sender {
  return async (subscription, load, topic) => {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.cles },
      load,
      {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        // Un patch reste une nouvelle quelques jours : au-dela, inutile de la livrer.
        TTL: 4 * 24 * 3600,
        urgency: "normal",
        topic,
        timeout: 10_000,
      },
    );
  };
}

export interface SendPreview extends PushMessage {
  id: string;
  heros: string[];
}

export interface BroadcastSummary {
  version: string;
  simulation: boolean;
  abonnes: number;
  destinataires: number;
  parLangue: Partial<Record<Locale, number>>;
  /** Quelques messages rediges, pour verifier le rendu avant un envoi. */
  apercus: SendPreview[];
  envoyes: number;
  echecs: number;
  supprimes: number;
}

const BY_BATCH = 10;

/**
 * Prepare, et envoie si `envoyer`, la notification de chaque abonne touche
 * par le patch. Les abonnements que le service declare disparus (404, 410)
 * sont effaces. `cible` restreint l'envoi a un abonne, pour un essai.
 */
export async function broadcast(
  patch: AdjustedPatch,
  options: { send: boolean; target?: string; sender?: Sender; maxPreviews?: number },
): Promise<BroadcastSummary> {
  const subscribers = await serially(readSubscribers);
  const sends = recipients(subscribers, patch).filter((e) => !options.target || idSubscriber(e.subscriber.endpoint) === options.target);
  const messages = sends.map((e) => ({
    send: e,
    message: buildMessage(createT(e.subscriber.langue), e.subscriber.langue, patch.version, e.keys, heroesBySlug),
  }));

  const byLocale: Partial<Record<Locale, number>> = {};
  for (const e of sends) byLocale[e.subscriber.langue] = (byLocale[e.subscriber.langue] ?? 0) + 1;
  const summary: BroadcastSummary = {
    version: patch.version,
    simulation: !options.send,
    abonnes: subscribers.length,
    destinataires: sends.length,
    parLangue: Object.fromEntries(LOCALES.filter((l) => byLocale[l]).map((l) => [l, byLocale[l]])),
    apercus: messages.slice(0, options.maxPreviews ?? 5).map(({ send, message }) => ({
      id: idSubscriber(send.subscriber.endpoint),
      heros: send.keys.map((h) => h.slug),
      ...message,
    })),
    envoyes: 0,
    echecs: 0,
    supprimes: 0,
  };
  if (!options.send || messages.length === 0) return summary;

  const config = configPush();
  const sender = options.sender ?? (config ? senderWebPush(config) : null);
  if (!sender) throw new Error("notifications : cles VAPID absentes");

  const topic = `patch-${patch.version.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 32);
  const gone: StoredSubscription[] = [];
  for (let i = 0; i < messages.length; i += BY_BATCH) {
    const batch = messages.slice(i, i + BY_BATCH);
    const results = await Promise.allSettled(
      batch.map(({ send, message }) => sender(send.subscriber, JSON.stringify(message), topic)),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        summary.envoyes += 1;
        return;
      }
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        gone.push(batch[j].send.subscriber);
      } else {
        summary.echecs += 1;
        void log("warning", "notification non delivree", {
          version: patch.version,
          statut: status ?? null,
          service: new URL(batch[j].send.subscriber.endpoint).hostname,
          erreur: r.reason instanceof Error ? r.reason.message.slice(0, 200) : String(r.reason).slice(0, 200),
        });
      }
    });
  }

  if (gone.length) {
    summary.supprimes = await editSubscribers((list) => {
      const remaining = list.filter((a) => !gone.some((d) => matches(a, d)));
      return { subscribers: remaining, result: list.length - remaining.length };
    });
  }
  await log("info", "notifications de patch", {
    version: patch.version,
    destinataires: summary.destinataires,
    envoyes: summary.envoyes,
    echecs: summary.echecs,
    supprimes: summary.supprimes,
    cible: options.target ?? null,
  });
  return summary;
}

export type StartupOutcome =
  | { action: "recorded"; version: string }
  | { action: "already-notified"; version: string }
  | { action: "older"; version: string; dernier: string }
  | { action: "sent"; summary: BroadcastSummary };

/**
 * Appele a chaque demarrage avec le dernier patch connu des donnees.
 *
 * - Premier passage (aucun etat) : on note le patch sans rien envoyer — les
 *   abonnes n'ont pas a recevoir l'annonce d'un patch deja ancien.
 * - Patch deja notifie, ou plus ancien que le dernier notifie : rien.
 * - Patch plus recent : l'etat est ecrit AVANT l'envoi. Un arret en plein
 *   envoi fait perdre quelques notifications, jamais en doubler.
 */
export function notifyNewPatch(patch: AdjustedPatch, sender?: Sender): Promise<StartupOutcome> {
  return serialState(async () => {
    const state = await readState();
    if (!state?.dernierPatch) {
      await writeState(patch.version);
      await log("info", "notifications : premier demarrage, patch enregistre sans envoi", { version: patch.version });
      return { action: "recorded", version: patch.version };
    }
    if (state.dernierPatch === patch.version) return { action: "already-notified", version: patch.version };
    if (compareVersions(patch.version, state.dernierPatch) < 0) {
      return { action: "older", version: patch.version, dernier: state.dernierPatch };
    }
    await writeState(patch.version);
    return { action: "sent", summary: await broadcast(patch, { send: true, sender }) };
  });
}

export type ManualOutcome =
  | { action: "simulation"; bilan: BroadcastSummary; dernierNotifie: string | null }
  | { action: "refused"; raison: "already-notified"; dernierNotifie: string }
  | { action: "sent"; bilan: BroadcastSummary; dernierNotifie: string | null };

/**
 * Declenchement manuel (route protegee). Par defaut, une simulation. Un envoi
 * cible (un seul abonne) sert d'essai et ne touche pas a l'etat ; un envoi a
 * tous refuse un patch deja notifie, sauf `forcer`, et le note sinon.
 */
export function triggerManually(
  patch: AdjustedPatch,
  options: { send: boolean; target?: string; force?: boolean; sender?: Sender },
): Promise<ManualOutcome> {
  return serialState(async () => {
    const state = await readState();
    const lastNotified = state?.dernierPatch ?? null;
    if (!options.send) {
      return { action: "simulation", bilan: await broadcast(patch, { send: false, target: options.target, maxPreviews: 20 }), dernierNotifie: lastNotified };
    }
    if (!options.target) {
      if (lastNotified === patch.version && !options.force) {
        return { action: "refused", raison: "already-notified", dernierNotifie: lastNotified };
      }
      if (!lastNotified || compareVersions(patch.version, lastNotified) > 0) await writeState(patch.version);
    }
    const summary = await broadcast(patch, { send: true, target: options.target, sender: options.sender });
    return { action: "sent", bilan: summary, dernierNotifie: lastNotified };
  });
}

/** Les decisions sur l'etat ne se chevauchent pas (demarrage et route manuelle). */
let queueState: Promise<unknown> = Promise.resolve();
function serialState<T>(task: () => Promise<T>): Promise<T> {
  const run = queueState.then(task, task);
  queueState = run.catch(() => {});
  return run;
}

/** Point d'entree du demarrage : ne leve jamais, journalise tout. */
export async function notifyOnStartup(patch: AdjustedPatch | undefined): Promise<void> {
  if (!patch || !configPush()) return;
  try {
    const issue = await notifyNewPatch(patch);
    if (issue.action === "older") {
      await log("warning", "notifications : patch des donnees plus ancien que le dernier notifie", issue);
    }
  } catch (error) {
    await logError("notifications : echec au demarrage", error, { version: patch.version });
  }
}

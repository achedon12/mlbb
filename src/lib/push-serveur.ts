import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import webpush from "web-push";
import { LANGUES, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { herosParSlug } from "@/lib/donnees-client";
import { journaliser, journaliserErreur } from "@/lib/journal";
import {
  MAX_ABONNES,
  comparerVersions,
  construireMessage,
  destinataires,
  type Abonne,
  type AbonnementPush,
  type MessagePush,
  type PatchAjuste,
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

export interface ConfigPush {
  publique: string;
  privee: string;
  sujet: string;
}

let configAvertie = false;

/**
 * Cles VAPID lues dans l'environnement, a l'execution : l'image n'a pas a les
 * connaitre au build. Sans elles, la fonction est simplement absente.
 */
export function configPush(): ConfigPush | null {
  const publique = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privee = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const sujet = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (!publique && !privee && !sujet) return null;
  const valide =
    /^[A-Za-z0-9_-]{80,100}$/.test(publique) && /^[A-Za-z0-9_-]{40,50}$/.test(privee) && /^(mailto:|https:\/\/)/.test(sujet);
  if (!valide) {
    if (!configAvertie) {
      configAvertie = true;
      void journaliser("avertissement", "notifications : cles VAPID incompletes ou mal formees, fonction desactivee");
    }
    return null;
  }
  return { publique, privee, sujet };
}

const dossier = () => process.env.DONNEES_DIR?.trim() || "donnees-serveur";
const fichierAbonnes = () => join(dossier(), "push-abonnements.json");
const fichierEtat = () => join(dossier(), "push-etat.json");

// ── Fichiers ───────────────────────────────────────────────────────

export class ErreurStockage extends Error {}

async function lireJson<T>(fichier: string): Promise<T | null> {
  let brut: string;
  try {
    brut = await readFile(fichier, "utf8");
  } catch (erreur) {
    if ((erreur as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ErreurStockage(`lecture impossible : ${fichier}`, { cause: erreur });
  }
  try {
    return JSON.parse(brut) as T;
  } catch (erreur) {
    // Surtout ne pas repartir de zero : la prochaine ecriture effacerait tout.
    throw new ErreurStockage(`fichier illisible : ${fichier}`, { cause: erreur });
  }
}

async function ecrireJson(fichier: string, donnees: unknown): Promise<void> {
  await mkdir(dossier(), { recursive: true });
  const temporaire = `${fichier}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(temporaire, JSON.stringify(donnees) + "\n", { encoding: "utf8", mode: 0o600 });
    await rename(temporaire, fichier);
  } catch (erreur) {
    await rm(temporaire, { force: true }).catch(() => {});
    throw new ErreurStockage(`ecriture impossible : ${fichier}`, { cause: erreur });
  }
}

/** File d'attente : une lecture-modification-ecriture a la fois. */
let file: Promise<unknown> = Promise.resolve();
function enSerie<T>(tache: () => Promise<T>): Promise<T> {
  const suite = file.then(tache, tache);
  file = suite.catch(() => {});
  return suite;
}

interface Registre {
  abonnes: Abonne[];
}

async function lireAbonnes(): Promise<Abonne[]> {
  const registre = await lireJson<Registre>(fichierAbonnes());
  return Array.isArray(registre?.abonnes) ? registre.abonnes : [];
}

function modifierAbonnes<R>(modifier: (abonnes: Abonne[]) => { abonnes: Abonne[] | null; resultat: R }): Promise<R> {
  return enSerie(async () => {
    const { abonnes, resultat } = modifier(await lireAbonnes());
    if (abonnes) await ecrireJson(fichierAbonnes(), { abonnes } satisfies Registre);
    return resultat;
  });
}

export interface EtatPush {
  dernierPatch: string;
  date: string;
}

const lireEtat = () => lireJson<EtatPush>(fichierEtat()).catch(() => null);
const ecrireEtat = (version: string) =>
  ecrireJson(fichierEtat(), { dernierPatch: version, date: new Date().toISOString() } satisfies EtatPush);

// ── Abonnements ────────────────────────────────────────────────────

/**
 * Comparaison a temps constant : secret `auth` d'un abonnement (preuve de
 * possession) ou jeton de la route d'administration.
 */
export function memeSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const correspond = (abonne: Abonne, abonnement: AbonnementPush) =>
  abonne.endpoint === abonnement.endpoint && memeSecret(abonne.cles.auth, abonnement.cles.auth);

/** Cree ou remplace l'abonnement de ce navigateur. */
export function enregistrerAbonne(
  abonnement: AbonnementPush,
  langue: Langue,
  favoris: string[],
): Promise<"cree" | "remplace" | "plein"> {
  return modifierAbonnes((abonnes) => {
    const maintenant = new Date().toISOString();
    const existant = abonnes.find((a) => a.endpoint === abonnement.endpoint);
    if (!existant && abonnes.length >= MAX_ABONNES) return { abonnes: null, resultat: "plein" as const };
    const nouveau: Abonne = { ...abonnement, langue, favoris, cree: existant?.cree ?? maintenant, maj: maintenant };
    const autres = abonnes.filter((a) => a.endpoint !== abonnement.endpoint);
    return { abonnes: [...autres, nouveau], resultat: existant ? ("remplace" as const) : ("cree" as const) };
  });
}

/** Met a jour les favoris (et la langue) d'un abonnement connu. */
export function majAbonne(
  abonnement: AbonnementPush,
  favoris: string[],
  langue: Langue | null,
): Promise<"ok" | "inconnu"> {
  return modifierAbonnes((abonnes) => {
    const existant = abonnes.find((a) => correspond(a, abonnement));
    if (!existant) return { abonnes: null, resultat: "inconnu" as const };
    const inchange = existant.favoris.join() === favoris.join() && (!langue || langue === existant.langue);
    if (inchange) return { abonnes: null, resultat: "ok" as const };
    const maj: Abonne = { ...existant, favoris, langue: langue ?? existant.langue, maj: new Date().toISOString() };
    return { abonnes: abonnes.map((a) => (a === existant ? maj : a)), resultat: "ok" as const };
  });
}

export function supprimerAbonne(abonnement: AbonnementPush): Promise<"ok" | "inconnu"> {
  return modifierAbonnes((abonnes) => {
    const restants = abonnes.filter((a) => !correspond(a, abonnement));
    return restants.length === abonnes.length
      ? { abonnes: null, resultat: "inconnu" as const }
      : { abonnes: restants, resultat: "ok" as const };
  });
}

/** Identifiant court et stable d'un abonne, pour les bilans : l'adresse n'y figure jamais. */
export const idAbonne = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 12);

// ── Limitation de debit ────────────────────────────────────────────

/** Fenetre fixe par adresse, comme pour le journal client. */
export function limiteurParMinute(maximum: number): (adresse: string) => boolean {
  const suivis = new Map<string, { debut: number; nombre: number }>();
  return (adresse) => {
    const maintenant = Date.now();
    const suivi = suivis.get(adresse);
    if (!suivi || maintenant - suivi.debut > 60_000) {
      if (suivis.size > 5_000) suivis.clear();
      suivis.set(adresse, { debut: maintenant, nombre: 1 });
      return true;
    }
    suivi.nombre += 1;
    return suivi.nombre <= maximum;
  };
}

export const adresseDe = (requete: Request) =>
  requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || requete.headers.get("x-real-ip") || "inconnue";

// ── Envoi ──────────────────────────────────────────────────────────

/** Erreur d'envoi : `statusCode` est celui du service de notification. */
export type Envoyeur = (abonnement: AbonnementPush, charge: string, topic: string) => Promise<void>;

function envoyeurWebPush(config: ConfigPush): Envoyeur {
  return async (abonnement, charge, topic) => {
    await webpush.sendNotification(
      { endpoint: abonnement.endpoint, keys: abonnement.cles },
      charge,
      {
        vapidDetails: { subject: config.sujet, publicKey: config.publique, privateKey: config.privee },
        // Un patch reste une nouvelle quelques jours : au-dela, inutile de la livrer.
        TTL: 4 * 24 * 3600,
        urgency: "normal",
        topic,
        timeout: 10_000,
      },
    );
  };
}

export interface ApercuEnvoi extends MessagePush {
  id: string;
  heros: string[];
}

export interface BilanDiffusion {
  version: string;
  simulation: boolean;
  abonnes: number;
  destinataires: number;
  parLangue: Partial<Record<Langue, number>>;
  /** Quelques messages rediges, pour verifier le rendu avant un envoi. */
  apercus: ApercuEnvoi[];
  envoyes: number;
  echecs: number;
  supprimes: number;
}

const PAR_LOT = 10;

/**
 * Prepare, et envoie si `envoyer`, la notification de chaque abonne touche
 * par le patch. Les abonnements que le service declare disparus (404, 410)
 * sont effaces. `cible` restreint l'envoi a un abonne, pour un essai.
 */
export async function diffuser(
  patch: PatchAjuste,
  options: { envoyer: boolean; cible?: string; envoyeur?: Envoyeur; maxApercus?: number },
): Promise<BilanDiffusion> {
  const abonnes = await enSerie(lireAbonnes);
  const envois = destinataires(abonnes, patch).filter((e) => !options.cible || idAbonne(e.abonne.endpoint) === options.cible);
  const messages = envois.map((e) => ({
    envoi: e,
    message: construireMessage(creerT(e.abonne.langue), e.abonne.langue, patch.version, e.touches, herosParSlug),
  }));

  const parLangue: Partial<Record<Langue, number>> = {};
  for (const e of envois) parLangue[e.abonne.langue] = (parLangue[e.abonne.langue] ?? 0) + 1;
  const bilan: BilanDiffusion = {
    version: patch.version,
    simulation: !options.envoyer,
    abonnes: abonnes.length,
    destinataires: envois.length,
    parLangue: Object.fromEntries(LANGUES.filter((l) => parLangue[l]).map((l) => [l, parLangue[l]])),
    apercus: messages.slice(0, options.maxApercus ?? 5).map(({ envoi, message }) => ({
      id: idAbonne(envoi.abonne.endpoint),
      heros: envoi.touches.map((h) => h.slug),
      ...message,
    })),
    envoyes: 0,
    echecs: 0,
    supprimes: 0,
  };
  if (!options.envoyer || messages.length === 0) return bilan;

  const config = configPush();
  const envoyeur = options.envoyeur ?? (config ? envoyeurWebPush(config) : null);
  if (!envoyeur) throw new Error("notifications : cles VAPID absentes");

  const topic = `patch-${patch.version.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 32);
  const disparus: AbonnementPush[] = [];
  for (let i = 0; i < messages.length; i += PAR_LOT) {
    const lot = messages.slice(i, i + PAR_LOT);
    const resultats = await Promise.allSettled(
      lot.map(({ envoi, message }) => envoyeur(envoi.abonne, JSON.stringify(message), topic)),
    );
    resultats.forEach((r, j) => {
      if (r.status === "fulfilled") {
        bilan.envoyes += 1;
        return;
      }
      const statut = (r.reason as { statusCode?: number })?.statusCode;
      if (statut === 404 || statut === 410) {
        disparus.push(lot[j].envoi.abonne);
      } else {
        bilan.echecs += 1;
        void journaliser("avertissement", "notification non delivree", {
          version: patch.version,
          statut: statut ?? null,
          service: new URL(lot[j].envoi.abonne.endpoint).hostname,
          erreur: r.reason instanceof Error ? r.reason.message.slice(0, 200) : String(r.reason).slice(0, 200),
        });
      }
    });
  }

  if (disparus.length) {
    bilan.supprimes = await modifierAbonnes((liste) => {
      const restants = liste.filter((a) => !disparus.some((d) => correspond(a, d)));
      return { abonnes: restants, resultat: liste.length - restants.length };
    });
  }
  await journaliser("info", "notifications de patch", {
    version: patch.version,
    destinataires: bilan.destinataires,
    envoyes: bilan.envoyes,
    echecs: bilan.echecs,
    supprimes: bilan.supprimes,
    cible: options.cible ?? null,
  });
  return bilan;
}

export type IssueDemarrage =
  | { action: "enregistre"; version: string }
  | { action: "deja-notifie"; version: string }
  | { action: "plus-ancien"; version: string; dernier: string }
  | { action: "envoye"; bilan: BilanDiffusion };

/**
 * Appele a chaque demarrage avec le dernier patch connu des donnees.
 *
 * - Premier passage (aucun etat) : on note le patch sans rien envoyer — les
 *   abonnes n'ont pas a recevoir l'annonce d'un patch deja ancien.
 * - Patch deja notifie, ou plus ancien que le dernier notifie : rien.
 * - Patch plus recent : l'etat est ecrit AVANT l'envoi. Un arret en plein
 *   envoi fait perdre quelques notifications, jamais en doubler.
 */
export function notifierNouveauPatch(patch: PatchAjuste, envoyeur?: Envoyeur): Promise<IssueDemarrage> {
  return enSerieEtat(async () => {
    const etat = await lireEtat();
    if (!etat?.dernierPatch) {
      await ecrireEtat(patch.version);
      await journaliser("info", "notifications : premier demarrage, patch enregistre sans envoi", { version: patch.version });
      return { action: "enregistre", version: patch.version };
    }
    if (etat.dernierPatch === patch.version) return { action: "deja-notifie", version: patch.version };
    if (comparerVersions(patch.version, etat.dernierPatch) < 0) {
      return { action: "plus-ancien", version: patch.version, dernier: etat.dernierPatch };
    }
    await ecrireEtat(patch.version);
    return { action: "envoye", bilan: await diffuser(patch, { envoyer: true, envoyeur }) };
  });
}

export type IssueManuelle =
  | { action: "simulation"; bilan: BilanDiffusion; dernierNotifie: string | null }
  | { action: "refuse"; raison: "deja-notifie"; dernierNotifie: string }
  | { action: "envoye"; bilan: BilanDiffusion; dernierNotifie: string | null };

/**
 * Declenchement manuel (route protegee). Par defaut, une simulation. Un envoi
 * cible (un seul abonne) sert d'essai et ne touche pas a l'etat ; un envoi a
 * tous refuse un patch deja notifie, sauf `forcer`, et le note sinon.
 */
export function declencherManuellement(
  patch: PatchAjuste,
  options: { envoyer: boolean; cible?: string; forcer?: boolean; envoyeur?: Envoyeur },
): Promise<IssueManuelle> {
  return enSerieEtat(async () => {
    const etat = await lireEtat();
    const dernierNotifie = etat?.dernierPatch ?? null;
    if (!options.envoyer) {
      return { action: "simulation", bilan: await diffuser(patch, { envoyer: false, cible: options.cible, maxApercus: 20 }), dernierNotifie };
    }
    if (!options.cible) {
      if (dernierNotifie === patch.version && !options.forcer) {
        return { action: "refuse", raison: "deja-notifie", dernierNotifie };
      }
      if (!dernierNotifie || comparerVersions(patch.version, dernierNotifie) > 0) await ecrireEtat(patch.version);
    }
    const bilan = await diffuser(patch, { envoyer: true, cible: options.cible, envoyeur: options.envoyeur });
    return { action: "envoye", bilan, dernierNotifie };
  });
}

/** Les decisions sur l'etat ne se chevauchent pas (demarrage et route manuelle). */
let fileEtat: Promise<unknown> = Promise.resolve();
function enSerieEtat<T>(tache: () => Promise<T>): Promise<T> {
  const suite = fileEtat.then(tache, tache);
  fileEtat = suite.catch(() => {});
  return suite;
}

/** Point d'entree du demarrage : ne leve jamais, journalise tout. */
export async function notifierAuDemarrage(patch: PatchAjuste | undefined): Promise<void> {
  if (!patch || !configPush()) return;
  try {
    const issue = await notifierNouveauPatch(patch);
    if (issue.action === "plus-ancien") {
      await journaliser("avertissement", "notifications : patch des donnees plus ancien que le dernier notifie", issue);
    }
  } catch (erreur) {
    await journaliserErreur("notifications : echec au demarrage", erreur, { version: patch.version });
  }
}

import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AbonnementPush } from "@/lib/push";
import type { Envoyeur } from "@/lib/push-serveur";

// Le journal ecrirait dans `logs/` : on le fait taire.
vi.mock("@/lib/journal", () => ({ journaliser: vi.fn(async () => {}), journaliserErreur: vi.fn(async () => {}) }));

const {
  ErreurStockage,
  declencherManuellement,
  enregistrerAbonne,
  idAbonne,
  majAbonne,
  notifierNouveauPatch,
  supprimerAbonne,
} = await import("@/lib/push-serveur");

/**
 * Stockage des abonnements et regles d'envoi, sur un dossier temporaire et un
 * envoyeur factice : jamais deux fois le meme patch, rien au premier
 * demarrage, les abonnements disparus effaces.
 */
let dossier: string;
beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "mlbb-push-"));
  process.env.DONNEES_DIR = dossier;
});

const abonnement = (id: string): AbonnementPush => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  cles: {
    p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  },
});
const lireAbonnes = () =>
  (JSON.parse(readFileSync(join(dossier, "push-abonnements.json"), "utf8")) as { abonnes: { endpoint: string; favoris: string[] }[] })
    .abonnes;
const etat = () => JSON.parse(readFileSync(join(dossier, "push-etat.json"), "utf8")).dernierPatch as string;

const patch = (version: string) => ({
  version,
  ajustements: [
    { slug: "khufra", type: "amelioration" as const },
    { slug: "layla", type: "affaiblissement" as const },
  ],
});

/** Envoyeur factice : les adresses « disparu » repondent 410, « panne » 500. */
const envoyeurFactice = () =>
  vi.fn<Envoyeur>(async (a) => {
    if (a.endpoint.includes("disparu")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
    if (a.endpoint.includes("panne")) throw Object.assign(new Error("Erreur"), { statusCode: 500 });
  });

describe("abonnements", () => {
  it("cree, remplace, met a jour et supprime, par ecriture atomique", async () => {
    const a = abonnement("a");
    expect(await enregistrerAbonne(a, "fr", ["khufra"])).toBe("cree");
    expect(await enregistrerAbonne(a, "en", ["khufra"])).toBe("remplace");
    expect(await majAbonne(a, ["layla"], null)).toBe("ok");
    expect(lireAbonnes()).toMatchObject([{ endpoint: a.endpoint, favoris: ["layla"], langue: "en" }]);
    expect(readdirSync(dossier).filter((f) => f.endsWith(".tmp"))).toEqual([]);

    expect(await supprimerAbonne(a)).toBe("ok");
    expect(await supprimerAbonne(a)).toBe("inconnu");
    expect(lireAbonnes()).toEqual([]);
  });

  it("exige le secret de l'abonnement pour le modifier ou le supprimer", async () => {
    const a = abonnement("a");
    await enregistrerAbonne(a, "fr", ["khufra"]);
    const usurpe = { ...a, cles: { ...a.cles, auth: randomBytes(16).toString("base64url") } };
    expect(await majAbonne(usurpe, [], "fr")).toBe("inconnu");
    expect(await supprimerAbonne(usurpe)).toBe("inconnu");
    expect(lireAbonnes()).toHaveLength(1);
  });

  it("n'ecrase jamais un fichier illisible", async () => {
    writeFileSync(join(dossier, "push-abonnements.json"), "{ tronque");
    await expect(enregistrerAbonne(abonnement("a"), "fr", [])).rejects.toBeInstanceOf(ErreurStockage);
    expect(readFileSync(join(dossier, "push-abonnements.json"), "utf8")).toBe("{ tronque");
  });

  it("les ecritures simultanees ne se perdent pas", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => enregistrerAbonne(abonnement(`n${i}`), "fr", [])));
    expect(lireAbonnes()).toHaveLength(20);
  });
});

describe("envoi au demarrage", () => {
  it("premier demarrage : note le patch sans rien envoyer", async () => {
    await enregistrerAbonne(abonnement("a"), "fr", ["khufra"]);
    const envoyeur = envoyeurFactice();
    expect(await notifierNouveauPatch(patch("2.1.88"), envoyeur)).toEqual({ action: "enregistre", version: "2.1.88" });
    expect(envoyeur).not.toHaveBeenCalled();
    expect(etat()).toBe("2.1.88");
  });

  it("nouveau patch : une notification par abonne concerne, une seule fois", async () => {
    await notifierNouveauPatch(patch("2.1.88"));
    await enregistrerAbonne(abonnement("a"), "fr", ["khufra", "tigreal"]);
    await enregistrerAbonne(abonnement("b"), "en", ["tigreal"]);
    await enregistrerAbonne(abonnement("c"), "it", ["layla", "khufra"]);
    const envoyeur = envoyeurFactice();

    const issue = await notifierNouveauPatch(patch("2.1.90"), envoyeur);
    expect(issue.action).toBe("envoye");
    expect(envoyeur).toHaveBeenCalledTimes(2);
    const charges = envoyeur.mock.calls.map(([a, charge]) => [a.endpoint.split("/").at(-1), JSON.parse(charge as string)]);
    expect(charges).toEqual([
      ["a", expect.objectContaining({ url: "/fr/heroes/khufra#stats", tag: "patch-2.1.90", langue: "fr" })],
      ["c", expect.objectContaining({ url: "/it/patch-notes/2.1.90", langue: "it" })],
    ]);
    expect(etat()).toBe("2.1.90");

    expect(await notifierNouveauPatch(patch("2.1.90"), envoyeur)).toEqual({ action: "deja-notifie", version: "2.1.90" });
    expect(await notifierNouveauPatch(patch("2.1.88"), envoyeur)).toMatchObject({ action: "plus-ancien" });
    expect(envoyeur).toHaveBeenCalledTimes(2);
  });

  it("efface les abonnements disparus (404, 410), garde les pannes passageres", async () => {
    await notifierNouveauPatch(patch("2.1.88"));
    await enregistrerAbonne(abonnement("disparu"), "fr", ["khufra"]);
    await enregistrerAbonne(abonnement("panne"), "fr", ["khufra"]);
    await enregistrerAbonne(abonnement("ok"), "fr", ["layla"]);

    const issue = await notifierNouveauPatch(patch("2.1.90"), envoyeurFactice());
    expect(issue).toMatchObject({ action: "envoye", bilan: { destinataires: 3, envoyes: 1, echecs: 1, supprimes: 1 } });
    expect(lireAbonnes().map((a) => a.endpoint.split("/").at(-1))).toEqual(["panne", "ok"]);
  });
});

describe("declenchement manuel", () => {
  it("simule par defaut, sans rien envoyer ni noter", async () => {
    await enregistrerAbonne(abonnement("a"), "fr", ["khufra"]);
    const envoyeur = envoyeurFactice();
    const issue = await declencherManuellement(patch("2.1.90"), { envoyer: false, envoyeur });
    expect(issue).toMatchObject({ action: "simulation", dernierNotifie: null, bilan: { simulation: true, destinataires: 1 } });
    expect(envoyeur).not.toHaveBeenCalled();
    expect(readdirSync(dossier)).not.toContain("push-etat.json");
  });

  it("refuse de renvoyer a tous un patch deja annonce, sauf a forcer", async () => {
    await notifierNouveauPatch(patch("2.1.90"));
    await enregistrerAbonne(abonnement("a"), "fr", ["khufra"]);
    const envoyeur = envoyeurFactice();
    expect(await declencherManuellement(patch("2.1.90"), { envoyer: true, envoyeur })).toMatchObject({ action: "refuse" });
    expect(envoyeur).not.toHaveBeenCalled();
    expect(await declencherManuellement(patch("2.1.90"), { envoyer: true, forcer: true, envoyeur })).toMatchObject({
      action: "envoye",
    });
    expect(envoyeur).toHaveBeenCalledTimes(1);
  });

  it("un envoi cible ne va qu'a un abonne et ne touche pas a l'etat", async () => {
    await notifierNouveauPatch(patch("2.1.88"));
    const a = abonnement("a");
    await enregistrerAbonne(a, "fr", ["khufra"]);
    await enregistrerAbonne(abonnement("b"), "fr", ["layla"]);
    const envoyeur = envoyeurFactice();
    const issue = await declencherManuellement(patch("2.1.90"), { envoyer: true, cible: idAbonne(a.endpoint), envoyeur });
    expect(issue).toMatchObject({ action: "envoye", bilan: { destinataires: 1, envoyes: 1 } });
    expect(envoyeur).toHaveBeenCalledTimes(1);
    expect(etat()).toBe("2.1.88");
  });

  it("un envoi a tous d'un patch plus recent le note comme annonce", async () => {
    await notifierNouveauPatch(patch("2.1.88"));
    await declencherManuellement(patch("2.1.90"), { envoyer: true, envoyeur: envoyeurFactice() });
    expect(etat()).toBe("2.1.90");
    expect(await notifierNouveauPatch(patch("2.1.90"))).toMatchObject({ action: "deja-notifie" });
  });
});

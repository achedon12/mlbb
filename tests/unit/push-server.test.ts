import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSubscription } from "@/lib/push";
import type { Sender } from "@/lib/push-server";

// Le journal ecrirait dans `logs/` : on le fait taire.
vi.mock("@/lib/log", () => ({ log: vi.fn(async () => {}), logError: vi.fn(async () => {}) }));

const {
  ErrorStorage,
  triggerManually,
  saveSubscriber,
  idSubscriber,
  majSubscriber,
  notifyNewPatch,
  deleteSubscriber,
} = await import("@/lib/push-server");

/**
 * Stockage des abonnements et regles d'envoi, sur un dossier temporaire et un
 * envoyeur factice : jamais deux fois le meme patch, rien au premier
 * demarrage, les abonnements disparus effaces.
 */
let folder: string;
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "mlbb-push-"));
  process.env.DATA_DIR = folder;
});

const subscription = (id: string): StoredSubscription => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  cles: {
    p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  },
});
const readSubscribers = () =>
  (JSON.parse(readFileSync(join(folder, "push-abonnements.json"), "utf8")) as { abonnes: { endpoint: string; favoris: string[] }[] })
    .abonnes;
const state = () => JSON.parse(readFileSync(join(folder, "push-etat.json"), "utf8")).dernierPatch as string;

const patch = (version: string) => ({
  version,
  adjustments: [
    { slug: "khufra", type: "buff" as const },
    { slug: "layla", type: "nerf" as const },
  ],
});

/** Envoyeur factice : les adresses « disparu » repondent 410, « panne » 500. */
const fakeSender = () =>
  vi.fn<Sender>(async (a) => {
    if (a.endpoint.includes("disparu")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
    if (a.endpoint.includes("panne")) throw Object.assign(new Error("Erreur"), { statusCode: 500 });
  });

describe("subscriptions", () => {
  it("creates, replaces, updates and deletes, with atomic writes", async () => {
    const a = subscription("a");
    expect(await saveSubscriber(a, "fr", ["khufra"])).toBe("created");
    expect(await saveSubscriber(a, "en", ["khufra"])).toBe("replaced");
    expect(await majSubscriber(a, ["layla"], null)).toBe("ok");
    expect(readSubscribers()).toMatchObject([{ endpoint: a.endpoint, favoris: ["layla"], langue: "en" }]);
    expect(readdirSync(folder).filter((f) => f.endsWith(".tmp"))).toEqual([]);

    expect(await deleteSubscriber(a)).toBe("ok");
    expect(await deleteSubscriber(a)).toBe("unknown");
    expect(readSubscribers()).toEqual([]);
  });

  it("requires the subscription secret to update or delete it", async () => {
    const a = subscription("a");
    await saveSubscriber(a, "fr", ["khufra"]);
    const spoofed = { ...a, cles: { ...a.cles, auth: randomBytes(16).toString("base64url") } };
    expect(await majSubscriber(spoofed, [], "fr")).toBe("unknown");
    expect(await deleteSubscriber(spoofed)).toBe("unknown");
    expect(readSubscribers()).toHaveLength(1);
  });

  it("never overwrites an unreadable file", async () => {
    writeFileSync(join(folder, "push-abonnements.json"), "{ tronque");
    await expect(saveSubscriber(subscription("a"), "fr", [])).rejects.toBeInstanceOf(ErrorStorage);
    expect(readFileSync(join(folder, "push-abonnements.json"), "utf8")).toBe("{ tronque");
  });

  it("concurrent writes are not lost", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => saveSubscriber(subscription(`n${i}`), "fr", [])));
    expect(readSubscribers()).toHaveLength(20);
  });
});

describe("sending on startup", () => {
  it("first startup: records the patch without sending anything", async () => {
    await saveSubscriber(subscription("a"), "fr", ["khufra"]);
    const sender = fakeSender();
    expect(await notifyNewPatch(patch("2.1.88"), sender)).toEqual({ action: "recorded", version: "2.1.88" });
    expect(sender).not.toHaveBeenCalled();
    expect(state()).toBe("2.1.88");
  });

  it("new patch: one notification per relevant subscriber, only once", async () => {
    await notifyNewPatch(patch("2.1.88"));
    await saveSubscriber(subscription("a"), "fr", ["khufra", "tigreal"]);
    await saveSubscriber(subscription("b"), "en", ["tigreal"]);
    await saveSubscriber(subscription("c"), "it", ["layla", "khufra"]);
    const sender = fakeSender();

    const issue = await notifyNewPatch(patch("2.1.90"), sender);
    expect(issue.action).toBe("sent");
    expect(sender).toHaveBeenCalledTimes(2);
    const charges = sender.mock.calls.map(([a, load]) => [a.endpoint.split("/").at(-1), JSON.parse(load as string)]);
    expect(charges).toEqual([
      ["a", expect.objectContaining({ url: "/fr/heroes/khufra#stats", tag: "patch-2.1.90", langue: "fr" })],
      ["c", expect.objectContaining({ url: "/it/patch-notes/2.1.90", langue: "it" })],
    ]);
    expect(state()).toBe("2.1.90");

    expect(await notifyNewPatch(patch("2.1.90"), sender)).toEqual({ action: "already-notified", version: "2.1.90" });
    expect(await notifyNewPatch(patch("2.1.88"), sender)).toMatchObject({ action: "older" });
    expect(sender).toHaveBeenCalledTimes(2);
  });

  it("deletes gone subscriptions (404, 410), keeps transient failures", async () => {
    await notifyNewPatch(patch("2.1.88"));
    await saveSubscriber(subscription("disparu"), "fr", ["khufra"]);
    await saveSubscriber(subscription("panne"), "fr", ["khufra"]);
    await saveSubscriber(subscription("ok"), "fr", ["layla"]);

    const issue = await notifyNewPatch(patch("2.1.90"), fakeSender());
    expect(issue).toMatchObject({ action: "sent", summary: { destinataires: 3, envoyes: 1, echecs: 1, supprimes: 1 } });
    expect(readSubscribers().map((a) => a.endpoint.split("/").at(-1))).toEqual(["panne", "ok"]);
  });
});

describe("manual trigger", () => {
  it("dry run by default, without sending or recording anything", async () => {
    await saveSubscriber(subscription("a"), "fr", ["khufra"]);
    const sender = fakeSender();
    const issue = await triggerManually(patch("2.1.90"), { send: false, sender });
    expect(issue).toMatchObject({ action: "simulation", dernierNotifie: null, bilan: { simulation: true, destinataires: 1 } });
    expect(sender).not.toHaveBeenCalled();
    expect(readdirSync(folder)).not.toContain("push-etat.json");
  });

  it("refuses to resend an already announced patch to everyone, unless forced", async () => {
    await notifyNewPatch(patch("2.1.90"));
    await saveSubscriber(subscription("a"), "fr", ["khufra"]);
    const sender = fakeSender();
    expect(await triggerManually(patch("2.1.90"), { send: true, sender })).toMatchObject({ action: "refused" });
    expect(sender).not.toHaveBeenCalled();
    expect(await triggerManually(patch("2.1.90"), { send: true, force: true, sender })).toMatchObject({
      action: "sent",
    });
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("a targeted send only goes to one subscriber and leaves the state untouched", async () => {
    await notifyNewPatch(patch("2.1.88"));
    const a = subscription("a");
    await saveSubscriber(a, "fr", ["khufra"]);
    await saveSubscriber(subscription("b"), "fr", ["layla"]);
    const sender = fakeSender();
    const issue = await triggerManually(patch("2.1.90"), { send: true, target: idSubscriber(a.endpoint), sender });
    expect(issue).toMatchObject({ action: "sent", bilan: { destinataires: 1, envoyes: 1 } });
    expect(sender).toHaveBeenCalledTimes(1);
    expect(state()).toBe("2.1.88");
  });

  it("a send to everyone of a newer patch records it as announced", async () => {
    await notifyNewPatch(patch("2.1.88"));
    await triggerManually(patch("2.1.90"), { send: true, sender: fakeSender() });
    expect(state()).toBe("2.1.90");
    expect(await notifyNewPatch(patch("2.1.90"))).toMatchObject({ action: "already-notified" });
  });
});

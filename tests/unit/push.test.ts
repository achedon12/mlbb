import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTFrom, type Tree } from "@/i18n/t";
import {
  MAX_FAVOURITES,
  subscriptionValid,
  compareVersions,
  buildMessage,
  recipients,
  endpointValid,
  validFavourites,
  validateRequest,
  type Subscriber,
} from "@/lib/push";

/**
 * Patch notifications: request validation, recipient selection and message
 * writing — the part with no disk or network.
 */
const keyPair = () => ({
  p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString("base64url"),
  auth: randomBytes(16).toString("base64url"),
});
const FCM = "https://fcm.googleapis.com/fcm/send/abc123:APA91b";
const KNOWN = new Set(["khufra", "layla", "tigreal", "saber", "ruby"]);

const subscriber = (id: string, favourites: string[], locale: Subscriber["langue"] = "fr"): Subscriber => ({
  endpoint: `${FCM}${id}`,
  cles: keyPair(),
  langue: locale,
  favoris: favourites,
  cree: "2026-09-01T00:00:00.000Z",
  maj: "2026-09-01T00:00:00.000Z",
});

describe("subscription endpoint", () => {
  it("accepts known push services, over https", () => {
    expect(endpointValid(FCM)).toBe(FCM);
    expect(endpointValid("https://updates.push.services.mozilla.com/wpush/v2/gAAAA")).not.toBeNull();
    expect(endpointValid("https://web.push.apple.com/QGuQ")).not.toBeNull();
    expect(endpointValid("https://jmt17.google.com/fcm/send/eLyINELhWpQ:APA9")).not.toBeNull();
    expect(endpointValid("https://autre.google.com/fcm/send/x")).toBeNull();
    expect(endpointValid("https://wns2-par02p.notify.windows.com/w/?token=x")).not.toBeNull();
  });

  it("rejects http, unknown or internal hosts, credentials and ports", () => {
    expect(endpointValid("http://fcm.googleapis.com/fcm/send/x")).toBeNull();
    expect(endpointValid("https://exemple.com/push")).toBeNull();
    expect(endpointValid("https://127.0.0.1/push")).toBeNull();
    expect(endpointValid("https://localhost/push")).toBeNull();
    expect(endpointValid("https://fcm.googleapis.com.exemple.com/x")).toBeNull();
    expect(endpointValid("https://user:mdp@fcm.googleapis.com/x")).toBeNull();
    expect(endpointValid("https://fcm.googleapis.com:8443/x")).toBeNull();
    expect(endpointValid(`${FCM}${"a".repeat(1_100)}`)).toBeNull();
    expect(endpointValid(42)).toBeNull();
  });

  it("checks the shape of the encryption keys", () => {
    const good = keyPair();
    expect(subscriptionValid({ endpoint: FCM, keys: good })).toEqual({ endpoint: FCM, cles: good });
    expect(subscriptionValid({ endpoint: FCM, keys: { ...good, auth: "court" } })).toBeNull();
    expect(subscriptionValid({ endpoint: FCM, keys: { ...good, p256dh: "a b" } })).toBeNull();
    expect(subscriptionValid({ endpoint: FCM })).toBeNull();
    expect(subscriptionValid(null)).toBeNull();
  });
});

describe("favourites", () => {
  it("deduplicates and drops heroes missing from the catalog", () => {
    expect(validFavourites(["khufra", "layla", "khufra", "unknown"], KNOWN)).toEqual(["khufra", "layla"]);
    expect(validFavourites([], KNOWN)).toEqual([]);
  });

  it("rejects an invalid shape or a list that is too long", () => {
    expect(validFavourites("khufra", KNOWN)).toBeNull();
    expect(validFavourites(["khufra", 3], KNOWN)).toBeNull();
    expect(validFavourites(["Khufra"], KNOWN)).toBeNull();
    expect(validFavourites(["../etc"], KNOWN)).toBeNull();
    expect(validFavourites(Array.from({ length: MAX_FAVOURITES + 1 }, () => "khufra"), KNOWN)).toBeNull();
  });
});

describe("API requests", () => {
  const subscription = { endpoint: FCM, keys: keyPair() };

  it("subscribe: site language required", () => {
    expect(validateRequest("subscribe", { abonnement: subscription, langue: "it", favoris: ["ruby"] }, KNOWN)).toMatchObject({
      type: "subscribe",
      langue: "it",
      favoris: ["ruby"],
    });
    expect(validateRequest("subscribe", { abonnement: subscription, langue: "de", favoris: [] }, KNOWN)).toBeNull();
    expect(validateRequest("subscribe", { abonnement: subscription, favoris: [] }, KNOWN)).toBeNull();
  });

  it("update: language optional, favourites required", () => {
    expect(validateRequest("update", { abonnement: subscription, favoris: ["saber"] }, KNOWN)).toMatchObject({ langue: null });
    expect(validateRequest("update", { abonnement: subscription, langue: "es", favoris: [] }, KNOWN)).toMatchObject({ langue: "es" });
    expect(validateRequest("update", { abonnement: subscription }, KNOWN)).toBeNull();
    expect(validateRequest("update", { abonnement: subscription, langue: 3, favoris: [] }, KNOWN)).toBeNull();
  });

  it("unsubscribe: the subscription is enough, but must be complete", () => {
    expect(validateRequest("unsubscribe", { abonnement: subscription }, KNOWN)).toMatchObject({ type: "unsubscribe" });
    expect(validateRequest("unsubscribe", { abonnement: { endpoint: FCM } }, KNOWN)).toBeNull();
    expect(validateRequest("unsubscribe", [subscription], KNOWN)).toBeNull();
  });
});

describe("patch recipients", () => {
  const patch = {
    version: "2.1.88",
    adjustments: [
      { slug: "saber", type: "buff" as const },
      { slug: "khufra", type: "buff" as const },
      { slug: "layla", type: "nerf" as const },
      { slug: "khufra", type: "adjust" as const },
    ],
  };

  it("only keeps subscribers with an affected favourite", () => {
    const sends = recipients([subscriber("a", ["tigreal"]), subscriber("b", ["layla", "khufra"]), subscriber("c", [])], patch);
    expect(sends.map((e) => e.subscriber.endpoint)).toEqual([`${FCM}b`]);
  });

  it("follows the patch notes order, each hero only once", () => {
    const [send] = recipients([subscriber("b", ["layla", "khufra"])], patch);
    expect(send.keys).toEqual([
      { slug: "khufra", type: "buff" },
      { slug: "layla", type: "nerf" },
    ]);
  });
});

describe("notification message", () => {
  const messages = {
    pushNotif: {
      title: {
        buff: "Patch {version} : amélioration pour {name}",
        nerf: "Patch {version} : affaiblissement pour {name}",
        adjust: "Patch {version} : ajustements pour {name}",
      },
      titleMany: "Patch {version} : {n} de vos favoris modifiés",
      bodyOne: "Le détail est sur sa fiche, dans l'onglet Stats.",
      row: "{name} : {type}",
      other: "et {n} autre",
      others: "et {n} autres",
    },
    patchHeroes: { buff: "Amélioration", nerf: "Affaiblissement", adjustment: "Ajustement" },
    favourites: { alert: { changed: "Modifié" } },
  } satisfies Tree;
  const t = createTFrom(messages);
  const names = { khufra: "Khufra", layla: "Layla", saber: "Saber", ruby: "Ruby", tigreal: "Tigreal" };

  it("a single hero: named title, link to the Stats tab of its hero page", () => {
    const m = buildMessage(t, "fr", "2.1.88", [{ slug: "khufra", type: "buff" }], names);
    expect(m).toEqual({
      titre: "Patch 2.1.88 : amélioration pour Khufra",
      corps: "Le détail est sur sa fiche, dans l'onglet Stats.",
      url: "/fr/heroes/khufra#stats",
      tag: "patch-2.1.88",
      langue: "fr",
    });
  });

  it("an adjustment without a type is treated as an adjustment", () => {
    const m = buildMessage(t, "en", "2.1.88", [{ slug: "layla", type: null }], names);
    expect(m.titre).toBe("Patch 2.1.88 : ajustements pour Layla");
    expect(m.url).toBe("/en/heroes/layla#stats");
  });

  it("several heroes: three named, the others counted, link to the patch", () => {
    const keyNames = [
      { slug: "khufra", type: "buff" as const },
      { slug: "layla", type: "nerf" as const },
      { slug: "saber", type: null },
      { slug: "ruby", type: "adjust" as const },
      { slug: "tigreal", type: "adjust" as const },
    ];
    const m = buildMessage(t, "es", "2.1.88", keyNames, names);
    expect(m.titre).toBe("Patch 2.1.88 : 5 de vos favoris modifiés");
    expect(m.corps).toBe("Khufra : Amélioration\nLayla : Affaiblissement\nSaber : Modifié\net 2 autres");
    expect(m.url).toBe("/es/patch-notes/2.1.88");

    const four = buildMessage(t, "fr", "2.1.88", keyNames.slice(0, 4), names);
    expect(four.corps.split("\n").at(-1)).toBe("et 1 autre");
    const two = buildMessage(t, "fr", "2.1.88", keyNames.slice(0, 2), names);
    expect(two.corps).toBe("Khufra : Amélioration\nLayla : Affaiblissement");
  });

  it("a slug without a known name stays readable", () => {
    const m = buildMessage(t, "fr", "2.1.88", [{ slug: "newcomer", type: "buff" }], names);
    expect(m.titre).toBe("Patch 2.1.88 : amélioration pour newcomer");
  });
});

describe("versions", () => {
  it("compares numerically", () => {
    expect(compareVersions("2.1.88", "1.9.47")).toBeGreaterThan(0);
    expect(compareVersions("1.8.78", "1.8.100")).toBeLessThan(0);
    expect(compareVersions("2.1.88", "2.1.88")).toBe(0);
  });
});

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { creerTDepuis, type Arbre } from "@/i18n/t";
import {
  MAX_FAVORIS,
  abonnementValide,
  comparerVersions,
  construireMessage,
  destinataires,
  endpointValide,
  favorisValides,
  validerDemande,
  type Abonne,
} from "@/lib/push";

/**
 * Notifications de patch : validation des demandes, choix des destinataires
 * et redaction des messages — la partie sans disque ni reseau.
 */
const cles = () => ({
  p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString("base64url"),
  auth: randomBytes(16).toString("base64url"),
});
const FCM = "https://fcm.googleapis.com/fcm/send/abc123:APA91b";
const CONNUS = new Set(["khufra", "layla", "tigreal", "saber", "ruby"]);

const abonne = (id: string, favoris: string[], langue: Abonne["langue"] = "fr"): Abonne => ({
  endpoint: `${FCM}${id}`,
  cles: cles(),
  langue,
  favoris,
  cree: "2026-09-01T00:00:00.000Z",
  maj: "2026-09-01T00:00:00.000Z",
});

describe("adresse d'abonnement", () => {
  it("accepte les services de notification connus, en https", () => {
    expect(endpointValide(FCM)).toBe(FCM);
    expect(endpointValide("https://updates.push.services.mozilla.com/wpush/v2/gAAAA")).not.toBeNull();
    expect(endpointValide("https://web.push.apple.com/QGuQ")).not.toBeNull();
    expect(endpointValide("https://jmt17.google.com/fcm/send/eLyINELhWpQ:APA9")).not.toBeNull();
    expect(endpointValide("https://autre.google.com/fcm/send/x")).toBeNull();
    expect(endpointValide("https://wns2-par02p.notify.windows.com/w/?token=x")).not.toBeNull();
  });

  it("refuse http, les hotes inconnus ou internes, les identifiants et les ports", () => {
    expect(endpointValide("http://fcm.googleapis.com/fcm/send/x")).toBeNull();
    expect(endpointValide("https://exemple.com/push")).toBeNull();
    expect(endpointValide("https://127.0.0.1/push")).toBeNull();
    expect(endpointValide("https://localhost/push")).toBeNull();
    expect(endpointValide("https://fcm.googleapis.com.exemple.com/x")).toBeNull();
    expect(endpointValide("https://user:mdp@fcm.googleapis.com/x")).toBeNull();
    expect(endpointValide("https://fcm.googleapis.com:8443/x")).toBeNull();
    expect(endpointValide(`${FCM}${"a".repeat(1_100)}`)).toBeNull();
    expect(endpointValide(42)).toBeNull();
  });

  it("verifie la forme des cles de chiffrement", () => {
    const bonnes = cles();
    expect(abonnementValide({ endpoint: FCM, keys: bonnes })).toEqual({ endpoint: FCM, cles: bonnes });
    expect(abonnementValide({ endpoint: FCM, keys: { ...bonnes, auth: "court" } })).toBeNull();
    expect(abonnementValide({ endpoint: FCM, keys: { ...bonnes, p256dh: "a b" } })).toBeNull();
    expect(abonnementValide({ endpoint: FCM })).toBeNull();
    expect(abonnementValide(null)).toBeNull();
  });
});

describe("favoris", () => {
  it("dedoublonne et ecarte les heros absents du catalogue", () => {
    expect(favorisValides(["khufra", "layla", "khufra", "inconnu"], CONNUS)).toEqual(["khufra", "layla"]);
    expect(favorisValides([], CONNUS)).toEqual([]);
  });

  it("refuse une forme invalide ou une liste trop longue", () => {
    expect(favorisValides("khufra", CONNUS)).toBeNull();
    expect(favorisValides(["khufra", 3], CONNUS)).toBeNull();
    expect(favorisValides(["Khufra"], CONNUS)).toBeNull();
    expect(favorisValides(["../etc"], CONNUS)).toBeNull();
    expect(favorisValides(Array.from({ length: MAX_FAVORIS + 1 }, () => "khufra"), CONNUS)).toBeNull();
  });
});

describe("demandes de l'API", () => {
  const abonnement = { endpoint: FCM, keys: cles() };

  it("abonnement : langue du site obligatoire", () => {
    expect(validerDemande("abonner", { abonnement, langue: "it", favoris: ["ruby"] }, CONNUS)).toMatchObject({
      type: "abonner",
      langue: "it",
      favoris: ["ruby"],
    });
    expect(validerDemande("abonner", { abonnement, langue: "de", favoris: [] }, CONNUS)).toBeNull();
    expect(validerDemande("abonner", { abonnement, favoris: [] }, CONNUS)).toBeNull();
  });

  it("mise a jour : langue facultative, favoris obligatoires", () => {
    expect(validerDemande("maj", { abonnement, favoris: ["saber"] }, CONNUS)).toMatchObject({ langue: null });
    expect(validerDemande("maj", { abonnement, langue: "es", favoris: [] }, CONNUS)).toMatchObject({ langue: "es" });
    expect(validerDemande("maj", { abonnement }, CONNUS)).toBeNull();
    expect(validerDemande("maj", { abonnement, langue: 3, favoris: [] }, CONNUS)).toBeNull();
  });

  it("desinscription : l'abonnement suffit, mais complet", () => {
    expect(validerDemande("desabonner", { abonnement }, CONNUS)).toMatchObject({ type: "desabonner" });
    expect(validerDemande("desabonner", { abonnement: { endpoint: FCM } }, CONNUS)).toBeNull();
    expect(validerDemande("desabonner", [abonnement], CONNUS)).toBeNull();
  });
});

describe("destinataires d'un patch", () => {
  const patch = {
    version: "2.1.88",
    ajustements: [
      { slug: "saber", type: "amelioration" as const },
      { slug: "khufra", type: "amelioration" as const },
      { slug: "layla", type: "affaiblissement" as const },
      { slug: "khufra", type: "ajustement" as const },
    ],
  };

  it("ne retient que les abonnes dont un favori est touche", () => {
    const envois = destinataires([abonne("a", ["tigreal"]), abonne("b", ["layla", "khufra"]), abonne("c", [])], patch);
    expect(envois.map((e) => e.abonne.endpoint)).toEqual([`${FCM}b`]);
  });

  it("suit l'ordre des notes de patch, un heros une seule fois", () => {
    const [envoi] = destinataires([abonne("b", ["layla", "khufra"])], patch);
    expect(envoi.touches).toEqual([
      { slug: "khufra", type: "amelioration" },
      { slug: "layla", type: "affaiblissement" },
    ]);
  });
});

describe("message d'une notification", () => {
  const messages = {
    notifPush: {
      titre: {
        amelioration: "Patch {version} : amélioration pour {nom}",
        affaiblissement: "Patch {version} : affaiblissement pour {nom}",
        ajustement: "Patch {version} : ajustements pour {nom}",
      },
      titrePlusieurs: "Patch {version} : {n} de vos favoris modifiés",
      corpsUn: "Le détail est sur sa fiche, dans l'onglet Stats.",
      ligne: "{nom} : {type}",
      autre: "et {n} autre",
      autres: "et {n} autres",
    },
    patchHeros: { amelioration: "Amélioration", affaiblissement: "Affaiblissement", ajustement: "Ajustement" },
    favoris: { alerte: { modifie: "Modifié" } },
  } satisfies Arbre;
  const t = creerTDepuis(messages);
  const noms = { khufra: "Khufra", layla: "Layla", saber: "Saber", ruby: "Ruby", tigreal: "Tigreal" };

  it("un seul heros : titre nominatif, lien vers l'onglet Stats de sa fiche", () => {
    const m = construireMessage(t, "fr", "2.1.88", [{ slug: "khufra", type: "amelioration" }], noms);
    expect(m).toEqual({
      titre: "Patch 2.1.88 : amélioration pour Khufra",
      corps: "Le détail est sur sa fiche, dans l'onglet Stats.",
      url: "/fr/heroes/khufra#stats",
      tag: "patch-2.1.88",
      langue: "fr",
    });
  });

  it("un ajustement sans type est traite comme un ajustement", () => {
    const m = construireMessage(t, "en", "2.1.88", [{ slug: "layla", type: null }], noms);
    expect(m.titre).toBe("Patch 2.1.88 : ajustements pour Layla");
    expect(m.url).toBe("/en/heroes/layla#stats");
  });

  it("plusieurs heros : trois cites, les autres comptes, lien vers le patch", () => {
    const touches = [
      { slug: "khufra", type: "amelioration" as const },
      { slug: "layla", type: "affaiblissement" as const },
      { slug: "saber", type: null },
      { slug: "ruby", type: "ajustement" as const },
      { slug: "tigreal", type: "ajustement" as const },
    ];
    const m = construireMessage(t, "es", "2.1.88", touches, noms);
    expect(m.titre).toBe("Patch 2.1.88 : 5 de vos favoris modifiés");
    expect(m.corps).toBe("Khufra : Amélioration\nLayla : Affaiblissement\nSaber : Modifié\net 2 autres");
    expect(m.url).toBe("/es/patch-notes/2.1.88");

    const quatre = construireMessage(t, "fr", "2.1.88", touches.slice(0, 4), noms);
    expect(quatre.corps.split("\n").at(-1)).toBe("et 1 autre");
    const deux = construireMessage(t, "fr", "2.1.88", touches.slice(0, 2), noms);
    expect(deux.corps).toBe("Khufra : Amélioration\nLayla : Affaiblissement");
  });

  it("un slug sans nom connu reste lisible", () => {
    const m = construireMessage(t, "fr", "2.1.88", [{ slug: "nouveau", type: "amelioration" }], noms);
    expect(m.titre).toBe("Patch 2.1.88 : amélioration pour nouveau");
  });
});

describe("versions", () => {
  it("compare numeriquement", () => {
    expect(comparerVersions("2.1.88", "1.9.47")).toBeGreaterThan(0);
    expect(comparerVersions("1.8.78", "1.8.100")).toBeLessThan(0);
    expect(comparerVersions("2.1.88", "2.1.88")).toBe(0);
  });
});

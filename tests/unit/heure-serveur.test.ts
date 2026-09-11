import { describe, expect, it } from "vitest";
import {
  decalageFuseau,
  decomposer,
  finsDeSaison,
  libelleDecalage,
  muralServeur,
  prochaineFinSaison,
  prochaineRemiseHebdo,
  prochaineRemiseQuotidienne,
  prochainStarlight,
} from "@/lib/heure-serveur";
import { patchsDetail } from "@/lib/donnees";

const iso = (ms: number) => new Date(ms).toISOString();
const t = (s: string) => Date.parse(s);

describe("heure serveur (UTC-8)", () => {
  it("donne l'heure murale du serveur", () => {
    const m = muralServeur(t("2026-09-11T08:00:00Z"));
    expect(m.getUTCHours()).toBe(0);
    expect(m.getUTCDate()).toBe(11);
  });

  it("place la remise quotidienne a 08:00 UTC, strictement apres l'instant", () => {
    expect(iso(prochaineRemiseQuotidienne(t("2026-09-11T07:59:59Z")))).toBe("2026-09-11T08:00:00.000Z");
    expect(iso(prochaineRemiseQuotidienne(t("2026-09-11T08:00:00Z")))).toBe("2026-09-12T08:00:00.000Z");
    expect(iso(prochaineRemiseQuotidienne(t("2026-12-31T23:00:00Z")))).toBe("2027-01-01T08:00:00.000Z");
  });

  it("place la remise hebdomadaire le lundi a 00:00 serveur", () => {
    // Vendredi 11 septembre 2026 -> lundi 14.
    expect(iso(prochaineRemiseHebdo(t("2026-09-11T12:00:00Z")))).toBe("2026-09-14T08:00:00.000Z");
    // Lundi 07:00 UTC : encore dimanche 23:00 au serveur.
    expect(iso(prochaineRemiseHebdo(t("2026-09-14T07:00:00Z")))).toBe("2026-09-14T08:00:00.000Z");
    expect(iso(prochaineRemiseHebdo(t("2026-09-14T08:00:00Z")))).toBe("2026-09-21T08:00:00.000Z");
  });

  it("fait repartir le Starlight le 1er du mois, annee suivante comprise", () => {
    expect(iso(prochainStarlight(t("2026-09-11T12:00:00Z")))).toBe("2026-10-01T08:00:00.000Z");
    expect(iso(prochainStarlight(t("2026-10-01T07:59:00Z")))).toBe("2026-10-01T08:00:00.000Z");
    expect(iso(prochainStarlight(t("2026-10-01T08:00:00Z")))).toBe("2026-11-01T08:00:00.000Z");
    expect(iso(prochainStarlight(t("2026-12-15T00:00:00Z")))).toBe("2027-01-01T08:00:00.000Z");
  });
});

describe("durees et fuseaux", () => {
  it("decoupe une duree, jamais negative", () => {
    expect(decomposer(90_061_000)).toEqual({ jours: 1, heures: 1, minutes: 1, secondes: 1 });
    expect(decomposer(999)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 0 });
    expect(decomposer(-5000)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 0 });
  });

  it("suit l'heure d'ete des fuseaux IANA", () => {
    expect(decalageFuseau("Europe/Paris", Date.UTC(2026, 6, 1))).toBe(120);
    expect(decalageFuseau("Europe/Paris", Date.UTC(2026, 0, 15))).toBe(60);
    expect(decalageFuseau("Asia/Kolkata", Date.UTC(2026, 6, 1))).toBe(330);
    expect(decalageFuseau("Etc/GMT+8", Date.UTC(2026, 6, 1))).toBe(-480);
  });

  it("ecrit le decalage a la maniere UTC+x", () => {
    expect(libelleDecalage(330)).toBe("UTC+5:30");
    expect(libelleDecalage(-180)).toBe("UTC−3");
    expect(libelleDecalage(0)).toBe("UTC");
  });
});

describe("fins de saison annoncees", () => {
  const patch = (date: string, html: string) => ({ version: "x", lien: "https://exemple", date, sections: [{ html }] });

  it("lit l'heure serveur d'une fin de saison et la convertit en UTC", () => {
    const fins = finsDeSaison([patch("2024-03-05", "<li>S31 will end at 23:59:59 on 3/15 (Server Time).</li>")]);
    expect(fins).toHaveLength(1);
    expect(fins[0].saison).toBe(31);
    expect(iso(fins[0].fin)).toBe("2024-03-16T07:59:59.000Z");
  });

  it("passe a l'annee suivante pour une fin annoncee en decembre pour janvier", () => {
    const fins = finsDeSaison([patch("2025-12-20", "S40 will end at 23:59:59 on 1/5 (Server Time).")]);
    expect(iso(fins[0].fin)).toBe("2026-01-06T07:59:59.000Z");
  });

  it("ne garde que les fins a venir", () => {
    const fins = finsDeSaison([patch("2024-03-05", "S31 will end at 23:59:59 on 3/15 (Server Time).")]);
    expect(prochaineFinSaison(fins, t("2024-03-10T00:00:00Z"))?.saison).toBe(31);
    expect(prochaineFinSaison(fins, t("2026-09-11T00:00:00Z"))).toBeNull();
  });

  it("retrouve l'annonce de la saison 31 dans les notes synchronisees", () => {
    const fins = finsDeSaison(Object.values(patchsDetail));
    expect(fins.some((f) => f.saison === 31)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { splitLead } from "@/lib/lead";
import fr from "@/i18n/messages/fr.json";
import en from "@/i18n/messages/en.json";
import id from "@/i18n/messages/id.json";

describe("splitLead", () => {
  it("leaves a short lead whole", () => {
    expect(splitLead("Les 133 héros du jeu.")).toEqual({ visible: "Les 133 héros du jeu.", rest: null });
  });

  it("cuts a long lead after its first sentence", () => {
    const lead =
      "Les taux de victoire, de ban et de pick de chaque héros, remontés par le jeu, avec leur évolution sur sept jours. Triez selon n'importe quelle colonne, filtrez par rôle ou par position.";
    expect(splitLead(lead)).toEqual({
      visible:
        "Les taux de victoire, de ban et de pick de chaque héros, remontés par le jeu, avec leur évolution sur sept jours.",
      rest: "Triez selon n'importe quelle colonne, filtrez par rôle ou par position.",
    });
  });

  it("keeps a long single sentence whole, to be clamped rather than folded", () => {
    const lead = fr.pages.tierList.lead;
    expect(splitLead(lead).rest).toBeNull();
  });

  it("does not cut inside a patch number or a game name", () => {
    const lead =
      "La tier list du patch 2.1.90 de Mobile Legends: Bang Bang, calculée sur les taux de victoire et de ban remontés par le jeu à chaque synchronisation quotidienne.";
    expect(splitLead(lead).rest).toBeNull();
  });

  it("never loses a word, in any language", () => {
    const leads = [
      fr.pages.statistics.lead,
      fr.pages.heroes.lead,
      en.pages.statistics.lead,
      en.pages.heroes.lead,
      id.pages.statistics.lead,
      id.pages.heroes.lead,
    ];
    for (const lead of leads) {
      const { visible, rest } = splitLead(lead);
      expect([visible, rest].filter(Boolean).join(" ")).toBe(lead.trim());
    }
  });
});

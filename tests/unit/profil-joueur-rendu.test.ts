import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Les actions serveur lisent les cookies de Next : hors requete, on les remplace.
vi.mock("@/lib/actions", () => ({ reconnecter: vi.fn(), deconnecter: vi.fn() }));
vi.mock("@/lib/actions-profil", () => ({ partiesSuivantes: vi.fn() }));

import { PartiesRecentes } from "@/components/parties-recentes";
import { BilanJoueur, EtatProfil, ListeBourreaux, TableauHeros } from "@/components/profil-joueur";
import { EvolutionJoueur, FichesHerosRang, TableauPostes } from "@/components/profil-joueur-analyse";
import { CompleterMessages, FournisseurLangue } from "@/i18n/fournisseur";
import { creerT, messagesClient, messagesPage } from "@/i18n/traductions";
import { evolution, fichesHerosRang, statsParPosition, statsParRole } from "@/lib/analyse-joueur";
import { formaterPourcent } from "@/lib/format-joueur";
import { lireHerosFrequents, lireJson, lireParties, lireStats } from "@/lib/joueur-api";
import { afficherPartie, bilanSaison, comparerHeros } from "@/lib/profil-joueur";
import { rangLisible } from "@/lib/rangs";
import { HEROS_FREQUENTS, PARTIES_TEXTE, STATS, historiqueBrut, pageHistorique, partieBrute } from "./echantillons-joueur";

/** Le rendu echappe apostrophes et guillemets du texte : on compare au texte tel qu'on le lit. */
const decoderEntites = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * Rendu du profil de joueur avec les reponses d'exemple : la connexion reelle
 * demande un code recu en jeu, ces rendus sont la seule verification possible
 * de bout en bout hors ligne.
 */
const rendre = (element: ReactElement) =>
  decoderEntites(
    renderToStaticMarkup(
      h(FournisseurLangue, {
        langue: "fr",
        messages: messagesClient("fr"),
        // Comme la page : catalogue commun, plus les rubriques propres au profil.
        children: h(CompleterMessages, { messages: messagesPage("fr", ["pages.accountProfile"]), children: element }),
      }),
    ),
  );

const t = creerT("fr");
const donneesPartiesTexte = (lireJson(PARTIES_TEXTE) as { data: unknown }).data;
const parties = lireParties(donneesPartiesTexte);
const frequents = lireHerosFrequents(HEROS_FREQUENTS.data).entrees;

describe("PartiesRecentes", () => {
  it("rend chaque partie avec son heros, son issue et son KDA", () => {
    const html = rendre(
      h(PartiesRecentes, { saison: 40, initiales: parties.entrees.map(afficherPartie), suivant: parties.suivant }),
    );
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html).toContain('href="/fr/heroes/fanny"');
    expect(html).toContain("14 / 1 / 11");
    expect(html).toMatch(/<time dateTime="2026-03-30T08:06:39.000Z">/i);
    // Heros inconnu du site : nom du service, sans lien.
    expect(html).toContain("Nouveau Heros");
    expect(html).not.toContain("/heroes/null");
    expect(html).toContain("<button");
  });

  it("n'offre pas de page suivante quand il n'y en a plus", () => {
    const html = rendre(h(PartiesRecentes, { saison: 40, initiales: parties.entrees.map(afficherPartie), suivant: null }));
    expect(html).not.toContain("<button");
  });

  it("annonce une saison sans partie", () => {
    const html = rendre(h(PartiesRecentes, { saison: 40, initiales: [], suivant: null }));
    expect(html).not.toContain("<ol");
    expect(html).toContain("<p");
  });
});

describe("blocs du profil", () => {
  it("rend le tableau des heros face a la moyenne du rang", () => {
    const lignes = comparerHeros(frequents, "mythic");
    const html = rendre(h(TableauHeros, { lignes, tranche: "mythic", t, langue: "fr" }));
    expect(html).toContain("<table");
    expect(html.match(/scope="row"/g)).toHaveLength(6);
    expect(html).toContain(formaterPourcent(87.5, "fr"));
    expect(html).toContain('href="/fr/heroes/ling"');
  });

  it("rend le bilan de saison et celui des saisons suivies", () => {
    const html = rendre(
      h(BilanJoueur, {
        bilan: bilanSaison(frequents),
        complet: false,
        rang: rangLisible(166),
        stats: lireStats(STATS.data),
        t,
        langue: "fr",
      }),
    );
    expect(html).toContain(">58<");
    expect(html).toContain(formaterPourcent((35 / 58) * 100, "fr"));
    expect(html).toContain("308");
  });

  it("propose de se reconnecter quand la session a expire", () => {
    const html = rendre(h(EtatProfil, { type: "expiree", t }));
    expect(html).toContain("<form");
    expect(html).toContain('type="submit"');
  });

  it("dit quand le detail des parties ne porte pas les equipes", () => {
    const vide = rendre(h(ListeBourreaux, { analyse: { liste: [], analysees: 0 }, t, langue: "fr" }));
    expect(vide).not.toContain("<ul");
  });
});

describe("analyses du profil", () => {
  const historique = lireParties((lireJson(pageHistorique(historiqueBrut(), null)) as { data: unknown }).data).entrees;

  it("rend les roles avec leur part, point fort et point faible", () => {
    const bilan = statsParRole(frequents);
    const html = rendre(h(TableauPostes, { type: "roles", titre: "Par rôle", source: "Saison", bilan, t, langue: "fr" }));
    expect(html.match(/scope="row"/g)).toHaveLength(5);
    expect(html).toContain(t("roles.Assassin"));
    expect(html).toContain(t("pages.accountProfile.pointFort"));
    expect(html).toContain(t("pages.accountProfile.aTravailler"));
    expect(html).toContain(formaterPourcent((33 / 58) * 100, "fr"));
  });

  it("rend les positions de l'historique, parties sans position signalees", () => {
    // Chou, deux positions au catalogue, sans `lid` : la partie ne peut etre rangee.
    const brut = lireJson(pageHistorique([partieBrute(950, 26, null, 1, 1774857999)], null)) as { data: unknown };
    const chou = lireParties(brut.data);
    const bilan = statsParPosition([...historique, ...lireParties(donneesPartiesTexte).entrees, ...chou.entrees]);
    const html = rendre(h(TableauPostes, { type: "lanes", titre: "Par position", source: "", bilan, t, langue: "fr" }));
    expect(html).toContain(t("lanes.Jungle"));
    expect(bilan.ecartees).toBe(1);
    expect(html).toContain(t("pages.accountProfile.sansPosition.un", { n: 1 }));
  });

  it("rend series, forme et courbe de l'evolution", () => {
    const html = rendre(h(EvolutionJoueur, { evo: evolution(historique), fin: true, t, langue: "fr" }));
    expect(html).toContain('role="img"');
    expect(html.match(/<dt/g)).toHaveLength(4);
    expect(html).toContain(formaterPourcent(70, "fr"));
    expect(html).toContain("<path");
  });

  it("se passe de courbe sur un historique trop court", () => {
    const html = rendre(h(EvolutionJoueur, { evo: evolution(historique.slice(0, 6)), fin: false, t, langue: "fr" }));
    expect(html).not.toContain('role="img"');
    expect(html).toContain("<dl");
  });

  it("rend build et contres du rang, avec les liens vers les onglets de la fiche", () => {
    const fiches = fichesHerosRang(comparerHeros(frequents, "mythic"), "mythic", historique);
    const html = rendre(h(FichesHerosRang, { fiches, tranche: "mythic", t, langue: "fr" }));
    expect(html).toContain('href="/fr/heroes/ling#builds"');
    expect(html).toContain('href="/fr/heroes/ling#contres"');
    expect(html).toMatch(/href="\/fr\/items#[a-z0-9-]+"/);
    expect(html.match(/<li class="biseau/g)).toHaveLength(3);
  });
});

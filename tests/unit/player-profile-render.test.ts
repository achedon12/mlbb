import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Les actions serveur lisent les cookies de Next : hors requete, on les remplace.
vi.mock("@/lib/actions", () => ({ reconnect: vi.fn(), disconnect: vi.fn() }));
vi.mock("@/lib/profile-actions", () => ({ nextMatches: vi.fn() }));

import { RecentMatches } from "@/components/recent-matches";
import { PlayerSummary, StateProfile, ListNemeses, HeroTable } from "@/components/player-profile";
import { EvolutionPlayer, HeroRankSheets, TableRoles } from "@/components/player-profile-analysis";
import { ExtendMessages, LocaleProvider } from "@/i18n/provider";
import { createT, messagesClient, messagesPage } from "@/i18n/translations";
import { evolution, heroRankSheets, statsByPosition, statsByRole } from "@/lib/player-analysis";
import { formatPercent } from "@/lib/player-format";
import { readFrequentHeroes, readJson, readMatches, readStats } from "@/lib/player-api";
import { showMatch, summarySeason, compareHeroes } from "@/lib/player-profile";
import { readableRank } from "@/lib/ranks";
import { FREQUENT_HEROES, MATCHES_TEXT, STATS, historyRaw, pageHistory, matchRaw } from "./player-samples";

/** Le rendu echappe apostrophes et guillemets du texte : on compare au texte tel qu'on le lit. */
const decodeEntities = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * Rendu du profil de joueur avec les reponses d'exemple : la connexion reelle
 * demande un code recu en jeu, ces rendus sont la seule verification possible
 * de bout en bout hors ligne.
 */
const render = (element: ReactElement) =>
  decodeEntities(
    renderToStaticMarkup(
      h(LocaleProvider, {
        locale: "fr",
        messages: messagesClient("fr"),
        // Comme la page : catalogue commun, plus les rubriques propres au profil.
        children: h(ExtendMessages, { messages: messagesPage("fr", ["pages.accountProfile"]), children: element }),
      }),
    ),
  );

const t = createT("fr");
const dataMatchesText = (readJson(MATCHES_TEXT) as { data: unknown }).data;
const matches = readMatches(dataMatchesText);
const frequents = readFrequentHeroes(FREQUENT_HEROES.data).entries;

describe("RecentMatches", () => {
  it("renders each match with its hero, outcome and KDA", () => {
    const html = render(
      h(RecentMatches, { season: 40, initials: matches.entries.map(showMatch), next: matches.next }),
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

  it("offers no next page when there are none left", () => {
    const html = render(h(RecentMatches, { season: 40, initials: matches.entries.map(showMatch), next: null }));
    expect(html).not.toContain("<button");
  });

  it("announces a season without matches", () => {
    const html = render(h(RecentMatches, { season: 40, initials: [], next: null }));
    expect(html).not.toContain("<ol");
    expect(html).toContain("<p");
  });
});

describe("profile blocks", () => {
  it("renders the hero table against the rank average", () => {
    const rows = compareHeroes(frequents, "mythic");
    const html = render(h(HeroTable, { rows, bucket: "mythic", t, locale: "fr" }));
    expect(html).toContain("<table");
    expect(html.match(/scope="row"/g)).toHaveLength(6);
    expect(html).toContain(formatPercent(87.5, "fr"));
    expect(html).toContain('href="/fr/heroes/ling"');
  });

  it("renders the season summary and the tracked seasons summary", () => {
    const html = render(
      h(PlayerSummary, {
        summary: summarySeason(frequents),
        full: false,
        rank: readableRank(166),
        stats: readStats(STATS.data),
        t,
        locale: "fr",
      }),
    );
    expect(html).toContain(">58<");
    expect(html).toContain(formatPercent((35 / 58) * 100, "fr"));
    expect(html).toContain("308");
  });

  it("offers to sign in again when the session has expired", () => {
    const html = render(h(StateProfile, { type: "expired", t }));
    expect(html).toContain("<form");
    expect(html).toContain('type="submit"');
  });

  it("says when the match details do not include teams", () => {
    const empty = render(h(ListNemeses, { analysis: { list: [], analyzed: 0 }, t, locale: "fr" }));
    expect(empty).not.toContain("<ul");
  });
});

describe("profile analyses", () => {
  const history = readMatches((readJson(pageHistory(historyRaw(), null)) as { data: unknown }).data).entries;

  it("renders roles with their share, strength and weakness", () => {
    const summary = statsByRole(frequents);
    const html = render(h(TableRoles, { type: "roles", title: "Par rôle", source: "Saison", summary, t, locale: "fr" }));
    expect(html.match(/scope="row"/g)).toHaveLength(5);
    expect(html).toContain(t("roles.Assassin"));
    expect(html).toContain(t("pages.accountProfile.strongPoint"));
    expect(html).toContain(t("pages.accountProfile.toImprove"));
    expect(html).toContain(formatPercent((33 / 58) * 100, "fr"));
  });

  it("renders history positions, flagging matches without a position", () => {
    // Chou, deux positions au catalogue, sans `lid` : la partie ne peut etre rangee.
    const raw = readJson(pageHistory([matchRaw(950, 26, null, 1, 1774857999)], null)) as { data: unknown };
    const chou = readMatches(raw.data);
    const summary = statsByPosition([...history, ...readMatches(dataMatchesText).entries, ...chou.entries]);
    const html = render(h(TableRoles, { type: "lanes", title: "Par position", source: "", summary, t, locale: "fr" }));
    expect(html).toContain(t("lanes.Jungle"));
    expect(summary.excluded).toBe(1);
    expect(html).toContain(t("pages.accountProfile.noPosition.one", { n: 1 }));
  });

  it("renders streaks, form and the evolution chart", () => {
    const html = render(h(EvolutionPlayer, { evo: evolution(history), end: true, t, locale: "fr" }));
    expect(html).toContain('role="img"');
    expect(html.match(/<dt/g)).toHaveLength(4);
    expect(html).toContain(formatPercent(70, "fr"));
    expect(html).toContain("<path");
  });

  it("does without a chart on a history that is too short", () => {
    const html = render(h(EvolutionPlayer, { evo: evolution(history.slice(0, 6)), end: false, t, locale: "fr" }));
    expect(html).not.toContain('role="img"');
    expect(html).toContain("<dl");
  });

  it("renders the rank's build and counters, with links to the hero page tabs", () => {
    const sheets = heroRankSheets(compareHeroes(frequents, "mythic"), "mythic", history);
    const html = render(h(HeroRankSheets, { sheets, bucket: "mythic", t, locale: "fr" }));
    expect(html).toContain('href="/fr/heroes/ling#builds"');
    expect(html).toContain('href="/fr/heroes/ling#contres"');
    expect(html).toMatch(/href="\/fr\/items#[a-z0-9-]+"/);
    expect(html.match(/<li class="bevel/g)).toHaveLength(3);
  });
});

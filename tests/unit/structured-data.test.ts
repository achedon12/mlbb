import { describe, expect, it } from "vitest";
import {
  eventMonthData,
  faqPageData,
  heroAnswer,
  heroFaq,
  heroKind,
  lastDayOfMonth,
  type HeroFacts,
} from "@/lib/structured-data";
import { createT } from "@/i18n/translations";
import { site } from "@/lib/site";

const t = createT("en");

const facts: HeroFacts = {
  name: "Aamon",
  kind: "Assassin, Jungle",
  rate: { tier: "S", winRate: "52.4%" },
  counters: "Saber, Natalia and Lukas",
  build: { items: "Rapid Boots, Feather of Heaven and Holy Crystal", emblem: "Assassin" },
  version: "2.1.40",
  date: "November 24, 2026",
};

describe("FAQPage", () => {
  it("lists each question with its accepted answer, in the page's language", () => {
    const data = faqPageData("fr", {
      path: "/heroes/aamon",
      items: [{ question: "Qui contre Aamon ?", answer: "Saber." }],
      changed: "2026-11-24",
    });
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      url: `${site.url}/fr/heroes/aamon`,
      inLanguage: "fr-FR",
      dateModified: "2026-11-24",
      mainEntity: [{ "@type": "Question", name: "Qui contre Aamon ?", acceptedAnswer: { "@type": "Answer", text: "Saber." } }],
    });
  });

  it("is null without any question, and drops empty ones", () => {
    expect(faqPageData("en", { path: "/x", items: [] })).toBeNull();
    expect(faqPageData("en", { path: "/x", items: [{ question: " ", answer: "a" }] })).toBeNull();
    expect(faqPageData("en", { path: "/x", items: [{ question: "q", answer: "a" }] })).not.toHaveProperty("dateModified");
  });
});

describe("a hero's short answer", () => {
  it("joins roles and lanes", () => {
    expect(heroKind(["Fighter", "Assassin"], ["Exp", "Jungle"])).toBe("Fighter / Assassin, Exp / Jungle");
    expect(heroKind(["Support"], [])).toBe("Support");
  });

  it("says tier, win rate, patch and date, then who counters the hero", () => {
    expect(heroAnswer(t, facts)).toEqual([
      "Aamon (Assassin, Jungle) is S tier with a 52.4% win rate across all ranks on patch 2.1.40, measured November 24, 2026.",
      "The heroes that counter Aamon best, all ranks combined: Saber, Natalia and Lukas.",
    ]);
  });

  it("stays one sentence for an unmeasured hero without counters", () => {
    expect(heroAnswer(t, { ...facts, rate: null, counters: null })).toEqual([
      "Aamon (Assassin, Jungle) is not played enough in ranked games to be measured yet.",
    ]);
  });

  it("answers the page's questions with the same sentences", () => {
    const [lead, counters] = heroAnswer(t, facts);
    expect(heroFaq(t, facts)).toEqual([
      { question: "Is Aamon good in the current patch?", answer: lead },
      { question: "Who counters Aamon?", answer: counters },
      {
        question: "What is the best build for Aamon?",
        answer: "The most played Aamon build, all ranks combined: Rapid Boots, Feather of Heaven and Holy Crystal, with the Assassin emblem.",
      },
    ]);
  });

  it("leaves out a question it has no data for", () => {
    const faq = heroFaq(t, { ...facts, rate: null, build: null });
    expect(faq.map((x) => x.question)).toEqual(["Who counters Aamon?"]);
    expect(heroFaq(t, { ...facts, build: { items: "A and B", emblem: null } }).at(-1)?.answer).toBe(
      "The most played Aamon build, all ranks combined: A and B.",
    );
  });
});

describe("a month of events", () => {
  it("knows each month's last day, leap years included", () => {
    expect(lastDayOfMonth("2026-11")).toBe("2026-11-30");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });

  it("is an online Event running the whole month", () => {
    const data = eventMonthData("en", {
      name: "MLBB StarLight November 2026",
      description: "One StarLight skin.",
      path: "/events/2026-11",
      month: "2026-11",
      image: "/visuels/skins/x.webp",
    });
    expect(data).toMatchObject({
      "@type": "Event",
      url: `${site.url}/en/events/2026-11`,
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      location: { "@type": "VirtualLocation" },
      image: `${site.url}/visuels/skins/x.webp`,
    });
    expect(eventMonthData("en", { name: "n", description: "d", path: "/p", month: "2026-01" })).not.toHaveProperty("image");
  });
});

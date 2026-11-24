import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { site } from "./site";

/**
 * Structured data builders written for answer engines (search snippets,
 * assistants that cite a source): a page's factual questions as a
 * `FAQPage`, a hero's short answer, a month of game events as an `Event`.
 *
 * No data import: the pages hand over figures already measured and
 * formatted, so the builders stay pure and the tests run without the
 * catalogue. Every answer repeats text the page shows, never more.
 */

export interface QuestionAnswer {
  question: string;
  answer: string;
}

/** The game every page is about, as the other blocks name it. */
const GAME = { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" } as const;

/**
 * A page's questions and their answers, as a `FAQPage`. Null without any
 * question: an empty `mainEntity` is invalid.
 */
export function faqPageData(
  locale: Locale,
  o: { path: string; items: QuestionAnswer[]; changed?: string | null },
) {
  const items = o.items.filter((x) => x.question.trim() && x.answer.trim());
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${site.url}/${locale}${o.path}`,
    inLanguage: LOCALE_HTML[locale],
    ...(o.changed ? { dateModified: o.changed } : {}),
    about: GAME,
    mainEntity: items.map((x) => ({
      "@type": "Question",
      name: x.question,
      acceptedAnswer: { "@type": "Answer", text: x.answer },
    })),
  };
}

/** What a hero page knows, already formatted in the page's language. */
export interface HeroFacts {
  name: string;
  /** Roles, then lanes: "Assassin, Jungle" (`heroKind`). */
  kind: string;
  /** Measured tier and win rate, all ranks; null for an unmeasured hero. */
  rate: { tier: string; winRate: string } | null;
  /** The heroes that counter it best, all ranks, as a sentence list. */
  counters: string | null;
  /** The most played build, all ranks: item names as a list, emblem's name. */
  build: { items: string; emblem: string | null } | null;
  /** Current patch number. */
  version: string;
  /** Measurement date, long form. */
  date: string;
}

/**
 * "Assassin, Jungle": roles, then lanes when the hero has any. The messages
 * put it in parentheses after the name, so it holds none of its own.
 */
export function heroKind(roles: string[], lanes: string[]): string {
  const r = roles.join(" / ");
  return lanes.length ? `${r}, ${lanes.join(" / ")}` : r;
}

/**
 * The hero page's short answer, one or two sentences: kind, tier, win rate,
 * patch and date, then who counters it. Shown at the top of the page and
 * reused as the answers below, so the two never disagree.
 */
export function heroAnswer(t: T, f: HeroFacts): string[] {
  const lead = f.rate
    ? t("pages.heroDetail.answer.summary", { name: f.name, kind: f.kind, tier: f.rate.tier, winRate: f.rate.winRate, v: f.version, date: f.date })
    : t("pages.heroDetail.answer.summaryNoRate", { name: f.name, kind: f.kind });
  return f.counters ? [lead, t("pages.heroDetail.answer.counters", { name: f.name, counters: f.counters })] : [lead];
}

/**
 * The questions a hero page is searched for — is it good, who counters it,
 * what to build — answered from its measurements. A question without data
 * is left out rather than answered vaguely.
 */
export function heroFaq(t: T, f: HeroFacts): QuestionAnswer[] {
  const [lead, counters] = heroAnswer(t, f);
  const items: QuestionAnswer[] = [];
  if (f.rate) items.push({ question: t("pages.heroDetail.answer.faqGood", { name: f.name }), answer: lead });
  if (counters) items.push({ question: t("pages.heroDetail.answer.faqCounters", { name: f.name }), answer: counters });
  if (f.build?.items) {
    items.push({
      question: t("pages.heroDetail.answer.faqBuild", { name: f.name }),
      answer: f.build.emblem
        ? t("pages.heroDetail.answer.buildEmblem", { name: f.name, items: f.build.items, emblem: f.build.emblem })
        : t("pages.heroDetail.answer.build", { name: f.name, items: f.build.items }),
    });
  }
  return items;
}

/** Last day of a month, "2026-02" → "2026-02-28". */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * A month of in-game releases (its StarLight pass, Collector and event
 * skins) as an online `Event` running the whole calendar month, held in
 * the game itself. No `dateModified`: an `Event` is not a creative work;
 * the page's `CollectionPage` carries the data date.
 */
export function eventMonthData(
  locale: Locale,
  o: { name: string; description: string; path: string; month: string; image?: string | null },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: o.name,
    description: o.description,
    url: `${site.url}/${locale}${o.path}`,
    inLanguage: LOCALE_HTML[locale],
    startDate: `${o.month}-01`,
    endDate: lastDayOfMonth(o.month),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: "https://m.mobilelegends.com/" },
    organizer: { "@type": "Organization", name: "Moonton" },
    ...(o.image ? { image: new URL(o.image, site.url).toString() } : {}),
    about: GAME,
  };
}

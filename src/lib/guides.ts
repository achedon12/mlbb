import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked, type Token, type Tokens } from "marked";
import { LANES } from "./draft";
import type { Lane, Role } from "./types";
import { keySearch } from "./utils";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Long-form guides: strategy (laning, objectives, drafting…) and one guide per
 * lane.
 *
 * They are Markdown files in `content/<locale>/guides/`, written in French and
 * translated by `npm run translate:articles`, like the news. Unlike a news
 * post, a guide is kept up to date rather than dated: its file name is its
 * address, and its front matter carries an `updated` date, its kind, its order
 * on the hub, the guides it leads to and the tools it uses.
 *
 * A role guide holds two markers, `<!-- guide:heroes -->` and
 * `<!-- guide:kit -->`, where the page inserts the lane's heroes and builds
 * read from the latest measurements: the text never names a "best hero" that
 * the next patch would make wrong.
 */
const ROOT = path.join(process.cwd(), "content");
const SECTION = "guides";
/** Guides are written in French: the French folder defines which guides exist. */
const SOURCE_LOCALE: Locale = "fr";

export const GUIDE_KINDS = ["strategy", "role"] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];

/** Live blocks a role guide can place in its text. */
export const GUIDE_BLOCKS = ["heroes", "kit"] as const;
export type GuideBlock = (typeof GUIDE_BLOCKS)[number];
const BLOCK_MARKER = /^<!--\s*guide:([a-z]+)\s*-->$/;

export interface Guide {
  slug: string;
  title: string;
  /** Short name, for the breadcrumb and the links other pages point to it with. */
  short: string;
  summary: string;
  kind: GuideKind;
  /** Lane of a role guide; null for a strategy guide. */
  lane: Lane | null;
  /** Position on the hub, within its kind. */
  order: number;
  /** First publication, ISO date. */
  date: string;
  /** Last substantive revision, ISO date. */
  updated: string;
  author: string;
  keywords: string[];
  /** Slugs of the guides suggested at the end. */
  related: string[];
  /** Site tools the guide leads to, as paths without locale ("/draft"). */
  tools: string[];
  content: string;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

function parse(slug: string, raw: string): Guide {
  const { data, content } = matter(raw);
  const kind = GUIDE_KINDS.includes(data.kind) ? (data.kind as GuideKind) : "strategy";
  const lane = LANES.includes(data.lane) ? (data.lane as Lane) : null;
  const date = String(data.date ?? "");
  return {
    slug,
    title: String(data.title ?? slug),
    short: String(data.short ?? data.title ?? slug),
    summary: String(data.summary ?? ""),
    kind,
    lane,
    order: Number(data.order ?? 0),
    date,
    updated: String(data.updated ?? date),
    author: String(data.author ?? "achedon12"),
    keywords: strings(data.keywords),
    related: strings(data.related),
    tools: strings(data.tools),
    content,
  };
}

const folder = (locale: Locale) => path.join(ROOT, locale, SECTION);

/** Slugs of every guide, from the French source folder, in file order. */
export function guideSlugs(): string[] {
  const dir = folder(SOURCE_LOCALE);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/**
 * A guide in the reader's language. A translation not produced yet falls back
 * to English, then to the French source: a guide never 404s in one language
 * only.
 */
export function guide(slug: string, locale: Locale = DEFAULT_LOCALE): Guide | undefined {
  if (!guideSlugs().includes(slug)) return undefined;
  for (const l of [locale, DEFAULT_LOCALE, SOURCE_LOCALE]) {
    const file = path.join(folder(l), `${slug}.md`);
    if (fs.existsSync(file)) return parse(slug, fs.readFileSync(file, "utf8"));
  }
  return undefined;
}

/** Every guide, strategy first, each kind in its hub order. */
export function guides(locale: Locale = DEFAULT_LOCALE): Guide[] {
  return guideSlugs()
    .map((slug) => guide(slug, locale))
    .filter((g): g is Guide => g !== undefined)
    .sort((a, b) => GUIDE_KINDS.indexOf(a.kind) - GUIDE_KINDS.indexOf(b.kind) || a.order - b.order);
}

/**
 * Lane whose guide a role's pages point to: where the role is usually played.
 * Tanks and supports share the roam guide.
 */
export const GUIDE_LANE_OF_ROLE: Record<Role, Lane> = {
  Marksman: "Gold",
  Fighter: "Exp",
  Mage: "Mid",
  Assassin: "Jungle",
  Tank: "Roam",
  Support: "Roam",
};

/** Guide of a lane, for the tier list and role pages that point to it. */
export function guideOfLane(lane: Lane, locale: Locale = DEFAULT_LOCALE): Guide | undefined {
  return guides(locale).find((g) => g.kind === "role" && g.lane === lane);
}

/** Most recent `updated` date of all guides, for the hub's sitemap entry. */
export function guidesUpdated(): string | undefined {
  return guides(SOURCE_LOCALE)
    .map((g) => g.updated)
    .sort()
    .at(-1);
}

// -- Reading ------------------------------------------------------------------

/** Words read per minute: a cautious pace for a text full of game terms. */
const WORDS_PER_MINUTE = 200;

/** Estimated reading time in whole minutes, at least one. */
export function readingMinutes(markdown: string): number {
  const text = markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#*_>`[\]-]/g, " ");
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// -- Headings and table of contents -----------------------------------------

/** Plain text of inline tokens: link labels kept, markup dropped. */
function plain(tokens: Token[] | undefined, fallback: string): string {
  if (!tokens) return fallback;
  return tokens.map((t) => ("tokens" in t && t.tokens ? plain(t.tokens, t.raw) : "text" in t ? t.text : t.raw)).join("");
}

/** "Phase de lane : les bases" → "phase-de-lane-les-bases". */
export function anchorOf(title: string): string {
  return (
    keySearch(title)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

export interface GuideHeading {
  level: number;
  title: string;
  anchor: string;
}

/** Gives every heading a unique anchor, in document order. */
function anchorAllocator() {
  const seen = new Map<string, number>();
  return (title: string) => {
    const base = anchorOf(title);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };
}

/**
 * Second-level headings of a guide, with the anchors the rendering gives them.
 * Live blocks are announced in the text by their own `##` heading, so they
 * appear here like any section.
 */
export function guideHeadings(markdown: string): GuideHeading[] {
  const allocate = anchorAllocator();
  return new Marked()
    .lexer(markdown)
    .filter((t): t is Tokens.Heading => t.type === "heading")
    .map((t) => ({ level: t.depth, title: plain(t.tokens, t.text), anchor: allocate(plain(t.tokens, t.text)) }))
    .filter((h) => h.level === 2);
}

// -- Rendering ----------------------------------------------------------------

export type GuidePart = { type: "html"; html: string } | { type: "block"; block: GuideBlock };

/**
 * A guide's body as HTML parts, cut at the live block markers. Headings carry
 * the anchors of `guideHeadings`, counted across the whole guide so that the
 * table of contents and the parts agree. The HTML still has to go through
 * `cleanGuideHtml`, which localizes internal links.
 */
export function renderGuide(markdown: string): GuidePart[] {
  const allocate = anchorAllocator();
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        return `<h${depth} id="${allocate(plain(tokens, text))}">${inner}</h${depth}>\n`;
      },
    },
  });

  const parts: GuidePart[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const source = buffer.join("\n").trim();
    if (source) parts.push({ type: "html", html: marked.parse(source, { async: false }) });
    buffer = [];
  };
  for (const line of markdown.split("\n")) {
    const block = line.trim().match(BLOCK_MARKER)?.[1];
    if (block && (GUIDE_BLOCKS as readonly string[]).includes(block)) {
      flush();
      parts.push({ type: "block", block: block as GuideBlock });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return parts;
}

/** Live blocks a guide places, in order. */
export const blocksOf = (markdown: string): GuideBlock[] =>
  renderGuide(markdown).flatMap((p) => (p.type === "block" ? [p.block] : []));

/** Internal link targets of a guide's text, without anchors or query ("/heroes/ling"). */
export function internalLinks(markdown: string): string[] {
  const targets = [...markdown.matchAll(/\]\((\/[^)\s#?]*)[^)]*\)/g)].map((m) => m[1]);
  return [...new Set(targets)];
}

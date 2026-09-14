import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Article } from "./types";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * Article reading.
 *
 * Content lives in `content/` as Markdown with a YAML header: a contributor
 * can open a pull request without touching the code. Reading happens at
 * build time, never at runtime — pages are static.
 */
const ROOT = path.join(process.cwd(), "content");

const SECTIONS = ["news", "patch-notes"] as const;
type Section = (typeof SECTIONS)[number];

/** Folder of a section for a language, falling back to the default locale. */
function folderOf(section: Section, locale: Locale): string {
  const local = path.join(ROOT, locale, section);
  if (fs.existsSync(local) && fs.readdirSync(local).some((f) => f.endsWith(".md"))) return local;
  return path.join(ROOT, DEFAULT_LOCALE, section);
}

/** Reads a folder's articles; `locale` is the reader's, for the missing-title fallback. */
export function readFolder(folder: string, locale: Locale): Article[] {
  if (!fs.existsSync(folder)) return [];
  const t = createT(locale);

  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(folder, file), "utf8");
      const { data, content } = matter(raw);

      return {
        // The file name starts with the date, which does not belong in the
        // URL: it is already carried by the structured data. The rest
        // becomes a URL segment, encoded: a file name must never be able to
        // form an executable link.
        slug: encodeURIComponent(file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")),
        title: String(data.title ?? t("articleUI.untitled")),
        date: String(data.date ?? ""),
        summary: String(data.summary ?? ""),
        category: (data.category ?? "News") as Article["category"],
        author: String(data.author ?? "achedon12"),
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
        content,
      } satisfies Article;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function articles(section: Section, locale: Locale = DEFAULT_LOCALE): Article[] {
  return readFolder(folderOf(section, locale), locale);
}

/** All articles combined, from newest to oldest. */
export function allArticles(locale: Locale = DEFAULT_LOCALE): Article[] {
  return SECTIONS.flatMap((s) => articles(s, locale)).sort((a, b) => b.date.localeCompare(a.date));
}

export function article(section: Section, slug: string, locale: Locale = DEFAULT_LOCALE): Article | undefined {
  return articles(section, locale).find((a) => a.slug === slug);
}

/** Renders an article's Markdown to HTML. */
export function toHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

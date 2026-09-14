import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Article } from "./types";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Lecture des articles.
 *
 * Le contenu vit dans `content/` en Markdown avec un en-tete YAML : un
 * contributeur peut ouvrir une pull request sans toucher au code. La lecture
 * se fait au build, jamais au runtime — les pages sont statiques.
 */
const ROOT = path.join(process.cwd(), "content");

const SECTIONS = ["news", "patch-notes"] as const;
type Section = (typeof SECTIONS)[number];

/** Dossier d'une section pour une langue, avec repli sur le francais. */
function folderOf(section: Section, locale: Locale): string {
  const local = path.join(ROOT, locale, section);
  if (fs.existsSync(local) && fs.readdirSync(local).some((f) => f.endsWith(".md"))) return local;
  return path.join(ROOT, DEFAULT_LOCALE, section);
}

function readFolder(folder: string): Article[] {
  if (!fs.existsSync(folder)) return [];

  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(folder, file), "utf8");
      const { data, content } = matter(raw);

      return {
        // Le nom de fichier commence par la date, qui n'a rien a faire dans
        // l'URL : elle est deja portee par les donnees structurees. Le reste
        // devient un segment d'adresse, encode : un nom de fichier ne doit
        // jamais pouvoir former un lien executable.
        slug: encodeURIComponent(file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")),
        title: String(data.title ?? "Sans titre"),
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
  return readFolder(folderOf(section, locale));
}

/** Tous les articles confondus, du plus recent au plus ancien. */
export function allArticles(locale: Locale = DEFAULT_LOCALE): Article[] {
  return SECTIONS.flatMap((s) => articles(s, locale)).sort((a, b) => b.date.localeCompare(a.date));
}

export function article(section: Section, slug: string, locale: Locale = DEFAULT_LOCALE): Article | undefined {
  return articles(section, locale).find((a) => a.slug === slug);
}

/** Rend le Markdown d'un article en HTML. */
export function toHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

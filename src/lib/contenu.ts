import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Article } from "./types";
import { LANGUE_DEFAUT, type Langue } from "@/i18n/config";

/**
 * Lecture des articles.
 *
 * Le contenu vit dans `content/` en Markdown avec un en-tete YAML : un
 * contributeur peut ouvrir une pull request sans toucher au code. La lecture
 * se fait au build, jamais au runtime — les pages sont statiques.
 */
const RACINE = path.join(process.cwd(), "content");

const SECTIONS = ["actualites", "patch-notes"] as const;
type Section = (typeof SECTIONS)[number];

/** Dossier d'une section pour une langue, avec repli sur le francais. */
function dossierDe(section: Section, locale: Langue): string {
  const local = path.join(RACINE, locale, section);
  if (fs.existsSync(local) && fs.readdirSync(local).some((f) => f.endsWith(".md"))) return local;
  return path.join(RACINE, LANGUE_DEFAUT, section);
}

function lireDossier(dossier: string): Article[] {
  if (!fs.existsSync(dossier)) return [];

  return fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith(".md"))
    .map((fichier) => {
      const brut = fs.readFileSync(path.join(dossier, fichier), "utf8");
      const { data, content } = matter(brut);

      return {
        // Le nom de fichier commence par la date, qui n'a rien a faire dans
        // l'URL : elle est deja portee par les donnees structurees. Le reste
        // devient un segment d'adresse, encode : un nom de fichier ne doit
        // jamais pouvoir former un lien executable.
        slug: encodeURIComponent(fichier.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")),
        title: String(data.title ?? "Sans titre"),
        date: String(data.date ?? ""),
        summary: String(data.summary ?? ""),
        category: (data.category ?? "Actualite") as Article["category"],
        author: String(data.author ?? "achedon12"),
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
        content: content,
      } satisfies Article;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function articles(section: Section, locale: Langue = LANGUE_DEFAUT): Article[] {
  return lireDossier(dossierDe(section, locale));
}

/** Tous les articles confondus, du plus recent au plus ancien. */
export function tousLesArticles(locale: Langue = LANGUE_DEFAUT): Article[] {
  return SECTIONS.flatMap((s) => articles(s, locale)).sort((a, b) => b.date.localeCompare(a.date));
}

export function article(section: Section, slug: string, locale: Langue = LANGUE_DEFAUT): Article | undefined {
  return articles(section, locale).find((a) => a.slug === slug);
}

/** Rend le Markdown d'un article en HTML. */
export function enHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

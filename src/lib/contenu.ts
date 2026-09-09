import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Article } from "./types";

/**
 * Lecture des articles.
 *
 * Le contenu vit dans `content/` en Markdown avec un en-tete YAML : un
 * contributeur peut ouvrir une pull request sans toucher au code. La lecture
 * se fait au build, jamais au runtime — les pages sont statiques.
 */
const RACINE = path.join(process.cwd(), "content");

const DOSSIERS: Record<string, string> = {
  actualites: path.join(RACINE, "actualites"),
  "patch-notes": path.join(RACINE, "patch-notes"),
};

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
        // l'URL : elle est deja portee par les donnees structurees.
        slug: fichier.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, ""),
        titre: String(data.titre ?? "Sans titre"),
        date: String(data.date ?? ""),
        chapeau: String(data.chapeau ?? ""),
        categorie: (data.categorie ?? "Actualite") as Article["categorie"],
        auteur: String(data.auteur ?? "achedon12"),
        motsCles: Array.isArray(data.motsCles) ? data.motsCles.map(String) : [],
        contenu: content,
      } satisfies Article;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function articles(section: keyof typeof DOSSIERS): Article[] {
  return lireDossier(DOSSIERS[section]);
}

/** Tous les articles confondus, du plus recent au plus ancien. */
export function tousLesArticles(): Article[] {
  return Object.keys(DOSSIERS)
    .flatMap((s) => articles(s as keyof typeof DOSSIERS))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function article(
  section: keyof typeof DOSSIERS,
  slug: string,
): Article | undefined {
  return articles(section).find((a) => a.slug === slug);
}

/** Rend le Markdown d'un article en HTML. */
export function enHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

import Link from "next/link";
import { assainirHtml } from "@/lib/html";
import { FilAriane } from "@/components/fil-ariane";
import type { Article } from "@/lib/types";
import { navigation } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

export function ListeArticles({
  articles,
  base,
}: {
  articles: Article[];
  base: string;
}) {
  if (articles.length === 0) {
    return <p className="text-craie-500">Aucune publication pour le moment.</p>;
  }

  return (
    <ul className="space-y-4">
      {articles.map((a) => (
        <li key={a.slug}>
          <Link
            href={`${base}/${a.slug}`}
            className="biseau block border border-nuit-700/70 bg-nuit-900/60 p-6 transition-colors hover:border-or-500/60"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
                {a.categorie}
              </span>
              <time dateTime={a.date} className="text-xs text-craie-500">
                {formaterDate(a.date)}
              </time>
            </div>
            <h2 className="mt-2 font-titre text-xl font-bold leading-snug text-craie-100">
              {a.titre}
            </h2>
            <p className="mt-3 leading-relaxed text-craie-500">{a.chapeau}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Corps d'article : en-tete, contenu rendu, et retour a la liste. */
export function CorpsArticle({
  article,
  html,
  retour,
}: {
  article: Article;
  html: string;
  retour: { href: string; label: string };
}) {
  // Nom de section pour le fil d'Ariane : celui de la navigation plutot que le
  // libelle du lien retour (« Tous les… »), qui ne nomme pas la rubrique.
  const section = navigation.find((n) => n.href === retour.href)?.label ?? retour.label;

  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <FilAriane miettes={[{ nom: section, href: retour.href }, { nom: article.titre }]} />
      <Link
        href={retour.href}
        className="mt-4 inline-block text-sm text-craie-500 transition-colors hover:text-or-400"
      >
        ← {retour.label}
      </Link>

      <header className="mt-6 border-b border-nuit-800 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
            {article.categorie}
          </span>
          <time dateTime={article.date} className="text-xs text-craie-500">
            {formaterDate(article.date)}
          </time>
          <span className="text-xs text-craie-500">par {article.auteur}</span>
        </div>
        <h1 className="mt-4 font-titre text-3xl font-bold leading-tight text-craie-100 sm:text-4xl">
          {article.titre}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-craie-300">{article.chapeau}</p>
      </header>

      <div className="prose-mlbb mt-10" dangerouslySetInnerHTML={{ __html: assainirHtml(html) }} />

      {article.motsCles.length > 0 && (
        <ul className="mt-12 flex flex-wrap gap-2 border-t border-nuit-800 pt-6">
          {article.motsCles.map((m) => (
            <li
              key={m}
              className="biseau-sm border border-nuit-700 px-2.5 py-1 text-xs text-craie-500"
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

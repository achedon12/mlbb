import Link from "@/components/lien";
import { assainirHtml } from "@/lib/html";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { FilAriane } from "@/components/fil-ariane";
import type { Article } from "@/lib/types";
import { ACTUALITE } from "@/lib/rubriques";
import { formaterDate } from "@/lib/utils";

export function ListeArticles({
  articles,
  base,
  langue,
}: {
  articles: Article[];
  base: string;
  langue: Langue;
}) {
  const t = creerT(langue);
  if (articles.length === 0) {
    return <p className="text-craie-500">{t("articleUI.aucune")}</p>;
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
                {t(`articleCat.${a.categorie}`)}
              </span>
              <time dateTime={a.date} className="text-xs text-craie-500">
                {formaterDate(a.date, LOCALE_HTML[langue])}
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
  langue,
  article,
  html,
  retour,
}: {
  article: Article;
  html: string;
  retour: { href: string; label: string };
  langue: Langue;
}) {
  const t = creerT(langue);
  // Nom de section pour le fil d'Ariane : celui de la navigation plutot que le
  // libelle du lien retour (« Tous les… »), qui ne nomme pas la rubrique.
  const rubrique = ACTUALITE.find((r) => r.href === retour.href);
  const section = rubrique ? t(`nav.${rubrique.cle}.label`) : retour.label;

  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <FilAriane miettes={[{ nom: section, href: retour.href }, { nom: article.titre }]} />

      <header className="mt-6 border-b border-nuit-800 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
            {t(`articleCat.${article.categorie}`)}
          </span>
          <time dateTime={article.date} className="text-xs text-craie-500">
            {formaterDate(article.date, LOCALE_HTML[langue])}
          </time>
          <span className="text-xs text-craie-500">{t("articleUI.par", { auteur: article.auteur })}</span>
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

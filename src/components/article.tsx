import Link from "@/components/link";
import { cleanHtml } from "@/lib/html";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { Breadcrumb } from "@/components/breadcrumb";
import type { Article } from "@/lib/types";
import { NEWS } from "@/lib/sections";
import { formatShortDate } from "@/lib/utils";
import { HeroPortrait } from "@/components/hero-portrait";
import { AsideBlock, ReadingLayout } from "@/components/reading-layout";
import { allHeroes } from "@/lib/data";
import type { GuideHeading } from "@/lib/guides";
import { heroesMentioned } from "@/lib/mentions";

export function ListArticles({
  articles,
  base,
  locale,
}: {
  articles: Article[];
  base: string;
  locale: Locale;
}) {
  const t = createT(locale);
  if (articles.length === 0) {
    return <p className="text-chalk-500">{t("articleUI.none")}</p>;
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {articles.map((a) => (
        <li key={a.slug}>
          <Link
            href={`${base}/${a.slug}`}
            className="bevel block h-full border border-night-700/70 bg-night-900/60 p-6 transition-colors hover:border-gold-500/60"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gold-400">
                {t(`articleCategory.${a.category}`)}
              </span>
              <time dateTime={a.date} className="text-xs text-chalk-500">
                {formatShortDate(a.date, LOCALE_HTML[locale])}
              </time>
            </div>
            <h2 className="mt-2 font-heading text-xl font-bold leading-snug text-chalk-100">
              {a.title}
            </h2>
            <p className="mt-3 leading-relaxed text-chalk-500">{a.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Article body on the reading layout: the table of contents on the left
 * when the article has sections, the text in the middle, and on the right
 * the heroes it talks about and the latest articles of its section.
 */
export function BodyArticle({
  locale,
  article,
  html,
  headings,
  others = [],
  back,
}: {
  article: Article;
  html: string;
  /** Second-level headings, with the anchors `html` gives them. */
  headings?: GuideHeading[];
  /** Other articles of the section, newest first, for the side column. */
  others?: Article[];
  back: { href: string; label: string };
  locale: Locale;
}) {
  const t = createT(locale);
  // Section name for the breadcrumb: the navigation one rather than the back
  // link label ("All…"), which does not name the section.
  const navEntry = NEWS.find((r) => r.href === back.href);
  const section = navEntry ? t(`nav.${navEntry.key}.label`) : back.label;
  const heroes = heroesMentioned(article.content, allHeroes);
  const latest = others.filter((o) => o.slug !== article.slug).slice(0, 4);

  const aside =
    heroes.length > 0 || latest.length > 0 ? (
      <>
        {heroes.length > 0 && (
          <AsideBlock id="article-heroes" title={t("articleUI.heroes")}>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8 xl:grid-cols-4">
              {heroes.map((h) => (
                <li key={h.slug}>
                  <Link href={`/heroes/${h.slug}`} className="group block text-center">
                    <HeroPortrait
                      source={h.images.icon ?? h.images.portrait}
                      name={h.name}
                      decorative
                      className="mx-auto block border border-night-700/70 transition-colors group-hover:border-gold-500/60"
                    />
                    <span className="mt-1 block truncate text-xs text-chalk-300 transition-colors group-hover:text-gold-400">
                      {h.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AsideBlock>
        )}
        {latest.length > 0 && (
          <AsideBlock id="article-latest" title={t("articleUI.latest")}>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {latest.map((o) => (
                <li key={o.slug}>
                  <Link
                    href={`${back.href}/${o.slug}`}
                    className="bevel-sm block h-full border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60"
                  >
                    <time dateTime={o.date} className="text-xs text-chalk-500">
                      {formatShortDate(o.date, LOCALE_HTML[locale])}
                    </time>
                    <span className="mt-1 block text-sm font-semibold leading-snug text-chalk-100">{o.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={back.href} className="mt-3 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500">
              {back.label} →
            </Link>
          </AsideBlock>
        )}
      </>
    ) : undefined;

  return (
    <ReadingLayout toc={headings} tocLabel={t("common.contents")} aside={aside} className="pb-8 pt-5 sm:py-14">
      <Breadcrumb crumbs={[{ name: section, href: back.href }, { name: article.title }]} />

      <header className="mt-4 border-b border-night-800 pb-5 sm:mt-6 sm:pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gold-400">
            {t(`articleCategory.${article.category}`)}
          </span>
          <time dateTime={article.date} className="text-xs text-chalk-500">
            {formatShortDate(article.date, LOCALE_HTML[locale])}
          </time>
          <span className="text-xs text-chalk-500">{t("articleUI.by", { author: article.author })}</span>
        </div>
        <h1 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight text-chalk-100 sm:mt-4 sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-2 leading-snug text-chalk-300 sm:mt-4 sm:text-lg sm:leading-relaxed">{article.summary}</p>
      </header>

      <div className="prose-mlbb mt-5 sm:mt-10" dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} />

      {article.keywords.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2 border-t border-night-800 pt-4 sm:mt-12 sm:pt-6">
          {article.keywords.map((m) => (
            <li
              key={m}
              className="bevel-sm border border-night-700 px-2.5 py-1 text-xs text-chalk-500"
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </ReadingLayout>
  );
}

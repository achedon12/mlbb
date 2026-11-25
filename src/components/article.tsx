import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import { cleanHtml } from "@/lib/html";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import type { Article } from "@/lib/types";
import { NEWS } from "@/lib/sections";
import { cn, formatShortDate } from "@/lib/utils";
import { DexSays } from "@/components/mascot";
import { HeroTile } from "@/components/hero-tile";
import { EditorialPoster, ENTRANCE, firstWithArt } from "@/components/editorial-poster";
import { AsideBlock, ReadingLayout } from "@/components/reading-layout";
import { allHeroes } from "@/lib/data";
import type { GuideHeading } from "@/lib/guides";
import { heroesMentioned } from "@/lib/mentions";

/**
 * The lead artwork of an article: the artwork of the first hero it talks
 * about. Chosen from the text, so it never changes between two visits and
 * needs nothing in the article's front matter.
 */
export function articleArt(article: Article): string | null {
  return firstWithArt(heroesMentioned(article.content, allHeroes, 12).map((h) => h.slug))?.art ?? null;
}

/** Category and date, on one line: the article's only small label. */
function ArticleKicker({ article, locale, className }: { article: Article; locale: Locale; className?: string }) {
  const t = createT(locale);
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}>
      <span className="font-heading font-bold uppercase text-gold-400">{t(`articleCategory.${article.category}`)}</span>
      <time dateTime={article.date} className="text-chalk-400">
        {formatShortDate(article.date, LOCALE_INTL[locale])}
      </time>
    </span>
  );
}

/** The artwork frame of a card: fixed ratio, the art zooms 3 % on hover. */
function CardArt({ art, sizes, className }: { art: string | null; sizes: string; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block overflow-hidden bg-night-800", className)}>
      {art && (
        <Image
          src={art}
          alt=""
          fill
          sizes={sizes}
          className="object-cover object-[50%_25%] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      )}
      <span className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/40 to-transparent" />
    </span>
  );
}

/**
 * A list of articles as an editorial front: with `feature`, the newest one
 * opens it across the width, its artwork large and its title set big over
 * it; the others follow as artwork cards. Empty, Dex says so.
 */
export function ListArticles({
  articles,
  base,
  locale,
  feature = false,
}: {
  articles: Article[];
  base: string;
  locale: Locale;
  /** Open the list on the newest article, set large. */
  feature?: boolean;
}) {
  const t = createT(locale);
  if (articles.length === 0) {
    return (
      <DexSays pose="dodo" height={120}>
        <p className="text-chalk-200">{t("articleUI.none")}</p>
      </DexSays>
    );
  }

  const [first, ...rest] = feature ? articles : [];
  // Beside the feature from `lg`: the next two; the others follow below.
  const beside = feature ? rest.slice(0, 2) : [];
  const cards = feature ? rest.slice(2) : articles;

  return (
    <div className="space-y-4 sm:space-y-6">
      {first && (
        <div className={cn("grid gap-4 sm:gap-6", beside.length > 0 && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
          <Link href={`${base}/${first.slug}`} className="group card-link relative block overflow-hidden p-0">
            <CardArt
              art={articleArt(first)}
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="aspect-[4/5] sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto"
            />
            <span className="absolute inset-x-0 bottom-0 block p-5 sm:p-8 lg:relative lg:flex lg:min-h-[36rem] lg:flex-col lg:justify-end lg:p-10">
              <ArticleKicker article={first} locale={locale} />
              <span className="display-caps mt-3 block max-w-3xl text-balance text-[clamp(2.2rem,1.4rem+3vw,4.5rem)] text-chalk-100 transition-colors group-hover:text-gold-300">
                {first.title}
              </span>
              <span className="mt-3 line-clamp-3 block max-w-2xl leading-relaxed text-chalk-200 sm:mt-4 sm:text-lg">
                {first.summary}
              </span>
            </span>
          </Link>
          {beside.length > 0 && (
            <ul className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-1">
              {beside.map((a) => (
                <li key={a.slug}>
                  <ArticleCard article={a} base={base} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {cards.length > 0 && (
        <ul className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((a) => (
            <li key={a.slug}>
              <ArticleCard article={a} base={base} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** An article as a card: its artwork on top, the title in the display face. */
function ArticleCard({ article: a, base, locale }: { article: Article; base: string; locale: Locale }) {
  return (
    <Link href={`${base}/${a.slug}`} className="group card-link flex h-full flex-col overflow-hidden p-0">
      <CardArt art={articleArt(a)} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="aspect-[16/9]" />
      <span className="relative -mt-10 block flex-1 px-5 pb-6 sm:px-6">
        <ArticleKicker article={a} locale={locale} />
        <span className="display-caps mt-2 block text-balance text-[1.9rem] text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-[2.2rem]">
          {a.title}
        </span>
        <span className="mt-3 line-clamp-3 block leading-relaxed text-chalk-400">{a.summary}</span>
      </span>
    </Link>
  );
}

/**
 * Article page: an editorial poster (the artwork of the first hero the
 * article talks about, the title set large over it, category, date and
 * author), then the reading layout — the table of contents on the left when
 * the article has sections, the text in the middle, and on the right the
 * heroes it talks about, as portraits, and the latest articles of its
 * section.
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
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8 xl:grid-cols-3">
              {heroes.map((h) => (
                <li key={h.slug}>
                  <HeroTile
                    href={`/heroes/${h.slug}`}
                    name={h.name}
                    portrait={h.images.portrait ?? h.images.icon}
                    sizes="(min-width: 1280px) 6rem, (min-width: 640px) 11vw, 23vw"
                  />
                </li>
              ))}
            </ul>
          </AsideBlock>
        )}
        {latest.length > 0 && (
          <AsideBlock id="article-latest" title={t("articleUI.latest")}>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {latest.map((o) => (
                <li key={o.slug}>
                  <Link href={`${back.href}/${o.slug}`} className="group card-link flex h-full items-stretch overflow-hidden p-0">
                    <CardArt art={articleArt(o)} sizes="6rem" className="w-24 shrink-0" />
                    <span className="block min-w-0 p-3">
                      <time dateTime={o.date} className="text-xs text-chalk-500">
                        {formatShortDate(o.date, LOCALE_INTL[locale])}
                      </time>
                      <span className="mt-1 line-clamp-3 block text-sm font-semibold leading-snug text-chalk-100 transition-colors group-hover:text-gold-300">
                        {o.title}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={back.href}
              className="mt-4 inline-flex items-center gap-1.5 font-heading font-bold uppercase text-gold-400 hover:text-gold-300"
            >
              {back.label}
              <ArrowRight size={15} aria-hidden />
            </Link>
          </AsideBlock>
        )}
      </>
    ) : undefined;

  return (
    <>
      <EditorialPoster art={articleArt(article)} crumbs={[{ name: section, href: back.href }, { name: article.title }]}>
        <ArticleKicker article={article} locale={locale} />
        <h1 className="affiche-name display-caps mt-3 max-w-5xl text-balance text-[clamp(2.5rem,1.4rem+3.6vw,5.25rem)] text-chalk-100">
          {article.title}
        </h1>
        <div aria-hidden className="eclat mt-5 h-[3px] w-24" />
        <p className="mt-4 max-w-2xl leading-relaxed text-chalk-200 sm:text-lg">{article.summary}</p>
        <p className="mt-3 text-sm text-chalk-400">{t("articleUI.by", { author: article.author })}</p>
      </EditorialPoster>

      <ReadingLayout toc={headings} tocLabel={t("common.contents")} aside={aside} className={cn("pb-8 pt-6 sm:py-12", ENTRANCE)}>
        <div className="prose-mlbb" dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} />

        {article.keywords.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-2 border-t border-night-800 pt-5 sm:mt-12 sm:pt-6">
            {article.keywords.map((m) => (
              <li key={m} className="bevel-sm bg-night-800 px-2.5 py-1 text-xs text-chalk-400">
                {m}
              </li>
            ))}
          </ul>
        )}
      </ReadingLayout>
    </>
  );
}

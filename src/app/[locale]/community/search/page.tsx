import type { Metadata } from "next";
import { count, SearchForm, ThreadList, Unavailable } from "@/components/community/parts";
import { Pager } from "@/components/pager";
import { DexNote, heroArt, StageHeader } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { isCategory, readPageNumber, THREADS_PER_PAGE } from "@/lib/community/constants";
import { readQuery } from "@/lib/community/rules";
import { searchThreads } from "@/lib/community/store";
import { requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { paging } from "@/lib/pager";

/**
 * Forum search: threads whose title, text or replies hold the words
 * (Postgres full text). Never indexed: a page per query would be endless
 * thin content.
 */
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return { title: createT(locale)("pages.community.searchTitle"), robots: { index: false, follow: true } };
}

export default async function CommunitySearchPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const raw = await searchParams;
  const t = createT(locale);
  const query = readQuery(raw.q);
  const category = raw.category && isCategory(raw.category) ? raw.category : null;
  const page = readPageNumber(raw.page, 50);
  const now = await requestTime();
  const result = query && databaseConfigured() ? await searchThreads(query, category, page).catch(() => null) : query ? null : { threads: [], total: 0 };
  const view = paging(result?.total ?? 0, page, THREADS_PER_PAGE);
  const href = (n: number) => {
    const search = new URLSearchParams({ q: query });
    if (category) search.set("category", category);
    if (n > 1) search.set("page", String(n));
    return `/community/search?${search}`;
  };

  return (
    <>
      <StageHeader
        compact
        dex="reflexion"
        art={heroArt("nana")}
        artPosition="55% 22%"
        title={t("pages.community.searchTitle")}
        lead={
          category
            ? t("pages.community.searchLeadCategory", { name: t(`pages.community.categories.${category}.name`) })
            : t("pages.community.searchLead")
        }
        crumbs={[{ name: t("pages.community.title"), href: "/community" }, { name: t("pages.community.searchTitle") }]}
      >
        <div className="mt-5">
          <SearchForm t={t} locale={locale} query={query} category={category ?? undefined} />
        </div>
      </StageHeader>
      <div className="stage-enter page-wrap space-y-6 py-8 sm:py-10 *:max-w-4xl">
        {!result ? (
          <Unavailable t={t} />
        ) : query ? (
          <>
            <p role="status" className="font-heading text-xl font-bold text-chalk-100">
              {count(t, locale, "pages.community.searchResults", result.total, { query })}
            </p>
            <ThreadList threads={result.threads} t={t} locale={locale} now={now} showCategory emptyText={t("pages.community.searchEmpty")} />
            <Pager paging={view} href={href} t={t} />
          </>
        ) : (
          <DexNote pose="pointe" height={110}>{t("pages.community.searchHint")}</DexNote>
        )}
      </div>
    </>
  );
}

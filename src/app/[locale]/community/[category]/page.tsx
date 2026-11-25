import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewThread } from "@/components/community/composer";
import { CATEGORY_ART, heroOptions, Rules, SearchForm, ThreadList, Unavailable } from "@/components/community/parts";
import Link from "@/components/link";
import { MemberLine, SignInChoice } from "@/components/community/sign-in";
import { Pager } from "@/components/pager";
import { heroArt, StageHeader } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { CATEGORIES, isCategory, readPageNumber, readSort, SORTS, THREADS_PER_PAGE, type Sort } from "@/lib/community/constants";
import { listThreads } from "@/lib/community/store";
import { currentMember, discordLoginEnabled, requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { paging } from "@/lib/pager";
import { cn } from "@/lib/utils";

/**
 * One forum category: its threads, pinned first, latest activity or most
 * upvoted, twenty a page. The first page in the default order is the one
 * indexed; the other orders and pages point engines back to it.
 */
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ locale: Locale; category: string }>;
  searchParams: Promise<{ sort?: string; page?: string; login?: string }>;
};

const href = (category: string, sort: Sort, page: number) => {
  const query = new URLSearchParams();
  if (sort !== "latest") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return `/community/${category}${search ? `?${search}` : ""}`;
};

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isCategory(category)) return notFoundMetadata(locale);
  const query = await searchParams;
  const t = createT(locale);
  const name = t(`pages.community.categories.${category}.name`);
  const meta = metaPage(locale, {
    title: t("pages.community.seo.categoryTitle", { name }),
    description: t("pages.community.seo.categoryDescription", {
      description: t(`pages.community.categories.${category}.description`),
      name,
    }),
    path: `/community/${category}`,
    card: true,
  });
  const variant = readSort(query.sort) !== "latest" || readPageNumber(query.page) > 1;
  return variant ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const { locale, category } = await params;
  if (!isCategory(category)) notFound();
  const query = await searchParams;
  const t = createT(locale);
  const sort = readSort(query.sort);
  const page = readPageNumber(query.page);
  const now = await requestTime();
  const name = t(`pages.community.categories.${category}.name`);

  const [data, member] = await Promise.all([
    databaseConfigured() ? listThreads({ category, sort, page }).catch(() => null) : null,
    currentMember(now),
  ]);
  if (data && page > 1 && data.threads.length === 0) notFound();
  const view = paging(data?.total ?? 0, page, THREADS_PER_PAGE);

  return (
    <>
      <StageHeader
        title={name}
        art={heroArt(CATEGORY_ART[category].hero)}
        artPosition={CATEGORY_ART[category].position}
        kicker={t("pages.community.title")}
        lead={t(`pages.community.categories.${category}.description`)}
        crumbs={[
          { name: t("pages.community.title"), href: "/community" },
          {
            name,
            siblings: CATEGORIES.filter((c) => c !== category).map((c) => ({
              name: t(`pages.community.categories.${c}.name`),
              href: `/community/${c}`,
            })),
          },
        ]}
        details={{ label: t("pages.community.rules.title"), content: <Rules t={t} /> }}
      >
        <div className="mt-5">
          <SearchForm t={t} locale={locale} category={category} />
        </div>
      </StageHeader>
      <ExtendMessages messages={messagesPage(locale, ["pages.communityUI"])}>
        <div className="stage-enter page-wrap space-y-6 py-8 sm:py-10 *:max-w-4xl">
          {!data ? (
            <Unavailable t={t} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <nav aria-label={t("pages.community.sortLabel")} className="flex gap-1 border-b border-night-800">
                  {SORTS.map((s) => (
                    <Link
                      key={s}
                      href={href(category, s, 1)}
                      aria-current={s === sort ? "page" : undefined}
                      className={cn(
                        "eclat-under inline-flex min-h-11 items-center px-4 font-heading text-base font-bold uppercase transition-colors",
                        s === sort ? "text-gold-400" : "text-chalk-400 hover:text-chalk-100",
                      )}
                    >
                      {t(`pages.community.sort.${s}`)}
                    </Link>
                  ))}
                </nav>
              </div>
              {member.status === "ok" ? (
                <>
                  <MemberLine t={t} locale={locale} member={member} back={`/community/${category}`} />
                  <NewThread category={category} heroes={heroOptions()} />
                </>
              ) : (
                <SignInChoice
                  t={t}
                  locale={locale}
                  purpose="post"
                  back={`/community/${category}`}
                  member={member}
                  discordEnabled={discordLoginEnabled()}
                  failed={query.login === "failed"}
                />
              )}
              <ThreadList threads={data.threads} t={t} locale={locale} now={now} emptyText={t("pages.community.emptyCategory")} />
              <Pager paging={view} href={(n) => href(category, sort, n)} t={t} />
            </>
          )}
        </div>
      </ExtendMessages>
    </>
  );
}

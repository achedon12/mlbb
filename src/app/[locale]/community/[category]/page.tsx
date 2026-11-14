import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewThread } from "@/components/community/composer";
import { heroOptions, Rules, SearchForm, ThreadList, Unavailable } from "@/components/community/parts";
import Link from "@/components/link";
import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { currentPlayer } from "@/lib/community-builds-server";
import { CATEGORIES, isCategory, readPageNumber, readSort, SORTS, THREADS_PER_PAGE, type Sort } from "@/lib/community/constants";
import { listThreads } from "@/lib/community/store";
import { requestTime } from "@/lib/community/server";
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
  searchParams: Promise<{ sort?: string; page?: string }>;
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
  if (!isCategory(category)) return {};
  const query = await searchParams;
  const t = createT(locale);
  const name = t(`pages.community.categories.${category}.name`);
  const meta = metaPage(locale, {
    title: t("pages.community.seo.categoryTitle", { name }),
    description: t(`pages.community.categories.${category}.description`),
    path: `/community/${category}`,
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

  const [data, player] = await Promise.all([
    databaseConfigured() ? listThreads({ category, sort, page }).catch(() => null) : null,
    currentPlayer().catch(() => ({ status: "unavailable" as const })),
  ]);
  if (data && page > 1 && data.threads.length === 0) notFound();
  const view = paging(data?.total ?? 0, page, THREADS_PER_PAGE);

  return (
    <>
      <PageHeader
        title={name}
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
      </PageHeader>
      <ExtendMessages messages={messagesPage(locale, ["pages.communityUI"])}>
        <div className="page-wrap space-y-6 py-8 *:max-w-4xl">
          {!data ? (
            <Unavailable t={t} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <nav aria-label={t("pages.community.sortLabel")} className="flex gap-1">
                  {SORTS.map((s) => (
                    <Link
                      key={s}
                      href={href(category, s, 1)}
                      aria-current={s === sort ? "page" : undefined}
                      className={cn(
                        "bevel-sm inline-flex min-h-11 items-center px-3 text-sm font-semibold transition-colors",
                        s === sort ? "bg-night-800 text-chalk-100" : "text-chalk-400 hover:text-chalk-100",
                      )}
                    >
                      {t(`pages.community.sort.${s}`)}
                    </Link>
                  ))}
                </nav>
                {player.status !== "ok" && (
                  <p className="text-sm text-chalk-400">
                    <Link href="/login" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
                      {t("pages.community.signIn")}
                    </Link>{" "}
                    {t("pages.community.signInToPost")}
                  </p>
                )}
              </div>
              {player.status === "ok" && <NewThread category={category} heroes={heroOptions()} />}
              <ThreadList threads={data.threads} t={t} locale={locale} now={now} emptyText={t("pages.community.emptyCategory")} />
              <Pager paging={view} href={(n) => href(category, sort, n)} t={t} />
            </>
          )}
        </div>
      </ExtendMessages>
    </>
  );
}

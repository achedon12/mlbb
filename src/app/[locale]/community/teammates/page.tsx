import type { Metadata } from "next";
import { ReportButton } from "@/components/community/post-actions";
import { ago, DiscordAlternative, heroOptions, isoDate, Unavailable } from "@/components/community/parts";
import { TeammateForm, type OwnCard } from "@/components/community/teammate-form";
import { HeroPortrait } from "@/components/hero-portrait";
import Link from "@/components/link";
import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/ui";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { currentPlayer } from "@/lib/community-builds-server";
import { CARDS_PER_PAGE, LANGUAGES, RANKS, readPageNumber, REGIONS } from "@/lib/community/constants";
import { listCards, ownCard, type Card, type CardFilters } from "@/lib/community/store";
import { heroesBySlug } from "@/lib/data";
import { requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { LANES } from "@/lib/draft";
import { paging } from "@/lib/pager";

/**
 * Teammate finder: short "looking for" cards, filtered by region, rank,
 * lane and language, a week each. The in-game id and the Discord handle a
 * player chose to share are only rendered for signed-in players: a visitor
 * (or a crawler) never receives them.
 */
export const dynamic = "force-dynamic";

type Query = { region?: string; rank?: string; lane?: string; language?: string; page?: string };
type Params = { params: Promise<{ locale: Locale }>; searchParams: Promise<Query> };

const pick = (value: string | undefined, allowed: readonly string[]) => (value && allowed.includes(value) ? value : undefined);

function filtersOf(query: Query): CardFilters {
  return {
    region: pick(query.region, REGIONS),
    rank: pick(query.rank, RANKS),
    lane: pick(query.lane, LANES),
    language: pick(query.language, LANGUAGES),
  };
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const t = createT(locale);
  const meta = metaPage(locale, {
    title: t("pages.community.teammates.seoTitle"),
    description: t("pages.community.teammates.seoDescription"),
    path: "/community/teammates",
  });
  const filtered = Object.values(filtersOf(query)).some(Boolean) || readPageNumber(query.page) > 1;
  return filtered ? { ...meta, robots: { index: false, follow: true } } : meta;
}

const SELECT = "bevel-sm mt-1 block h-11 w-full border border-night-700 bg-night-900 px-2 text-sm text-chalk-100";

export default async function TeammatesPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const query = await searchParams;
  const t = createT(locale);
  const filters = filtersOf(query);
  const page = readPageNumber(query.page);
  const now = await requestTime();
  const languageName = new Intl.DisplayNames([LOCALE_INTL[locale]], { type: "language" });

  const player = await currentPlayer().catch(() => ({ status: "unavailable" as const }));
  const viewer = player.status === "ok" ? player.id : null;
  const data = databaseConfigured()
    ? await Promise.all([listCards(filters, page, now), viewer ? ownCard(viewer, now) : null]).catch(() => null)
    : null;
  const view = paging(data?.[0].total ?? 0, page, CARDS_PER_PAGE);
  const href = (n: number) => {
    const search = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1])));
    if (n > 1) search.set("page", String(n));
    const s = search.toString();
    return `/community/teammates${s ? `?${s}` : ""}`;
  };

  const own = data?.[1];
  const ownProps: OwnCard | null = own
    ? {
        region: own.region,
        rank: own.rank,
        lanes: own.lanes,
        heroes: own.heroes,
        languages: own.languages,
        playTimes: own.playTimes,
        note: own.note,
        gameId: own.gameId,
        discord: own.discord,
        expiresAt: own.expiresAt.toISOString(),
        hidden: Boolean(own.hiddenAt),
      }
    : null;

  const card = (c: Card) => (
    <li key={c.id}>
      <article className="bevel flex h-full flex-col gap-3 border border-night-800 bg-night-900/60 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-chalk-100">{c.authorName}</h3>
            <p className="text-xs text-chalk-500">
              {t(`pages.communityUI.regions.${c.region}`)} · {t(`rankNames.${c.rank}`)}
            </p>
          </div>
          <time dateTime={isoDate(c.createdAt)} className="shrink-0 text-xs text-chalk-500">
            {ago(locale, c.createdAt, now)}
          </time>
        </header>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("pages.communityUI.teammates.lanes")}>
          {c.lanes.map((l) => (
            <li key={l} className="bevel-sm border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 text-xs text-chalk-100">
              {t(`lanes.${l}`)}
            </li>
          ))}
        </ul>
        {c.heroes.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label={t("pages.communityUI.teammates.heroes")}>
            {c.heroes.flatMap((s) => {
              const h = heroesBySlug.get(s);
              return h ? (
                <li key={s}>
                  <Link href={`/heroes/${s}`} title={h.name} className="block">
                    <HeroPortrait source={h.images.icon} name={h.name} size="small" />
                  </Link>
                </li>
              ) : [];
            })}
          </ul>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-chalk-500">{t("pages.community.teammates.speaks")}</dt>
          <dd className="text-chalk-300">{c.languages.map((l) => languageName.of(l) ?? l).join(", ")}</dd>
          {c.playTimes.length > 0 && (
            <>
              <dt className="text-chalk-500">{t("pages.community.teammates.plays")}</dt>
              <dd className="text-chalk-300">{c.playTimes.map((p) => t(`pages.communityUI.playTimes.${p}`)).join(", ")}</dd>
            </>
          )}
        </dl>
        {c.note && <p className="break-words text-sm leading-relaxed text-chalk-300">{c.note}</p>}
        <div className="mt-auto border-t border-night-800 pt-3 text-xs">
          {c.gameId || c.discord ? (
            viewer ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {c.gameId && (
                  <>
                    <dt className="text-chalk-500">{t("pages.community.teammates.gameId")}</dt>
                    <dd className="select-all font-mono text-chalk-100">{c.gameId}</dd>
                  </>
                )}
                {c.discord && (
                  <>
                    <dt className="text-chalk-500">Discord</dt>
                    <dd className="select-all break-all font-mono text-chalk-100">{c.discord}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-chalk-500">
                <Link href="/login" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
                  {t("pages.community.signIn")}
                </Link>{" "}
                {t("pages.community.teammates.signInForContact")}
              </p>
            )
          ) : (
            <p className="text-chalk-500">{t("pages.community.teammates.noContact")}</p>
          )}
          {viewer && viewer !== c.accountId && (
            <div className="-mb-2 flex flex-wrap">
              <ReportButton kind="card" id={c.id} signedIn />
            </div>
          )}
        </div>
      </article>
    </li>
  );

  return (
    <>
      <PageHeader
        title={t("pages.community.teammates.title")}
        lead={t("pages.community.teammates.lead")}
        crumbs={[{ name: t("pages.community.title"), href: "/community" }, { name: t("pages.community.teammates.title") }]}
      />
      <ExtendMessages messages={messagesPage(locale, ["pages.communityUI"])}>
        <div className="page-wrap space-y-8 py-8">
          {!data ? (
            <Unavailable t={t} />
          ) : (
            <>
              <section aria-labelledby="own-card-title" className="space-y-3">
                <h2 id="own-card-title" className="sr-only">
                  {t("pages.community.teammates.ownTitle")}
                </h2>
                {viewer ? (
                  <TeammateForm heroes={heroOptions()} card={ownProps} />
                ) : (
                  <p className="text-sm text-chalk-300">
                    <Link href="/login" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
                      {t("pages.community.signIn")}
                    </Link>{" "}
                    {t("pages.community.teammates.signInToPost")}
                  </p>
                )}
              </section>

              <section aria-labelledby="cards-title" className="space-y-4">
                <h2 id="cards-title" className="font-heading text-xl font-bold text-chalk-100">
                  {t("pages.community.teammates.listTitle", { n: data[0].total })}
                </h2>
                <form method="get" action={`/${locale}/community/teammates`} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
                  <label className="text-xs text-chalk-400">
                    {t("pages.communityUI.teammates.region")}
                    <select name="region" defaultValue={filters.region ?? ""} className={SELECT}>
                      <option value="">{t("pages.community.teammates.any")}</option>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {t(`pages.communityUI.regions.${r}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-chalk-400">
                    {t("pages.communityUI.teammates.rank")}
                    <select name="rank" defaultValue={filters.rank ?? ""} className={SELECT}>
                      <option value="">{t("pages.community.teammates.any")}</option>
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {t(`rankNames.${r}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-chalk-400">
                    {t("pages.community.teammates.lane")}
                    <select name="lane" defaultValue={filters.lane ?? ""} className={SELECT}>
                      <option value="">{t("pages.community.teammates.any")}</option>
                      {LANES.map((l) => (
                        <option key={l} value={l}>
                          {t(`lanes.${l}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-chalk-400">
                    {t("pages.community.teammates.language")}
                    <select name="language" defaultValue={filters.language ?? ""} className={SELECT}>
                      <option value="">{t("pages.community.teammates.any")}</option>
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {languageName.of(l) ?? l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="col-span-2 flex items-center gap-3 sm:col-span-4 lg:col-span-1">
                    <button
                      type="submit"
                      className="bevel-sm inline-flex h-11 items-center border border-night-700 px-4 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60"
                    >
                      {t("pages.community.teammates.filter")}
                    </button>
                    {Object.values(filters).some(Boolean) && (
                      <Link href="/community/teammates" className="inline-flex min-h-11 items-center text-sm text-chalk-400 underline underline-offset-4 hover:text-gold-400">
                        {t("pages.community.teammates.reset")}
                      </Link>
                    )}
                  </div>
                </form>
                {data[0].cards.length === 0 ? (
                  <p className="border border-dashed border-night-700 p-6 text-sm text-chalk-400">{t("pages.community.teammates.empty")}</p>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data[0].cards.map(card)}</ul>
                )}
                <Pager paging={view} href={href} t={t} />
              </section>
            </>
          )}
          <DiscordAlternative t={t} text={t("pages.community.teammates.discordText")} />
        </div>
      </ExtendMessages>
    </>
  );
}

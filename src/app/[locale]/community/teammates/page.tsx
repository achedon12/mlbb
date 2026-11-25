import type { Metadata } from "next";
import { ReportButton } from "@/components/community/post-actions";
import Image from "next/image";
import { ago, count, DiscordAlternative, heroOptions, isoDate, Unavailable } from "@/components/community/parts";
import { MemberLine, SignInChoice } from "@/components/community/sign-in";
import { TeammateForm, type OwnCard } from "@/components/community/teammate-form";
import { HeroPortrait } from "@/components/hero-portrait";
import Link from "@/components/link";
import { Pager } from "@/components/pager";
import { DexNote, heroArt, heroPortrait, StageHeader } from "@/components/stage";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { CARDS_PER_PAGE, LANGUAGES, RANKS, readPageNumber, REGIONS } from "@/lib/community/constants";
import { listCards, ownCard, type Card, type CardFilters } from "@/lib/community/store";
import { heroesBySlug } from "@/lib/data";
import { currentMember, discordLoginEnabled, requestTime } from "@/lib/community/server";
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

type Query = { region?: string; rank?: string; lane?: string; language?: string; page?: string; login?: string };
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

const SELECT = "field mt-1 h-11 px-2 text-sm";

export default async function TeammatesPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const query = await searchParams;
  const t = createT(locale);
  const filters = filtersOf(query);
  const page = readPageNumber(query.page);
  const now = await requestTime();
  const languageName = new Intl.DisplayNames([LOCALE_INTL[locale]], { type: "language" });

  const member = await currentMember(now);
  const viewer = member.status === "ok" ? member.author.id : null;
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
      <article className="bevel-lg flex h-full flex-col gap-3 bg-night-900 p-4 transition-[translate] duration-200 hover:-translate-y-0.5 sm:p-5">
        {c.heroes.length > 0 && (
          <ul className="-mx-1 grid grid-cols-4 gap-1.5" aria-label={t("pages.communityUI.teammates.heroes")}>
            {c.heroes.slice(0, 4).flatMap((s) => {
              const h = heroesBySlug.get(s);
              const portrait = heroPortrait(s);
              return h ? (
                <li key={s}>
                  <Link href={`/heroes/${s}`} className="hero-tile group">
                    <span className="hero-tile-art">
                      {portrait && <Image src={portrait} alt="" fill sizes="(min-width: 1024px) 7rem, 22vw" className="object-cover object-top" />}
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-night-950 to-transparent" />
                      <span className="display-caps absolute inset-x-0 bottom-0 truncate p-1.5 text-sm font-extrabold text-chalk-100 group-hover:text-gold-300">
                        {h.name}
                      </span>
                    </span>
                  </Link>
                </li>
              ) : [];
            })}
          </ul>
        )}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display-caps truncate pr-[0.15em] text-[1.9rem] text-chalk-100">{c.authorName}</h3>
            <p className="mt-1 text-sm text-chalk-300">
              {t(`pages.communityUI.regions.${c.region}`)} · <span className="font-heading font-bold uppercase text-gold-400">{t(`rankNames.${c.rank}`)}</span>
            </p>
          </div>
          <time dateTime={isoDate(c.createdAt)} className="shrink-0 text-xs text-chalk-500">
            {ago(locale, c.createdAt, now)}
          </time>
        </header>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("pages.communityUI.teammates.lanes")}>
          {c.lanes.map((l) => (
            <li key={l} className="bevel-sm bg-night-800 px-2.5 py-1 font-heading text-sm font-bold uppercase text-chalk-100">
              {t(`lanes.${l}`)}
            </li>
          ))}
        </ul>
        {c.heroes.length > 4 && (
          <ul className="flex flex-wrap gap-1" aria-label={t("pages.community.teammates.mains")}>
            {c.heroes.slice(4).flatMap((s) => {
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
                <a href="#own-card-title" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
                  {t("pages.community.signIn")}
                </a>{" "}
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
      <StageHeader
        title={t("pages.community.teammates.title")}
        lead={t("pages.community.teammates.lead")}
        crumbs={[{ name: t("pages.community.title"), href: "/community" }, { name: t("pages.community.teammates.title") }]}
        art={heroArt("gusion")}
        artPosition="60% 20%"
        dex="idee"
      />
      <ExtendMessages messages={messagesPage(locale, ["pages.communityUI"])}>
        <div className="stage-enter page-wrap space-y-10 py-8 sm:py-10">
          {!data ? (
            <Unavailable t={t} />
          ) : (
            <>
              <section aria-labelledby="own-card-title" className="space-y-3">
                <h2 id="own-card-title" className="sr-only">
                  {t("pages.community.teammates.ownTitle")}
                </h2>
                {member.status === "ok" ? (
                  <>
                    <MemberLine t={t} locale={locale} member={member} back="/community/teammates" />
                    <TeammateForm heroes={heroOptions()} card={ownProps} />
                  </>
                ) : (
                  <SignInChoice
                    t={t}
                    locale={locale}
                    purpose="card"
                    back="/community/teammates"
                    member={member}
                    discordEnabled={discordLoginEnabled()}
                    failed={query.login === "failed"}
                  />
                )}
              </section>

              <section aria-labelledby="cards-title" className="space-y-4">
                <h2 id="cards-title" className="type-section text-chalk-100">
                  {count(t, locale, "pages.community.teammates.listTitle", data[0].total)}
                </h2>
                <div aria-hidden className="eclat h-[3px] w-24" />
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
                    <button type="submit" className="btn btn-secondary">
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
                  <DexNote pose="pointe" height={120} title={t("pages.community.teammates.emptyTitle")}>
                    {t("pages.community.teammates.empty")}
                  </DexNote>
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

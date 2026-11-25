import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityBuildCard } from "@/components/community-build-card";
import Link from "@/components/link";
import { ActionLink } from "@/components/ui";
import { DexSays } from "@/components/mascot";
import { MetaPoster, artOf } from "@/components/meta/meta-poster";
import { PosterHero } from "@/components/meta/poster-hero";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { buildNames, simCatalog } from "@/lib/build-catalog";
import { sortBuilds, toPublic } from "@/lib/community-builds";
import { readCommunity } from "@/lib/community-builds-server";
import { listBuilds } from "@/lib/community-builds-store";
import { heroesBySlug } from "@/lib/data";

/**
 * Community builds of one hero, most voted first, each with its computed
 * stats and a link to open it in the simulator. Rendered on each request; a
 * hero without any build yet is not indexed (an empty page teaches nothing).
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Locale; hero: string }> };

/** Beyond this, the list is cut: the least voted builds stay reachable through the API. */
const MAX_SHOWN = 50;

const knownHero = (slug: string) => (simCatalog.heroes.has(slug) ? heroesBySlug.get(slug) : undefined);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, hero } = await params;
  const h = knownHero(hero);
  if (!h) return notFoundMetadata(locale);
  const t = createT(locale);
  const count = ((await listBuilds().catch(() => [])) ?? []).filter((b) => b.build.hero === hero).length;
  return {
    ...metaPage(locale, {
      title: t("pages.seo.communityBuildsHero.title", { hero: h.name }),
      description: t("pages.seo.communityBuildsHero.description", { hero: h.name }),
      path: `/builds/${hero}`,
      card: true,
    }),
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function HeroCommunityBuildsPage({ params }: Params) {
  const { locale, hero } = await params;
  const h = knownHero(hero);
  if (!h) notFound();
  const t = createT(locale);
  const { builds: stored, viewer, now } = await readCommunity();
  const mine = stored ? sortBuilds(stored.filter((b) => b.build.hero === hero), "votes", now) : [];
  const itemNames = buildNames(locale, t).items;
  const heroView = { name: h.name, icon: h.images.icon };
  const create = (
    <Link href={`/tools/build?h=${hero}`} className="btn btn-primary">
      {t("pages.communityBuilds.heroCreate", { hero: h.name })}
    </Link>
  );

  return (
    <>
      <MetaPoster
        title={t("pages.communityBuilds.heroTitle", { hero: h.name })}
        lead={t("pages.communityBuilds.heroLead", { hero: h.name })}
        crumbs={[{ name: t("pages.communityBuilds.title"), href: "/builds" }, { name: h.name }]}
        art={artOf(h.slug)}
        portrait={h.images.portrait}
        compact
        actions={create}
        feature={
          <PosterHero href={`/heroes/${h.slug}`} kicker={h.title ?? t("pages.communityBuilds.title")} name={h.name} />
        }
      />
      <ExtendMessages messages={messagesPage(locale, ["pages.communityBuildsUI"])}>
        <div className="page-wrap space-y-8 py-10 sm:py-14">
          {stored === null ? (
            <DexSays pose="triste">
              <p role="alert">{t("pages.communityBuilds.unavailable")}</p>
            </DexSays>
          ) : mine.length === 0 ? (
            <DexSays pose="surpris">
              <p>{t("pages.communityBuilds.heroEmpty", { hero: h.name })}</p>
              <p className="mt-3">{create}</p>
            </DexSays>
          ) : (
            <>
              {mine.length > MAX_SHOWN && (
                <p className="text-sm text-chalk-500">{t("pages.communityBuilds.shownCount", { n: MAX_SHOWN, total: mine.length })}</p>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {mine.slice(0, MAX_SHOWN).map((b) => (
                  <CommunityBuildCard
                    key={b.id}
                    build={toPublic(b, viewer, now)}
                    t={t}
                    locale={locale}
                    hero={heroView}
                    itemNames={itemNames}
                    signedIn={viewer !== null}
                  />
                ))}
              </div>
            </>
          )}
          <p>
            <ActionLink href="/builds">{t("pages.communityBuilds.backToHub")}</ActionLink>
          </p>
        </div>
      </ExtendMessages>
    </>
  );
}

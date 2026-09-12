import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityBuildCard } from "@/components/community-build-card";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { buildNames, simCatalog } from "@/lib/build-catalog";
import { sortBuilds, toPublic } from "@/lib/community-builds";
import { readCommunity } from "@/lib/community-builds-server";
import { listBuilds } from "@/lib/community-builds-store";
import { herosParSlug } from "@/lib/donnees";

/**
 * Community builds of one hero, most voted first, each with its computed
 * stats and a link to open it in the simulator. Rendered on each request; a
 * hero without any build yet is not indexed (an empty page teaches nothing).
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Langue; hero: string }> };

/** Beyond this, the list is cut: the least voted builds stay reachable through the API. */
const MAX_SHOWN = 50;

const knownHero = (slug: string) => (simCatalog.heroes.has(slug) ? herosParSlug.get(slug) : undefined);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, hero } = await params;
  const h = knownHero(hero);
  if (!h) return {};
  const t = creerT(locale);
  const count = ((await listBuilds().catch(() => [])) ?? []).filter((b) => b.build.hero === hero).length;
  return {
    ...metaPage(locale, {
      titre: t("pages.seo.communityBuildsHero.title", { hero: h.name }),
      description: t("pages.seo.communityBuildsHero.description", { hero: h.name }),
      chemin: `/builds/${hero}`,
    }),
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function HeroCommunityBuildsPage({ params }: Params) {
  const { locale, hero } = await params;
  const h = knownHero(hero);
  if (!h) notFound();
  const t = creerT(locale);
  const { builds: stored, viewer, now } = await readCommunity();
  const mine = stored ? sortBuilds(stored.filter((b) => b.build.hero === hero), "votes", now) : [];
  const itemNames = buildNames(locale, t).items;
  const heroView = { name: h.name, icon: h.images.icon };

  return (
    <>
      <EnTetePage
        titre={t("pages.communityBuilds.heroTitle", { hero: h.name })}
        chapeau={t("pages.communityBuilds.heroLead", { hero: h.name })}
        miettes={[{ nom: t("pages.communityBuilds.title"), href: "/builds" }, { nom: h.name }]}
        icone={<PortraitHeros source={h.images.icon} nom={h.name} taille="vignette" decoratif />}
      >
        <Link
          href={`/tools/build?h=${hero}`}
          className="bevel-sm mt-5 inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("pages.communityBuilds.heroCreate", { hero: h.name })}
        </Link>
      </EnTetePage>
      <CompleterMessages messages={messagesPage(locale, ["pages.communityBuildsUI"])}>
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
          {stored === null ? (
            <p role="alert" className="border border-blood-500/40 p-4 text-chalk-300">
              {t("pages.communityBuilds.unavailable")}
            </p>
          ) : mine.length === 0 ? (
            <p className="border border-dashed border-night-700 p-6 text-chalk-300">{t("pages.communityBuilds.heroEmpty", { hero: h.name })}</p>
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
            <Link href="/builds" className="inline-flex min-h-11 items-center text-sm text-chalk-300 underline underline-offset-4 hover:text-gold-400">
              {t("pages.communityBuilds.backToHub")}
            </Link>
          </p>
        </div>
      </CompleterMessages>
    </>
  );
}

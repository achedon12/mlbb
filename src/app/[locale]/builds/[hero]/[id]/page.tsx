import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { BuildStats } from "@/components/build-stats";
import { DeleteBuildButton, VoteButton } from "@/components/community-build-actions";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { buildNames, emblemImage, emblemName, itemImage, simCatalog, spellImage, spellName, talentImage, talentName } from "@/lib/build-catalog";
import { simulate } from "@/lib/build-simulator";
import { BUILD_ID, INDEX_THRESHOLD, isIndexable, toPublic } from "@/lib/community-builds";
import { viewerAndTime } from "@/lib/community-builds-server";
import { getBuild } from "@/lib/community-builds-store";
import { herosParSlug } from "@/lib/donnees";
import { dateLongue } from "@/lib/fraicheur";

/**
 * One community build: its choices, the author's notes, the full computed
 * stats, votes. Rendered on each request. Indexable only from
 * `INDEX_THRESHOLD` votes: below that, a page per build would flood search
 * engines with untested variations.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Langue; hero: string; id: string }> };

async function load(id: string) {
  if (!BUILD_ID.test(id)) return null;
  return getBuild(id).catch(() => undefined);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, id } = await params;
  const stored = await load(id);
  if (!stored) return { robots: { index: false, follow: true } };
  const t = creerT(locale);
  const hero = herosParSlug.get(stored.build.hero)?.nom ?? stored.build.hero;
  return {
    ...metaPage(locale, {
      titre: t("pages.seo.communityBuild.title", { title: stored.title, hero }),
      description: t("pages.seo.communityBuild.description", { hero, name: stored.author.name, votes: stored.votes.length }),
      chemin: `/builds/${stored.build.hero}/${stored.id}`,
    }),
    robots: isIndexable(stored.votes.length) ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CommunityBuildPage({ params }: Params) {
  const { locale, hero, id } = await params;
  const stored = await load(id);
  const t = creerT(locale);
  if (stored === null) notFound();
  if (stored === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p role="alert" className="border border-blood-500/40 p-4 text-chalk-300">
          {t("pages.communityBuilds.unavailable")}
        </p>
      </div>
    );
  }
  if (stored.build.hero !== hero) permanentRedirect(`/${locale}/builds/${stored.build.hero}/${stored.id}`);

  const { viewer, now } = await viewerAndTime();
  const build = toPublic(stored, viewer, now);
  const h = herosParSlug.get(build.hero);
  const heroName = h?.nom ?? build.hero;
  const simHero = simCatalog.heroes.get(build.hero);
  const result = simulate(build.build, simCatalog);
  const names = buildNames(locale, t);
  const b = build.build;

  const choice = (src: string | null, label: string, round = false) => (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`relative size-9 shrink-0 overflow-hidden bg-night-800 ${round ? "rounded-full" : ""}`}>
        {src && <Image src={src} alt="" fill unoptimized className="object-contain" />}
      </span>
      <span className="min-w-0 text-sm text-chalk-200">{label}</span>
    </span>
  );

  return (
    <>
      <EnTetePage
        titre={build.title}
        chapeau={t("pages.communityBuilds.buildLead", {
          hero: heroName,
          name: build.authorName,
          date: dateLongue(locale, build.createdAt),
        })}
        miettes={[
          { nom: t("pages.communityBuilds.title"), href: "/builds" },
          { nom: heroName, href: `/builds/${build.hero}` },
          { nom: build.title },
        ]}
        icone={h ? <PortraitHeros source={h.visuels.icone} nom={heroName} taille="vignette" decoratif /> : undefined}
      />
      <CompleterMessages messages={messagesPage(locale, ["pages.buildSimulatorUI", "pages.communityBuildsUI"])}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="min-w-0 space-y-8">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <VoteButton id={build.id} votes={build.votes} voted={build.voted} own={build.own} signedIn={viewer !== null} />
              <Link
                href={`/tools/build?${build.code}`}
                className="bevel-sm inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
              >
                {t("pages.communityBuilds.openSimulator")}
              </Link>
              {build.own && <DeleteBuildButton id={build.id} hero={build.hero} />}
            </div>
            {!isIndexable(build.votes) && (
              <p className="text-xs text-chalk-500">{t("pages.communityBuilds.indexNote", { n: INDEX_THRESHOLD })}</p>
            )}

            <section aria-labelledby="choices-title" className="space-y-4">
              <h2 id="choices-title" className="font-heading text-xl font-bold text-chalk-100">
                {t("pages.communityBuilds.choicesTitle")}
              </h2>
              <p className="text-sm text-chalk-400">{t("pages.communityBuilds.level", { level: b.level })}</p>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.communityBuilds.items")}</h3>
                <ol className="mt-2 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
                  {b.items.map((slug, i) => (
                    <li key={`${slug}-${i}`}>
                      <Link href={`/items/${slug}`} className="flex min-h-11 items-center hover:text-gold-400">
                        {choice(itemImage(slug), names.items[slug] ?? slug)}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.communityBuilds.emblem")}</h3>
                  <div className="mt-2">{b.emblem ? choice(emblemImage(b.emblem), emblemName(t, b.emblem), true) : "-"}</div>
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.communityBuilds.talents")}</h3>
                  <ul className="mt-2 space-y-2">
                    {b.talents.map((k, i) => (
                      <li key={i}>{k ? choice(talentImage(k), talentName(t, k), true) : "-"}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.communityBuilds.spell")}</h3>
                  <div className="mt-2">{b.spell ? choice(spellImage(b.spell), spellName(t, b.spell), true) : "-"}</div>
                </div>
              </div>
            </section>

            {build.notes && (
              <section aria-labelledby="notes-title">
                <h2 id="notes-title" className="font-heading text-xl font-bold text-chalk-100">
                  {t("pages.communityBuilds.notesTitle")}
                </h2>
                <p className="mt-3 whitespace-pre-line break-words leading-relaxed text-chalk-300">{build.notes}</p>
              </section>
            )}

            <p>
              <Link
                href={`/builds/${build.hero}`}
                className="inline-flex min-h-11 items-center text-sm text-chalk-300 underline underline-offset-4 hover:text-gold-400"
              >
                {t("pages.communityBuilds.backToHero", { hero: heroName })}
              </Link>
            </p>
          </div>

          <aside aria-labelledby="stats-title" className="min-w-0 space-y-4">
            <h2 id="stats-title" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.communityBuilds.statsTitle")}
            </h2>
            {result && simHero ? (
              <BuildStats result={result} names={names} resource={simHero.resource} />
            ) : (
              <p className="text-sm text-chalk-500">{t("pages.communityBuilds.statsMissing")}</p>
            )}
          </aside>
        </div>
      </CompleterMessages>
    </>
  );
}

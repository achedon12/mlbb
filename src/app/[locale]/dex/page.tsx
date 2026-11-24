import type { Metadata } from "next";
import { DiscordMark } from "@/components/bot/discord-mark";
import { DiscordJoinLink } from "@/components/discord-join-link";
import Link from "@/components/link";
import { Dex, type DexPose } from "@/components/mascot";
import { heroArt, StageHeader } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { botPublished, communityInvite } from "@/lib/bot/public";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * Dex's own page: who he is, where he comes from in the Land of Dawn, what he
 * does on the site and on Discord (where the bot, Dex MLBB, wears his face),
 * his twelve poses as a living gallery, and the way to the community server.
 *
 * A page of its own rather than a section of `/about`: Dex is one character
 * across the site, the bot and the server, and that needs an address the bot
 * and the server can point to. `/about` tells the project's story and links
 * here; the brand kit (`/brand`) holds the files.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.dexPage.metaTitle"),
    description: t("pages.dexPage.metaDescription"),
    path: "/dex",
    image: "/mascot/dex-salut-square.png",
  });
}

const POSES: DexPose[] = ["salut", "reflexion", "idee", "surpris", "victoire", "carte", "joie", "bravo", "saut", "pointe", "triste", "dodo"];
const TRAITS = ["color", "tufts", "crystal", "cape"] as const;

export default async function DexPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const invite = communityInvite();
  const bot = botPublished();
  const h2 = "type-section text-chalk-100";
  const more = "text-sm font-semibold text-gold-400 transition-colors hover:text-gold-300";

  return (
    <>
      <StageHeader
        title={t("pages.dexPage.title")}
        kicker={t("pages.dexPage.kicker")}
        lead={t("pages.dexPage.lead")}
        art={heroArt("floryn")}
        artPosition="55% 25%"
        dex="salut"
      >
        <p className="dex-bubble mt-5 max-w-md font-heading text-lg font-semibold leading-snug text-chalk-100">{t("pages.dexPage.hello")}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {invite && (
            <DiscordJoinLink href={invite} placement="Inline" className="btn btn-primary">
              <DiscordMark />
              {t("pages.dexPage.join")}
            </DiscordJoinLink>
          )}
          <a href="#poses" className="btn btn-secondary">
            {t("pages.dexPage.seePoses")}
          </a>
        </div>
      </StageHeader>

      <div className="stage-enter page-wrap space-y-16 py-10 sm:space-y-24 sm:py-14">
        <section aria-labelledby="origin" className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-14">
          <div className="max-w-2xl">
            <h2 id="origin" className={h2}>
              {t("pages.dexPage.originTitle")}
            </h2>
            <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-chalk-300">
              <p>{t("pages.dexPage.origin1")}</p>
              <p>{t("pages.dexPage.origin2")}</p>
              <p className="text-chalk-100">{t("pages.dexPage.origin3")}</p>
            </div>
            <h3 className="mt-8 font-heading text-lg font-bold uppercase text-chalk-100">{t("pages.dexPage.traitsTitle")}</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {TRAITS.map((k) => (
                <li key={k} className="bevel-sm bg-night-800 px-3 py-2 text-sm text-chalk-200">
                  {t(`pages.dexPage.traits.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="dex-host justify-self-center">
            <Dex pose="carte" height={260} still />
          </div>
        </section>

        <section aria-labelledby="does">
          <h2 id="does" className={h2}>
            {t("pages.dexPage.doesTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          {/* Two blocks of different weights: the site, wide; Discord, set apart on the night relief. */}
          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-10">
            <div>
              <h3 className="display-caps text-[2rem] text-chalk-100 sm:text-[2.5rem]">{t("pages.dexPage.siteTitle")}</h3>
              <p className="mt-2 max-w-xl leading-relaxed text-chalk-300">{t("pages.dexPage.siteText")}</p>
            </div>
            <div className="bevel-lg bg-night-800 p-6 shadow-[inset_0_3px_0_var(--color-azure-400)]">
              <h3 className="display-caps text-[2rem] text-chalk-100 sm:text-[2.5rem]">{t("pages.dexPage.discordTitle")}</h3>
              <p className="mt-2 leading-relaxed text-chalk-300">{t("pages.dexPage.discordText")}</p>
              {bot && (
                <p className="mt-4">
                  <Link href="/bot" className={more}>
                    {t("pages.dexPage.botLink")} →
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="poses" aria-labelledby="poses-title" className="scroll-mt-24">
          <h2 id="poses-title" className={h2}>
            {t("pages.dexPage.posesTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <p className="mt-3 max-w-2xl text-chalk-300">{t("pages.dexPage.posesLead")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 xl:grid-cols-6">
            {POSES.map((pose) => (
              <li key={pose} className="dex-host flex flex-col items-center text-center">
                <span className="flex h-[156px] items-end">
                  <Dex pose={pose} height={150} />
                </span>
                <h3 className="display-caps mt-4 text-2xl text-gold-400">{t(`pages.dexPage.poses.${pose}.name`)}</h3>
                <p className="mt-1 max-w-[14rem] text-sm leading-snug text-chalk-300">{t(`pages.dexPage.poses.${pose}.text`)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <Link href="/brand" className={more}>
              {t("pages.dexPage.kitLink")} →
            </Link>
          </p>
        </section>

        <section aria-labelledby="join" className="dex-host bevel-lg flex items-end gap-6 bg-night-800 p-6 shadow-[inset_0_3px_0_var(--color-gold-400)] sm:p-10">
          <div className="min-w-0 flex-1">
            <h2 id="join" className={h2}>
              {t("pages.dexPage.joinTitle")}
            </h2>
            <p className="mt-3 mb-6 max-w-2xl text-chalk-300">{t("pages.dexPage.joinText")}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {invite && (
                <DiscordJoinLink href={invite} placement="Inline" className="btn btn-primary">
                  <DiscordMark />
                  {t("pages.dexPage.join")}
                </DiscordJoinLink>
              )}
              {bot && (
                <Link href="/bot" className={more}>
                  {t("pages.dexPage.botLink")} →
                </Link>
              )}
              <Link href="/about" className={more}>
                {t("pages.dexPage.aboutLink")} →
              </Link>
            </div>
          </div>
          <span className="hidden shrink-0 md:block">
            <Dex pose="victoire" height={210} still />
          </span>
        </section>
      </div>
    </>
  );
}

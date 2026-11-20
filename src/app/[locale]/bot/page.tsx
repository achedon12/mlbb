import type { Metadata } from "next";
import Image from "next/image";
import { Gift, Languages, PartyPopper, Star, Wrench } from "lucide-react";
import { DiscordMark } from "@/components/bot/discord-mark";
import Link from "@/components/link";
import { Dex } from "@/components/mascot";
import { heroArt, StageHeader } from "@/components/stage";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { BOT_CATEGORIES, BOT_COMMANDS, voteUrl } from "@/lib/bot/commands";
import { botClientId, communityInvite, inviteUrl } from "@/lib/bot/public";
import { liveServerCount } from "@/lib/bot/server-count";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * The bot's landing page: what it does, shown with the bot's own replies
 * (`public/bot/`, rendered by `bot/listing/render.mjs` from its embed
 * builders), its commands by family as indexable text, the permissions it
 * asks for, the FAQ, and the "Add to Discord", "Join the server" and "Vote"
 * buttons.
 *
 * Built only when the application id is set at build time (otherwise 404,
 * like every bot page). The live server count is the one database read of a
 * public page: cached, and the page itself is regenerated every ten
 * minutes at most.
 */
export const revalidate = 600;

const PATH = "/bot";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!botClientId()) return notFoundMetadata(locale);
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.bot.metaTitle"),
    description: t("pages.bot.metaDescription"),
    path: PATH,
    // The bot's banner, 1200×630: a share shows the bot, not the site.
    image: "/bot/banner.png",
    keywords: [
      "mobile legends discord bot",
      "mlbb discord bot",
      "MLBB bot",
      "mobile legends build bot",
      "mobile legends counter bot",
      "mobile legends tier list bot",
      "MLBBdle discord",
      "Dex MLBB",
    ],
  });
}

const PERMISSIONS = ["view", "send", "threads", "embed", "attach", "history", "emojis", "reactions"] as const;

/** The replies shown, with their size (the files are 1440 px wide, drawn at 2x). */
const SHOWCASE = [
  { key: "heroes", file: "screenshot-hero", width: 1440, height: 1631 },
  { key: "builds", file: "screenshot-counter", width: 1440, height: 726 },
  { key: "meta", file: "screenshot-tierlist", width: 1440, height: 991 },
  { key: "news", file: "screenshot-patch", width: 1440, height: 832 },
  { key: "daily", file: "screenshot-mlbbdle", width: 1440, height: 769 },
] as const;

const EXTRAS = [
  { key: "welcome", icon: PartyPopper },
  { key: "tools", icon: Wrench },
  { key: "languages", icon: Languages },
  { key: "free", icon: Gift },
] as const;

const FAQ_COUNT = 8;

export default async function BotPage({ params }: Params) {
  const { locale } = await params;
  const clientId = botClientId();
  if (!clientId) return <NotFoundPage />;
  const t = createT(locale);
  const invite = communityInvite();
  const servers = await liveServerCount();
  const add = inviteUrl(clientId);
  const vote = voteUrl();
  const h2 = "type-section text-chalk-100";
  const faq = Array.from({ length: FAQ_COUNT }, (_, i) => ({ q: t(`pages.bot.faq${i + 1}q`), a: t(`pages.bot.faq${i + 1}a`) }));

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Dex MLBB",
      alternateName: ["MLBBDex Discord bot", "MLBBDex bot"],
      description: t("pages.bot.metaDescription"),
      url: `${site.url}/${locale}${PATH}`,
      applicationCategory: "GameApplication",
      applicationSubCategory: "Discord bot",
      operatingSystem: "Discord",
      inLanguage: LOCALE_HTML[locale],
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      installUrl: add,
      image: `${site.url}/bot/banner.png`,
      screenshot: SHOWCASE.map((s) => `${site.url}/bot/${s.file}.webp`),
      featureList: SHOWCASE.map((s) => t(`pages.bot.showcase.${s.key}Title`)),
      publisher: { "@type": "Organization", name: site.name, url: site.url },
      about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((e) => ({ "@type": "Question", name: e.q, acceptedAnswer: { "@type": "Answer", text: e.a } })),
    },
  ];

  const ctas = (
    <div className="flex flex-wrap gap-3">
      <a href={add} rel="noopener" className="btn btn-primary">
        <DiscordMark />
        {t("pages.bot.add")}
      </a>
      {invite && (
        <a href={invite} rel="noopener" className="btn btn-secondary">
          {t("pages.bot.join")}
        </a>
      )}
      <a href={vote} rel="noopener" className="btn btn-secondary">
        <Star size={16} aria-hidden />
        {t("pages.bot.vote")}
      </a>
    </div>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <StageHeader
        title={t("pages.bot.title")}
        art={heroArt("zilong")}
        artPosition="55% 20%"
        dex="idee"
        lead={t("pages.bot.lead")}
        crumbs={[{ name: t("pages.bot.breadcrumb") }]}
        meta={[
          t("pages.bot.free"),
          t("pages.bot.languages"),
          t("pages.bot.noAdmin"),
          servers ? t("pages.bot.servers", { count: new Intl.NumberFormat(locale).format(servers) }) : null,
        ]}
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {ctas}
          <Link
            href="/bot/dashboard"
            prefetch={false}
            className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
          >
            {t("pages.bot.dashboard")} →
          </Link>
        </div>
        {/* Dex introduces the bot: on Discord, the bot is him (Dex MLBB, his face as its avatar). */}
        <p className="dex-bubble mt-5 max-w-md font-heading text-lg font-semibold leading-snug text-chalk-100">
          {t("pages.bot.dexLine")}{" "}
          <Link href="/dex" className="whitespace-nowrap text-gold-400 transition-colors hover:text-gold-300">
            {t("pages.bot.dexLink")} →
          </Link>
        </p>
      </StageHeader>

      <div className="stage-enter page-wrap space-y-16 py-10 sm:space-y-24 sm:py-14">
        <section aria-labelledby="features">
          <h2 id="features" className={h2}>
            {t("pages.bot.showcaseTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <div className="mt-6 space-y-10 sm:space-y-14">
            {SHOWCASE.map((s, i) => (
              <article key={s.key} className="grid items-center gap-5 md:grid-cols-2 md:gap-10">
                <div className={i % 2 ? "md:order-2" : undefined}>
                  <span aria-hidden className="score score-outline block text-[4.5rem]">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="display-caps mt-2 text-[2rem] text-chalk-100 sm:text-[2.5rem]">{t(`pages.bot.showcase.${s.key}Title`)}</h3>
                  <p className="mt-2 leading-relaxed text-chalk-300">{t(`pages.bot.showcase.${s.key}Text`)}</p>
                </div>
                <Image
                  src={`/bot/${s.file}.webp`}
                  alt={t(`pages.bot.showcase.${s.key}Alt`)}
                  width={s.width / 2}
                  height={s.height / 2}
                  sizes="(min-width: 768px) 460px, calc(100vw - 2rem)"
                  // The first one is the page's largest image, in view on a desktop.
                  priority={i === 0}
                  className="bevel-lg h-auto w-full shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)] transition-[translate] duration-300 hover:-translate-y-0.5"
                />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="extras">
          <h2 id="extras" className={h2}>
            {t("pages.bot.extrasTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {EXTRAS.map(({ icon: Icon, key }) => (
              <li key={key} className="card transition-[translate] duration-200 hover:-translate-y-0.5">
                <p className="flex items-center gap-2 font-heading text-xl font-bold uppercase text-chalk-100">
                  <Icon size={20} aria-hidden className="text-gold-400" />
                  {t(`pages.bot.extras.${key}Title`)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-chalk-300">{t(`pages.bot.extras.${key}Text`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="commands">
          <h2 id="commands" className={h2}>
            {t("pages.bot.commandsTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <p className="mt-3 text-chalk-300">{t("pages.bot.commandsLead")}</p>
          <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {BOT_CATEGORIES.map((category) => (
              <div key={category}>
                <h3 className="font-heading text-base font-bold uppercase tracking-wide text-chalk-100">
                  {t(`pages.bot.categories.${category}`)}
                </h3>
                <dl className="mt-2 divide-y divide-night-700/70 border-y border-night-700/70">
                  {BOT_COMMANDS.filter((c) => c.category === category).map((c) => (
                    <div key={c.name} className="py-2.5">
                      <dt>
                        <code className="font-mono text-sm text-gold-400">
                          /{c.name}
                          {c.options && <span className="text-chalk-500"> {c.options}</span>}
                        </code>
                      </dt>
                      <dd className="mt-0.5 text-sm leading-relaxed text-chalk-300">{t(`pages.bot.commands.${c.name}`)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="permissions">
          <h2 id="permissions" className={h2}>
            {t("pages.bot.permissionsTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <p className="mt-3 text-chalk-300">{t("pages.bot.permissionsText")}</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm text-chalk-300">
            {PERMISSIONS.map((p) => (
              <li key={p} className="bevel-sm bg-night-800 px-2.5 py-1">
                {t(`pages.bot.permissions.${p}`)}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className={h2}>
            {t("pages.bot.faqTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <div className="mt-5 space-y-6">
            {faq.map((e) => (
              <div key={e.q}>
                <h3 className="font-heading text-lg font-bold text-chalk-100">{e.q}</h3>
                <p className="mt-1 leading-relaxed text-chalk-300">{e.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="cta" className="dex-host bevel-lg flex items-end gap-6 bg-night-800 p-6 shadow-[inset_0_3px_0_var(--color-gold-400)] sm:p-10">
          <div className="min-w-0 flex-1">
            <h2 id="cta" className={h2}>
              {t("pages.bot.ctaTitle")}
            </h2>
            <p className="mt-3 mb-6 max-w-2xl text-chalk-300">{t("pages.bot.ctaText")}</p>
            {ctas}
          </div>
          <span aria-hidden className="hidden shrink-0 md:block">
            <Dex pose="victoire" height={210} still />
          </span>
        </section>

        <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/bot/privacy" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
            {t("pages.bot.privacy")} →
          </Link>
          <Link href="/bot/terms" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
            {t("pages.bot.terms")} →
          </Link>
        </p>
      </div>
    </>
  );
}

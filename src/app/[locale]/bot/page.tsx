import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellRing, Languages, Puzzle, ScrollText } from "lucide-react";
import { DiscordMark } from "@/components/bot/discord-mark";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { BOT_COMMANDS } from "@/lib/bot/commands";
import { botClientId, communityInvite, inviteUrl } from "@/lib/bot/public";
import { liveServerCount } from "@/lib/bot/server-count";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * The bot's landing page: what it does, its commands as indexable text,
 * the permissions it asks for, the FAQ, and the "Add to Discord" and "Join
 * the server" buttons.
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
  if (!botClientId()) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.bot.metaTitle"),
    description: t("pages.bot.metaDescription"),
    path: PATH,
    keywords: ["mobile legends discord bot", "mlbb discord bot", "MLBB bot", "mobile legends tier list bot", "MLBBdle discord"],
  });
}

const PERMISSIONS = ["view", "send", "threads", "embed", "attach", "history", "emojis", "reactions"] as const;
const BUTTON = "bevel-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors";

export default async function BotPage({ params }: Params) {
  const { locale } = await params;
  const clientId = botClientId();
  if (!clientId) notFound();
  const t = createT(locale);
  const invite = communityInvite();
  const servers = await liveServerCount();
  const h2 = "font-heading text-xl font-bold text-chalk-100 sm:text-2xl";

  const features = [
    { icon: ScrollText, key: "heroes" },
    { icon: BellRing, key: "announcements" },
    { icon: Puzzle, key: "daily" },
    { icon: Languages, key: "languages" },
  ] as const;
  const faq = [1, 2, 3, 4, 5].map((n) => ({ q: t(`pages.bot.faq${n}q`), a: t(`pages.bot.faq${n}a`) }));

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: site.name,
      description: t("pages.bot.metaDescription"),
      url: `${site.url}/${locale}${PATH}`,
      applicationCategory: "GameApplication",
      applicationSubCategory: "Discord bot",
      operatingSystem: "Discord",
      inLanguage: LOCALE_HTML[locale],
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      installUrl: inviteUrl(clientId),
      publisher: { "@type": "Organization", name: site.name, url: site.url },
      about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((e) => ({ "@type": "Question", name: e.q, acceptedAnswer: { "@type": "Answer", text: e.a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.bot.title")}
        lead={t("pages.bot.lead")}
        crumbs={[{ name: t("pages.bot.breadcrumb") }]}
        meta={[
          t("pages.bot.free"),
          servers ? t("pages.bot.servers", { count: new Intl.NumberFormat(locale).format(servers) }) : null,
        ]}
      >
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={inviteUrl(clientId)} rel="noopener" className={`${BUTTON} bg-gold-500 text-night-950 hover:bg-gold-400`}>
            <DiscordMark />
            {t("pages.bot.add")}
          </a>
          {invite && (
            <a
              href={invite}
              rel="noopener"
              className={`${BUTTON} border border-night-600 bg-night-800 text-chalk-100 hover:border-gold-500/60`}
            >
              {t("pages.bot.join")}
            </a>
          )}
          <Link
            href="/bot/dashboard"
            prefetch={false}
            className={`${BUTTON} border border-night-600 text-chalk-300 hover:border-gold-500/60 hover:text-chalk-100`}
          >
            {t("pages.bot.dashboard")}
          </Link>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:space-y-14">
        <section aria-labelledby="features">
          <h2 id="features" className={h2}>
            {t("pages.bot.featuresTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, key }) => (
              <li key={key} className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
                <p className="flex items-center gap-2 font-heading font-bold text-gold-400">
                  <Icon size={18} aria-hidden />
                  {t(`pages.bot.features.${key}Title`)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-chalk-300">{t(`pages.bot.features.${key}Text`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="commands">
          <h2 id="commands" className={h2}>
            {t("pages.bot.commandsTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-3 text-chalk-300">{t("pages.bot.commandsLead")}</p>
          <dl className="mt-5 divide-y divide-night-700/70 border-y border-night-700/70">
            {BOT_COMMANDS.map((c) => (
              <div key={c.name} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                <dt>
                  <code className="font-mono text-sm text-gold-400">
                    /{c.name}
                    {c.options && <span className="text-chalk-500"> {c.options}</span>}
                  </code>
                </dt>
                <dd className="text-sm leading-relaxed text-chalk-300">{t(`pages.bot.commands.${c.name}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="permissions">
          <h2 id="permissions" className={h2}>
            {t("pages.bot.permissionsTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-3 text-chalk-300">{t("pages.bot.permissionsText")}</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm text-chalk-300">
            {PERMISSIONS.map((p) => (
              <li key={p} className="bevel-sm border border-night-700/70 bg-night-950/50 px-2.5 py-1">
                {t(`pages.bot.permissions.${p}`)}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className={h2}>
            {t("pages.bot.faqTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-5 space-y-6">
            {faq.map((e) => (
              <div key={e.q}>
                <h3 className="font-heading text-lg font-bold text-chalk-100">{e.q}</h3>
                <p className="mt-1 leading-relaxed text-chalk-300">{e.a}</p>
              </div>
            ))}
          </div>
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

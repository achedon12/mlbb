import { ArrowRight, Bot, HandHeart, Library, Rss } from "lucide-react";
import Link from "@/components/link";
import { cn } from "@/lib/utils";
import { DiscordMark } from "@/components/bot/discord-mark";
import { DiscordJoinLink } from "@/components/discord-join-link";
import { SectionTitle } from "@/components/ui";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { botPublished, communityInvite } from "@/lib/bot/public";
import { allArticles } from "@/lib/content";
import { formatShortDate } from "@/lib/utils";

/**
 * Latest articles, then where players meet: the Discord server when its
 * invite is set, the bot when it is deployed, the community builds and the
 * contribution guide. Each block only appears when its page exists.
 */
export function HomeCommunity({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const articles = allArticles(locale).slice(0, 3);
  const invite = communityInvite();
  const bot = botPublished();

  const doors = [
    { href: "/builds", icon: Library, title: t("nav.communityBuilds.label"), text: t("home.community.buildsText") },
    ...(bot ? [{ href: "/bot", icon: Bot, title: t("nav.bot.label"), text: t("nav.bot.desc") }] : []),
    { href: "/contribute", icon: HandHeart, title: t("footer.contribute"), text: t("home.community.contributeText") },
  ];

  return (
    <section className={cn("grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-10", className)}>
      <div>
        <SectionTitle action={{ href: "/news", label: t("home.allNews") }}>{t("home.latestArticles")}</SectionTitle>
        <ul className="space-y-2">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/${a.category === "Patch" ? "patch-notes" : "news"}/${a.slug}`}
                className="card-link eclat-under group block p-4 sm:p-5"
              >
                <span className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-heading text-sm font-bold uppercase text-gold-400">{t(`articleCategory.${a.category}`)}</span>
                  <time dateTime={a.date} className="text-chalk-500">
                    {formatShortDate(a.date, LOCALE_INTL[locale])}
                  </time>
                </span>
                <span className="mt-1.5 line-clamp-2 block font-heading text-lg font-bold leading-tight text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-xl">
                  {a.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm leading-snug text-chalk-500">{a.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-sm text-chalk-500">
          <Rss size={15} aria-hidden className="text-gold-400" />
          <Link href="/feed.xml" className="inline-flex min-h-11 items-center hover:text-gold-400">
            {t("home.followRss")}
          </Link>
        </p>
      </div>

      <div>
        <SectionTitle>{t("home.community.title")}</SectionTitle>
        {/* The server first and largest: where the players meet. */}
        {invite && (
          <DiscordJoinLink
            href={invite}
            placement="Inline"
            context="default"
            className="bevel-lg group relative mb-3 block overflow-hidden bg-night-800 p-5 shadow-[inset_0_3px_0_var(--color-azure-500)] transition-colors hover:bg-night-700 sm:p-6"
          >
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 text-azure-500/15">
              <DiscordMark size={160} />
            </span>
            <span className="relative flex items-center gap-4">
              <span className="bevel-sm grid size-14 shrink-0 place-items-center bg-azure-500 text-night-950">
                <DiscordMark size={30} />
              </span>
              <span className="display-caps min-w-0 pr-[0.12em] text-[clamp(1.75rem,1.4rem+1.2vw,2.4rem)] text-chalk-100">
                {t("discordPopup.title")}
              </span>
            </span>
            <span className="relative mt-3 block max-w-md text-sm text-chalk-200 sm:text-base">{t("discordCta.default.text")}</span>
            <span className="btn relative mt-4 bg-azure-500 text-night-950 group-hover:bg-azure-300">
              {t("discordPopup.join")}
              <ArrowRight size={16} aria-hidden />
            </span>
          </DiscordJoinLink>
        )}
        <ul className="space-y-2">
          {doors.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link
                href={href}
                className="card-link group flex min-h-11 items-start gap-3 p-3"
              >
                <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                <span className="min-w-0">
                  <span className="block font-heading text-lg font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-400">
                    {title}
                  </span>
                  <span className="block text-sm text-chalk-500">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

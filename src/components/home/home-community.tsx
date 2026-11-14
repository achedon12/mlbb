import { Bot, HandHeart, Library, Rss } from "lucide-react";
import Link from "@/components/link";
import { cn } from "@/lib/utils";
import { DiscordMark } from "@/components/bot/discord-mark";
import { SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
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
                className="bevel group block border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60 sm:p-4"
              >
                <span className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-semibold text-gold-400">{t(`articleCategory.${a.category}`)}</span>
                  <time dateTime={a.date} className="text-chalk-500">
                    {formatShortDate(a.date, LOCALE_HTML[locale])}
                  </time>
                </span>
                <span className="mt-1 line-clamp-2 block font-heading font-bold leading-snug text-chalk-100 transition-colors group-hover:text-gold-400 sm:text-lg">
                  {a.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm leading-snug text-chalk-500">{a.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-sm text-chalk-500">
          <Rss size={15} aria-hidden className="text-gold-400" />
          <Link href="/feed.xml" className="hover:text-gold-400">
            {t("home.followRss")}
          </Link>
        </p>
      </div>

      <div>
        <SectionTitle>{t("home.community.title")}</SectionTitle>
        {invite && (
          <a
            href={invite}
            rel="noopener"
            className="bevel group mb-3 flex items-center gap-4 border border-blurple-500/50 bg-blurple-500/15 p-4 transition-colors hover:border-blurple-500 hover:bg-blurple-500/25"
          >
            <span className="bevel-sm grid size-12 shrink-0 place-items-center bg-blurple-500 text-white">
              <DiscordMark size={26} />
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-lg font-bold text-chalk-100">{t("discordPopup.title")}</span>
              <span className="block text-sm text-chalk-300">{t("discordPopup.text")}</span>
            </span>
          </a>
        )}
        <ul className="space-y-2">
          {doors.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link
                href={href}
                className="bevel-sm group flex items-start gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60"
              >
                <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
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

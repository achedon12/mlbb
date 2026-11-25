import { ArrowRight, Rss } from "lucide-react";
import Link from "@/components/link";
import { cn } from "@/lib/utils";
import { DiscordMark } from "@/components/bot/discord-mark";
import { DiscordJoinLink } from "@/components/discord-join-link";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { botPublished, communityInvite } from "@/lib/bot/public";
import { allArticles } from "@/lib/content";
import { formatShortDate } from "@/lib/utils";

const articleHref = (a: { category: string; slug: string }) => `/${a.category === "Patch" ? "patch-notes" : "news"}/${a.slug}`;

/**
 * The latest articles as an editorial list: the newest one large at the
 * left, the next two beside it, each its category, date, title and summary
 * on the page, split by hairlines. Then the other doors of the community
 * (the players' builds, the bot when it is deployed, the contribution
 * guide) as a line of links.
 */
export function HomeArticles({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const articles = allArticles(locale).slice(0, 3);
  const bot = botPublished();
  const doors = [
    { href: "/builds", title: t("nav.communityBuilds.label"), text: t("home.community.buildsText") },
    ...(bot ? [{ href: "/bot", title: t("nav.bot.label"), text: t("nav.bot.desc") }] : []),
    { href: "/contribute", title: t("footer.contribute"), text: t("home.community.contributeText") },
  ];
  const lang = LOCALE_INTL[locale];
  const [first, ...rest] = articles;

  return (
    <section aria-labelledby="home-articles" className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="home-articles" className="display-caps text-[clamp(2.6rem,1.6rem+3vw,4.5rem)] leading-[0.88] text-chalk-100">
          {t("home.latestArticles")}
        </h2>
        <p className="flex flex-wrap gap-x-6">
          <Link href="/news" className="inline-flex min-h-11 items-center font-semibold text-gold-400 underline decoration-1 underline-offset-4 hover:text-gold-300">
            {t("home.allNews")}
          </Link>
          <Link href="/feed.xml" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-chalk-400 hover:text-gold-300">
            <Rss size={14} aria-hidden />
            {t("home.followRss")}
          </Link>
        </p>
      </div>

      {first && (
        <div className="mt-8 grid gap-x-16 border-t border-night-800 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Article article={first} lang={lang} t={t} large />
          <ul className="lg:border-l lg:border-night-800 lg:pl-16">
            {rest.map((a, i) => (
              <li key={a.slug} className={cn("border-night-800", i > 0 && "border-t", "max-lg:border-t")}>
                <Article article={a} lang={lang} t={t} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-14 grid gap-x-10 gap-y-6 border-t border-night-800 pt-6 sm:grid-cols-3">
        {doors.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="group block">
              <span className="block font-heading text-xl font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">{d.title}</span>
              <span className="mt-1 block text-sm text-chalk-400">{d.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Article({
  article: a,
  lang,
  t,
  large = false,
}: {
  article: ReturnType<typeof allArticles>[number];
  lang: string;
  t: ReturnType<typeof createT>;
  large?: boolean;
}) {
  return (
    <Link href={articleHref(a)} className={cn("group block", large ? "py-8" : "py-6")}>
      <span className="flex flex-wrap items-baseline gap-3 text-sm">
        <span className="font-semibold text-gold-400">{t(`articleCategory.${a.category}`)}</span>
        <time dateTime={a.date} className="text-chalk-500">
          {formatShortDate(a.date, lang)}
        </time>
      </span>
      <span
        className={cn(
          "mt-2 block font-heading font-bold leading-[1.05] text-chalk-100 transition-colors group-hover:text-gold-300",
          large ? "text-[clamp(1.9rem,1.3rem+2vw,3.25rem)]" : "line-clamp-2 text-2xl",
        )}
      >
        {a.title}
      </span>
      <span className={cn("mt-3 block text-chalk-400", large ? "max-w-2xl text-lg leading-relaxed" : "line-clamp-2 text-sm leading-snug")}>
        {a.summary}
      </span>
    </Link>
  );
}

/**
 * The Discord server, as one band across the whole screen: the real logo
 * set large, the invitation and its button. Only when the invite is set.
 */
export function HomeDiscord({ locale }: { locale: Locale }) {
  const invite = communityInvite();
  if (!invite) return null;
  const t = createT(locale);
  return (
    <section aria-labelledby="home-discord" className="relative overflow-hidden border-y border-night-800 bg-night-900">
      <DiscordJoinLink href={invite} placement="Inline" context="default" className="group block">
        <span className="page-wrap flex flex-col gap-8 py-14 sm:flex-row sm:items-center sm:gap-12 sm:py-16">
          <span aria-hidden className="shrink-0 text-azure-500 transition-transform duration-200 group-hover:-translate-y-0.5">
            <DiscordMark size={96} />
          </span>
          <span className="min-w-0 flex-1">
            <span id="home-discord" role="heading" aria-level={2} className="display-caps block pr-[0.1em] text-[clamp(2.4rem,1.6rem+2.6vw,4rem)] leading-[0.9] text-chalk-100">
              {t("discordPopup.title")}
            </span>
            <span className="mt-3 block max-w-xl text-chalk-200 sm:text-lg">{t("discordCta.default.text")}</span>
          </span>
          <span className="btn scheme-dark shrink-0 self-start bg-azure-500 px-7 text-night-950 group-hover:bg-azure-300 sm:self-center">
            {t("discordPopup.join")}
            <ArrowRight size={16} aria-hidden />
          </span>
        </span>
      </DiscordJoinLink>
    </section>
  );
}

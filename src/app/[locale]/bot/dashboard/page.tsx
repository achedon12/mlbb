import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuildIcon, LoginPanel, UserBar, BUTTON } from "@/components/bot/dashboard-parts";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { manageableGuilds, type BotGuild } from "@/lib/bot/client";
import { botConfig, isSuperAdmin } from "@/lib/bot/config";
import { dashboardPageAllowed } from "@/lib/bot/dashboard-guard";
import { botClientId, inviteUrl } from "@/lib/bot/public";
import { currentDiscordUser } from "@/lib/bot/session";

type Params = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ login?: string }> };

/**
 * Dashboard home: Discord login, then the servers this user can manage,
 * asked live to the bot (Manage Server in that server, bot present).
 * Private and dynamic: never indexed, never cached.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return { title: t("pages.botDashboard.title"), robots: { index: false, follow: false } };
}

export default async function DashboardPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const config = botConfig();
  const clientId = botClientId();
  if (!config || !clientId) notFound();
  const t = createT(locale);
  const user = await currentDiscordUser(config);

  let guilds: BotGuild[] | null = null;
  // Throttled per account and address (see `dashboardReadAllowed`): past
  // the ceiling, the page says the bot is unreachable for a moment.
  if (user && (await dashboardPageAllowed(user.id))) guilds = await manageableGuilds(config, user.id).catch(() => null);

  return (
    <>
      <PageHeader
        title={t("pages.botDashboard.title")}
        lead={t("pages.botDashboard.lead")}
        crumbs={[{ name: t("pages.bot.breadcrumb"), href: "/bot" }, { name: t("pages.bot.dashboard") }]}
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {!user ? (
          <LoginPanel t={t} locale={locale} next="dashboard" failed={(await searchParams).login === "failed"} />
        ) : (
          <>
            <UserBar t={t} locale={locale} user={user} />
            <section aria-labelledby="servers">
              <h2 id="servers" className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
                {t("pages.botDashboard.serversTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <p className="mt-3 text-sm text-chalk-500">{t("pages.botDashboard.serversLead")}</p>
              {guilds === null ? (
                <p role="alert" className="mt-5 text-chalk-300">
                  {t("pages.botDashboard.unreachable")}
                </p>
              ) : guilds.length === 0 ? (
                <p className="mt-5 text-chalk-300">{t("pages.botDashboard.noServers")}</p>
              ) : (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {guilds.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/bot/dashboard/${g.id}`}
                        prefetch={false}
                        className="bevel-sm flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60"
                      >
                        <GuildIcon id={g.id} icon={g.icon} name={g.name} />
                        <span className="min-w-0 flex-1 truncate font-semibold text-chalk-100">{g.name}</span>
                        <span className="text-sm text-gold-400">{t("pages.botDashboard.manage")} →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <a href={inviteUrl(clientId)} rel="noopener" className={`${BUTTON} mt-6 border border-night-600 bg-night-800 text-chalk-100 hover:border-gold-500/60`}>
                {t("pages.botDashboard.addBot")}
              </a>
            </section>
            {isSuperAdmin(config, user.id) && (
              <p>
                <Link href="/bot/admin" prefetch={false} className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500">
                  {t("pages.botDashboard.admin")} →
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

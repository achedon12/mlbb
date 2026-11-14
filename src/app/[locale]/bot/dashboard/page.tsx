import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BUTTON, GuildIcon, LoginPanel, UserBar } from "@/components/bot/dashboard-parts";
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
 * asked live to the bot (Manage Server in that server, bot present), each a
 * card leading to its settings, and a distinct card to add the bot to
 * another server (the login reads no server list: those cannot be named).
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

  const addCard = (
    <a
      href={inviteUrl(clientId)}
      rel="noopener"
      className="bevel group flex h-full min-h-24 items-center gap-4 border border-dashed border-night-600 bg-night-900/40 p-4 transition-colors hover:border-gold-500/70 hover:bg-night-900/80"
    >
      <span aria-hidden className="bevel-sm grid size-12 shrink-0 place-items-center bg-gold-500/15 text-gold-400">
        <Plus className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg font-bold text-chalk-100">{t("pages.botDashboard.addBot")}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-chalk-400">{t("pages.botDashboard.addBotLead")}</span>
      </span>
    </a>
  );

  return (
    <>
      <PageHeader
        title={t("pages.botDashboard.title")}
        lead={t("pages.botDashboard.lead")}
        crumbs={[{ name: t("pages.bot.breadcrumb"), href: "/bot" }, { name: t("pages.bot.dashboard") }]}
      />
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:py-10">
        {!user ? (
          <LoginPanel t={t} locale={locale} next="dashboard" failed={(await searchParams).login === "failed"} />
        ) : (
          <>
            <UserBar t={t} locale={locale} user={user} />
            <section aria-labelledby="servers">
              <h2 id="servers" className="font-heading text-2xl font-bold text-chalk-100">
                {t("pages.botDashboard.serversTitle")}
              </h2>
              <p className="mt-1 max-w-prose text-base text-chalk-300">{t("pages.botDashboard.serversLead")}</p>
              {guilds === null ? (
                <p role="alert" className="bevel mt-5 border-l-4 border-blood-400 bg-blood-500/10 p-4 text-base text-chalk-100">
                  {t("pages.botDashboard.unreachable")}
                </p>
              ) : guilds.length === 0 ? (
                <div className="mt-5 space-y-4">
                  <p className="text-base text-chalk-200">{t("pages.botDashboard.noServers")}</p>
                  <div className="max-w-xl">{addCard}</div>
                </div>
              ) : (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {guilds.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/bot/dashboard/${g.id}`}
                        prefetch={false}
                        className="bevel group flex min-h-24 items-center gap-4 border border-night-700 bg-night-900/80 p-4 transition-colors hover:border-gold-500/70 hover:bg-night-850"
                      >
                        <GuildIcon id={g.id} icon={g.icon} name={g.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading text-lg font-bold text-chalk-100">{g.name}</span>
                          <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-300">
                            <span aria-hidden className="size-2 rounded-full bg-emerald-400" />
                            {t("pages.botDashboard.botPresent")}
                          </span>
                        </span>
                        <span className={`${BUTTON} shrink-0 bg-gold-500 text-night-950 group-hover:bg-gold-400`}>
                          {t("pages.botDashboard.manage")}
                          <ChevronRight aria-hidden className="size-4" />
                        </span>
                      </Link>
                    </li>
                  ))}
                  <li>{addCard}</li>
                </ul>
              )}
            </section>
            {isSuperAdmin(config, user.id) && (
              <p>
                <Link
                  href="/bot/admin"
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
                >
                  <ShieldCheck aria-hidden className="size-4" />
                  {t("pages.botDashboard.admin")}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

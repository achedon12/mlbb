import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayBars } from "@/components/bot/day-bars";
import { GuildIcon, LoginPanel, UserBar } from "@/components/bot/dashboard-parts";
import { FlushButton } from "@/components/bot/settings-form";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { LOCALE_NAME, isLocale, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";
import { botStats, type BotStats } from "@/lib/bot/client";
import { botConfig, isSuperAdmin } from "@/lib/bot/config";
import { botClientId } from "@/lib/bot/public";
import { currentDiscordUser } from "@/lib/bot/session";
import { adminStats, isWindow, WINDOWS, type AdminStats, type StatsWindow } from "@/lib/bot/stats";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ window?: string; login?: string }> };

/**
 * Super admin panel. The Discord id is checked against BOT_SUPER_ADMIN_IDS
 * on every request; anyone else gets the same 404 as a missing page. Every
 * figure is server-rendered, charts included: the only script is the flush
 * button.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return { title: createT(locale)("pages.botAdmin.title"), robots: { index: false, follow: false } };
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
      <dt className="text-xs text-chalk-500">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-chalk-100">{value}</dd>
    </div>
  );
}

const h2 = "font-heading text-xl font-bold text-chalk-100 sm:text-2xl";

export default async function AdminPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const config = botConfig();
  if (!config || !botClientId()) notFound();
  const t = createT(locale);
  const user = await currentDiscordUser(config);
  const query = await searchParams;
  const crumbs = [{ name: t("pages.bot.breadcrumb"), href: "/bot" }, { name: t("pages.botAdmin.title") }];

  if (!user) {
    return (
      <>
        <PageHeader title={t("pages.botAdmin.title")} lead={t("pages.botAdmin.lead")} crumbs={crumbs} />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <LoginPanel t={t} locale={locale} next="admin" failed={query.login === "failed"} />
        </div>
      </>
    );
  }
  if (!isSuperAdmin(config, user.id)) notFound();

  const window: StatsWindow = isWindow(query.window) ? query.window : "7d";
  const [stats, health] = await Promise.all([
    adminStats(window).catch((): AdminStats | null => null),
    botStats(config).catch((): BotStats | null => null),
  ]);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const languageOf = (l: string) => (isLocale(l) ? LOCALE_NAME[l] : l);
  const duration = (s: number) => {
    const days = Math.floor(s / 86_400);
    const hours = Math.floor((s % 86_400) / 3600);
    return days ? `${days} d ${hours} h` : `${hours} h ${Math.floor((s % 3600) / 60)} min`;
  };

  return (
    <>
      <PageHeader title={t("pages.botAdmin.title")} lead={t("pages.botAdmin.lead")} crumbs={crumbs} />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <UserBar t={t} locale={locale} user={user} />

        <nav aria-label={t("pages.botAdmin.window")} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-chalk-500">{t("pages.botAdmin.window")}</span>
          {(Object.keys(WINDOWS) as StatsWindow[]).map((w) => (
            <Link
              key={w}
              href={`/bot/admin?window=${w}`}
              prefetch={false}
              aria-current={w === window ? "page" : undefined}
              className={cn(
                "bevel-sm border px-3 py-1.5 transition-colors",
                w === window ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-night-700 text-chalk-300 hover:border-gold-500/60",
              )}
            >
              {t(`pages.botAdmin.windows.${w}`)}
            </Link>
          ))}
        </nav>

        <ExtendMessages messages={messagesPage(locale, ["pages.botUI"])}>
          <FlushButton />
        </ExtendMessages>

        <section aria-labelledby="health">
          <h2 id="health" className={h2}>
            {t("pages.botAdmin.healthTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          {!health ? (
            <p role="alert" className="mt-4 text-blood-400">
              {t("pages.botAdmin.botUnreachable")}
            </p>
          ) : (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Figure label={t("pages.botAdmin.guildCount")} value={number.format(health.guildCount)} />
                <Figure label={t("pages.botAdmin.shards")} value={number.format(health.shards.length)} />
                <Figure label={t("pages.botAdmin.memory")} value={`${number.format(Math.round(health.memoryMb))} MB`} />
                <Figure label={t("pages.botAdmin.uptime")} value={duration(health.uptimeSec)} />
              </dl>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {health.shards.map((s) => (
                  <li key={s.id} className="bevel-sm flex justify-between gap-3 border border-night-700/70 bg-night-900/60 px-3 py-2">
                    <span className="text-chalk-100">{t("pages.botAdmin.shard", { id: s.id })}</span>
                    <span className="tabular-nums text-chalk-300">
                      {s.status} · {number.format(s.guilds)} · {t("pages.botAdmin.ping")} {s.ping === null ? "–" : `${number.format(Math.round(s.ping))} ms`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {!stats ? (
          <p role="alert" className="text-blood-400">
            {t("pages.botAdmin.databaseUnreachable")}
          </p>
        ) : (
          <>
            <section aria-labelledby="servers">
              <h2 id="servers" className={h2}>
                {t("pages.botAdmin.serversTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Figure label={t("pages.botAdmin.active")} value={number.format(stats.servers.active)} />
                <Figure label={t("pages.botAdmin.left")} value={number.format(stats.servers.left)} />
                <Figure label={t("pages.botAdmin.votes")} value={number.format(stats.votes)} />
              </dl>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <DayBars title={t("pages.botAdmin.joinsPerDay")} points={stats.servers.joins} locale={locale} empty={t("pages.botAdmin.chartEmpty")} />
                <DayBars title={t("pages.botAdmin.leavesPerDay")} points={stats.servers.leaves} locale={locale} empty={t("pages.botAdmin.chartEmpty")} />
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
                <div>
                  <h3 className="font-semibold text-chalk-100">{t("pages.botAdmin.biggest")}</h3>
                  <ol className="mt-3 space-y-2">
                    {stats.servers.biggest.map((g) => (
                      <li key={g.id} className="flex items-center gap-3 text-sm">
                        <GuildIcon id={g.id} icon={g.icon} name={g.name} />
                        <span className="min-w-0 flex-1 truncate text-chalk-100">{g.name}</span>
                        <span className="tabular-nums text-chalk-300">
                          {t("pages.botDashboard.members", { count: number.format(g.memberCount) })}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="font-semibold text-chalk-100">{t("pages.botAdmin.locales")}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {stats.servers.locales.map((l) => (
                      <li key={l.locale} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-chalk-300">{languageOf(l.locale)}</span>
                        <span aria-hidden className="h-2 flex-1 bg-night-700">
                          <span
                            className="block h-full bg-azure-500"
                            style={{ width: `${(l.count / Math.max(1, stats.servers.active)) * 100}%` }}
                          />
                        </span>
                        <span className="w-12 text-right tabular-nums text-chalk-100">{number.format(l.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section aria-labelledby="commands">
              <h2 id="commands" className={h2}>
                {t("pages.botAdmin.commandsTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Figure label={t("pages.botAdmin.total")} value={number.format(stats.commands.total)} />
                <Figure label={t("pages.botAdmin.errorRate")} value={percent.format(stats.commands.errorRate)} />
                <Figure label={t("pages.botAdmin.p95")} value={`${number.format(stats.commands.p95)} ms`} />
              </dl>
              <DayBars
                className="mt-4"
                title={t("pages.botAdmin.perDay")}
                points={stats.commands.perDay}
                locale={locale}
                empty={t("pages.botAdmin.chartEmpty")}
              />
              <h3 className="mt-6 font-semibold text-chalk-100">{t("pages.botAdmin.topCommands")}</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[22rem] text-sm">
                  <thead className="text-left text-xs text-chalk-500">
                    <tr>
                      <th scope="col" className="py-2 font-semibold">{t("pages.botAdmin.command")}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{t("pages.botAdmin.count")}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{t("pages.botAdmin.errors")}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{t("pages.botAdmin.p95")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-night-700/70">
                    {stats.commands.top.map((c) => (
                      <tr key={c.command}>
                        <td className="py-2 font-mono text-gold-400">/{c.command}</td>
                        <td className="py-2 text-right tabular-nums text-chalk-100">{number.format(c.count)}</td>
                        <td className={cn("py-2 text-right tabular-nums", c.errors ? "text-blood-400" : "text-chalk-500")}>
                          {number.format(c.errors)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-chalk-300">{number.format(c.p95)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="announcements">
              <h2 id="announcements" className={h2}>
                {t("pages.botAdmin.announcementsTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <Figure label={t("pages.botAdmin.delivered")} value={number.format(stats.announcements.sent)} />
                <Figure label={t("pages.botAdmin.failed")} value={number.format(stats.announcements.failed)} />
              </dl>
            </section>

            <section aria-labelledby="daily">
              <h2 id="daily" className={h2}>
                {t("pages.botAdmin.dailyTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <DayBars
                className="mt-5"
                title={t("pages.botAdmin.playersPerDay")}
                points={stats.daily.playersPerDay}
                locale={locale}
                empty={t("pages.botAdmin.chartEmpty")}
              />
            </section>
          </>
        )}
      </div>
    </>
  );
}

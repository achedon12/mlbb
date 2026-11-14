import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuildIcon, LoginPanel, UserBar } from "@/components/bot/dashboard-parts";
import { SettingsForm } from "@/components/bot/settings-form";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";
import { canManage, guildChannels } from "@/lib/bot/client";
import { botConfig } from "@/lib/bot/config";
import { dashboardPageAllowed } from "@/lib/bot/dashboard-guard";
import { botClientId, isSnowflake } from "@/lib/bot/public";
import { currentDiscordUser } from "@/lib/bot/session";
import { settingsView } from "@/lib/bot/settings";
import { deliveryHealth } from "@/lib/bot/stats";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale; guild: string }> };

/**
 * One server's dashboard: its settings form and its delivery health. The
 * bot is asked first whether this user may manage this server; then for its
 * channels and roles, which feed the pickers.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return { title: createT(locale)("pages.botDashboard.title"), robots: { index: false, follow: false } };
}

export default async function GuildPage({ params }: Params) {
  const { locale, guild: id } = await params;
  const config = botConfig();
  if (!config || !botClientId() || !isSnowflake(id)) notFound();
  const t = createT(locale);
  const user = await currentDiscordUser(config);
  const crumbs = [
    { name: t("pages.bot.breadcrumb"), href: "/bot" },
    { name: t("pages.bot.dashboard"), href: "/bot/dashboard" },
  ];

  const message = (text: string) => (
    <>
      <PageHeader title={t("pages.botDashboard.title")} lead={t("pages.botDashboard.lead")} crumbs={[...crumbs.slice(0, 1), { name: t("pages.bot.dashboard") }]} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        {user ? <UserBar t={t} locale={locale} user={user} /> : null}
        <p role="alert" className="text-chalk-300">
          {text}
        </p>
        <Link href="/bot/dashboard" className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500">
          ← {t("pages.botDashboard.back")}
        </Link>
      </div>
    </>
  );

  if (!user) {
    return (
      <>
        <PageHeader title={t("pages.botDashboard.title")} lead={t("pages.botDashboard.lead")} crumbs={crumbs} />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <LoginPanel t={t} locale={locale} next="dashboard" failed={false} />
        </div>
      </>
    );
  }

  let allowed: boolean;
  let lists: Awaited<ReturnType<typeof guildChannels>>;
  // Throttled per account and address (see `dashboardReadAllowed`).
  if (!(await dashboardPageAllowed(user.id))) return message(t("pages.botDashboard.unreachable"));
  try {
    allowed = await canManage(config, id, user.id);
    if (!allowed) return message(t("pages.botDashboard.notAllowed"));
    lists = await guildChannels(config, id);
  } catch {
    return message(t("pages.botDashboard.unreachable"));
  }

  const [guild, health] = await Promise.all([
    db().guild.findUnique({ where: { id }, include: { settings: true } }).catch(() => undefined),
    deliveryHealth(id).catch(() => null),
  ]);
  if (guild === undefined) return message(t("pages.botDashboard.unreachable"));
  if (!guild || guild.leftAt) return message(t("pages.botDashboard.notAllowed"));
  const view = settingsView(guild.id, guild.locale, guild.settings);
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title={guild.name}
        lead={t("pages.botDashboard.lead")}
        crumbs={[...crumbs, { name: guild.name }]}
        icon={<GuildIcon id={guild.id} icon={guild.icon} name={guild.name} />}
        meta={[t("pages.botDashboard.members", { count: new Intl.NumberFormat(locale).format(guild.memberCount) })]}
      />
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        <UserBar t={t} locale={locale} user={user} />
        <section aria-labelledby="settings">
          <h2 id="settings" className="sr-only">
            {t("pages.botDashboard.settingsTitle")}
          </h2>
          <ExtendMessages messages={messagesPage(locale, ["pages.botUI"])}>
            <SettingsForm
              guildId={guild.id}
              initial={view}
              channels={lists.channels.map(({ id, name }) => ({ id, name }))}
              roles={lists.roles.map(({ id, name }) => ({ id, name }))}
            />
          </ExtendMessages>
        </section>

        <section aria-labelledby="deliveries">
          <h2 id="deliveries" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.botDashboard.deliveriesTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          {!health?.length ? (
            <p className="mt-4 text-sm text-chalk-500">{t("pages.botDashboard.noDeliveries")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-night-700/70 border-y border-night-700/70 text-sm">
              {health.map((d) => (
                <li key={`${d.type}-${d.key}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="text-chalk-100">
                    {t(`pages.botUI.types.${d.type}`)} <span className="text-chalk-500">· {d.key}</span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className={cn("font-semibold", d.status === "sent" ? "text-emerald-400" : "text-blood-400")}>
                      {t(`pages.botDashboard.statuses.${d.status}`)}
                    </span>
                    <time dateTime={d.sentAt} className="tabular-nums text-chalk-500">
                      {dateTime.format(new Date(d.sentAt))} UTC
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

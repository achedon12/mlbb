import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BUTTON, GuildIcon, LoginPanel, UserBar } from "@/components/bot/dashboard-parts";
import { RoleMenusSection } from "@/components/bot/role-menus-section";
import { SettingsForm } from "@/components/bot/settings-form";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";
import { canManage, grantableRoles, guildChannels, guildEmojis, mentionableRoles, refusalFor, type BotEmoji } from "@/lib/bot/client";
import { botConfig } from "@/lib/bot/config";
import { dashboardPageAllowed } from "@/lib/bot/dashboard-guard";
import { botClientId, discordImage, isSnowflake } from "@/lib/bot/public";
import { currentDiscordUser } from "@/lib/bot/session";
import { roleMenuStatus } from "@/lib/bot/kinds";
import { roleMenuView } from "@/lib/bot/role-menus";
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
        <div className="bevel border border-night-700 bg-night-900/80 p-5 sm:p-6">
          <p role="alert" className="text-base leading-relaxed text-chalk-100">
            {text}
          </p>
          <Link href="/bot/dashboard" className={`${BUTTON} mt-4 border border-night-600 bg-night-800 text-chalk-100 hover:border-gold-500/70`}>
            <ArrowLeft aria-hidden className="size-4" />
            {t("pages.botDashboard.back")}
          </Link>
        </div>
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
  let granted: Awaited<ReturnType<typeof grantableRoles>>;
  let emojis: BotEmoji[];
  // Throttled per account and address (see `dashboardReadAllowed`).
  if (!(await dashboardPageAllowed(user.id))) return message(t("pages.botDashboard.unreachable"));
  try {
    allowed = await canManage(config, id, user.id);
    if (!allowed) return message(t("pages.botDashboard.notAllowed"));
    // Which roles this user may hand out: the auto-role pickers offer only those.
    // The server's emojis feed the role menu pickers: without them (an older bot), none offered.
    [lists, granted, emojis] = await Promise.all([
      guildChannels(config, id),
      grantableRoles(config, id, user.id),
      guildEmojis(config, id).catch(() => []),
    ]);
  } catch {
    return message(t("pages.botDashboard.unreachable"));
  }

  const [guild, health, menuRows] = await Promise.all([
    db().guild.findUnique({ where: { id }, include: { settings: true } }).catch(() => undefined),
    deliveryHealth(id).catch(() => null),
    db()
      .roleMenu.findMany({ where: { guildId: id }, orderBy: { id: "asc" } })
      .catch(() => undefined),
  ]);
  if (guild === undefined || menuRows === undefined) return message(t("pages.botDashboard.unreachable"));
  if (!guild || guild.leftAt) return message(t("pages.botDashboard.notAllowed"));
  const view = settingsView(guild.id, guild.locale, guild.settings);
  const menus = menuRows.map(roleMenuView);
  // A menu set up by another manager who can no longer give its roles is
  // paused (the bot refuses every click): asked live, for a few managers at most.
  const grantsBy = new Map<string, ReadonlySet<string>>([[user.id, granted.grantable]]);
  const others = [...new Set(menus.map((m) => m.configuredBy))].filter((u) => u !== user.id).slice(0, 3);
  for (const [other, grants] of await Promise.all(
    others.map((other) => grantableRoles(config, id, other).then((g) => [other, g.grantable] as const, () => [other, null] as const)),
  )) {
    if (grants) grantsBy.set(other, grants);
  }
  const paused = menus.filter((m) => grantsBy.get(m.configuredBy) && m.options.some((o) => !grantsBy.get(m.configuredBy)!.has(o.roleId))).map((m) => m.id);
  const assignable = new Set(lists.roles.filter((r) => r.assignable).map((r) => r.id));
  const menusState = !menus.length
    ? { kind: "off" as const, text: t("pages.botUI.statusOff") }
    : paused.length || !lists.manageRoles || menus.some((m) => m.options.some((o) => !assignable.has(o.roleId)))
      ? { kind: "attention" as const, text: t("pages.botUI.statusAttention") }
      : {
          kind: "on" as const,
          text: t("pages.botUI.statusCount", { on: menus.filter((m) => roleMenuStatus(m) !== "draft").length, total: menus.length }),
        };
  const roleChoices = lists.roles.map((r) => ({ ...r, granterRefusal: refusalFor(granted.refusals, r.id) }));
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title={guild.name}
        lead={t("pages.botDashboard.lead")}
        crumbs={[...crumbs, { name: guild.name }]}
        icon={<GuildIcon id={guild.id} icon={guild.icon} name={guild.name} size="lg" />}
        meta={[
          <span key="bot" className="inline-flex items-center gap-1.5 text-emerald-300">
            <span aria-hidden className="size-2 rounded-full bg-emerald-400" />
            {t("pages.botDashboard.botPresent")}
          </span>,
          t("pages.botDashboard.members", { count: new Intl.NumberFormat(locale).format(guild.memberCount) }),
          lists.manageRoles ? null : t("pages.botDashboard.noManageRoles"),
        ]}
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/bot/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500">
            <ArrowLeft aria-hidden className="size-4" />
            {t("pages.botDashboard.back")}
          </Link>
          <UserBar t={t} locale={locale} user={user} compact />
        </div>
        <section aria-labelledby="settings">
          <h2 id="settings" className="sr-only">
            {t("pages.botDashboard.settingsTitle")}
          </h2>
          <ExtendMessages messages={messagesPage(locale, ["pages.botUI"])}>
            <SettingsForm
              guildId={guild.id}
              initial={view}
              channels={lists.channels.map(({ id, name }) => ({ id, name }))}
              roles={mentionableRoles(lists.roles).map(({ id, name }) => ({ id, name }))}
              autoRoles={{ roles: roleChoices, manageRoles: lists.manageRoles }}
              sample={{ user: user.name, avatarUrl: discordImage("avatars", user.id, user.avatar, 128), server: guild.name, count: guild.memberCount }}
              extraSections={[{ id: "role-menus", title: t("pages.botUI.roleMenus.title"), state: menusState }]}
            />
            <div className="mt-6 lg:ml-[15rem]">
              <RoleMenusSection
                guildId={guild.id}
                userId={user.id}
                initial={menus}
                channels={lists.channels.map(({ id, name }) => ({ id, name }))}
                roles={roleChoices}
                emojis={emojis}
                manageRoles={lists.manageRoles}
                paused={paused}
                state={menusState}
              />
            </div>
          </ExtendMessages>
        </section>

        <section aria-labelledby="deliveries" className="bevel border border-night-700 bg-night-900/80 p-4 sm:p-5 lg:ml-[15rem]">
          <h2 id="deliveries" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.botDashboard.deliveriesTitle")}
          </h2>
          <p className="mt-1 text-sm text-chalk-400">{t("pages.botDashboard.deliveriesLead")}</p>
          {!health?.length ? (
            <p className="mt-4 text-base text-chalk-300">{t("pages.botDashboard.noDeliveries")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-night-700 border-y border-night-700 text-base">
              {health.map((d) => (
                <li key={`${d.type}-${d.key}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="text-chalk-100">
                    {t(`pages.botUI.types.${d.type}`)} <span className="text-chalk-400">({d.key})</span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className={cn("font-semibold", d.status === "sent" ? "text-emerald-400" : "text-blood-400")}>
                      {t(`pages.botDashboard.statuses.${d.status}`)}
                    </span>
                    <time dateTime={d.sentAt} className="text-sm tabular-nums text-chalk-400">
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

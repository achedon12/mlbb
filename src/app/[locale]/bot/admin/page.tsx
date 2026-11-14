import { CircleCheck, CircleX, DatabaseBackup, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FlowColumns,
  Kpi,
  Legend,
  OTHER_COLOR,
  PANEL,
  RankBars,
  SegmentedBar,
  SERIES,
  StackedColumns,
  STATUS,
  type Series,
} from "@/components/bot/admin-charts";
import { BackupButton } from "@/components/bot/backup-button";
import { GuildIcon, LoginPanel, UserBar } from "@/components/bot/dashboard-parts";
import { FlushButton } from "@/components/bot/settings-form";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { LOCALE_NAME, isLocale, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage, type T } from "@/i18n/translations";
import { botStats, type BotStats } from "@/lib/bot/client";
import { botConfig, isSuperAdmin } from "@/lib/bot/config";
import { botClientId } from "@/lib/bot/public";
import { recentLogRows, type LogRow } from "@/lib/bot/recent-log";
import { currentDiscordUser } from "@/lib/bot/session";
import { adminStats, isWindow, OTHER, relativeChange, WINDOWS, type AdminStats, type StatsWindow } from "@/lib/bot/stats";
import { listBackups, readStatus, type BackupFile, type BackupStatus } from "@/lib/db-backup";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ window?: string; login?: string }> };

/**
 * Super admin panel. The Discord id is checked against BOT_SUPER_ADMIN_IDS
 * on every request; anyone else gets the same 404 as a missing page. Every
 * figure is server-rendered, charts included (`admin-charts.tsx`, hover and
 * focus in CSS): the only scripts are the flush and backup buttons.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return { title: createT(locale)("pages.botAdmin.title"), robots: { index: false, follow: false } };
}

const SHARD_KEYS = new Set([
  "ready",
  "connecting",
  "reconnecting",
  "idle",
  "nearly",
  "disconnected",
  "waitingForGuilds",
  "identifying",
  "resuming",
  "unavailable",
]);

function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id} className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
            {title}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Panel({ title, className, children, aside }: { title: string; className?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <figure className={cn(PANEL, "min-w-0", className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-chalk-100">{title}</span>
        {aside}
      </figcaption>
      {children}
    </figure>
  );
}

function duration(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days} j ${hours} h` : hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function bytes(n: number, locale: string) {
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i ? 1 : 0 }).format(v)} ${units[i]}`;
}

/** Ping: under 150 ms fine, under 400 slow, beyond that bad. */
const pingTone = (ping: number | null) => (ping === null ? "bg-chalk-600" : ping < 150 ? "bg-[#199e70]" : ping < 400 ? "bg-[#c98500]" : "bg-blood-500");

function Health({ t, health, locale }: { t: T; health: BotStats | null; locale: string }) {
  const number = new Intl.NumberFormat(locale);
  const state = !health ? "down" : health.shards.every((s) => s.status === "ready") ? "ok" : "degraded";
  const lamp = { ok: "bg-[#2fd39b]", degraded: "bg-gold-400", down: "bg-blood-500" }[state];
  const facts = health
    ? [
        [t("pages.botAdmin.uptime"), duration(health.uptimeSec)],
        [t("pages.botAdmin.memory"), `${number.format(Math.round(health.memoryMb))} MB`],
        [t("pages.botAdmin.guildCount"), number.format(health.guildCount)],
        [t("pages.botAdmin.shards"), number.format(health.totalShards ?? health.shards.length)],
        [t("pages.botAdmin.version"), health.version ?? "–"],
        [t("pages.botAdmin.node"), health.node ?? "–"],
      ]
    : [];
  return (
    <div className="bevel relative overflow-hidden border border-night-600/80 bg-[radial-gradient(ellipse_at_top_left,rgba(224,169,46,0.14),transparent_55%),linear-gradient(180deg,#131b30,#0a0e1a)] p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span aria-hidden className="relative flex size-4">
            {state === "ok" && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:hidden", lamp)} />}
            <span className={cn("relative size-4 rounded-full ring-4 ring-night-950/70", lamp)} />
          </span>
          <div>
            <p className="text-sm text-chalk-300">{t("pages.botAdmin.healthTitle")}</p>
            <p className="font-heading text-3xl font-bold text-chalk-100">{t(`pages.botAdmin.status.${state}`)}</p>
          </div>
        </div>
        {health && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-chalk-500">{label}</dt>
                <dd className="mt-0.5 truncate font-heading text-lg font-semibold text-chalk-100">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {!health ? (
        <p role="alert" className="mt-4 text-sm text-blood-400">
          {t("pages.botAdmin.botUnreachable")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {health.shards.map((s) => {
            const ready = s.status === "ready";
            const label = t(`pages.botAdmin.shardStatus.${SHARD_KEYS.has(s.status) ? s.status : "unknown"}`);
            return (
              <li key={s.id} className="bevel-sm border border-night-700/80 bg-night-950/50 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-chalk-100">{t("pages.botAdmin.shard", { id: s.id })}</span>
                  <span className={cn("flex items-center gap-1.5 text-xs", ready ? "text-chalk-300" : "text-gold-400")}>
                    {ready ? <CircleCheck aria-hidden className="size-3.5 text-[#2fd39b]" /> : <TriangleAlert aria-hidden className="size-3.5" />}
                    {label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-chalk-500">
                  <span aria-hidden className="flex gap-[2px]">
                    {[0, 1, 2, 3].map((bar) => (
                      <span
                        key={bar}
                        className={cn("w-1 rounded-[1px]", bar <= (s.ping === null ? -1 : s.ping < 150 ? 3 : s.ping < 400 ? 1 : 0) ? pingTone(s.ping) : "bg-night-700")}
                        style={{ height: 4 + bar * 3 }}
                      />
                    ))}
                  </span>
                  <span className="tabular-nums text-chalk-300">
                    {s.ping === null ? t("pages.botAdmin.pingUnknown") : `${number.format(Math.round(s.ping))} ms`}
                  </span>
                  <span className="ml-auto tabular-nums">{t("pages.botAdmin.guilds", { count: number.format(s.guilds) })}</span>
                  {s.memoryMb !== undefined && <span className="tabular-nums">{number.format(s.memoryMb)} MB</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Backups({ t, files, status, locale }: { t: T; files: BackupFile[]; status: BackupStatus | null; locale: string }) {
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
  return (
    <Panel title={t("pages.botAdmin.backupsTitle")}>
      <p className="mt-1 text-sm text-chalk-500">{t("pages.botAdmin.backupsLead")}</p>
      {status && (
        <p className={cn("mt-3 flex items-start gap-2 text-sm", status.ok ? "text-chalk-300" : "text-blood-400")}>
          {status.ok ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-[#2fd39b]" /> : <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />}
          <span>
            {status.ok
              ? t("pages.botAdmin.lastBackupOk", {
                  when: when(status.at),
                  duration: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(status.durationMs / 1000),
                  trigger: t(`pages.botAdmin.backupTrigger.${status.trigger}`),
                })
              : t("pages.botAdmin.lastBackupFailed", {
                  when: when(status.at),
                  trigger: t(`pages.botAdmin.backupTrigger.${status.trigger}`),
                  error: status.error ?? "",
                })}
          </span>
        </p>
      )}
      {files.length ? (
        <ul className="mt-4 divide-y divide-night-700/70 text-sm">
          {files.map((f, i) => (
            <li key={f.name} className="flex items-center gap-3 py-2.5">
              <DatabaseBackup aria-hidden className={cn("size-4 shrink-0", i === 0 ? "text-gold-400" : "text-chalk-500")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-chalk-100">{f.name}</span>
                <span className="block text-xs text-chalk-500">{when(f.createdAt)}</span>
              </span>
              <span className="tabular-nums text-chalk-300">{bytes(f.size, locale)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-chalk-500">{t("pages.botAdmin.backupsEmpty")}</p>
      )}
      <div className="mt-4">
        <BackupButton />
      </div>
    </Panel>
  );
}

function Logs({ t, rows, locale }: { t: T; rows: LogRow[]; locale: string }) {
  const time = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <Panel title={t("pages.botAdmin.logsTitle")}>
      {rows.length ? (
        <ol className="mt-3 divide-y divide-night-700/70 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.t}-${i}`} className="flex items-start gap-3 py-2">
              {r.level === "error" ? (
                <CircleX aria-label={t("pages.botAdmin.levels.error")} className="mt-0.5 size-4 shrink-0 text-blood-400" />
              ) : (
                <TriangleAlert aria-label={t("pages.botAdmin.levels.warning")} className="mt-0.5 size-4 shrink-0 text-gold-400" />
              )}
              <span className="min-w-0 flex-1 break-words text-chalk-200">{r.message}</span>
              <time dateTime={r.t} className="shrink-0 text-xs tabular-nums text-chalk-500">
                {time.format(new Date(r.t))}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-chalk-500">{t("pages.botAdmin.logsEmpty")}</p>
      )}
    </Panel>
  );
}

function Dashboard({ t, stats, locale }: { t: T; stats: AdminStats; locale: Locale }) {
  const number = new Intl.NumberFormat(locale);
  const format = (n: number) => number.format(Math.round(n));
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  // Site locales by their own name; Discord's (en-US, pt-BR…) by the browser's.
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const languageOf = (l: string) => {
    if (isLocale(l)) return LOCALE_NAME[l];
    try {
      return names.of(l) ?? l;
    } catch {
      return l;
    }
  };
  const hourly = stats.bucket === "hour";
  const short = new Intl.DateTimeFormat(locale, hourly ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(locale, hourly ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" } : { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dateOf = (key: string) => new Date(hourly ? `${key}:00:00Z` : `${key}T00:00:00Z`);
  const shortLabels = stats.keys.map((k) => short.format(dateOf(k)));
  const longLabels = stats.keys.map((k) => long.format(dateOf(k)) + (hourly ? " UTC" : ""));
  const dayShort = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dailyDates = stats.daily.perDay.map((d) => new Date(`${d.day}T00:00:00Z`));

  const k = stats.kpis;
  const vs = t(`pages.botAdmin.vsPrevious.${stats.window}`);
  const noBase = t("pages.botAdmin.noBase");
  const tile = { changeLabel: vs, noBase, locale };
  const commandTrend = stats.commands.perBucket.map((b) => b.total);

  const commandSeries: Series[] = stats.commands.series.map((id, i) => ({
    id,
    label: id === OTHER ? t("pages.botAdmin.other") : `/${id}`,
    color: id === OTHER ? OTHER_COLOR : SERIES[i % SERIES.length],
  }));
  const gameSeries: Series[] = stats.daily.games.map((id, i) => ({
    id,
    label: ["mlbbdle-classic", "mlbbdle-skill", "quiz"].includes(id) ? t(`pages.botAdmin.games.${id}`) : id,
    color: SERIES[(i + 1) % SERIES.length],
  }));
  const localeParts = (rows: { locale: string; count: number }[]) => {
    const top = rows.slice(0, SERIES.length);
    const rest = rows.slice(SERIES.length).reduce((n, r) => n + r.count, 0);
    return [
      ...top.map((r, i) => ({ id: r.locale, label: languageOf(r.locale), value: r.count, color: SERIES[i] })),
      ...(rest ? [{ id: OTHER, label: t("pages.botAdmin.other"), value: rest, color: OTHER_COLOR }] : []),
    ];
  };
  const typeLabel = (type: string) =>
    ["patches", "skins", "events", "advanceServer", "esports"].includes(type) ? t(`pages.botUI.types.${type}`) : type;
  const deliverySeries = [
    { id: "sent", label: t("pages.botAdmin.delivered"), color: STATUS.good },
    { id: "forbidden", label: t("pages.botAdmin.forbidden"), color: STATUS.warning },
    { id: "failed", label: t("pages.botAdmin.failed"), color: STATUS.bad },
  ];
  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          hero
          className="col-span-2 lg:row-span-2"
          label={t("pages.botAdmin.kpi.commands")}
          value={format(k.commands.current)}
          change={relativeChange(k.commands)}
          trend={commandTrend}
          {...tile}
        />
        <Kpi label={t("pages.botAdmin.kpi.servers")} value={format(k.servers.current)} change={relativeChange(k.servers)} trend={stats.servers.flow.map((f) => f.joins - f.leaves)} {...tile} />
        <Kpi label={t("pages.botAdmin.kpi.members")} value={new Intl.NumberFormat(locale, { notation: k.members.current >= 100_000 ? "compact" : "standard" }).format(k.members.current)} change={relativeChange(k.members)} {...tile} />
        <Kpi label={t("pages.botAdmin.kpi.players")} value={format(k.players.current)} change={relativeChange(k.players)} trend={stats.daily.perDay.map((d) => Object.values(d.values).reduce((n, v) => n + v, 0))} {...tile} />
        <Kpi label={t("pages.botAdmin.kpi.activeGuilds")} value={format(stats.commands.activeGuilds.current)} change={relativeChange(stats.commands.activeGuilds)} {...tile} />
        <Kpi
          label={t("pages.botAdmin.kpi.errorRate")}
          value={percent.format(k.errorRate.current)}
          change={relativeChange(k.errorRate)}
          goodWhenUp={false}
          trend={stats.commands.perBucket.map((b) => (b.total ? b.errors / b.total : 0))}
          {...tile}
        />
        <Kpi
          label={t("pages.botAdmin.kpi.p95")}
          value={`${format(k.p95.current)} ms`}
          change={relativeChange(k.p95)}
          goodWhenUp={false}
          trend={stats.commands.perBucket.map((b) => b.p95)}
          {...tile}
        />
        <Kpi label={t("pages.botAdmin.kpi.delivered")} value={format(stats.announcements.sent)} change={relativeChange({ current: stats.announcements.sent, previous: stats.announcements.previous.sent })} {...tile} />
        <Kpi label={t("pages.botAdmin.kpi.votes")} value={format(stats.votes.current)} change={relativeChange(stats.votes)} {...tile} />
      </dl>

      <Section id="commands" title={t("pages.botAdmin.commandsTitle")}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={t(`pages.botAdmin.perBucket.${stats.bucket}`)} className="lg:col-span-2">
            <StackedColumns
              title={t(`pages.botAdmin.perBucket.${stats.bucket}`)}
              rows={stats.commands.perBucket}
              series={commandSeries}
              labels={shortLabels}
              long={longLabels}
              format={format}
              unitLabel={t("pages.botAdmin.commandsUnit")}
              empty={t("pages.botAdmin.chartEmpty")}
              locale={locale}
              height="h-56 lg:h-80"
            />
          </Panel>
          <Panel title={t("pages.botAdmin.topCommands")}>
            <RankBars
              rows={stats.commands.top.slice(0, 8).map((c, i) => ({
                id: c.command,
                name: `/${c.command}`,
                label: <span className="font-semibold text-gold-400">/{c.command}</span>,
                value: c.count,
                segments: [
                  { label: t("pages.botAdmin.commandsUnit"), value: c.count - c.errors, color: i < 5 ? SERIES[i] : OTHER_COLOR },
                  { label: t("pages.botAdmin.failed"), value: c.errors, color: STATUS.bad },
                ],
                aside: (
                  <span className="text-xs tabular-nums text-chalk-500">
                    {c.errors > 0 && <span className="text-blood-400">{t("pages.botAdmin.errorsShort", { count: format(c.errors) })} · </span>}
                    {t("pages.botAdmin.p95Short", { ms: format(c.p95) })}
                  </span>
                ),
              }))}
              format={format}
              empty={t("pages.botAdmin.chartEmpty")}
            />
          </Panel>
          <Panel title={t(`pages.botAdmin.p95PerBucket.${stats.bucket}`)} className="lg:col-span-2">
            <StackedColumns
              title={t(`pages.botAdmin.p95PerBucket.${stats.bucket}`)}
              rows={stats.commands.perBucket.map((b) => ({ key: b.key, values: { p95: b.p95 } }))}
              series={[{ id: "p95", label: "p95", color: SERIES[1] }]}
              labels={shortLabels}
              long={longLabels}
              format={format}
              unitLabel={t("pages.botAdmin.msUnit")}
              empty={t("pages.botAdmin.chartEmpty")}
              locale={locale}
              height="h-32"
            />
          </Panel>
          <Panel title={t("pages.botAdmin.commandLocales")}>
            {stats.commands.locales.length ? (
              <SegmentedBar parts={localeParts(stats.commands.locales)} label={t("pages.botAdmin.commandLocales")} format={format} locale={locale} />
            ) : (
              <p className="mt-4 text-sm text-chalk-500">{t("pages.botAdmin.chartEmpty")}</p>
            )}
          </Panel>
          <Panel title={t("pages.botAdmin.topGuilds")} className="lg:col-span-3">
            <RankBars
              rows={stats.commands.topGuilds.map((g) => ({
                id: g.id,
                name: g.name,
                label: g.name,
                value: g.count,
                aside:
                  g.memberCount !== null ? (
                    <span className="hidden text-xs tabular-nums text-chalk-500 sm:inline">
                      {t("pages.botAdmin.members", { count: format(g.memberCount) })}
                    </span>
                  ) : undefined,
              }))}
              format={format}
              color={SERIES[1]}
              className="lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3 lg:space-y-0"
              empty={t("pages.botAdmin.chartEmpty")}
            />
          </Panel>
        </div>
      </Section>

      <Section id="servers" title={t("pages.botAdmin.serversTitle")}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel
            title={t("pages.botAdmin.flowTitle")}
            className="lg:col-span-2"
            aside={
              <span className="text-xs tabular-nums text-chalk-500">
                +{format(stats.servers.joins.current)} / −{format(stats.servers.leaves.current)}
              </span>
            }
          >
            <FlowColumns
              title={t("pages.botAdmin.flowTitle")}
              rows={stats.servers.flow}
              labels={shortLabels}
              long={longLabels}
              format={format}
              joinsLabel={t("pages.botAdmin.joins")}
              leavesLabel={t("pages.botAdmin.leaves")}
              empty={t("pages.botAdmin.chartEmpty")}
            />
          </Panel>
          <Panel title={t("pages.botAdmin.serverLocales")}>
            {stats.servers.locales.length ? (
              <SegmentedBar parts={localeParts(stats.servers.locales)} label={t("pages.botAdmin.serverLocales")} format={format} locale={locale} />
            ) : (
              <p className="mt-4 text-sm text-chalk-500">{t("pages.botAdmin.chartEmpty")}</p>
            )}
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-night-700/70 pt-4 text-center">
              {[
                [t("pages.botAdmin.activeServers"), stats.servers.active, "text-chalk-100"],
                [t("pages.botAdmin.leftServers"), stats.servers.left, "text-chalk-300"],
                [t("pages.botAdmin.failingServers"), stats.servers.failing, stats.servers.failing ? "text-blood-400" : "text-chalk-300"],
              ].map(([label, value, tone]) => (
                <div key={label as string} className="flex flex-col-reverse">
                  <dt className="mt-0.5 text-[0.7rem] leading-tight text-chalk-500">{label}</dt>
                  <dd className={cn("font-heading text-xl font-bold", tone as string)}>{format(value as number)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={t("pages.botAdmin.biggest")} className="lg:col-span-3">
            {stats.servers.biggest.length ? (
              <ol className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {stats.servers.biggest.map((g, i) => (
                  <li key={g.id} className="flex items-center gap-3 text-sm">
                    <span aria-hidden className="w-5 text-right font-heading font-bold tabular-nums text-chalk-600">
                      {i + 1}
                    </span>
                    <GuildIcon id={g.id} icon={g.icon} name={g.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-chalk-100">{g.name}</span>
                      <span className="block text-xs text-chalk-500">{languageOf(g.locale)}</span>
                    </span>
                    <span className="tabular-nums text-chalk-300">{t("pages.botAdmin.members", { count: format(g.memberCount) })}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-chalk-500">{t("pages.botAdmin.chartEmpty")}</p>
            )}
          </Panel>
        </div>
      </Section>

      <Section id="announcements" title={t("pages.botAdmin.announcementsTitle")}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={t("pages.botAdmin.byType")} className="lg:col-span-2">
            {stats.announcements.byType.length > 0 && <Legend series={deliverySeries} className="mt-3" />}
            <RankBars
              rows={stats.announcements.byType.map((d) => ({
                id: d.type,
                name: typeLabel(d.type),
                label: typeLabel(d.type),
                value: d.sent + d.forbidden + d.failed,
                segments: deliverySeries.map((s) => ({ label: s.label, value: d[s.id as "sent" | "forbidden" | "failed"], color: s.color })),
                aside: (d.failed + d.forbidden > 0) ? (
                  <span className="text-xs tabular-nums text-blood-400">
                    {t("pages.botAdmin.errorsShort", { count: format(d.failed + d.forbidden) })}
                  </span>
                ) : undefined,
              }))}
              format={format}
              empty={t("pages.botAdmin.chartEmpty")}
            />
          </Panel>
          <Panel title={t("pages.botAdmin.recentFailures")}>
            {stats.announcements.recentFailures.length ? (
              <ol className="mt-3 divide-y divide-night-700/70 text-sm">
                {stats.announcements.recentFailures.map((f, i) => (
                  <li key={i} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-chalk-100">{f.guild}</span>
                      <time dateTime={f.sentAt} className="shrink-0 text-xs tabular-nums text-chalk-500">
                        {when.format(new Date(f.sentAt))}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs text-chalk-500">
                      <span className={f.status === "forbidden" ? "text-gold-400" : "text-blood-400"}>
                        {f.status === "forbidden" ? t("pages.botAdmin.forbidden") : t("pages.botAdmin.failed")}
                      </span>{" "}
                      · {typeLabel(f.type)} {f.key}
                      {f.error && <span className="block truncate">{f.error}</span>}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm text-chalk-300">
                <CircleCheck aria-hidden className="size-4 text-[#2fd39b]" />
                {t("pages.botAdmin.noFailures")}
              </p>
            )}
          </Panel>
        </div>
      </Section>

      <Section id="daily" title={t("pages.botAdmin.dailyTitle")}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={t("pages.botAdmin.playersPerDay")} className="lg:col-span-2">
            <StackedColumns
              title={t("pages.botAdmin.playersPerDay")}
              rows={stats.daily.perDay.map((d) => ({ key: d.day, values: d.values }))}
              series={gameSeries}
              labels={dailyDates.map((d) => dayShort.format(d))}
              long={dailyDates.map((d) => dayLong.format(d))}
              format={format}
              unitLabel={t("pages.botAdmin.playersUnit")}
              empty={t("pages.botAdmin.chartEmpty")}
              locale={locale}
            />
          </Panel>
          <dl className="grid content-start gap-3">
            <Kpi label={t("pages.botAdmin.uniquePlayers")} value={format(stats.daily.players)} change={relativeChange(k.players)} {...tile} />
            <Kpi label={t("pages.botAdmin.results")} value={format(stats.daily.results.current)} change={relativeChange(stats.daily.results)} {...tile} />
          </dl>
        </div>
      </Section>
    </>
  );
}

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
  const now = new Date();
  const [stats, health, files, backupStatus, logRows] = await Promise.all([
    adminStats(window, now).catch((): AdminStats | null => null),
    botStats(config).catch((): BotStats | null => null),
    listBackups().catch((): BackupFile[] => []),
    readStatus().catch(() => null),
    recentLogRows().catch((): LogRow[] => []),
  ]);
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(now);

  return (
    <>
      <PageHeader title={t("pages.botAdmin.title")} lead={t("pages.botAdmin.lead")} crumbs={crumbs} />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:py-10">
        <UserBar t={t} locale={locale} user={user} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label={t("pages.botAdmin.window")} className="flex items-center gap-3 text-sm">
            <span className="text-chalk-500">{t("pages.botAdmin.window")}</span>
            <span className="bevel-sm flex border border-night-700 bg-night-900/80 p-1">
              {(Object.keys(WINDOWS) as StatsWindow[]).map((w) => (
                <Link
                  key={w}
                  href={`/bot/admin?window=${w}`}
                  prefetch={false}
                  aria-current={w === window ? "page" : undefined}
                  className={cn(
                    "px-3 py-1.5 font-semibold transition-colors",
                    w === window ? "bg-gold-500 text-night-950" : "text-chalk-300 hover:text-gold-400",
                  )}
                >
                  {t(`pages.botAdmin.windows.${w}`)}
                </Link>
              ))}
            </span>
            <span className="hidden text-xs text-chalk-500 sm:inline">{t("pages.botAdmin.updated", { time: clock })}</span>
          </nav>
          <ExtendMessages messages={messagesPage(locale, ["pages.botUI"])}>
            <FlushButton />
          </ExtendMessages>
        </div>

        <Health t={t} health={health} locale={locale} />

        {!stats ? (
          <p role="alert" className="text-blood-400">
            {t("pages.botAdmin.databaseUnreachable")}
          </p>
        ) : (
          <Dashboard t={t} stats={stats} locale={locale} />
        )}

        <Section id="ops" title={t("pages.botAdmin.opsTitle")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Logs t={t} rows={logRows} locale={locale} />
            <ExtendMessages messages={messagesPage(locale, ["pages.botUI"])}>
              <Backups t={t} files={files} status={backupStatus} locale={locale} />
            </ExtendMessages>
          </div>
        </Section>
      </div>
    </>
  );
}

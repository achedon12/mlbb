"use client";

import { CalendarClock, Hand, Languages, Megaphone, RotateCcw, Send, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { AutoRolesFieldset, type AutoRoleChoice } from "@/components/bot/auto-roles-fieldset";
import {
  FIELD,
  HELP,
  LABEL,
  Notice,
  PRIMARY,
  SECONDARY,
  Section,
  Toasts,
  useLeaveWarning,
  useToasts,
  type SectionState,
} from "@/components/bot/dashboard-ui";
import { GreetingsFieldset, type GreetingSample } from "@/components/bot/greetings-fieldset";
import { LOCALES, LOCALE_NAME, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import {
  ANNOUNCEMENT_TYPES,
  AUTO_ROLES_NOT_GRANTABLE,
  GREETING_KINDS,
  type AnnouncementType,
  type AutoRoleFailure,
  type GreetingKind,
} from "@/lib/bot/kinds";
import type { GuildSettingsView, SettingsInput } from "@/lib/bot/settings";
import { cn } from "@/lib/utils";

/**
 * A server's settings form, on its dashboard page. The channel and role
 * lists come from the bot, through the page; the save goes to
 * `/api/discord/guilds/<id>/settings`, which checks everything again
 * (permission, channels, roles) before writing.
 *
 * One card per part (language, announcements, daily games, welcome and
 * goodbye, auto-roles), each saying whether it is on, off or needs
 * attention, listed in a section index. Changes are kept in the page until
 * saved: a bar at the bottom says so, saves or discards them, and leaving
 * the page asks first. Saves and test posts answer with a toast.
 */

type Channel = { id: string; name: string };
type Failing = { channels: Set<AnnouncementType | GreetingKind>; autoRoles: AutoRoleFailure | null };

function toInput(view: GuildSettingsView): SettingsInput {
  return {
    locale: view.locale,
    announcements: Object.fromEntries(
      ANNOUNCEMENT_TYPES.map((t) => [t, { channelId: view[t].channelId, roleId: view[t].roleId }]),
    ) as SettingsInput["announcements"],
    dailyMlbbdleChannelId: view.dailyMlbbdleChannelId,
    dailyQuizChannelId: view.dailyQuizChannelId,
    dailyHourUtc: view.dailyHourUtc,
    welcome: { channelId: view.welcome.channelId, message: view.welcome.message },
    goodbye: { channelId: view.goodbye.channelId, message: view.goodbye.message },
    autoRoles: { roleIds: view.autoRoles.roleIds, botRoleIds: view.autoRoles.botRoleIds },
  };
}

const failingOf = (view: GuildSettingsView): Failing => ({
  channels: new Set([...ANNOUNCEMENT_TYPES, ...GREETING_KINDS].filter((key) => view[key].failing)),
  autoRoles: view.autoRoles.failing ? (view.autoRoles.failReason ?? "bot") : null,
});

async function send(url: string, method: "PUT" | "POST", body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return null;
  }
}

type Notify = (kind: "ok" | "error", text: string) => void;

/** `greeting`: test the welcome or goodbye message, with the text as it stands in the form. */
function TestButton({
  guildId,
  channelId,
  locale,
  greeting,
  notify,
  label,
}: {
  guildId: string;
  channelId: string | null;
  locale: Locale;
  greeting?: { kind: GreetingKind; message: string | null };
  notify: Notify;
  /** What is tested, for screen readers ("Send a test: Patch notes"). */
  label: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const response = await send(`/api/discord/guilds/${guildId}/test`, "POST", { channelId, locale, ...greeting });
    const ok = response?.ok && ((await response.json().catch(() => null)) as { ok?: boolean } | null)?.ok;
    setBusy(false);
    notify(ok ? "ok" : "error", ok ? t("pages.botUI.testSent") : t("pages.botUI.testFailed"));
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || !channelId}
      aria-label={`${t("pages.botUI.test")}: ${label}`}
      className={cn(SECONDARY, "w-full whitespace-nowrap sm:w-auto")}
    >
      <Send aria-hidden className="size-4" />
      {busy ? t("pages.botUI.testing") : t("pages.botUI.test")}
    </button>
  );
}

function Select({
  id,
  label,
  labelClass,
  value,
  disabled,
  onChange,
  children,
}: {
  id: string;
  label: string;
  labelClass?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cn(LABEL, labelClass)}>
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "mt-1.5")}>
        {children}
      </select>
    </div>
  );
}

const channelOptions = (channels: Channel[], none: string) => (
  <>
    <option value="">{none}</option>
    {channels.map((c) => (
      <option key={c.id} value={c.id}>
        #{c.name}
      </option>
    ))}
  </>
);

/** The section index: where each part is, and whether it is on. */
function SectionIndex({ items }: { items: { id: string; title: string; state?: SectionState }[] }) {
  const t = useT();
  return (
    <nav aria-label={t("pages.botUI.sectionsNav")} className="lg:sticky lg:top-24">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              className="bevel-sm relative flex min-h-11 items-center gap-2.5 border border-night-700 bg-night-900/80 px-3 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-chalk-100 lg:border-transparent lg:bg-transparent lg:hover:bg-night-900"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.state?.kind === "attention" ? "bg-blood-400" : item.state?.kind === "on" || !item.state ? "bg-emerald-400" : "bg-chalk-500",
                )}
              />
              <span>{item.title}</span>
              {item.state ? <span className="sr-only">({item.state.text})</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SettingsForm({
  guildId,
  initial,
  channels,
  roles,
  autoRoles,
  sample,
}: {
  guildId: string;
  initial: GuildSettingsView;
  channels: Channel[];
  /** Roles an announcement may mention. */
  roles: Channel[];
  /** Every role, with whether the bot may give it, and its Manage Roles. */
  autoRoles: { roles: AutoRoleChoice[]; manageRoles: boolean };
  /** Who and what the welcome preview shows: the signed-in user, this server. */
  sample: GreetingSample;
}) {
  const t = useT();
  const [saved, setSaved] = useState<SettingsInput>(() => toInput(initial));
  const [value, setValue] = useState<SettingsInput>(saved);
  const [failing, setFailing] = useState<Failing>(() => failingOf(initial));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();
  const ids = useId();

  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  useLeaveWarning(dirty);

  const setAnnouncement = (type: AnnouncementType, patch: Partial<SettingsInput["announcements"][AnnouncementType]>) =>
    setValue((v) => ({ ...v, announcements: { ...v.announcements, [type]: { ...v.announcements[type], ...patch } } }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setSaveError(null);
    const response = await send(`/api/discord/guilds/${guildId}/settings`, "PUT", value);
    setBusy(false);
    if (response?.ok) {
      const view = (await response.json().catch(() => null)) as GuildSettingsView | null;
      setSaved(value);
      // What the server kept: auto-roles another manager owns may stay failing.
      setFailing(view ? failingOf(view) : { channels: new Set(), autoRoles: null });
      push("ok", t("pages.botUI.saved"));
      return;
    }
    // A role this manager could not give themselves: say so, not "try again".
    const error = response?.status === 400 ? ((await response.json().catch(() => null)) as { error?: string } | null)?.error : null;
    const text = t(error === AUTO_ROLES_NOT_GRANTABLE ? "pages.botUI.autoRolesNotGrantable" : "pages.botUI.saveFailed");
    setSaveError(text);
    push("error", text);
  };

  const count = (on: number, total: number): SectionState =>
    on ? { kind: "on", text: t("pages.botUI.statusCount", { on, total }) } : { kind: "off", text: t("pages.botUI.statusOff") };
  const attention: SectionState = { kind: "attention", text: t("pages.botUI.statusAttention") };

  const announcementsOn = ANNOUNCEMENT_TYPES.filter((type) => value.announcements[type].channelId).length;
  const announcementsState =
    ANNOUNCEMENT_TYPES.some((type) => failing.channels.has(type) && value.announcements[type].channelId) ? attention : count(announcementsOn, ANNOUNCEMENT_TYPES.length);
  const dailyOn = [value.dailyMlbbdleChannelId, value.dailyQuizChannelId].filter(Boolean).length;
  const greetingsOn = GREETING_KINDS.filter((kind) => value[kind].channelId).length;
  const greetingsState = GREETING_KINDS.some((kind) => failing.channels.has(kind) && value[kind].channelId) ? attention : count(greetingsOn, 2);
  const autoRolesCount = value.autoRoles.roleIds.length + value.autoRoles.botRoleIds.length;
  const autoRolesState: SectionState =
    autoRolesCount && (failing.autoRoles || !autoRoles.manageRoles)
      ? attention
      : autoRolesCount
        ? { kind: "on", text: t("pages.botUI.statusOn") }
        : { kind: "off", text: t("pages.botUI.statusOff") };

  const sections = [
    { id: "language", title: t("pages.botUI.languageTitle") },
    { id: "announcements", title: t("pages.botUI.announcementsTitle"), state: announcementsState },
    { id: "daily", title: t("pages.botUI.dailyTitle"), state: count(dailyOn, 2) },
    { id: "greetings", title: t("pages.botUI.greetingsTitle"), state: greetingsState },
    { id: "auto-roles", title: t("pages.botUI.autoRolesTitle"), state: autoRolesState },
  ];
  const section = (id: string) => sections.find((s) => s.id === id)!;

  return (
    <form onSubmit={save} className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <SectionIndex items={sections} />

      <div className="mt-5 min-w-0 space-y-6 lg:mt-0">
        <Section id="language" icon={Languages} title={section("language").title} lead={t("pages.botUI.languageLead")}>
          <div className="max-w-sm">
            <Select
              id={`${ids}-locale`}
              label={t("pages.botUI.language")}
              value={value.locale}
              onChange={(locale) => setValue((v) => ({ ...v, locale: locale as Locale }))}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NAME[l]}
                </option>
              ))}
            </Select>
          </div>
        </Section>

        <Section
          id="announcements"
          icon={Megaphone}
          title={section("announcements").title}
          lead={t("pages.botUI.announcementsLead")}
          state={announcementsState}
        >
          {!channels.length ? <Notice tone="warning">{t("pages.botUI.noChannels")}</Notice> : null}
          <div
            aria-hidden
            className="hidden gap-4 border-b border-night-700 pb-2 text-sm font-semibold text-chalk-400 md:grid md:grid-cols-[minmax(8rem,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]"
          >
            <span>{t("pages.botUI.announcementType")}</span>
            <span>{t("pages.botUI.channel")}</span>
            <span>{t("pages.botUI.role")}</span>
            <span className="w-[9.5rem]" />
          </div>
          <ul className="divide-y divide-night-700">
            {ANNOUNCEMENT_TYPES.map((type) => {
              const setting = value.announcements[type];
              const name = t(`pages.botUI.types.${type}`);
              const broken = failing.channels.has(type) && setting.channelId;
              return (
                <li key={type} className={cn("py-4", broken && "-mx-2 border-l-4 border-l-blood-400 bg-blood-500/5 px-2")}>
                  <div className="grid gap-3 md:grid-cols-[minmax(8rem,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto] md:items-center md:gap-4">
                    <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-bold text-chalk-100 md:text-base">
                      {name}
                      <span className={cn("text-xs font-semibold", setting.channelId ? "text-emerald-300" : "text-chalk-400")}>
                        {setting.channelId ? t("pages.botUI.statusOn") : t("pages.botUI.statusOff")}
                      </span>
                    </p>
                    <Select
                      id={`${ids}-${type}-channel`}
                      label={`${t("pages.botUI.channel")}`}
                      labelClass="md:sr-only"
                      value={setting.channelId ?? ""}
                      onChange={(id) => setAnnouncement(type, { channelId: id || null, ...(id ? {} : { roleId: null }) })}
                    >
                      {channelOptions(channels, t("pages.botUI.off"))}
                    </Select>
                    <Select
                      id={`${ids}-${type}-role`}
                      label={t("pages.botUI.role")}
                      labelClass="md:sr-only"
                      value={setting.roleId ?? ""}
                      disabled={!setting.channelId}
                      onChange={(id) => setAnnouncement(type, { roleId: id || null })}
                    >
                      <option value="">{t("pages.botUI.noRole")}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                    </Select>
                    <TestButton guildId={guildId} channelId={setting.channelId} locale={value.locale} notify={push} label={name} />
                  </div>
                  {broken ? (
                    <div className="mt-3">
                      <Notice tone="error">{t("pages.botUI.failing")}</Notice>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section id="daily" icon={CalendarClock} title={section("daily").title} lead={t("pages.botUI.dailyLead")} state={count(dailyOn, 2)}>
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ["dailyMlbbdleChannelId", "pages.botUI.dailyMlbbdle"],
                ["dailyQuizChannelId", "pages.botUI.dailyQuiz"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-2">
                <Select
                  id={`${ids}-${field}`}
                  label={t(label)}
                  value={value[field] ?? ""}
                  onChange={(id) => setValue((v) => ({ ...v, [field]: id || null }))}
                >
                  {channelOptions(channels, t("pages.botUI.off"))}
                </Select>
                <TestButton guildId={guildId} channelId={value[field]} locale={value.locale} notify={push} label={t(label)} />
              </div>
            ))}
            <div className="max-w-xs">
              <Select
                id={`${ids}-hour`}
                label={t("pages.botUI.dailyHour")}
                value={String(value.dailyHourUtc)}
                disabled={!dailyOn}
                onChange={(hour) => setValue((v) => ({ ...v, dailyHourUtc: Number(hour) }))}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {t("pages.botUI.hourUtc", { hour: String(hour).padStart(2, "0") })}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Section>

        <Section id="greetings" icon={Hand} title={section("greetings").title} lead={t("pages.botUI.greetingsLead")} state={greetingsState}>
          <GreetingsFieldset
            value={{ welcome: value.welcome, goodbye: value.goodbye }}
            failing={new Set(GREETING_KINDS.filter((kind) => failing.channels.has(kind)))}
            channels={channels}
            sample={sample}
            locale={value.locale}
            onChange={(kind, greeting) => setValue((v) => ({ ...v, [kind]: greeting }))}
            testButton={(kind) => (
              <TestButton
                guildId={guildId}
                channelId={value[kind].channelId}
                locale={value.locale}
                greeting={{ kind, message: value[kind].message }}
                notify={push}
                label={t(`pages.botUI.greetingKinds.${kind}`)}
              />
            )}
          />
        </Section>

        <Section id="auto-roles" icon={UserPlus} title={section("auto-roles").title} lead={t("pages.botUI.autoRolesLead")} state={autoRolesState}>
          <AutoRolesFieldset
            value={value.autoRoles}
            roles={autoRoles.roles}
            manageRoles={autoRoles.manageRoles}
            failing={failing.autoRoles}
            onChange={(next) => setValue((v) => ({ ...v, autoRoles: next }))}
          />
        </Section>

        <div className="sticky bottom-0 z-40 -mx-4 border-t border-night-700 bg-night-950/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:border-x">
          <div className="flex flex-wrap items-center gap-3">
            <p className={cn("flex min-w-0 flex-1 basis-full items-center gap-2 text-sm font-semibold sm:basis-auto", dirty ? "text-gold-400" : "text-chalk-400")}>
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-gold-400" : "bg-emerald-400")} />
              {saveError && !dirty ? <span className="text-blood-400">{saveError}</span> : dirty ? t("pages.botUI.unsaved") : t("pages.botUI.allSaved")}
            </p>
            {dirty ? (
              <button type="button" onClick={() => setValue(saved)} disabled={busy} className={cn(SECONDARY, "flex-1 sm:flex-none")}>
                <RotateCcw aria-hidden className="size-4" />
                {t("pages.botUI.discard")}
              </button>
            ) : null}
            <button type="submit" disabled={busy} className={cn(PRIMARY, "flex-1 px-6 sm:flex-none")}>
              {busy ? t("pages.botUI.saving") : t("pages.botUI.save")}
            </button>
          </div>
          {saveError && dirty ? <p className={cn(HELP, "mt-2 text-blood-400")}>{saveError}</p> : null}
        </div>
      </div>

      <Toasts toasts={toasts} dismiss={dismiss} />
    </form>
  );
}

/** Super admin "flush announcements" button. */
export function FlushButton() {
  const t = useT();
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const run = async () => {
    setStatus({ kind: "busy", text: t("pages.botUI.flushing") });
    const response = await send("/api/discord/admin/flush", "POST", {});
    const data = response?.ok ? ((await response.json().catch(() => null)) as { created?: number } | null) : null;
    setStatus(
      data ? { kind: "ok", text: t("pages.botUI.flushed", { count: data.created ?? 0 }) } : { kind: "error", text: t("pages.botUI.flushFailed") },
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={status.kind === "busy"} className={PRIMARY}>
        {t("pages.botUI.flush")}
      </button>
      <span role="status" className={cn("text-sm", status.kind === "error" ? "text-blood-400" : "text-chalk-300")}>
        {status.text}
      </span>
    </div>
  );
}

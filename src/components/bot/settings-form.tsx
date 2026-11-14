"use client";

import { useId, useState } from "react";
import { LOCALES, LOCALE_NAME, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { AutoRolesFieldset, type AutoRoleChoice } from "@/components/bot/auto-roles-fieldset";
import { GreetingsFieldset, type GreetingSample } from "@/components/bot/greetings-fieldset";
import { ANNOUNCEMENT_TYPES, GREETING_KINDS, type AnnouncementType, type GreetingKind } from "@/lib/bot/kinds";
import type { GuildSettingsView, SettingsInput } from "@/lib/bot/settings";
import { cn } from "@/lib/utils";

/**
 * A server's settings form, on its dashboard page. The channel and role
 * lists come from the bot, through the page; the save goes to
 * `/api/discord/guilds/<id>/settings`, which checks everything again
 * (permission, channels, roles) before writing. The welcome and goodbye
 * messages have their own part, `greetings-fieldset.tsx`, and so do the
 * auto-roles, `auto-roles-fieldset.tsx`.
 *
 * Plain controlled selects and two fetch calls: the page ships little more
 * than this form.
 */

const FIELD = "bevel-sm w-full border border-night-700 bg-night-900 px-3 py-2 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";
const BUTTON = "bevel-sm px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60";

type Channel = { id: string; name: string };
type Status = { kind: "idle" | "busy" | "ok" | "error"; text?: string };

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

/** `greeting`: test the welcome or goodbye message, with the text as it stands in the form. */
function TestButton({
  guildId,
  channelId,
  locale,
  greeting,
}: {
  guildId: string;
  channelId: string | null;
  locale: Locale;
  greeting?: { kind: GreetingKind; message: string | null };
}) {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  if (!channelId) return null;
  const run = async () => {
    setStatus({ kind: "busy" });
    const response = await send(`/api/discord/guilds/${guildId}/test`, "POST", { channelId, locale, ...greeting });
    const ok = response?.ok && ((await response.json().catch(() => null)) as { ok?: boolean } | null)?.ok;
    setStatus(ok ? { kind: "ok", text: t("pages.botUI.testSent") } : { kind: "error", text: t("pages.botUI.testFailed") });
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={status.kind === "busy"}
        className={cn(BUTTON, "border border-night-600 bg-night-800 text-chalk-100 hover:border-gold-500/60")}
      >
        {t("pages.botUI.test")}
      </button>
      <span role="status" className={cn("text-xs", status.kind === "error" ? "text-blood-400" : "text-chalk-500")}>
        {status.text}
      </span>
    </span>
  );
}

function ChannelSelect({
  label,
  value,
  channels,
  onChange,
}: {
  label: string;
  value: string | null;
  channels: Channel[];
  onChange: (id: string | null) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-chalk-300">
        {label}
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cn(FIELD, "mt-1")}>
        <option value="">{t("pages.botUI.off")}</option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.name}
          </option>
        ))}
      </select>
    </div>
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
  const [value, setValue] = useState<SettingsInput>(() => toInput(initial));
  const [failing, setFailing] = useState(
    () => new Set<AnnouncementType | GreetingKind>([...ANNOUNCEMENT_TYPES, ...GREETING_KINDS].filter((key) => initial[key].failing)),
  );
  const [autoRolesFailing, setAutoRolesFailing] = useState(initial.autoRoles.failing);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const ids = useId();

  const setAnnouncement = (type: AnnouncementType, patch: Partial<SettingsInput["announcements"][AnnouncementType]>) =>
    setValue((v) => ({ ...v, announcements: { ...v.announcements, [type]: { ...v.announcements[type], ...patch } } }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "busy", text: t("pages.botUI.saving") });
    const response = await send(`/api/discord/guilds/${guildId}/settings`, "PUT", value);
    if (response?.ok) {
      setFailing(new Set());
      setAutoRolesFailing(false);
      setStatus({ kind: "ok", text: t("pages.botUI.saved") });
    } else {
      setStatus({ kind: "error", text: t("pages.botUI.saveFailed") });
    }
  };

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="max-w-sm">
        <label htmlFor={`${ids}-locale`} className="text-sm font-semibold text-chalk-100">
          {t("pages.botUI.language")}
        </label>
        <select
          id={`${ids}-locale`}
          value={value.locale}
          onChange={(e) => setValue((v) => ({ ...v, locale: e.target.value as Locale }))}
          className={cn(FIELD, "mt-1.5")}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_NAME[l]}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="font-heading text-lg font-bold text-chalk-100">{t("pages.botUI.announcementsTitle")}</legend>
        <p className="mt-1 text-sm text-chalk-500">{t("pages.botUI.announcementsLead")}</p>
        <div className="mt-4 grid gap-3">
          {ANNOUNCEMENT_TYPES.map((type) => {
            const setting = value.announcements[type];
            return (
              <div key={type} className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
                <p className="font-heading font-bold text-gold-400">{t(`pages.botUI.types.${type}`)}</p>
                {failing.has(type) && setting.channelId && (
                  <p role="alert" className="mt-1 text-sm text-blood-400">
                    {t("pages.botUI.failing")}
                  </p>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ChannelSelect
                    label={t("pages.botUI.channel")}
                    value={setting.channelId}
                    channels={channels}
                    onChange={(channelId) => setAnnouncement(type, { channelId, ...(channelId ? {} : { roleId: null }) })}
                  />
                  <div>
                    <label htmlFor={`${ids}-${type}-role`} className="text-xs font-semibold text-chalk-300">
                      {t("pages.botUI.role")}
                    </label>
                    <select
                      id={`${ids}-${type}-role`}
                      value={setting.roleId ?? ""}
                      disabled={!setting.channelId}
                      onChange={(e) => setAnnouncement(type, { roleId: e.target.value || null })}
                      className={cn(FIELD, "mt-1 disabled:opacity-50")}
                    >
                      <option value="">{t("pages.botUI.noRole")}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <TestButton guildId={guildId} channelId={setting.channelId} locale={value.locale} />
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-heading text-lg font-bold text-chalk-100">{t("pages.botUI.dailyTitle")}</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <ChannelSelect
              label={t("pages.botUI.dailyMlbbdle")}
              value={value.dailyMlbbdleChannelId}
              channels={channels}
              onChange={(id) => setValue((v) => ({ ...v, dailyMlbbdleChannelId: id }))}
            />
            <TestButton guildId={guildId} channelId={value.dailyMlbbdleChannelId} locale={value.locale} />
          </div>
          <div className="space-y-2">
            <ChannelSelect
              label={t("pages.botUI.dailyQuiz")}
              value={value.dailyQuizChannelId}
              channels={channels}
              onChange={(id) => setValue((v) => ({ ...v, dailyQuizChannelId: id }))}
            />
            <TestButton guildId={guildId} channelId={value.dailyQuizChannelId} locale={value.locale} />
          </div>
          <div>
            <label htmlFor={`${ids}-hour`} className="text-xs font-semibold text-chalk-300">
              {t("pages.botUI.dailyHour")}
            </label>
            <select
              id={`${ids}-hour`}
              value={value.dailyHourUtc}
              onChange={(e) => setValue((v) => ({ ...v, dailyHourUtc: Number(e.target.value) }))}
              className={cn(FIELD, "mt-1")}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {t("pages.botUI.hourUtc", { hour: String(hour).padStart(2, "0") })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <GreetingsFieldset
        value={{ welcome: value.welcome, goodbye: value.goodbye }}
        failing={new Set(GREETING_KINDS.filter((kind) => failing.has(kind)))}
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
          />
        )}
      />

      <AutoRolesFieldset
        value={value.autoRoles}
        roles={autoRoles.roles}
        manageRoles={autoRoles.manageRoles}
        failing={autoRolesFailing}
        onChange={(autoRoles) => setValue((v) => ({ ...v, autoRoles }))}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "busy"}
          className={cn(BUTTON, "bg-gold-500 text-night-950 hover:bg-gold-400")}
        >
          {t("pages.botUI.save")}
        </button>
        <span role="status" className={cn("text-sm", status.kind === "error" ? "text-blood-400" : "text-chalk-300")}>
          {status.text}
        </span>
      </div>
    </form>
  );
}

/** Super admin "flush announcements" button. */
export function FlushButton() {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
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
      <button
        type="button"
        onClick={run}
        disabled={status.kind === "busy"}
        className={cn(BUTTON, "bg-gold-500 text-night-950 hover:bg-gold-400")}
      >
        {t("pages.botUI.flush")}
      </button>
      <span role="status" className={cn("text-sm", status.kind === "error" ? "text-blood-400" : "text-chalk-300")}>
        {status.text}
      </span>
    </div>
  );
}

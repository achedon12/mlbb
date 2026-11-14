"use client";

import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { AutoRoleChoice } from "@/components/bot/auto-roles-fieldset";
import { FIELD, HELP, LABEL, Notice, PRIMARY, SECONDARY, Section, Toasts, useToasts, type SectionState } from "@/components/bot/dashboard-ui";
import { useT } from "@/i18n/provider";
import {
  MAX_ROLE_MENU_OPTIONS,
  MAX_ROLE_MENUS,
  ROLE_MENU_DESCRIPTION_MAX,
  ROLE_MENU_LABEL_MAX,
  ROLE_MENU_MODES,
  ROLE_MENU_NOT_GRANTABLE,
  ROLE_MENU_ROLES_UNAVAILABLE,
  ROLE_MENU_TITLE_MAX,
  roleMenuStatus,
  type RoleMenuMode,
} from "@/lib/bot/kinds";
import { customEmojiText, emojiImage, parseEmoji, suggestEmoji, type ServerEmoji } from "@/lib/bot/role-menu-emoji";
import type { RoleMenuView } from "@/lib/bot/role-menus";
import { cn } from "@/lib/utils";

/**
 * "Role menus" part of a server's dashboard: messages with a select menu
 * where the members pick their roles themselves (a rank, the games they
 * play). Each menu is saved on its own (`/api/discord/guilds/<id>/role-menus`),
 * then published: the bot posts the message, or edits the one it posted.
 *
 * The roles offered are those the bot may give and the signed-in manager
 * could give themselves; the server's custom emojis come from the bot,
 * and a role named like one of them gets it at once. The save checks it
 * all again with the bot, whatever this page sends.
 */

type Channel = { id: string; name: string };
type Option = { roleId: string; label: string; emoji: string | null };
type Draft = { id: number | null; channelId: string; title: string; description: string; mode: RoleMenuMode; options: Option[] };

const emptyDraft = (): Draft => ({ id: null, channelId: "", title: "", description: "", mode: "single", options: [] });
const draftOf = (menu: RoleMenuView): Draft => ({
  id: menu.id,
  channelId: menu.channelId,
  title: menu.title,
  description: menu.description ?? "",
  mode: menu.mode,
  options: menu.options.map((o) => ({ ...o })),
});

async function call(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<{ status: number; data: Record<string, unknown> | null } | null> {
  try {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    return { status: response.status, data: (await response.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return null;
  }
}

function EmojiPreview({ emoji, size = 20 }: { emoji: string | null; size?: number }) {
  const parsed = emoji ? parseEmoji(emoji) : null;
  if (!parsed) return <span aria-hidden className="inline-block shrink-0" style={{ width: size, height: size }} />;
  if (parsed.kind === "unicode")
    return (
      <span aria-hidden className="inline-grid shrink-0 place-items-center leading-none" style={{ width: size, height: size, fontSize: size * 0.85 }}>
        {parsed.value}
      </span>
    );
  const src = emojiImage(parsed.id, parsed.animated);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- Discord CDN emoji, already sized by the CDN
    <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />
  ) : null;
}

/** The message as Discord will show it, roughly: embed, select, button. */
function Preview({ draft }: { draft: Draft }) {
  const t = useT();
  const single = draft.mode === "single";
  return (
    <div className="space-y-2" aria-hidden>
      <p className={LABEL}>{t("pages.botUI.roleMenus.preview")}</p>
      <div className="rounded-md bg-[#2b2d31] p-3 text-[15px] text-[#dbdee1]">
        <div className="border-l-4 border-gold-500 bg-[#232428] p-3">
          <p className="font-semibold text-white">{draft.title || t("pages.botUI.roleMenus.titleLabel")}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {draft.description.trim() || t(single ? "pages.botUI.roleMenus.previewDefaultSingle" : "pages.botUI.roleMenus.previewDefaultMultiple")}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">
          <span>{t(single ? "pages.botUI.roleMenus.placeholderSingle" : "pages.botUI.roleMenus.placeholderMultiple")}</span>
          <ArrowDown className="size-4" />
        </div>
        {draft.options.length ? (
          <ul className="mt-1 max-h-48 overflow-y-auto rounded bg-[#1e1f22] py-1 text-sm">
            {draft.options.map((o) => (
              <li key={o.roleId} className="flex items-center gap-2 px-3 py-1">
                <EmojiPreview emoji={o.emoji} size={18} />
                <span className="truncate">{o.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="mt-2 inline-block rounded bg-[#4e5058] px-3 py-1.5 text-sm font-medium text-white">
          {t(single ? "pages.botUI.roleMenus.clearSingle" : "pages.botUI.roleMenus.clearMultiple")}
        </span>
      </div>
    </div>
  );
}

const UNICODE = "__unicode__";

function OptionRow({
  option,
  index,
  count,
  roleName,
  emojis,
  onChange,
  onMove,
  onRemove,
}: {
  option: Option;
  index: number;
  count: number;
  roleName: string;
  emojis: ServerEmoji[];
  onChange: (option: Option) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const ids = useId();
  const parsed = option.emoji ? parseEmoji(option.emoji) : null;
  const known = parsed?.kind === "custom" && emojis.some((e) => e.id === parsed.id);
  const [unicode, setUnicode] = useState(Boolean(option.emoji) && !known);
  const selectValue = unicode ? UNICODE : known && parsed?.kind === "custom" ? parsed.id : "";
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <p className="flex min-h-11 items-center gap-2 text-base font-semibold text-chalk-100">
        <EmojiPreview emoji={option.emoji} />
        <span className="truncate">@{roleName}</span>
      </p>
      <div>
        <label htmlFor={`${ids}-label`} className="text-xs font-semibold text-chalk-400">
          {t("pages.botUI.roleMenus.label")}
        </label>
        <input
          id={`${ids}-label`}
          value={option.label}
          maxLength={ROLE_MENU_LABEL_MAX}
          onChange={(e) => onChange({ ...option, label: e.target.value })}
          className={cn(FIELD, "mt-1")}
        />
      </div>
      <div>
        <label htmlFor={`${ids}-emoji`} className="text-xs font-semibold text-chalk-400">
          {t("pages.botUI.roleMenus.emoji")}
        </label>
        <select
          id={`${ids}-emoji`}
          value={selectValue}
          onChange={(e) => {
            const value = e.target.value;
            if (value === UNICODE) {
              setUnicode(true);
              onChange({ ...option, emoji: parsed?.kind === "unicode" ? option.emoji : null });
              return;
            }
            setUnicode(false);
            const emoji = emojis.find((x) => x.id === value);
            onChange({ ...option, emoji: emoji ? customEmojiText(emoji) : null });
          }}
          className={cn(FIELD, "mt-1")}
        >
          <option value="">{t("pages.botUI.roleMenus.noEmoji")}</option>
          {emojis.map((e) => (
            <option key={e.id} value={e.id}>
              :{e.name}:
            </option>
          ))}
          <option value={UNICODE}>{t("pages.botUI.roleMenus.unicodeEmoji")}</option>
        </select>
        {unicode ? (
          <input
            aria-label={t("pages.botUI.roleMenus.unicodeEmoji")}
            value={option.emoji ?? ""}
            maxLength={16}
            placeholder={t("pages.botUI.roleMenus.unicodePlaceholder")}
            onChange={(e) => onChange({ ...option, emoji: e.target.value.trim() || null })}
            className={cn(FIELD, "mt-1", option.emoji && !parsed && "border-blood-400")}
          />
        ) : null}
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`${t("pages.botUI.roleMenus.moveUp")}: ${roleName}`} className={cn(SECONDARY, "px-3")}>
          <ArrowUp aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          aria-label={`${t("pages.botUI.roleMenus.moveDown")}: ${roleName}`}
          className={cn(SECONDARY, "px-3")}
        >
          <ArrowDown aria-hidden className="size-4" />
        </button>
        <button type="button" onClick={onRemove} aria-label={`${t("pages.botUI.roleMenus.remove")}: ${roleName}`} className={cn(SECONDARY, "px-3")}>
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </li>
  );
}

function Editor({
  guildId,
  initial,
  channels,
  roles,
  emojis,
  onSaved,
  onCancel,
  notify,
}: {
  guildId: string;
  initial: Draft;
  channels: Channel[];
  roles: AutoRoleChoice[];
  emojis: ServerEmoji[];
  onSaved: (menu: RoleMenuView) => void;
  onCancel: () => void;
  notify: (kind: "ok" | "error", text: string) => void;
}) {
  const t = useT();
  const ids = useId();
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);
  const pickable = roles.filter((r) => r.assignable && r.granterRefusal === null);
  const remaining = pickable.filter((r) => !draft.options.some((o) => o.roleId === r.id));
  const valid = draft.channelId && draft.title.trim() && draft.options.length && draft.options.every((o) => o.label.trim());

  const setOption = (index: number, option: Option) => setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? option : o)) }));
  const move = (index: number, delta: -1 | 1) =>
    setDraft((d) => {
      const options = [...d.options];
      const [item] = options.splice(index, 1);
      options.splice(index + delta, 0, item!);
      return { ...d, options };
    });
  const addRole = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const emoji = suggestEmoji(role.name, emojis);
    setDraft((d) => ({
      ...d,
      options: [...d.options, { roleId, label: role.name.slice(0, ROLE_MENU_LABEL_MAX), emoji: emoji ? customEmojiText(emoji) : null }],
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setError(t("pages.botUI.roleMenus.required"));
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      channelId: draft.channelId,
      title: draft.title,
      description: draft.description || null,
      mode: draft.mode,
      options: draft.options.map((o) => ({ roleId: o.roleId, label: o.label, emoji: o.emoji })),
    };
    const result = await call(
      draft.id === null ? `/api/discord/guilds/${guildId}/role-menus` : `/api/discord/guilds/${guildId}/role-menus/${draft.id}`,
      draft.id === null ? "POST" : "PUT",
      body,
    );
    setBusy(false);
    if (result && (result.status === 200 || result.status === 201) && result.data) {
      notify("ok", t("pages.botUI.roleMenus.saved"));
      onSaved(result.data as unknown as RoleMenuView);
      return;
    }
    const code = result?.data?.error;
    const text = t(
      code === ROLE_MENU_NOT_GRANTABLE
        ? "pages.botUI.roleMenus.notGrantable"
        : result?.status === 409
          ? "pages.botUI.roleMenus.tooMany"
          : "pages.botUI.roleMenus.saveFailed",
    );
    setError(text);
    notify("error", text);
  };

  return (
    <form onSubmit={save} className="bevel-sm space-y-5 border border-gold-500/40 bg-night-850/60 p-4" aria-labelledby={`${ids}-heading`}>
      <h3 id={`${ids}-heading`} className="font-heading text-lg font-bold text-chalk-100">
        {draft.id === null ? t("pages.botUI.roleMenus.new") : t("pages.botUI.roleMenus.editing", { title: initial.title })}
      </h3>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-channel`} className={LABEL}>
                {t("pages.botUI.roleMenus.channel")}
              </label>
              <select id={`${ids}-channel`} required value={draft.channelId} onChange={(e) => setDraft((d) => ({ ...d, channelId: e.target.value }))} className={cn(FIELD, "mt-1.5")}>
                <option value="">{t("pages.botUI.roleMenus.chooseChannel")}</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${ids}-title`} className={LABEL}>
                {t("pages.botUI.roleMenus.titleLabel")}
              </label>
              <input
                id={`${ids}-title`}
                required
                value={draft.title}
                maxLength={ROLE_MENU_TITLE_MAX}
                placeholder={t("pages.botUI.roleMenus.titlePlaceholder")}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className={cn(FIELD, "mt-1.5")}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${ids}-description`} className={LABEL}>
              {t("pages.botUI.roleMenus.description")}
            </label>
            <textarea
              id={`${ids}-description`}
              rows={3}
              value={draft.description}
              maxLength={ROLE_MENU_DESCRIPTION_MAX}
              aria-describedby={`${ids}-description-help`}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className={cn(FIELD, "mt-1.5 resize-y leading-relaxed")}
            />
            <p id={`${ids}-description-help`} className={cn(HELP, "mt-1")}>
              {t("pages.botUI.roleMenus.descriptionHelp")}
            </p>
          </div>
          <fieldset>
            <legend className={LABEL}>{t("pages.botUI.roleMenus.mode")}</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {ROLE_MENU_MODES.map((mode) => (
                <label
                  key={mode}
                  className={cn(
                    "bevel-sm flex cursor-pointer gap-3 border p-3 transition-colors",
                    draft.mode === mode ? "border-gold-500 bg-gold-500/10" : "border-night-600 bg-night-850 hover:border-night-500",
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-mode`}
                    value={mode}
                    checked={draft.mode === mode}
                    onChange={() => setDraft((d) => ({ ...d, mode }))}
                    className="mt-1 accent-gold-500"
                  />
                  <span>
                    <span className="block text-base font-semibold text-chalk-100">{t(`pages.botUI.roleMenus.modes.${mode}`)}</span>
                    <span className={HELP}>{t(`pages.botUI.roleMenus.modeHelp.${mode}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <p className={LABEL}>{t("pages.botUI.roleMenus.options", { count: draft.options.length, max: MAX_ROLE_MENU_OPTIONS })}</p>
            {draft.options.length ? (
              <ul className="mt-1 divide-y divide-night-700 border-y border-night-700">
                {draft.options.map((option, index) => (
                  <OptionRow
                    key={option.roleId}
                    option={option}
                    index={index}
                    count={draft.options.length}
                    roleName={names.get(option.roleId) ?? t("pages.botUI.roleMenus.deletedRole")}
                    emojis={emojis}
                    onChange={(next) => setOption(index, next)}
                    onMove={(delta) => move(index, delta)}
                    onRemove={() => setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== index) }))}
                  />
                ))}
              </ul>
            ) : null}
            {!pickable.length ? (
              <div className="mt-2">
                <Notice tone="warning">{t("pages.botUI.autoRolesNoneSelectable")}</Notice>
              </div>
            ) : draft.options.length < MAX_ROLE_MENU_OPTIONS ? (
              <div className="mt-3 max-w-sm">
                <label htmlFor={`${ids}-add`} className="sr-only">
                  {t("pages.botUI.roleMenus.addRole")}
                </label>
                <select
                  id={`${ids}-add`}
                  value=""
                  disabled={!remaining.length}
                  onChange={(e) => addRole(e.target.value)}
                  className={FIELD}
                >
                  <option value="">{t("pages.botUI.roleMenus.addRole")}</option>
                  {roles
                    .filter((r) => !draft.options.some((o) => o.roleId === r.id))
                    .map((r) => {
                      const reason = r.refusal ?? r.granterRefusal;
                      return (
                        <option key={r.id} value={r.id} disabled={!r.assignable || r.granterRefusal !== null}>
                          @{r.name}
                          {reason ? ` (${t(`pages.botUI.autoRoleRefusals.${reason}`)})` : ""}
                        </option>
                      );
                    })}
                </select>
              </div>
            ) : null}
            <p className={cn(HELP, "mt-2")}>{t("pages.botUI.roleMenus.optionsHelp")}</p>
          </div>
        </div>
        <Preview draft={draft} />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={cn(PRIMARY, "px-6")}>
          {busy ? t("pages.botUI.saving") : t("pages.botUI.roleMenus.save")}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={SECONDARY}>
          {t("pages.botUI.roleMenus.cancel")}
        </button>
      </div>
    </form>
  );
}

export function RoleMenusSection({
  guildId,
  initial,
  channels,
  roles,
  emojis,
  manageRoles,
  paused,
  state,
  userId,
}: {
  guildId: string;
  /** The signed-in manager: a menu they save becomes theirs. */
  userId: string;
  initial: RoleMenuView[];
  channels: Channel[];
  /** Every role, with whether the bot may give it, and whether this manager may. */
  roles: AutoRoleChoice[];
  emojis: ServerEmoji[];
  manageRoles: boolean;
  /** Menus whose manager can no longer give one of their roles. */
  paused: number[];
  state: SectionState;
}) {
  const t = useT();
  const [menus, setMenus] = useState(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [pausedNow, setPausedNow] = useState(() => new Set(paused));
  const { toasts, push, dismiss } = useToasts();
  const channelName = (id: string | null) => channels.find((c) => c.id === id)?.name ?? "?";
  const usable = new Set(roles.filter((r) => r.assignable).map((r) => r.id));

  const replace = (menu: RoleMenuView) => setMenus((list) => (list.some((m) => m.id === menu.id) ? list.map((m) => (m.id === menu.id ? menu : m)) : [...list, menu]));

  const publish = async (menu: RoleMenuView) => {
    setBusy(menu.id);
    const result = await call(`/api/discord/guilds/${guildId}/role-menus/${menu.id}/publish`, "POST");
    setBusy(null);
    const data = result?.data;
    if (data?.ok && data.menu) {
      const published = data.menu as RoleMenuView;
      replace(published);
      push("ok", t("pages.botUI.roleMenus.published", { channel: channelName(published.channelId) }));
      return;
    }
    const code = typeof data?.error === "string" ? data.error : "";
    const key =
      code === ROLE_MENU_ROLES_UNAVAILABLE
        ? "rolesUnavailable"
        : code === "channel_not_available" || code === "missing_permissions" || code === "invalid_menu"
          ? code
          : result?.status === 429
            ? "rateLimited"
            : "failed";
    push("error", t(`pages.botUI.roleMenus.publishErrors.${key}`));
  };

  const remove = async (menu: RoleMenuView) => {
    if (!window.confirm(t("pages.botUI.roleMenus.deleteConfirm", { title: menu.title }))) return;
    setBusy(menu.id);
    const result = await call(`/api/discord/guilds/${guildId}/role-menus/${menu.id}`, "DELETE");
    setBusy(null);
    if (result?.status === 200) {
      setMenus((list) => list.filter((m) => m.id !== menu.id));
      if (editing?.id === menu.id) setEditing(null);
      push("ok", t("pages.botUI.roleMenus.deleted"));
    } else push("error", t("pages.botUI.roleMenus.deleteFailed"));
  };

  return (
    <Section id="role-menus" icon={ListChecks} title={t("pages.botUI.roleMenus.title")} lead={t("pages.botUI.roleMenus.lead")} state={state}>
      <div className="space-y-4">
        {!manageRoles ? <Notice tone="error">{t("pages.botUI.autoRolesNoPermission")}</Notice> : null}
        {!menus.length && !editing ? <p className="text-base text-chalk-300">{t("pages.botUI.roleMenus.empty")}</p> : null}
        {menus.length ? (
          <ul className="space-y-3">
            {menus.map((menu) => {
              const status = roleMenuStatus(menu);
              const broken = menu.options.some((o) => !usable.has(o.roleId));
              return (
                <li key={menu.id} className={cn("bevel-sm border bg-night-850/60 p-4", broken || pausedNow.has(menu.id) ? "border-blood-400/70" : "border-night-700")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-heading text-lg font-bold text-chalk-100">{menu.title}</h3>
                      <p className="mt-0.5 text-sm text-chalk-400">
                        #{channelName(menu.channelId)} · {t(`pages.botUI.roleMenus.modes.${menu.mode}`)} ·{" "}
                        {t("pages.botUI.roleMenus.roleCount", { count: menu.options.length })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        status === "published" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-gold-500/50 bg-gold-500/10 text-gold-400",
                      )}
                    >
                      {status === "published"
                        ? t("pages.botUI.roleMenus.statusPublished", { channel: channelName(menu.messageChannelId) })
                        : t(status === "draft" ? "pages.botUI.roleMenus.statusDraft" : "pages.botUI.roleMenus.statusChanged")}
                    </span>
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("pages.botUI.roleMenus.optionsList")}>
                    {menu.options.map((o) => (
                      <li
                        key={o.roleId}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm",
                          usable.has(o.roleId) ? "border-night-600 bg-night-800 text-chalk-100" : "border-blood-400/60 bg-blood-500/10 text-chalk-100",
                        )}
                      >
                        <EmojiPreview emoji={o.emoji} size={18} />
                        {o.label}
                      </li>
                    ))}
                  </ul>
                  {pausedNow.has(menu.id) ? (
                    <div className="mt-3">
                      <Notice tone="error">{t("pages.botUI.roleMenus.paused")}</Notice>
                    </div>
                  ) : null}
                  {broken ? (
                    <div className="mt-3">
                      <Notice tone="error">{t("pages.botUI.roleMenus.roleProblem")}</Notice>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => publish(menu)} disabled={busy !== null} className={PRIMARY}>
                      <Send aria-hidden className="size-4" />
                      {busy === menu.id
                        ? t("pages.botUI.roleMenus.publishing")
                        : status === "draft"
                          ? t("pages.botUI.roleMenus.publish")
                          : t("pages.botUI.roleMenus.update")}
                    </button>
                    <button type="button" onClick={() => setEditing(draftOf(menu))} disabled={busy !== null} className={SECONDARY}>
                      <Pencil aria-hidden className="size-4" />
                      {t("pages.botUI.roleMenus.edit")}
                    </button>
                    <button type="button" onClick={() => remove(menu)} disabled={busy !== null} className={SECONDARY}>
                      <Trash2 aria-hidden className="size-4" />
                      {t("pages.botUI.roleMenus.delete")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {editing ? (
          <Editor
            key={editing.id ?? "new"}
            guildId={guildId}
            initial={editing}
            channels={channels}
            roles={roles}
            emojis={emojis}
            notify={push}
            onCancel={() => setEditing(null)}
            onSaved={(menu) => {
              replace(menu);
              // Saved by a manager who can give its roles: no longer paused.
              if (menu.configuredBy === userId) setPausedNow((set) => new Set([...set].filter((id) => id !== menu.id)));
              setEditing(null);
            }}
          />
        ) : menus.length < MAX_ROLE_MENUS ? (
          <button type="button" onClick={() => setEditing(emptyDraft())} className={SECONDARY}>
            <Plus aria-hidden className="size-4" />
            {t("pages.botUI.roleMenus.new")}
          </button>
        ) : (
          <p className={HELP}>{t("pages.botUI.roleMenus.tooMany")}</p>
        )}
        <p className={HELP}>{t("pages.botUI.roleMenus.help")}</p>
      </div>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </Section>
  );
}

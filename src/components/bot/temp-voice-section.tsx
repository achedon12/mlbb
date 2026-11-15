"use client";

import { Headphones, Plus, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { FIELD, HELP, LABEL, Notice, PRIMARY, SECONDARY, Section, Toasts, useLeaveWarning, useToasts, type SectionState } from "@/components/bot/dashboard-ui";
import { useT } from "@/i18n/provider";
import { MAX_TEMP_VOICE_HUBS, TEMP_VOICE_MAX_USER_LIMIT, TEMP_VOICE_NAME_MAX, TEMP_VOICE_PLACEHOLDER, tempVoicePreview } from "@/lib/bot/kinds";
import type { TempVoiceHubView } from "@/lib/bot/temp-voice";
import { cn } from "@/lib/utils";

/**
 * "Temporary voice channels" part of a server's dashboard ("join to
 * create"): the voice channels that act as hubs, each with the user limit
 * and the name of the channels it creates. Saved on its own, every hub at
 * once (`/api/discord/guilds/<id>/temp-voice`); the save checks again with
 * the bot that each hub is one of the server's voice channels.
 */

type VoiceChannel = { id: string; name: string; category: string | null };
type Draft = { channelId: string; userLimit: string; nameTemplate: string };

const draftOf = (hub: TempVoiceHubView): Draft => ({
  channelId: hub.channelId,
  userLimit: String(hub.userLimit),
  nameTemplate: hub.nameTemplate ?? "",
});

const limitOf = (text: string): number | null => {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n <= TEMP_VOICE_MAX_USER_LIMIT ? n : null;
};

const inputOf = (drafts: Draft[]) =>
  drafts.map((d) => ({ channelId: d.channelId, userLimit: limitOf(d.userLimit) ?? 0, nameTemplate: d.nameTemplate.trim() || null }));

/** The save; status 0 when the request did not get through. */
async function put(guildId: string, hubs: ReturnType<typeof inputOf>): Promise<{ status: number; data: { hubs?: TempVoiceHubView[] } | null }> {
  try {
    const response = await fetch(`/api/discord/guilds/${guildId}/temp-voice`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hubs }),
    });
    return { status: response.status, data: (await response.json().catch(() => null)) as { hubs?: TempVoiceHubView[] } | null };
  } catch {
    return { status: 0, data: null };
  }
}

function HubRow({
  draft,
  index,
  channels,
  taken,
  defaultName,
  sampleUser,
  onChange,
  onRemove,
}: {
  draft: Draft;
  index: number;
  channels: VoiceChannel[];
  /** Hubs picked in the other rows. */
  taken: ReadonlySet<string>;
  defaultName: string;
  sampleUser: string;
  onChange: (draft: Draft) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const ids = useId();
  const known = !draft.channelId || channels.some((c) => c.id === draft.channelId);
  const limitValid = limitOf(draft.userLimit) !== null;
  const label = (c: VoiceChannel) => (c.category ? `${c.category} › ${c.name}` : c.name);
  return (
    <li className="bevel-sm border border-night-700 bg-night-850/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.botUI.tempVoice.hub", { number: index + 1 })}</h3>
        <button type="button" onClick={onRemove} className={SECONDARY}>
          <Trash2 aria-hidden className="size-4" />
          {t("pages.botUI.tempVoice.remove")}
        </button>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <label htmlFor={`${ids}-channel`} className={LABEL}>
            {t("pages.botUI.tempVoice.channel")}
          </label>
          <select
            id={`${ids}-channel`}
            value={draft.channelId}
            onChange={(e) => onChange({ ...draft, channelId: e.target.value })}
            className={cn(FIELD, "mt-1.5", !known && "border-blood-400")}
          >
            <option value="">{t("pages.botUI.tempVoice.chooseChannel")}</option>
            {!known ? <option value={draft.channelId}>{t("pages.botUI.tempVoice.deletedChannel")}</option> : null}
            {channels.map((c) => (
              <option key={c.id} value={c.id} disabled={taken.has(c.id)}>
                🔊 {label(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${ids}-limit`} className={LABEL}>
            {t("pages.botUI.tempVoice.userLimit")}
          </label>
          <input
            id={`${ids}-limit`}
            type="number"
            inputMode="numeric"
            min={0}
            max={TEMP_VOICE_MAX_USER_LIMIT}
            step={1}
            value={draft.userLimit}
            aria-invalid={!limitValid}
            aria-describedby={`${ids}-limit-help`}
            onChange={(e) => onChange({ ...draft, userLimit: e.target.value })}
            className={cn(FIELD, "mt-1.5", !limitValid && "border-blood-400")}
          />
          <p id={`${ids}-limit-help`} className={cn(HELP, "mt-1")}>
            {t("pages.botUI.tempVoice.userLimitHelp", { max: TEMP_VOICE_MAX_USER_LIMIT })}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor={`${ids}-name`} className={LABEL}>
          {t("pages.botUI.tempVoice.name")}
        </label>
        <input
          id={`${ids}-name`}
          value={draft.nameTemplate}
          maxLength={TEMP_VOICE_NAME_MAX}
          placeholder={defaultName}
          aria-describedby={`${ids}-name-help`}
          onChange={(e) => onChange({ ...draft, nameTemplate: e.target.value })}
          className={cn(FIELD, "mt-1.5")}
        />
        <p id={`${ids}-name-help`} className={cn(HELP, "mt-1")}>
          {t("pages.botUI.tempVoice.nameHelp", { placeholder: TEMP_VOICE_PLACEHOLDER, max: TEMP_VOICE_NAME_MAX })}
        </p>
        <p className="mt-2 text-sm text-chalk-200">
          {t("pages.botUI.tempVoice.preview")}{" "}
          <span className="font-semibold text-chalk-100">🔊 {tempVoicePreview(draft.nameTemplate.trim() || null, defaultName, sampleUser)}</span>
        </p>
      </div>
      {!known ? (
        <div className="mt-3">
          <Notice tone="error">{t("pages.botUI.tempVoice.unknownChannel")}</Notice>
        </div>
      ) : null}
    </li>
  );
}

export function TempVoiceSection({
  guildId,
  initial,
  voiceChannels,
  manageChannels,
  moveMembers,
  defaultName,
  sampleUser,
  state,
}: {
  guildId: string;
  initial: TempVoiceHubView[];
  voiceChannels: VoiceChannel[];
  /** The bot's permissions in the server: without both, it creates nothing. */
  manageChannels: boolean;
  moveMembers: boolean;
  /** The bot's default name in the server's language, `{user}` left in. */
  defaultName: string;
  /** Who the preview names: the signed-in user. */
  sampleUser: string;
  state: SectionState;
}) {
  const t = useT();
  const [saved, setSaved] = useState<Draft[]>(() => initial.map(draftOf));
  const [drafts, setDrafts] = useState<Draft[]>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();
  const dirty = JSON.stringify(inputOf(drafts)) !== JSON.stringify(inputOf(saved));
  useLeaveWarning(dirty);

  const missing = [
    ...(manageChannels ? [] : [t("pages.botUI.tempVoice.permissionNames.manageChannels")]),
    ...(moveMembers ? [] : [t("pages.botUI.tempVoice.permissionNames.moveMembers")]),
  ];
  const free = voiceChannels.filter((c) => !drafts.some((d) => d.channelId === c.id));

  const setDraft = (index: number, next: Draft) => setDrafts((list) => list.map((d, i) => (i === index ? next : d)));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (drafts.some((d) => !d.channelId)) return setError(t("pages.botUI.tempVoice.errors.noChannel"));
    if (drafts.some((d) => limitOf(d.userLimit) === null)) return setError(t("pages.botUI.tempVoice.errors.limit", { max: TEMP_VOICE_MAX_USER_LIMIT }));
    setBusy(true);
    const { status, data } = await put(guildId, inputOf(drafts));
    setBusy(false);
    if (status === 200 && data?.hubs) {
      const next = data.hubs.map(draftOf);
      setSaved(next);
      setDrafts(next);
      push("ok", t("pages.botUI.tempVoice.saved"));
      return;
    }
    const key = status === 400 ? "unknownChannel" : status === 429 ? "rateLimited" : "failed";
    const text = t(`pages.botUI.tempVoice.errors.${key}`);
    setError(text);
    push("error", text);
  };

  return (
    <Section id="temp-voice" icon={Headphones} title={t("pages.botUI.tempVoice.title")} lead={t("pages.botUI.tempVoice.lead")} state={state}>
      <form onSubmit={save} className="space-y-4">
        {missing.length ? <Notice tone="error">{t("pages.botUI.tempVoice.missingPermissions", { permissions: missing.join(", ") })}</Notice> : null}
        {!voiceChannels.length ? <Notice tone="warning">{t("pages.botUI.tempVoice.noVoiceChannels")}</Notice> : null}
        {!drafts.length ? <p className="text-base text-chalk-300">{t("pages.botUI.tempVoice.empty")}</p> : null}
        {drafts.length ? (
          <ul className="space-y-3">
            {drafts.map((draft, index) => (
              <HubRow
                key={index}
                draft={draft}
                index={index}
                channels={voiceChannels}
                taken={new Set(drafts.filter((_, i) => i !== index).map((d) => d.channelId))}
                defaultName={defaultName}
                sampleUser={sampleUser}
                onChange={(next) => setDraft(index, next)}
                onRemove={() => setDrafts((list) => list.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        ) : null}
        {drafts.length < MAX_TEMP_VOICE_HUBS ? (
          <button
            type="button"
            disabled={!free.length}
            onClick={() => setDrafts((list) => [...list, { channelId: free[0]?.id ?? "", userLimit: "0", nameTemplate: "" }])}
            className={SECONDARY}
          >
            <Plus aria-hidden className="size-4" />
            {t("pages.botUI.tempVoice.add")}
          </button>
        ) : (
          <p className={HELP}>{t("pages.botUI.tempVoice.tooMany", { max: MAX_TEMP_VOICE_HUBS })}</p>
        )}
        <p className={HELP}>{t("pages.botUI.tempVoice.help")}</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !dirty} className={cn(PRIMARY, "px-6")}>
            {busy ? t("pages.botUI.saving") : t("pages.botUI.tempVoice.save")}
          </button>
          {dirty ? (
            <button type="button" onClick={() => setDrafts(saved)} disabled={busy} className={SECONDARY}>
              {t("pages.botUI.discard")}
            </button>
          ) : null}
        </div>
      </form>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </Section>
  );
}

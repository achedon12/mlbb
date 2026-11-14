"use client";

import { Fragment, useId, type ReactNode } from "react";
import { useT } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { GREETING_DEFAULTS } from "@/lib/bot/greeting-defaults";
import { GREETING_KINDS, GREETING_MAX_LENGTH, GREETING_PLACEHOLDERS, type GreetingKind } from "@/lib/bot/kinds";
import { cn } from "@/lib/utils";

/**
 * "Welcome & goodbye" part of a server's settings form: for each message,
 * on/off, its channel, an optional text of the owner's with a live preview,
 * and a test post of the text as it stands (saved or not).
 *
 * The preview fills the placeholders the way the bot does
 * (`bot/src/embeds/greetings.ts`), with the signed-in user as the member.
 * The default text and the member count follow the server's language, as
 * chosen in the form: what is shown is what the bot will post.
 */

export type GreetingValue = { channelId: string | null; message: string | null };
export type GreetingSample = { user: string; avatarUrl: string | null; server: string; count: number };

type Channel = { id: string; name: string };

const FIELD = "bevel-sm w-full border border-night-700 bg-night-900 px-3 py-2 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";

/** Placeholder names as the help lists them, `{user}` → `user`. */
const NAMES = GREETING_PLACEHOLDERS.map((p) => p.slice(1, -1));

/** The text as the bot would write it, `{user}` as a mention pill, `**bold**` in bold. */
function Preview({ kind, text, sample, locale }: { kind: GreetingKind; text: string; sample: GreetingSample; locale: Locale }) {
  const values: Record<string, ReactNode> = {
    user: kind === "welcome" ? <span className="rounded bg-azure-500/25 px-1 text-azure-400">@{sample.user}</span> : sample.user,
    username: sample.user,
    server: sample.server,
    count: new Intl.NumberFormat(locale).format(sample.count),
  };
  const nodes = text.split(/(\*\*[^*]+\*\*|\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name && name in values) return <Fragment key={i}>{values[name]}</Fragment>;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      const inner = part.slice(2, -2);
      const filled = /^\{(\w+)\}$/.exec(inner)?.[1];
      return <strong key={i}>{filled && filled in values ? values[filled] : inner}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
  return (
    <div className="flex gap-3 border-l-4 border-gold-500 bg-night-950/70 p-3 text-sm text-chalk-100">
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{nodes}</p>
      {kind === "welcome" && sample.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar, already sized by the CDN
        <img src={sample.avatarUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full bg-night-800" />
      ) : null}
    </div>
  );
}

function GreetingCard({
  kind,
  value,
  failing,
  channels,
  sample,
  locale,
  onChange,
  test,
}: {
  kind: GreetingKind;
  value: GreetingValue;
  failing: boolean;
  channels: Channel[];
  sample: GreetingSample;
  locale: Locale;
  onChange: (value: GreetingValue) => void;
  test: ReactNode;
}) {
  const t = useT();
  const ids = useId();
  const on = value.channelId !== null;
  // The text the bot posts without one of the owner's: in the server's
  // language (the form's select), not the page's.
  const fallback = GREETING_DEFAULTS[locale][kind];
  const text = value.message?.trim() ? value.message : fallback;
  const length = value.message?.length ?? 0;

  return (
    <div className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
      <p className="font-heading font-bold text-gold-400">{t(`pages.botUI.greetingKinds.${kind}`)}</p>
      {failing && on && (
        <p role="alert" className="mt-1 text-sm text-blood-400">
          {t("pages.botUI.failing")}
        </p>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm text-chalk-100">
        <input
          type="checkbox"
          checked={on}
          disabled={!on && !channels.length}
          onChange={(e) => onChange({ ...value, channelId: e.target.checked ? (channels[0]?.id ?? null) : null })}
          className="size-4 accent-gold-500"
        />
        {t(`pages.botUI.greetingToggles.${kind}`)}
      </label>

      {on && (
        <div className="mt-3 space-y-3">
          <div className="max-w-sm">
            <label htmlFor={`${ids}-channel`} className="text-xs font-semibold text-chalk-300">
              {t("pages.botUI.channel")}
            </label>
            <select
              id={`${ids}-channel`}
              value={value.channelId ?? ""}
              onChange={(e) => onChange({ ...value, channelId: e.target.value || null })}
              className={cn(FIELD, "mt-1")}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${ids}-message`} className="text-xs font-semibold text-chalk-300">
              {t("pages.botUI.customMessage")}
            </label>
            <textarea
              id={`${ids}-message`}
              value={value.message ?? ""}
              maxLength={GREETING_MAX_LENGTH}
              rows={3}
              placeholder={fallback}
              aria-describedby={`${ids}-help`}
              onChange={(e) => onChange({ ...value, message: e.target.value || null })}
              className={cn(FIELD, "mt-1 resize-y")}
            />
            <div id={`${ids}-help`} className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs text-chalk-500">
              <div>
                <p>{t("pages.botUI.customHelp")}</p>
                <ul className="mt-1 space-y-0.5">
                  {NAMES.map((name) => (
                    <li key={name}>
                      <code className="text-chalk-300">{`{${name}}`}</code> {t(`pages.botUI.placeholders.${name}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <span className="tabular-nums">
                {length}/{GREETING_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-chalk-300">{t("pages.botUI.preview")}</p>
            <div className="mt-1">
              <Preview kind={kind} text={text} sample={sample} locale={locale} />
            </div>
          </div>
          {test}
        </div>
      )}
    </div>
  );
}

export function GreetingsFieldset({
  value,
  failing,
  channels,
  sample,
  locale,
  onChange,
  testButton,
}: {
  value: Record<GreetingKind, GreetingValue>;
  failing: ReadonlySet<GreetingKind>;
  channels: Channel[];
  sample: GreetingSample;
  locale: Locale;
  onChange: (kind: GreetingKind, value: GreetingValue) => void;
  testButton: (kind: GreetingKind) => ReactNode;
}) {
  const t = useT();
  return (
    <fieldset>
      <legend className="font-heading text-lg font-bold text-chalk-100">{t("pages.botUI.greetingsTitle")}</legend>
      <p className="mt-1 text-sm text-chalk-500">{t("pages.botUI.greetingsLead")}</p>
      <div className="mt-4 grid gap-3">
        {GREETING_KINDS.map((kind) => (
          <GreetingCard
            key={kind}
            kind={kind}
            value={value[kind]}
            failing={failing.has(kind)}
            channels={channels}
            sample={sample}
            locale={locale}
            onChange={(v) => onChange(kind, v)}
            test={testButton(kind)}
          />
        ))}
      </div>
    </fieldset>
  );
}

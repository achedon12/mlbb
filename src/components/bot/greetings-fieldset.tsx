"use client";

import { Fragment, useId, type ReactNode } from "react";
import { useT } from "@/i18n/provider";
import { LOCALE_INTL } from "@/i18n/config";
import { GREETING_DEFAULTS } from "@/lib/bot/greeting-defaults";
import { GREETING_KINDS, GREETING_MAX_LENGTH, GREETING_PLACEHOLDERS, type BotLocale, type GreetingKind } from "@/lib/bot/kinds";
import { FIELD, HELP, LABEL, Notice, StatusBadge, Toggle } from "@/components/bot/dashboard-ui";
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


/** Placeholder names as the help lists them, `{user}` → `user`. */
const NAMES = GREETING_PLACEHOLDERS.map((p) => p.slice(1, -1));

/** The text as the bot would write it, `{user}` as a mention pill, `**bold**` in bold. */
function Preview({ kind, text, sample, locale }: { kind: GreetingKind; text: string; sample: GreetingSample; locale: BotLocale }) {
  const values: Record<string, ReactNode> = {
    user: kind === "welcome" ? <span className="rounded bg-azure-500/25 px-1 text-azure-400">@{sample.user}</span> : sample.user,
    username: sample.user,
    server: sample.server,
    count: new Intl.NumberFormat(LOCALE_INTL[locale]).format(sample.count),
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
    <div className="flex gap-3 border-l-4 border-gold-500 bg-night-950 p-3 text-base leading-relaxed text-chalk-100">
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
  locale: BotLocale;
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
    <div className={cn("bevel-sm border bg-night-850/60 p-4", failing && on ? "border-blood-400/70" : "border-night-700")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-lg font-bold text-chalk-100">{t(`pages.botUI.greetingKinds.${kind}`)}</h3>
        <StatusBadge state={on ? { kind: "on", text: t("pages.botUI.statusOn") } : { kind: "off", text: t("pages.botUI.statusOff") }} />
      </div>
      <div className="mt-2">
        <Toggle
          checked={on}
          disabled={!on && !channels.length}
          onChange={(checked) => onChange({ ...value, channelId: checked ? (channels[0]?.id ?? null) : null })}
        >
          {t(`pages.botUI.greetingToggles.${kind}`)}
        </Toggle>
      </div>
      {failing && on ? (
        <div className="mt-3">
          <Notice tone="error">{t("pages.botUI.failing")}</Notice>
        </div>
      ) : null}

      {on && (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label htmlFor={`${ids}-channel`} className={LABEL}>
                {t("pages.botUI.channel")}
              </label>
              <select
                id={`${ids}-channel`}
                value={value.channelId ?? ""}
                onChange={(e) => onChange({ ...value, channelId: e.target.value || null })}
                className={cn(FIELD, "mt-1.5")}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${ids}-message`} className={LABEL}>
                {t("pages.botUI.customMessage")}
              </label>
              <textarea
                id={`${ids}-message`}
                name={`${kind}-message`}
                autoComplete="off"
                value={value.message ?? ""}
                maxLength={GREETING_MAX_LENGTH}
                rows={4}
                placeholder={fallback}
                aria-describedby={`${ids}-help ${ids}-count`}
                onChange={(e) => onChange({ ...value, message: e.target.value || null })}
                className={cn(FIELD, "mt-1.5 resize-y leading-relaxed")}
              />
              <p id={`${ids}-count`} className="mt-1 text-right text-sm tabular-nums text-chalk-400">
                {length}/{GREETING_MAX_LENGTH}
              </p>
              <div id={`${ids}-help`} className={HELP}>
                <p>{t("pages.botUI.customHelp")}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {NAMES.map((name) => (
                    <Fragment key={name}>
                      <dt>
                        <code translate="no" className="bevel-sm bg-night-800 px-1.5 py-0.5 text-chalk-100">{`{${name}}`}</code>
                      </dt>
                      <dd>{t(`pages.botUI.placeholders.${name}`)}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className={LABEL}>{t("pages.botUI.preview")}</p>
            <Preview kind={kind} text={text} sample={sample} locale={locale} />
            {test}
          </div>
        </div>
      )}
    </div>
  );
}

/** The welcome and goodbye cards, inside their section of the form. */
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
  locale: BotLocale;
  onChange: (kind: GreetingKind, value: GreetingValue) => void;
  testButton: (kind: GreetingKind) => ReactNode;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      {!channels.length ? <Notice tone="warning">{t("pages.botUI.noChannels")}</Notice> : null}
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
  );
}

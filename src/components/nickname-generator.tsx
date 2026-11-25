"use client";

import { DexNotice, Flash } from "@/components/dex-states";
import { Check, Copy, Share2, Shuffle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  DECORATIONS,
  GUIDE_LENGTH,
  INPUT_MAX,
  PRESETS,
  STYLES,
  decorate,
  measure,
  parseShared,
  pickRandom,
  sanitize,
  sharedQuery,
  stylize,
  type Decoration,
  type Preset,
  type Style,
} from "@/lib/nicknames";
import { trackEvent, trackShare } from "@/lib/analytics";
import { useDiscordMoment } from "@/components/discord-moment";
import { DiscordJoinLink } from "@/components/discord-join-link";
import { SupportCard } from "@/components/support-links";
import { communityInvite } from "@/lib/bot/public";
import { cn } from "@/lib/utils";

/**
 * Stylish nickname generator: the typed name is shown in every style, each
 * one copied in a single tap. The chosen one is previewed as the game shows
 * it (over the hero in a match, on the profile card), ready-made looks pair a
 * style with a decoration in one tap, and a share link reopens the generator
 * on the same nickname. Everything runs in the browser; nothing is sent.
 */

/** How long the copy confirmation stays on screen. */
const TOAST_MS = 2500;
/** Longer when the confirmation carries the Discord link: long enough to click it. */
const TOAST_LINK_MS = 4500;

/**
 * Copies to the clipboard. The modern API fails outside a secure context or
 * without permission (some in-app browsers): fall back to a hidden text area,
 * then admit failure.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const copyButton =
  "bevel-sm inline-flex size-11 shrink-0 items-center justify-center border border-night-600 text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400";
const primaryButton =
  "bevel-sm inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-gold-500 px-5 font-semibold text-night-950 transition-colors hover:bg-gold-400";
const secondaryButton =
  "bevel-sm inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-gold-500/60 px-5 font-semibold text-gold-400 transition-colors hover:border-gold-400 hover:text-gold-300";
/** A big tappable tile: its own background layer, since the bevel clips its children. */
const tile = (active: boolean) =>
  cn(
    "bevel-sm border transition-[background-color,border-color,transform] active:translate-y-px",
    active ? "border-gold-400 bg-gold-500/15" : "border-night-700/70 bg-night-900/60 hover:border-night-600",
  );

type Toast = { text: string; failed: boolean; invite?: string | null };

export function NicknameGenerator() {
  const t = useT();
  const locale = useLocale();
  const number = new Intl.NumberFormat(LOCALE_INTL[locale]);
  const inputId = useId();
  const helpId = useId();
  const [input, setInput] = useState(() => t("pages.nicknameUI.example"));
  const [style, setStyle] = useState<Style>("bold");
  const [decoration, setDecoration] = useState<Decoration>(DECORATIONS[0]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [copied, setCopied] = useState<Style | null>(null);
  const [copiedOnce, setCopiedOnce] = useState(false);
  // The Discord invitation after a copy, once the confirmation is gone.
  const discord = useDiscordMoment();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // A shared link (?n=…&s=…&d=…) reopens the generator on its nickname.
  useEffect(() => {
    const shared = parseShared(window.location.search);
    if (!shared) return;
    /* eslint-disable react-hooks/set-state-in-effect -- the address is only known in the browser */
    setInput(shared.name);
    if (shared.style) setStyle(shared.style);
    if (shared.decoration) setDecoration(shared.decoration);
    /* eslint-enable react-hooks/set-state-in-effect */
    trackEvent("Nickname", "Shared link", shared.style ?? undefined);
  }, []);

  const name = sanitize(input);
  const render = (s: Style, d: Decoration = decoration) => decorate(stylize(name, s), d);
  const selected = render(style);
  const length = measure(selected);

  function flash(next: Toast, duration: number, onEnd?: () => void) {
    setToast(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setToast(null);
      onEnd?.();
    }, duration);
  }

  async function copy(s: Style) {
    const text = render(s);
    if (!text) return;
    setStyle(s);
    const ok = await copyText(text);
    if (ok) trackEvent("Nickname", "Copy", s);
    // Every successful copy says where to show the nickname off: a link in the
    // confirmation itself, not one more card. The card comes once a session.
    const invite = ok ? communityInvite() : null;
    const duration = invite ? TOAST_LINK_MS : TOAST_MS;
    setCopied(ok ? s : null);
    if (ok) setCopiedOnce(true);
    if (ok) discord.offer("nickname", duration + 200);
    flash(
      ok
        ? { text: t("pages.nicknameUI.copied", { nickname: text }), failed: false, invite }
        : { text: t("pages.nicknameUI.copyFailed"), failed: true },
      duration,
      () => setCopied(null),
    );
  }

  /** The share sheet where there is one; otherwise the link goes to the clipboard. */
  async function share() {
    if (!name) return;
    const url = `${window.location.origin}${window.location.pathname}${sharedQuery(name, style, decoration)}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: t("pages.nicknameUI.shareTitle"),
          text: t("pages.nicknameUI.shareText", { nickname: selected }),
          url,
        });
        trackShare("Nickname", "native");
        return;
      } catch (e) {
        // Closing the share sheet is not a failure; any other refusal falls back to the clipboard.
        if ((e as Error).name === "AbortError") return;
      }
    }
    const ok = await copyText(url);
    if (ok) trackShare("Nickname", "clipboard");
    flash({ text: t(ok ? "pages.nicknameUI.linkCopied" : "pages.nicknameUI.shareFailed"), failed: !ok }, TOAST_MS);
  }

  /** Brings the preview back on screen when the choice was made below it. */
  function showPreview() {
    const el = preview.current;
    if (!el || el.getBoundingClientRect().top >= 64) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }

  function choosePreset(p: Preset) {
    setStyle(p.style);
    setDecoration(p.decoration);
    trackEvent("Nickname", "Preset", p.key);
    showPreview();
  }

  function chooseStyle(s: Style) {
    setStyle(s);
    showPreview();
  }

  function random() {
    const pick = pickRandom();
    setStyle(pick.style);
    setDecoration(pick.decoration);
  }

  return (
    <div className="space-y-6">
      <Card>
        <label htmlFor={inputId} className="text-xs uppercase tracking-wide text-chalk-500">
          {t("pages.nicknameUI.input")}
        </label>
        <div className="mt-1.5 flex flex-wrap gap-3">
          <input
            id={inputId}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={INPUT_MAX * 2}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={helpId}
            className="bevel-sm min-h-12 min-w-0 flex-1 basis-56 border border-night-700 bg-night-900 px-3 py-2.5 text-lg text-chalk-100 outline-none transition-colors focus:border-gold-500"
          />
          <button type="button" onClick={random} className={primaryButton}>
            <Shuffle size={16} aria-hidden />
            {t("pages.nicknameUI.random")}
          </button>
        </div>
        <p id={helpId} className="mt-2 text-xs leading-relaxed text-chalk-500">
          {t("pages.nicknameUI.help")}
        </p>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.nicknameUI.decorations")}</legend>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DECORATIONS.map((d) => {
              const active = d.key === decoration.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDecoration(d)}
                  className={cn(
                    tile(active),
                    "inline-flex min-h-12 items-center justify-center px-1 text-base",
                    active ? "text-gold-300" : "text-chalk-200",
                  )}
                >
                  {d.key === "none" ? (
                    <span className="text-sm">{t("pages.nicknameUI.none")}</span>
                  ) : (
                    <>
                      <span aria-hidden className="whitespace-nowrap">
                        {d.before}
                        <span className="px-0.5 opacity-50">·</span>
                        {d.after}
                      </span>
                      <span className="sr-only">{t(`pages.nicknameUI.decoration.${d.key}`)}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Card>

      {name === "" ? (
        <DexNotice pose="pointe">{t("pages.nicknameUI.empty")}</DexNotice>
      ) : (
        <>
          <div ref={preview} className="scroll-mt-20">
            <Card className="border-gold-500/30">
              <h2 className="text-xs uppercase tracking-wide text-chalk-500">
                {t("pages.nicknameUI.previewTitle")} · {t(`pages.nicknameUI.style.${style}`)}
              </h2>
              <NamePlates text={selected} initial={Array.from(stylize(name, style))[0] ?? ""} />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:flex">
                <button type="button" onClick={() => copy(style)} className={primaryButton}>
                  {copied === style ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
                  {t("pages.nicknameUI.copy")}
                </button>
                <button type="button" onClick={share} className={secondaryButton}>
                  <Share2 size={18} aria-hidden />
                  {t("pages.nicknameUI.share")}
                </button>
              </div>
              <p className="mt-3 text-sm text-chalk-300">
                <span className="tabular-nums">{t("pages.nicknameUI.length", { n: number.format(length.codePoints) })}</span>
                {length.utf16Units !== length.codePoints && (
                  <span className="text-chalk-500"> · {t("pages.nicknameUI.units", { u: number.format(length.utf16Units) })}</span>
                )}
              </p>
              {length.codePoints > GUIDE_LENGTH.max && (
                <p className="mt-1 text-sm text-blood-500">{t("pages.nicknameUI.overGuide", { max: GUIDE_LENGTH.max })}</p>
              )}
              <p className="mt-3 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
                {t("pages.nicknameUI.rating")}
              </p>
            </Card>
          </div>

          <section aria-labelledby="presets-title">
            <h2 id="presets-title" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.nicknameUI.presetsTitle")}
            </h2>
            <p className="mt-1 text-sm text-chalk-500">{t("pages.nicknameUI.presetsLead")}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const active = p.style === style && p.decoration.key === decoration.key;
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => choosePreset(p)}
                      className={cn(tile(active), "flex min-h-24 w-full flex-col justify-between gap-2 p-3 text-left")}
                    >
                      <span className="block break-all font-sans text-lg leading-snug text-chalk-100">
                        {render(p.style, p.decoration)}
                      </span>
                      <span className={cn("block font-heading text-sm font-bold uppercase", active ? "text-gold-300" : "text-chalk-400")}>
                        {t(`pages.nicknameUI.preset.${p.key}`)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="styles-title">
            <h2 id="styles-title" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.nicknameUI.stylesTitle")}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {STYLES.map((s) => {
                const text = render(s);
                const styleName = t(`pages.nicknameUI.style.${s}`);
                const active = s === style;
                return (
                  <li key={s} className="relative">
                    {/* The bevel clips its children: it stays on a background layer. */}
                    <div aria-hidden className={cn(tile(active), "absolute inset-0")} />
                    <div className="relative flex items-center gap-2 p-2">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => chooseStyle(s)}
                        className="min-h-14 min-w-0 flex-1 px-1.5 text-left"
                      >
                        <span className="block break-all font-sans text-xl leading-snug text-chalk-100">{text}</span>
                        <span className="block text-xs text-chalk-500">{styleName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copy(s)}
                        aria-label={t("pages.nicknameUI.copyStyle", { style: styleName })}
                        className={copyButton}
                      >
                        {copied === s ? <Check size={18} aria-hidden className="text-gold-400" /> : <Copy size={18} aria-hidden />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          {/* After a copy: the tool did its job, a quiet thanks under it. */}
          {copiedOnce && <SupportCard placement="Nickname" />}
        </>
      )}

      {/* Copy confirmation: a live region that is always mounted, so its content gets announced. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        {toast && (
          <p
            data-bottom-ui
            className={cn("max-w-full font-medium drop-shadow-[0_8px_18px_rgb(0_0_0/0.55)]", toast.invite && "pointer-events-auto")}
          >
            <Flash tone={toast.failed ? "error" : "ok"} className="py-1.5 pr-4">
              <span className="break-all">{toast.text}</span>
              {toast.invite && (
                <>
                  {" "}
                  <DiscordJoinLink
                    href={toast.invite}
                    placement="Toast"
                    context="nickname"
                    className="whitespace-nowrap font-semibold text-blurple-400 underline underline-offset-4 hover:text-white"
                  >
                    {t("pages.nicknameUI.copiedDiscord")}
                  </DiscordJoinLink>
                </>
              )}
            </Flash>
          </p>
        )}
      </div>
      {discord.card}
    </div>
  );
}

/**
 * The nickname as the game shows it, drawn in CSS: over the hero in a match
 * (name, level, health and mana bars) and on the profile card (framed avatar,
 * name). A likeness, not a capture: the game's own font may draw some
 * symbols differently, which the note under the preview says.
 */
function NamePlates({ text, initial }: { text: string; initial: string }) {
  const t = useT();
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <figure className="bevel-sm relative overflow-hidden border border-night-700 bg-[radial-gradient(120%_100%_at_50%_110%,var(--color-night-700),var(--color-night-950)_70%)] px-4 pb-3 pt-6">
        <div className="mx-auto w-full max-w-[16rem]">
          <p className="break-all text-center font-sans text-lg font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.9),0_0_6px_rgb(0_0_0/0.6)]">
            {text}
          </p>
          <div aria-hidden className="mt-1 flex items-center gap-1">
            <span className="grid h-6 min-w-6 place-items-center border border-gold-500 bg-night-950 px-1 text-[0.7rem] font-bold tabular-nums text-gold-300">
              15
            </span>
            <span className="flex-1">
              <span className="relative block h-3 overflow-hidden border border-black/80 bg-night-950">
                <span className="absolute inset-y-0 left-0 w-4/5 bg-linear-to-b from-azure-300 to-azure-600" />
                <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_13px,rgb(0_0_0/0.55)_13px_14px)]" />
              </span>
              <span className="mt-0.5 block h-1.5 bg-night-950">
                <span className="block h-full w-3/5 bg-gold-400" />
              </span>
            </span>
          </div>
        </div>
        <figcaption className="mt-4 text-center text-[0.7rem] uppercase tracking-wide text-chalk-500">
          {t("pages.nicknameUI.plateBattle")}
        </figcaption>
      </figure>

      <figure className="bevel-sm border border-night-700 bg-linear-to-br from-night-800 to-night-950 px-4 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-gold-400 bg-night-900 font-sans text-2xl font-bold text-gold-300 shadow-[0_0_0_3px_var(--color-night-950),0_0_14px_rgb(245_196_81/0.45)]"
          >
            {initial}
          </span>
          <p className="min-w-0 break-all font-sans text-xl font-semibold leading-snug text-chalk-100">{text}</p>
        </div>
        <figcaption className="mt-4 text-center text-[0.7rem] uppercase tracking-wide text-chalk-500">
          {t("pages.nicknameUI.plateProfile")}
        </figcaption>
      </figure>
    </div>
  );
}

"use client";

import { Check, Copy, Shuffle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { classesPuce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  DECORATIONS,
  GUIDE_LENGTH,
  INPUT_MAX,
  STYLES,
  decorate,
  measure,
  pickRandom,
  sanitize,
  stylize,
  type Decoration,
  type Style,
} from "@/lib/nicknames";
import { cn } from "@/lib/utils";

/**
 * Stylish nickname generator: the typed name is shown in every style, each
 * one copied in a single tap. Everything runs in the browser; nothing is sent.
 */

/** How long the copy confirmation stays on screen. */
const TOAST_MS = 2500;

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
  "biseau-sm inline-flex size-11 shrink-0 items-center justify-center border border-nuit-600 text-craie-300 transition-colors hover:border-or-500 hover:text-or-400";
const primaryButton =
  "biseau-sm inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-or-500 px-4 font-semibold text-nuit-950 transition-colors hover:bg-or-400";

export function NicknameGenerator() {
  const t = useT();
  const locale = useLangue();
  const number = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const inputId = useId();
  const helpId = useId();
  const [input, setInput] = useState(() => t("pages.nicknameUI.example"));
  const [style, setStyle] = useState<Style>("bold");
  const [decoration, setDecoration] = useState<Decoration>(DECORATIONS[0]);
  const [toast, setToast] = useState<{ text: string; failed: boolean } | null>(null);
  const [copied, setCopied] = useState<Style | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const name = sanitize(input);
  const render = (s: Style) => decorate(stylize(name, s), decoration);
  const selected = render(style);
  const length = measure(selected);

  async function copy(s: Style) {
    const text = render(s);
    if (!text) return;
    setStyle(s);
    const ok = await copyText(text);
    setToast(
      ok
        ? { text: t("pages.nicknameUI.copied", { nickname: text }), failed: false }
        : { text: t("pages.nicknameUI.copyFailed"), failed: true },
    );
    setCopied(ok ? s : null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setToast(null);
      setCopied(null);
    }, TOAST_MS);
  }

  function random() {
    const pick = pickRandom();
    setStyle(pick.style);
    setDecoration(pick.decoration);
  }

  return (
    <div className="space-y-6">
      <Carte>
        <label htmlFor={inputId} className="text-xs uppercase tracking-wide text-craie-500">
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
            className="biseau-sm min-h-11 min-w-0 flex-1 basis-56 border border-nuit-700 bg-nuit-900 px-3 py-2.5 text-lg text-craie-100 outline-none transition-colors focus:border-or-500"
          />
          <button type="button" onClick={random} className={primaryButton}>
            <Shuffle size={16} aria-hidden />
            {t("pages.nicknameUI.random")}
          </button>
        </div>
        <p id={helpId} className="mt-2 text-xs leading-relaxed text-craie-500">
          {t("pages.nicknameUI.help")}
        </p>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wide text-craie-500">{t("pages.nicknameUI.decorations")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DECORATIONS.map((d) => {
              const active = d.key === decoration.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDecoration(d)}
                  className={cn(classesPuce(active), "inline-flex min-h-11 min-w-11 items-center justify-center")}
                >
                  {d.key === "none" ? (
                    t("pages.nicknameUI.none")
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
      </Carte>

      {name === "" ? (
        <Carte>
          <p className="text-sm text-craie-300">{t("pages.nicknameUI.empty")}</p>
        </Carte>
      ) : (
        <>
          <Carte className="border-or-500/30">
            <p className="text-xs uppercase tracking-wide text-craie-500">
              {t("pages.nicknameUI.selected", { style: t(`pages.nicknameUI.style.${style}`) })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 basis-48 break-all font-sans text-3xl leading-snug text-or-400 sm:text-4xl">
                {selected}
              </p>
              <button type="button" onClick={() => copy(style)} className={primaryButton}>
                {copied === style ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {t("pages.nicknameUI.copy")}
              </button>
            </div>
            <p className="mt-3 text-sm text-craie-300">
              <span className="tabular-nums">{t("pages.nicknameUI.length", { n: number.format(length.codePoints) })}</span>
              {length.utf16Units !== length.codePoints && (
                <span className="text-craie-500"> · {t("pages.nicknameUI.units", { u: number.format(length.utf16Units) })}</span>
              )}
            </p>
            {length.codePoints > GUIDE_LENGTH.max && (
              <p className="mt-1 text-sm text-sang-500">{t("pages.nicknameUI.overGuide", { max: GUIDE_LENGTH.max })}</p>
            )}
            <p className="mt-3 border-t border-nuit-800 pt-3 text-xs leading-relaxed text-craie-500">
              {t("pages.nicknameUI.note")}
            </p>
          </Carte>

          <section aria-labelledby="styles-title">
            <h2 id="styles-title" className="font-titre text-xl font-bold text-craie-100">
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
                    <div
                      aria-hidden
                      className={cn(
                        "biseau-sm absolute inset-0 border bg-nuit-900/60 transition-colors",
                        active ? "border-or-500/70" : "border-nuit-700/70",
                      )}
                    />
                    <div className="relative flex items-center gap-2 p-2">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setStyle(s)}
                        className="min-h-11 min-w-0 flex-1 px-1 text-left"
                      >
                        <span className="block break-all font-sans text-lg leading-snug text-craie-100">{text}</span>
                        <span className="block text-xs text-craie-500">{styleName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copy(s)}
                        aria-label={t("pages.nicknameUI.copyStyle", { style: styleName })}
                        className={copyButton}
                      >
                        {copied === s ? <Check size={18} aria-hidden className="text-or-400" /> : <Copy size={18} aria-hidden />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
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
            className={cn(
              "max-w-full break-all border bg-nuit-900 px-4 py-2.5 text-sm font-medium text-craie-100 shadow-lg shadow-black/40",
              toast.failed ? "border-sang-500/60" : "border-or-500/60",
            )}
          >
            {toast.text}
          </p>
        )}
      </div>
    </div>
  );
}

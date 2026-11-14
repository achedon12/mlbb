"use client";

import { CircleAlert, CircleCheck, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Building blocks of the bot dashboard's settings form: the section cards,
 * their on/off/attention badge, the form controls' look, and the toasts.
 * Kept apart so each part of the form (`settings-form.tsx`,
 * `greetings-fieldset.tsx`, `auto-roles-fieldset.tsx`) reads the same.
 *
 * Contrast: labels are chalk-100/200 and help text chalk-400 on night-900
 * (over 7:1 and 6:1), errors blood-400 (5.6:1), never below WCAG AA.
 */

/** A select or text field: 16 px text (no zoom on phones), 44 px tall. */
export const FIELD =
  "bevel-sm min-h-11 w-full border border-night-600 bg-night-850 px-3 py-2 text-base text-chalk-100 transition-colors hover:border-night-600 focus-visible:border-gold-400 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
export const LABEL = "block text-sm font-semibold text-chalk-200";
export const HELP = "text-sm leading-relaxed text-chalk-400";
export const BUTTON =
  "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const PRIMARY = cn(BUTTON, "bg-gold-500 text-night-950 hover:bg-gold-400");
export const SECONDARY = cn(BUTTON, "border border-night-600 bg-night-800 text-chalk-100 hover:border-gold-500/70 hover:bg-night-700");

export type SectionState = { kind: "on" | "off" | "attention"; text: string };

/** On, off, or needs attention: color, icon and words, never color alone. */
export function StatusBadge({ state }: { state: SectionState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        state.kind === "on" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
        state.kind === "off" && "border-night-600 bg-night-800 text-chalk-300",
        state.kind === "attention" && "border-blood-400/50 bg-blood-500/15 text-blood-400",
      )}
    >
      {state.kind === "attention" ? (
        <CircleAlert aria-hidden className="size-3.5" />
      ) : (
        <span aria-hidden className={cn("size-2 rounded-full", state.kind === "on" ? "bg-emerald-400" : "bg-chalk-500")} />
      )}
      {state.text}
    </span>
  );
}

/** One part of the settings: an icon, a title, one line of help, its state. */
export function Section({
  id,
  icon: Icon,
  title,
  lead,
  state,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  lead: string;
  state?: SectionState;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="bevel scroll-mt-24 border border-night-700 bg-night-900/80">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-night-700 p-4 sm:p-5">
        <span aria-hidden className="bevel-sm grid size-10 shrink-0 place-items-center bg-gold-500/15 text-gold-400">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`${id}-title`} className="font-heading text-xl font-bold text-chalk-100">
              {title}
            </h2>
            {state ? <StatusBadge state={state} /> : null}
          </div>
          <p className={cn(HELP, "mt-1 max-w-prose")}>{lead}</p>
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** A problem with what to do about it, inside a section. */
export function Notice({ tone, children }: { tone: "error" | "warning"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex gap-2 border-l-4 px-3 py-2 text-sm leading-relaxed",
        tone === "error" ? "border-blood-400 bg-blood-500/10 text-chalk-100" : "border-gold-500 bg-gold-500/10 text-chalk-100",
      )}
    >
      <CircleAlert aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-blood-400" : "text-gold-400")} />
      <span>{children}</span>
    </p>
  );
}

/** A switch: a real checkbox, label and control one hit target. */
export function Toggle({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 text-base text-chalk-100", disabled && "cursor-not-allowed opacity-60")}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full border border-night-600 bg-night-800 transition-colors peer-checked:border-gold-500 peer-checked:bg-gold-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-400 after:absolute after:left-0.5 after:top-0.5 after:size-[1.125rem] after:rounded-full after:bg-chalk-300 after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-night-950 motion-reduce:after:transition-none"
      />
      <span>{children}</span>
    </label>
  );
}

export type Toast = { id: number; kind: "ok" | "error"; text: string };

/** Toasts: pushed by the form, announced politely, gone after 6 s. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Toast["kind"], text: string) => {
      const id = ++next.current;
      setToasts((list) => [...list.slice(-2), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), 6_000);
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "bevel-sm pointer-events-auto flex w-full max-w-sm items-start gap-3 border bg-night-850 p-3 text-sm text-chalk-100 shadow-lg shadow-night-950/60",
            toast.kind === "ok" ? "border-emerald-400/50" : "border-blood-400/60",
          )}
        >
          {toast.kind === "ok" ? (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          ) : (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-blood-400" />
          )}
          <p className="min-w-0 flex-1 break-words">{toast.text}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label={t("pages.botUI.dismiss")}
            className="-m-1 grid size-8 shrink-0 place-items-center text-chalk-400 transition-colors hover:text-chalk-100"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Asks before leaving the page with changes not saved. */
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

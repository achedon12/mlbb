"use client";

import { useEffect, useId, useState } from "react";
import { Flag } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { DATA_REPORT_CORRECTION_MAX, DATA_REPORT_SOURCE_MAX, DATA_REPORT_TEXT_MAX, DATA_REPORT_TEXT_MIN } from "@/lib/data-reports";
import { cn } from "@/lib/utils";

/**
 * "Report an error" on a data page: a quiet link that opens a short form,
 * what is wrong, the right value and a source if known. No account, no
 * e-mail. The pages are prerendered: the button shows only once
 * `/api/data-reports` says reports are taken (a site without database
 * never shows it). Texts: `pages.reportError`, given by `ReportError`.
 */

/** Whether reports are taken, asked once per page load and shared by every form on the page. */
let opening: Promise<boolean> | null = null;
const reportsOpen = () =>
  (opening ??= fetch("/api/data-reports")
    .then((r) => (r.ok ? r.json() : { open: false }))
    .then((d: { open?: unknown }) => d.open === true)
    .catch(() => false));

const FIELD =
  "bevel-sm mt-1 block w-full border border-night-700 bg-night-950 px-3 text-sm text-chalk-100 outline-none focus:border-gold-500";
const QUIET = "inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-chalk-400 transition-colors hover:text-chalk-100 disabled:opacity-60";

/** One POST, its status and `error`; 0 when the network failed. */
async function sendReport(body: unknown): Promise<{ status: number; error?: unknown }> {
  try {
    const r = await fetch("/api/data-reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await r.json().catch(() => ({}))) as { error?: unknown };
    return { status: r.status, error: data.error };
  } catch {
    return { status: 0 };
  }
}

type State ={ type: "idle" | "sending" | "sent" } | { type: "error"; message: string };

export function ReportErrorForm({ path, className }: { path: string; className?: string }) {
  const t = useT();
  const locale = useLocale();
  const formId = useId();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState("");
  const [source, setSource] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>({ type: "idle" });

  useEffect(() => {
    let live = true;
    reportsOpen().then((o) => live && setAvailable(o));
    return () => {
      live = false;
    };
  }, []);

  if (!available) return null;

  function refusal(status: number, error: unknown): string {
    if (error === "full") return t("pages.reportError.errors.full");
    if (status === 429) return t("pages.reportError.errors.tooFast");
    if (error === "links") return t("pages.reportError.errors.links");
    if (error === "text") return t("pages.reportError.errors.text", { min: DATA_REPORT_TEXT_MIN, max: DATA_REPORT_TEXT_MAX });
    if (error === "source") return t("pages.reportError.errors.source");
    if (status >= 400 && status < 500 && status !== 404) return t("pages.reportError.errors.invalid");
    return t("pages.reportError.errors.unavailable");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ type: "sending" });
    const body = {
      path,
      locale,
      text,
      ...(correction.trim() ? { correction } : {}),
      ...(source.trim() ? { source: source.trim() } : {}),
      ...(website ? { website } : {}),
    };
    const answer = await sendReport(body);
    if (answer.status === 201) {
      setState({ type: "sent" });
      trackEvent("Data report", "Send", path);
    } else setState({ type: "error", message: refusal(answer.status, answer.error) });
  }

  if (state.type === "sent") {
    return (
      <p role="status" className={cn("text-sm text-chalk-400", className)}>
        {t("pages.reportError.sent")}
      </p>
    );
  }

  return (
    <div className={className}>
      <button type="button" className={QUIET} aria-expanded={open} aria-controls={formId} onClick={() => setOpen((o) => !o)}>
        <Flag size={15} aria-hidden />
        {t("pages.reportError.open")}
      </button>
      {open && (
        <form id={formId} onSubmit={submit} className="bevel-sm mt-2 max-w-xl space-y-3 border border-night-700 bg-night-900 p-4">
          <p className="text-sm font-semibold text-chalk-100">{t("pages.reportError.title")}</p>
          <p className="text-xs text-chalk-400">{t("pages.reportError.intro")}</p>
          <label className="block text-xs text-chalk-400">
            {t("pages.reportError.text")}
            <textarea
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              minLength={DATA_REPORT_TEXT_MIN}
              maxLength={DATA_REPORT_TEXT_MAX}
              rows={4}
              className={cn(FIELD, "py-2")}
            />
          </label>
          <label className="block text-xs text-chalk-400">
            {t("pages.reportError.correction")}
            <input value={correction} onChange={(e) => setCorrection(e.target.value)} maxLength={DATA_REPORT_CORRECTION_MAX} className={cn(FIELD, "h-11")} />
          </label>
          <label className="block text-xs text-chalk-400">
            {t("pages.reportError.source")}
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={DATA_REPORT_SOURCE_MAX}
              className={cn(FIELD, "h-11")}
            />
          </label>
          {/* Honeypot: off screen and out of the tab order; people leave it empty, bots fill it in. */}
          <label aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
            Website
            <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <p className="text-xs text-chalk-500">{t("pages.reportError.privacy")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={state.type === "sending"}
              className="bevel-sm inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60"
            >
              {t("pages.reportError.send")}
            </button>
            <button type="button" className={QUIET} onClick={() => setOpen(false)}>
              {t("pages.reportError.cancel")}
            </button>
          </div>
          {state.type === "error" && (
            <p role="alert" className="text-sm text-blood-400">
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

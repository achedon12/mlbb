"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigUp, Flag, Pencil, Trash2 } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { REPORT_NOTE_MAX, REPORT_REASONS, type TargetKind } from "@/lib/community/constants";
import { cn } from "@/lib/utils";
import { refusal, send } from "./request";

/**
 * The small actions under a post: upvote, report, and the author's own
 * edit and delete. Kept quiet - text buttons on one line - so a long thread
 * reads as text, not as a toolbar.
 */

export const QUIET = "inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-chalk-400 transition-colors hover:text-chalk-100 disabled:opacity-60";

export function VoteButton({
  kind,
  id,
  score,
  voted,
  own,
  signedIn,
}: {
  kind: "thread" | "post";
  id: number;
  score: number;
  voted: boolean;
  own: boolean;
  signedIn: boolean;
}) {
  const t = useT();
  const [state, setState] = useState({ score, voted });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t("pages.communityUI.votes", { n: state.score });

  if (own || !signedIn) {
    return (
      <span className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-chalk-500" title={own ? undefined : t("pages.communityUI.signInToVote")}>
        <ArrowBigUp size={18} aria-hidden />
        <span className="tabular-nums">{label}</span>
      </span>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    const answer = await send("POST", "/api/community/votes", { kind, id });
    setBusy(false);
    if (answer.status === 200) {
      setState({ score: Number(answer.data.score), voted: Boolean(answer.data.voted) });
      trackEvent("Community", answer.data.voted ? "Upvote" : "Unvote", kind);
    } else setError(refusal(t, answer));
  }

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={state.voted}
        aria-label={`${state.voted ? t("pages.communityUI.unvote") : t("pages.communityUI.upvote")} (${label})`}
        className={cn(QUIET, state.voted && "text-gold-400 hover:text-gold-500")}
      >
        <ArrowBigUp size={18} aria-hidden className={state.voted ? "fill-current" : undefined} />
        <span className="tabular-nums">{state.score}</span>
      </button>
      {error && (
        <span role="alert" className="ml-2 text-xs text-blood-400">
          {error}
        </span>
      )}
    </span>
  );
}

export function ReportButton({ kind, id, signedIn }: { kind: TargetKind; id: number; signedIn: boolean }) {
  const t = useT();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam");
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ type: "idle" | "sending" | "sent" } | { type: "error"; message: string }>({ type: "idle" });

  if (!signedIn) return null;
  if (state.type === "sent") {
    return (
      <span role="status" className="inline-flex min-h-11 items-center px-1 text-sm text-chalk-400">
        {t("pages.communityUI.report.sent")}
      </span>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ type: "sending" });
    const answer = await send("POST", "/api/community/reports", { kind, id, reason, ...(note.trim() ? { note } : {}) });
    if (answer.status === 201) {
      setState({ type: "sent" });
      trackEvent("Community", "Report", kind);
    } else if (answer.status === 409) setState({ type: "sent" });
    else setState({ type: "error", message: refusal(t, answer) });
  }

  return (
    <>
      <button type="button" className={QUIET} aria-expanded={open} aria-controls={formId} onClick={() => setOpen((o) => !o)}>
        <Flag size={15} aria-hidden />
        {t("pages.communityUI.report.open")}
      </button>
      {open && (
        <form id={formId} onSubmit={submit} className="bevel-sm mt-2 basis-full space-y-3 border border-night-700 bg-night-900 p-4">
          <fieldset>
            <legend className="text-sm font-semibold text-chalk-100">{t("pages.communityUI.report.title")}</legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-chalk-300">
                  <input type="radio" name={`${formId}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-gold-500" />
                  {t(`pages.communityUI.report.reasons.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs text-chalk-400">
            {t("pages.communityUI.report.note")}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={REPORT_NOTE_MAX}
              className="bevel-sm mt-1 block h-11 w-full border border-night-700 bg-night-950 px-3 text-sm text-chalk-100 outline-none focus:border-gold-500"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={state.type === "sending"}
              className="bevel-sm inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60"
            >
              {t("pages.communityUI.report.send")}
            </button>
            <button type="button" className={QUIET} onClick={() => setOpen(false)}>
              {t("pages.communityUI.cancel")}
            </button>
          </div>
          {state.type === "error" && (
            <p role="alert" className="text-sm text-blood-400">
              {state.message}
            </p>
          )}
        </form>
      )}
    </>
  );
}

/** Delete one's own thread or reply, after a confirmation. */
export function DeleteButton({ kind, id, after }: { kind: "thread" | "post"; id: number; after: string | null }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(kind === "thread" ? t("pages.communityUI.confirmDeleteThread") : t("pages.communityUI.confirmDeleteReply"))) return;
    setBusy(true);
    const answer = await send("DELETE", kind === "thread" ? `/api/community/threads/${id}` : `/api/community/posts/${id}`);
    setBusy(false);
    if (answer.status === 204) {
      if (after) router.push(after);
      router.refresh();
    } else setError(refusal(t, answer));
  }

  return (
    <>
      <button type="button" onClick={remove} disabled={busy} className={cn(QUIET, "hover:text-blood-400")}>
        <Trash2 size={15} aria-hidden />
        {t("pages.communityUI.delete")}
      </button>
      {error && (
        <span role="alert" className="basis-full text-xs text-blood-400">
          {error}
        </span>
      )}
    </>
  );
}

export function EditToggle({ onClick, expanded, controls }: { onClick: () => void; expanded: boolean; controls: string }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={controls} className={QUIET}>
      <Pencil size={15} aria-hidden />
      {t("pages.communityUI.edit")}
    </button>
  );
}

export function SignInLink() {
  const t = useT();
  return (
    <Link href="/login" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
      {t("pages.communityUI.signIn")}
    </Link>
  );
}

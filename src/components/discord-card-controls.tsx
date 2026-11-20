"use client";

import { Flash } from "@/components/dex-states";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, RefreshCw, Trash2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";

/**
 * Buttons of the account page's Discord card (`/api/discord-profile`):
 * link, update the figures, the two options, unlink. Each change is the
 * visitor's own click; the page reloads its server part afterwards.
 */

type State = { type: "idle" | "sending" | "done" | "confirm" } | { type: "error"; message: string };
type Answer = { status: number; data: { error?: unknown } };

async function send(method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<Answer> {
  try {
    const r = await fetch("/api/discord-profile", {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: ((await r.json().catch(() => ({}))) as Answer["data"]) ?? {} };
  } catch {
    return { status: 0, data: {} };
  }
}

const button =
  "bevel-sm inline-flex min-h-11 items-center gap-2 bg-night-800 px-3 text-sm font-semibold text-chalk-100 transition-colors hover:bg-night-700 disabled:opacity-60";

function useCall() {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<State>({ type: "idle" });

  const message = (a: Answer) =>
    a.data.error === "expired"
      ? t("pages.discordCard.errorExpired")
      : a.status === 503 && a.data.error === "unavailable"
        ? t("pages.discordCard.errorDown")
        : t("pages.discordCard.error");

  async function call(method: "POST" | "PATCH" | "DELETE", body: unknown, event: string) {
    setState({ type: "sending" });
    const answer = await send(method, body);
    if (answer.status === 200) {
      setState({ type: "done" });
      trackEvent("Discord card", event);
      router.refresh();
    } else setState({ type: "error", message: message(answer) });
  }
  return { t, state, setState, call };
}

function Status({ state }: { state: State }) {
  const t = useT();
  if (state.type === "done") return <p role="status" className="text-sm text-azure-400">{t("pages.discordCard.done")}</p>;
  if (state.type === "error") return <p role="alert"><Flash tone="error">{state.message}</Flash></p>;
  return null;
}

/** Signed in both ways: link (or move the card to this Discord account). */
export function LinkCardButton() {
  const { t, state, call } = useCall();
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => call("POST", { action: "link" }, "Link")} disabled={state.type === "sending"} className={button}>
        <Link2 size={15} aria-hidden />
        {t("pages.discordCard.linkButton")}
      </button>
      <Status state={state} />
    </div>
  );
}

/** A linked card: update, options, unlink. */
export function CardControls({ isPublic, showId }: { isPublic: boolean; showId: boolean }) {
  const { t, state, setState, call } = useCall();
  const busy = state.type === "sending";
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => call("POST", { action: "refresh" }, "Refresh")} disabled={busy} className={button}>
        <RefreshCw size={15} aria-hidden />
        {t("pages.discordCard.refresh")}
      </button>

      <div className="space-y-2 text-sm text-chalk-300">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isPublic}
            disabled={busy}
            onChange={(e) => call("PATCH", { public: e.target.checked }, e.target.checked ? "Public" : "Private")}
            className="size-4 accent-gold-500"
          />
          <span>
            {t("pages.discordCard.public")}
            <span className="block text-xs text-chalk-500">{t("pages.discordCard.publicHint")}</span>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={showId}
            disabled={busy}
            onChange={(e) => call("PATCH", { showId: e.target.checked }, e.target.checked ? "Show id" : "Hide id")}
            className="size-4 accent-gold-500"
          />
          <span>{t("pages.discordCard.showId")}</span>
        </label>
      </div>

      {state.type === "confirm" ? (
        <div className="bevel-sm space-y-2 border border-night-700 bg-night-900 p-3 text-sm text-chalk-300">
          <p>{t("pages.discordCard.unlinkConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => call("DELETE", undefined, "Unlink")} className={`${button} bg-blood-500/20 hover:bg-blood-500/30`}>
              <Trash2 size={15} aria-hidden />
              {t("pages.discordCard.unlinkButton")}
            </button>
            <button type="button" onClick={() => setState({ type: "idle" })} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-chalk-300 hover:text-chalk-100">
              {t("pages.discordCard.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setState({ type: "confirm" })}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-chalk-400 underline underline-offset-4 hover:text-chalk-100"
        >
          <Trash2 size={13} aria-hidden />
          {t("pages.discordCard.unlink")}
        </button>
      )}
      <Status state={state} />
    </div>
  );
}

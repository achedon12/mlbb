"use client";

import { Flash } from "@/components/dex-states";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink } from "lucide-react";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { refusal, send } from "./request";

/**
 * Offer shown when this browser is signed in both ways (game account and
 * Discord) and the two are not linked yet: one button, confirmed by the
 * visitor, that links them (POST /api/community/link). Nothing is linked
 * behind the visitor's back.
 */
export function LinkAccounts() {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<{ type: "idle" | "sending" | "done" } | { type: "error"; message: string }>({ type: "idle" });

  async function link() {
    setState({ type: "sending" });
    const answer = await send("POST", "/api/community/link");
    if (answer.status === 200) {
      setState({ type: "done" });
      trackEvent("Community", "Link");
      router.refresh();
    } else if (answer.status === 409) setState({ type: "error", message: t("pages.communityUI.link.taken") });
    else setState({ type: "error", message: refusal(t, answer) });
  }

  if (state.type === "done") {
    return (
      <p role="status" className="text-sm text-azure-400">
        {t("pages.communityUI.link.done")}
      </p>
    );
  }
  return (
    <div className="bevel-sm space-y-2 border border-night-700 bg-night-900 p-3 text-sm text-chalk-300">
      <p>{t("pages.communityUI.link.offer")}</p>
      <button
        type="button"
        onClick={link}
        disabled={state.type === "sending"}
        className="bevel-sm inline-flex min-h-11 items-center gap-2 bg-night-800 px-3 font-semibold text-chalk-100 transition-colors hover:bg-night-700 disabled:opacity-60"
      >
        <Link2 size={15} aria-hidden />
        {t("pages.communityUI.link.button")}
      </button>
      {state.type === "error" && (
        <p role="alert">
          <Flash tone="error">{state.message}</Flash>
        </p>
      )}
    </div>
  );
}

/**
 * For a browser signed in both ways with the two linked: a small link that
 * opens a confirmation, which says what unlinking does (DELETE
 * /api/community/link): the Discord login becomes a new member with no
 * history, and everything merged stays with the game account.
 */
export function UnlinkAccounts() {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<{ type: "idle" | "confirm" | "sending" | "done" } | { type: "error"; message: string }>({ type: "idle" });

  async function unlink() {
    setState({ type: "sending" });
    const answer = await send("DELETE", "/api/community/link");
    if (answer.status === 200) {
      setState({ type: "done" });
      trackEvent("Community", "Unlink");
      router.refresh();
    } else if (answer.status === 403 && answer.data.error === "banned") setState({ type: "error", message: t("pages.communityUI.link.unlinkBanned") });
    else if (answer.status === 409) setState({ type: "error", message: t("pages.communityUI.link.notLinked") });
    else setState({ type: "error", message: refusal(t, answer) });
  }

  if (state.type === "done") {
    return (
      <p role="status" className="text-sm text-azure-400">
        {t("pages.communityUI.link.unlinkDone")}
      </p>
    );
  }
  if (state.type === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState({ type: "confirm" })}
        className="inline-flex min-h-11 items-center gap-1.5 text-chalk-400 underline underline-offset-4 hover:text-chalk-100"
      >
        <Unlink size={13} aria-hidden />
        {t("pages.communityUI.link.unlink")}
      </button>
    );
  }
  return (
    <div className="bevel-sm space-y-2 border border-night-700 bg-night-900 p-3 text-sm text-chalk-300">
      <p>{t("pages.communityUI.link.unlinkConfirm")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={unlink}
          disabled={state.type === "sending"}
          className="bevel-sm inline-flex min-h-11 items-center gap-2 bg-blood-500/20 px-3 font-semibold text-chalk-100 transition-colors hover:bg-blood-500/30 disabled:opacity-60"
        >
          <Unlink size={15} aria-hidden />
          {t("pages.communityUI.link.unlinkButton")}
        </button>
        <button
          type="button"
          onClick={() => setState({ type: "idle" })}
          disabled={state.type === "sending"}
          className="bevel-sm inline-flex min-h-11 items-center px-3 font-semibold text-chalk-300 transition-colors hover:text-chalk-100 disabled:opacity-60"
        >
          {t("pages.communityUI.link.cancel")}
        </button>
      </div>
      {state.type === "error" && (
        <p role="alert">
          <Flash tone="error">{state.message}</Flash>
        </p>
      )}
    </div>
  );
}

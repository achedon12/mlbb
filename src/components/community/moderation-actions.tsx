"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/provider";
import type { TargetKind } from "@/lib/community/constants";
import { cn } from "@/lib/utils";
import { send } from "./request";

/**
 * A moderator's buttons on one target (the queue, a thread page): hide or
 * show, delete, lock, pin, ban the author, dismiss the reports. Each one
 * goes to `/api/community/moderation`, which checks the moderator again and
 * logs the decision; the page is then read again.
 */

type Action = "hide" | "unhide" | "delete" | "lock" | "unlock" | "pin" | "unpin" | "ban" | "unban" | "dismiss";

const BUTTON = "bevel-sm inline-flex min-h-10 items-center border px-3 text-xs font-semibold transition-colors disabled:opacity-60";
const CALM = "border-night-700 text-chalk-200 hover:border-gold-500/60";
const STRONG = "border-blood-500/50 text-chalk-100 hover:border-blood-400";

export function ModerationActions({
  kind,
  id,
  hidden,
  locked = false,
  pinned = false,
  authorBanned,
  reported,
}: {
  kind: TargetKind;
  id: number;
  hidden: boolean;
  locked?: boolean;
  pinned?: boolean;
  authorBanned: boolean;
  /** Open reports exist: offer "dismiss". */
  reported: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const banId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banning, setBanning] = useState(false);
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");

  async function act(action: Action, extra: Record<string, unknown> = {}) {
    if (action === "delete" && !window.confirm(t("pages.communityUI.moderation.confirmDelete"))) return;
    setBusy(true);
    setError(null);
    const answer = await send("POST", "/api/community/moderation", { action, kind, id, ...extra });
    setBusy(false);
    if (answer.status === 200) {
      setBanning(false);
      router.refresh();
    } else setError(t("pages.communityUI.moderation.failed"));
  }

  const button = (action: Action, label: string, strong = false) => (
    <button type="button" disabled={busy} onClick={() => act(action)} className={cn(BUTTON, strong ? STRONG : CALM)}>
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hidden ? button("unhide", t("pages.communityUI.moderation.unhide")) : button("hide", t("pages.communityUI.moderation.hide"))}
        {kind === "thread" &&
          (locked ? button("unlock", t("pages.communityUI.moderation.unlock")) : button("lock", t("pages.communityUI.moderation.lock")))}
        {kind === "thread" &&
          (pinned ? button("unpin", t("pages.communityUI.moderation.unpin")) : button("pin", t("pages.communityUI.moderation.pin")))}
        {button("delete", t("pages.communityUI.moderation.delete"), true)}
        {!authorBanned && (
          <button
            type="button"
            disabled={busy}
            aria-expanded={banning}
            aria-controls={banId}
            onClick={() => setBanning((b) => !b)}
            className={cn(BUTTON, STRONG)}
          >
            {t("pages.communityUI.moderation.ban")}
          </button>
        )}
        {reported && button("dismiss", t("pages.communityUI.moderation.dismiss"))}
      </div>
      {banning && (
        <form
          id={banId}
          onSubmit={(e) => {
            e.preventDefault();
            void act("ban", { days: days === "0" ? null : Number(days), ...(note.trim() ? { note } : {}) });
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="text-xs text-chalk-400">
            {t("pages.communityUI.moderation.duration")}
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="bevel-sm mt-1 block h-10 border border-night-700 bg-night-950 px-2 text-sm text-chalk-100"
            >
              <option value="1">{t("pages.communityUI.moderation.days", { n: 1 })}</option>
              <option value="7">{t("pages.communityUI.moderation.days", { n: 7 })}</option>
              <option value="30">{t("pages.communityUI.moderation.days", { n: 30 })}</option>
              <option value="0">{t("pages.communityUI.moderation.forever")}</option>
            </select>
          </label>
          <label className="min-w-0 flex-1 text-xs text-chalk-400">
            {t("pages.communityUI.moderation.reason")}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              className="bevel-sm mt-1 block h-10 w-full border border-night-700 bg-night-950 px-2 text-sm text-chalk-100"
            />
          </label>
          <button type="submit" disabled={busy} className={cn(BUTTON, STRONG, "bg-blood-500/15")}>
            {t("pages.communityUI.moderation.confirmBan")}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-blood-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Lifts a ban, from the banned list. */
export function UnbanButton({ accountId }: { accountId: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={cn(BUTTON, CALM)}
      onClick={async () => {
        setBusy(true);
        const answer = await send("POST", "/api/community/moderation", { action: "unban", accountId });
        setBusy(false);
        if (answer.status === 200) router.refresh();
      }}
    >
      {t("pages.communityUI.moderation.unban")}
    </button>
  );
}

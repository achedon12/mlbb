"use client";

import { DatabaseBackup } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Super admin "back up now": posts to `/api/discord/admin/backup`, which
 * checks everything again, then reloads the server-rendered list.
 */
export function BackupButton() {
  const t = useT();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });

  const run = async () => {
    setStatus({ kind: "busy", text: t("pages.botUI.backingUp") });
    const response = await fetch("/api/discord/admin/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      credentials: "same-origin",
    }).catch(() => null);
    if (response?.ok) {
      setStatus({ kind: "ok", text: t("pages.botUI.backedUp") });
      startRefresh(() => router.refresh());
    } else {
      setStatus({ kind: "error", text: t(response?.status === 409 ? "pages.botUI.backupBusy" : "pages.botUI.backupFailed") });
    }
  };

  const busy = status.kind === "busy" || refreshing;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="bevel-sm inline-flex items-center gap-2 border border-gold-500/60 px-4 py-2 text-sm font-semibold text-gold-400 transition-colors hover:bg-gold-500/10 disabled:opacity-60"
      >
        <DatabaseBackup aria-hidden className="size-4" />
        {t("pages.botUI.backup")}
      </button>
      <span role="status" className={cn("text-sm", status.kind === "error" ? "text-blood-400" : "text-chalk-300")}>
        {status.text}
      </span>
    </div>
  );
}

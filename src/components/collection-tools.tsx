"use client";

import { useRef, useState } from "react";
import { Cloud, CloudOff, Download, HardDrive, Loader2, Upload, X } from "lucide-react";
import Link from "@/components/link";
import { classesChip } from "@/components/chip";
import { useT } from "@/i18n/provider";
import type { StoredOwnership } from "@/lib/collection";
import { MAX_BACKUP_BYTES, backupName, readBackup, writeBackup } from "@/lib/collection-sync";
import type { SyncNotice, SyncStatus } from "@/lib/collection-sync-client";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * The collection tool's side pieces: where the collection is saved, the
 * backup file, and the keyboard shortcuts. Kept apart from the list itself,
 * which is long enough.
 */

const ICON: Record<SyncStatus, typeof Cloud> = {
  checking: Loader2,
  browser: HardDrive,
  signedOut: HardDrive,
  saving: Loader2,
  saved: Cloud,
  offline: CloudOff,
  retrying: CloudOff,
  failed: CloudOff,
};

export function SyncLine({ status, notice, onDismiss }: { status: SyncStatus; notice: SyncNotice; onDismiss: () => void }) {
  const t = useT();
  const Icon = ICON[status];
  return (
    <div className="space-y-2 text-sm">
      <p role="status" className="flex items-start gap-2 text-chalk-400">
        <Icon
          size={16}
          aria-hidden
          className={cn(
            "mt-0.5 shrink-0",
            status === "saved" ? "text-gold-400" : "text-chalk-500",
            (status === "saving" || status === "checking") && "motion-safe:animate-spin",
          )}
        />
        <span>
          {t(`pages.collectionUI.sync_${status}`)}
          {status === "signedOut" && (
            <>
              {" "}
              <Link href="/login" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.collectionUI.syncSignIn")}
              </Link>
            </>
          )}
        </span>
      </p>
      {notice && (
        <p className="bevel-sm flex items-start gap-2 border border-gold-500/30 bg-gold-500/5 px-3 py-2 text-chalk-200">
          <span className="min-w-0 flex-1">{t(`pages.collectionUI.notice_${notice}`)}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("pages.collectionUI.dismiss")}
            className="shrink-0 text-chalk-500 hover:text-chalk-100"
          >
            <X size={16} aria-hidden />
          </button>
        </p>
      )}
    </div>
  );
}

type Pending = { collection: StoredOwnership; ignored: number };
type ImportState = "" | "size" | "json" | "format" | "version" | "empty" | "read" | "merged" | "replaced";

/**
 * Export to a JSON file and import from one. A file read is not applied
 * at once: what it holds is shown first, with the choice to add it to the
 * collection or to replace the collection with it — an inline choice, so a
 * replacement is never one stray click away.
 */
export function BackupPanel({
  collection,
  knownHeroes,
  knownSkins,
  onImport,
}: {
  collection: StoredOwnership;
  knownHeroes: ReadonlySet<string>;
  knownSkins: ReadonlySet<string>;
  onImport: (o: StoredOwnership, mode: "merge" | "replace") => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [state, setState] = useState<ImportState>("");
  const empty = collection.heros.length === 0 && collection.skins.length === 0;

  function exportFile() {
    const blob = new Blob([writeBackup(collection)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    trackEvent("Collection", "Export", undefined, collection.skins.length);
  }

  async function readFile(file: File | undefined) {
    if (input.current) input.current.value = "";
    setPending(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return setState("size");
    let text: string;
    try {
      text = await file.text();
    } catch {
      return setState("read");
    }
    const r = readBackup(text, knownHeroes, knownSkins);
    if (!r.ok) return setState(r.reason);
    setState("");
    setPending({ collection: r.collection, ignored: r.ignored });
  }

  function confirm(mode: "merge" | "replace") {
    if (!pending) return;
    onImport(pending.collection, mode);
    setPending(null);
    setState(mode === "merge" ? "merged" : "replaced");
    trackEvent("Collection", "Import", mode, pending.collection.skins.length);
  }

  return (
    <section aria-labelledby="backup-title" className="space-y-3">
      <h2 id="backup-title" className="text-xs uppercase tracking-wide text-chalk-500">
        {t("pages.collectionUI.backupTitle")}
      </h2>
      <p className="text-sm leading-relaxed text-chalk-400">{t("pages.collectionUI.backupLead")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportFile} disabled={empty} className={cn(classesChip(false, true), "inline-flex items-center gap-1.5 disabled:opacity-50")}>
          <Download size={14} aria-hidden />
          {t("pages.collectionUI.export")}
        </button>
        <button type="button" onClick={() => input.current?.click()} className={cn(classesChip(false, true), "inline-flex items-center gap-1.5")}>
          <Upload size={14} aria-hidden />
          {t("pages.collectionUI.import")}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("pages.collectionUI.import")}
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </div>
      {pending && (
        <div role="group" aria-labelledby="import-found" className="bevel-sm space-y-3 border border-gold-500/30 bg-gold-500/5 p-3 text-sm">
          <p id="import-found" className="text-chalk-200">
            {t("pages.collectionUI.importFound", { heroes: pending.collection.heros.length, skins: pending.collection.skins.length })}
            {pending.ignored > 0 && <> {t("pages.collectionUI.importIgnored", { n: pending.ignored })}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => confirm("merge")} className={classesChip(true, true)}>
              {t("pages.collectionUI.importMerge")}
            </button>
            <button type="button" onClick={() => confirm("replace")} className={classesChip(false, true)}>
              {t("pages.collectionUI.importReplace")}
            </button>
            <button type="button" onClick={() => setPending(null)} className="px-2 text-xs font-semibold text-chalk-400 hover:text-chalk-100">
              {t("pages.collectionUI.cancel")}
            </button>
          </div>
        </div>
      )}
      <p aria-live="polite" className="text-xs text-chalk-500">
        {state && t(`pages.collectionUI.import_${state}`)}
      </p>
    </section>
  );
}

export const SHORTCUTS = [
  { keys: ["/"], label: "shortcut_search" },
  { keys: ["1", "2", "3"], label: "shortcut_views" },
  { keys: ["H"], label: "shortcut_played" },
  { keys: ["N", "P"], label: "shortcut_pages" },
  { keys: ["?"], label: "shortcut_help" },
] as const;

export function ShortcutsHelp({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  const t = useT();
  return (
    // Hidden on small screens, which seldom have a keyboard; the keys still work there.
    <details open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className="hidden text-sm md:block">
      <summary aria-keyshortcuts="?" className="cursor-pointer text-xs font-semibold text-chalk-400 hover:text-gold-400">
        {t("pages.collectionUI.shortcutsTitle")}
      </summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="contents">
            <dt className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="rounded border border-night-600 px-1.5 text-[0.7rem] text-chalk-300">
                  {k}
                </kbd>
              ))}
            </dt>
            <dd className="text-xs leading-5 text-chalk-400">{t(`pages.collectionUI.${s.label}`)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-chalk-500">{t("pages.collectionUI.shortcutsHint")}</p>
    </details>
  );
}

/**
 * The tool's key for a keydown, or null when the key belongs to something
 * else: typing in a field, a modified key, a key the tool does not bind.
 * Digits are read from the physical key too: on an AZERTY keyboard, the
 * unshifted "1" key types "&".
 */
export function shortcutOf(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return null;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return null;
  const digit = /^Digit([1-3])$/.exec(e.code)?.[1];
  if (digit) return digit;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return ["/", "?", "h", "n", "p"].includes(key) ? key : null;
}

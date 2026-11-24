"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Cloud, CloudOff, Copy, ExternalLink, HardDrive, LogIn, RefreshCw, Trash2 } from "lucide-react";
import Link from "@/components/link";
import { Badges, MlbbdleFigures, ProgressCard, QuizFigures } from "@/components/progress-view";
import { useLocale, useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { emptyData, progressOf, PUBLIC_FIELDS, type PublicField, type SyncData } from "@/lib/account-sync";
import {
  deleteAccountCopy,
  readLocalProgress,
  resumeAccountSync,
  serverSyncState,
  subscribeSync,
  syncNow,
  syncState,
} from "@/lib/account-sync-client";
import { PROGRESS_EVENT, SYNCED_EVENT } from "@/lib/progress-signal";
import { dayUtc } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * The player's own progress, on the account page: figures and badges read
 * from this browser's copy (which the sync keeps in step with the account),
 * the sync state, the public page settings and the account copy's deletion.
 * Each piece is its own component, so the page places them in its sections;
 * every prop is plain data.
 */

/** This browser's progress, read after hydration and again whenever it changes. */
function useLocalProgress() {
  const [data, setData] = useState<SyncData | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      setData(readLocalProgress());
      setToday(dayUtc(new Date()));
    };
    const timer = setTimeout(read, 0);
    window.addEventListener(SYNCED_EVENT, read);
    window.addEventListener(PROGRESS_EVENT, read);
    window.addEventListener("mlbb:favoris", read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(SYNCED_EVENT, read);
      window.removeEventListener(PROGRESS_EVENT, read);
      window.removeEventListener("mlbb:favoris", read);
    };
  }, []);

  return progressOf(data ?? emptyData(), today ?? "1970-01-01");
}

/** Quiz, MLBBdle and badges: the progress section of the account page. */
export function ProgressOverview() {
  const t = useT();
  const progress = useLocalProgress();
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ProgressCard id="progress-quiz" title={t("pages.progress.quiz")} icon="trophy" action={{ href: "/quiz", label: t("pages.account.hub.play"), name: `${t("pages.account.hub.play")} ${t("pages.progress.quiz")}` }}>
          <QuizFigures quiz={progress.quiz} />
        </ProgressCard>
        <ProgressCard id="progress-mlbbdle" title={t("pages.progress.mlbbdle")} icon="puzzle" action={{ href: "/mlbbdle", label: t("pages.account.hub.play"), name: `${t("pages.account.hub.play")} ${t("pages.progress.mlbbdle")}` }}>
          <MlbbdleFigures mlbbdle={progress.mlbbdle} />
        </ProgressCard>
      </div>
      <ProgressCard id="progress-badges" title={t("pages.progress.badgesTitle")}>
        <Badges earned={progress.badges} />
      </ProgressCard>
    </div>
  );
}

/**
 * Where the progress is kept: this browser only, the account (with the
 * sync's live state), or paused. `signedIn`: a login the sync can use.
 */
export function SyncStatus({ signedIn, available }: { signedIn: boolean; available: boolean }) {
  const t = useT();
  const sync = useSyncExternalStore(subscribeSync, syncState, serverSyncState);
  const status = sync.status;
  if (!available) {
    return (
      <p className="bevel flex items-start gap-3 bg-night-900 p-4 text-sm text-chalk-300">
        <HardDrive size={18} aria-hidden className="mt-0.5 shrink-0 text-chalk-400" />
        {t("pages.progress.browserOnly")}
      </p>
    );
  }
  if (!signedIn || status === "signedOut") {
    return (
      <div className="bevel-lg flex flex-wrap items-center gap-4 bg-night-900 p-5 shadow-[inset_3px_0_0_var(--color-gold-400)]">
        <CloudOff size={24} aria-hidden className="shrink-0 text-gold-400" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-bold uppercase text-chalk-100">{t("pages.progress.signedOutTitle")}</p>
          <p className="mt-1 text-sm text-chalk-400">{t("pages.progress.signedOutText")}</p>
        </div>
        <Link href="/login" className="btn btn-primary btn-sm">
          <LogIn size={15} aria-hidden />
          {t("account.signIn")}
        </Link>
      </div>
    );
  }
  if (status === "paused") {
    return (
      <div className="bevel flex flex-wrap items-center gap-3 bg-night-900 p-4 text-sm text-chalk-300">
        <CloudOff size={18} aria-hidden className="shrink-0 text-chalk-400" />
        <p className="min-w-0 flex-1">{t("pages.progress.paused")}</p>
        <button type="button" onClick={() => void resumeAccountSync()} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} aria-hidden />
          {t("pages.progress.resume")}
        </button>
      </div>
    );
  }
  const key = status === "retrying" ? "retrying" : status === "saving" ? "saving" : status === "saved" ? "saved" : "checking";
  return (
    <p role="status" className="bevel flex items-center gap-3 bg-night-900/80 px-4 py-3 text-sm text-chalk-300">
      <span aria-hidden className={cn("relative grid size-8 shrink-0 place-items-center", status === "saved" ? "text-azure-400" : "text-chalk-400")}>
        <Cloud size={18} />
        {status === "saved" && <Check size={10} strokeWidth={3} className="absolute bottom-1.5 right-1" />}
      </span>
      <span className="min-w-0 flex-1">{t(`pages.progress.sync.${key}`)}</span>
      {status === "retrying" && (
        <button type="button" onClick={() => void syncNow()} className="min-h-10 text-xs font-semibold text-gold-400 hover:underline">
          {t("pages.progress.retry")}
        </button>
      )}
    </p>
  );
}

type Settings = { public: boolean; fields: string[]; slug: string | null };

/** The public profile's switch, its parts and its link to copy. */
export function PublicSettings() {
  const t = useT();
  const locale = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/account/profile", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<Settings>) : null))
      .then((s) => live && s && setSettings(s))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  const save = async (next: { public: boolean; fields: string[] }) => {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/account/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!r.ok) throw new Error(String(r.status));
      const saved = (await r.json()) as Settings;
      if (saved.public !== settings?.public) trackEvent("Account", "Profile public", saved.public ? "on" : "off");
      setSettings(saved);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const body = (() => {
    if (!settings) {
      return error ? <p className="text-sm text-chalk-400">{t("pages.progress.public.error")}</p> : <div className="skeleton h-12 max-w-md" />;
    }
    const url = settings.slug ? `${window.location.origin}/${locale}/u/${settings.slug}` : null;
    const toggleField = (f: PublicField) => {
      const fields = settings.fields.includes(f) ? settings.fields.filter((x) => x !== f) : [...settings.fields, f];
      void save({ public: settings.public, fields });
    };
    return (
      <>
        <label className="bevel flex min-h-12 cursor-pointer items-center gap-3 bg-night-950/70 px-4 py-3 text-sm font-semibold text-chalk-100">
          <input
            type="checkbox"
            role="switch"
            checked={settings.public}
            disabled={busy}
            onChange={(e) => void save({ public: e.target.checked, fields: settings.fields.length ? settings.fields : ["quiz", "mlbbdle", "badges"] })}
            className="size-5 accent-gold-500"
          />
          <span className="min-w-0 flex-1">{t("pages.progress.public.toggle")}</span>
          <span className={cn("bevel-sm px-2 py-0.5 text-[0.7rem] uppercase tracking-wide", settings.public ? "bg-gold-400 text-night-950" : "bg-night-800 text-chalk-400")}>
            {settings.public ? t("pages.account.hub.on") : t("pages.account.hub.off")}
          </span>
        </label>
        {settings.public && (
          <>
            <fieldset className="grid gap-1 sm:grid-cols-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-chalk-400">{t("pages.progress.public.fields")}</legend>
              {PUBLIC_FIELDS.map((f) => (
                <label key={f} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-chalk-200">
                  <input type="checkbox" checked={settings.fields.includes(f)} disabled={busy} onChange={() => toggleField(f)} className="size-4 accent-gold-500" />
                  {t(`pages.progress.public.field.${f}`)}
                </label>
              ))}
            </fieldset>
            {url && (
              <div className="bevel bg-night-950 p-3">
                <code className="block truncate text-xs text-chalk-300">{url}</code>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(url).then(
                        () => setCopied(true),
                        () => setCopied(false),
                      );
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    {copied ? t("pages.progress.public.copied") : t("pages.progress.public.copy")}
                  </button>
                  <a href={url} className="btn btn-secondary btn-sm">
                    <ExternalLink size={14} aria-hidden />
                    {t("pages.progress.public.open")}
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </>
    );
  })();

  return (
    <ProgressCard id="progress-public" title={t("pages.progress.public.title")} icon="globe">
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-chalk-400">{t("pages.progress.public.text")}</p>
        {body}
        <p className="text-xs text-chalk-500">{t("pages.progress.public.privacy")}</p>
        {error && settings && <p role="alert" className="text-sm text-blood-500">{t("pages.progress.public.error")}</p>}
      </div>
    </ProgressCard>
  );
}

/** Erasing the account's copy of the progress (hidden while the sync is paused: there is none). */
export function DeleteCopy() {
  const t = useT();
  const sync = useSyncExternalStore(subscribeSync, syncState, serverSyncState);
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (sync.status === "paused" && state !== "done") return null;
  if (state === "done") return <p role="status" className="text-sm text-chalk-400">{t("pages.progress.delete.done")}</p>;
  return (
    <section aria-labelledby="progress-delete" className="border-t border-night-800 pt-6">
      <h3 id="progress-delete" className="text-sm font-semibold text-chalk-200">{t("pages.progress.delete.title")}</h3>
      <p className="mt-1 max-w-2xl text-xs text-chalk-500">{t("pages.progress.delete.text")}</p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={state === "busy"}
            onClick={async () => {
              setState("busy");
              setState((await deleteAccountCopy()) ? "done" : "error");
            }}
            className="btn btn-sm border border-blood-500 text-blood-500"
          >
            <Trash2 size={14} aria-hidden />
            {t("pages.progress.delete.confirm")}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">
            {t("pages.progress.delete.cancel")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="mt-3 min-h-10 text-xs font-semibold text-chalk-400 underline underline-offset-4 hover:text-blood-500">
          {t("pages.progress.delete.action")}
        </button>
      )}
      {state === "error" && <p role="alert" className="mt-2 text-xs text-blood-500">{t("pages.progress.delete.error")}</p>}
    </section>
  );
}

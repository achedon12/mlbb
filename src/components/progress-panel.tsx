"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cloud, CloudOff, Globe, HardDrive, LogIn, Puzzle, RefreshCw, Star, Trash2, Trophy } from "lucide-react";
import Link from "@/components/link";
import { Badges, FavouriteList, MlbbdleFigures, ProgressSection, QuizFigures } from "@/components/progress-view";
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
 * The player's own progress page: figures and badges read from this
 * browser's copy (which the sync keeps in step with the account), the sync
 * state, the public page settings and the account copy's deletion. Signed
 * out, the same figures, with what signing in adds.
 */
export function ProgressPanel({ signedIn, available }: { signedIn: boolean; available: boolean }) {
  const t = useT();
  const sync = useSyncExternalStore(subscribeSync, syncState, serverSyncState);
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

  const progress = progressOf(data ?? emptyData(), today ?? "1970-01-01");

  return (
    <div className="space-y-12">
      <SyncBanner signedIn={signedIn} available={available} status={sync.status} />

      <ProgressSection id="progress-quiz" title={t("pages.progress.quiz")} icon={Trophy}>
        <QuizFigures quiz={progress.quiz} />
        <p className="text-xs text-chalk-500">
          <Link href="/quiz" className="font-semibold text-gold-400 hover:underline">{t("pages.progress.playQuiz")}</Link>
        </p>
      </ProgressSection>

      <ProgressSection id="progress-mlbbdle" title={t("pages.progress.mlbbdle")} icon={Puzzle}>
        <MlbbdleFigures mlbbdle={progress.mlbbdle} />
        <p className="text-xs text-chalk-500">
          <Link href="/mlbbdle" className="font-semibold text-gold-400 hover:underline">{t("pages.progress.playMlbbdle")}</Link>
        </p>
      </ProgressSection>

      <ProgressSection id="progress-badges" title={t("pages.progress.badgesTitle")}>
        <Badges earned={progress.badges} />
      </ProgressSection>

      <ProgressSection id="progress-favourites" title={t("pages.progress.favourites")} icon={Star}>
        <FavouriteList favourites={data?.favourites ?? []} />
      </ProgressSection>

      {signedIn && available && <PublicSettings />}
      {signedIn && available && sync.status !== "paused" && <DeleteCopy />}
    </div>
  );
}

function SyncBanner({ signedIn, available, status }: { signedIn: boolean; available: boolean; status: string }) {
  const t = useT();
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
    <p role="status" className="bevel flex items-center gap-3 bg-night-900 p-4 text-sm text-chalk-300">
      <Cloud size={18} aria-hidden className={cn("shrink-0", status === "saved" ? "text-azure-400" : "text-chalk-400")} />
      <span className="min-w-0 flex-1">{t(`pages.progress.sync.${key}`)}</span>
      {status === "retrying" && (
        <button type="button" onClick={() => void syncNow()} className="text-xs font-semibold text-gold-400 hover:underline">
          {t("pages.progress.retry")}
        </button>
      )}
    </p>
  );
}

type Settings = { public: boolean; fields: string[]; slug: string | null };

function PublicSettings() {
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

  if (!settings) {
    return error ? <p className="text-sm text-chalk-400">{t("pages.progress.public.error")}</p> : null;
  }

  const url = settings.slug ? `${window.location.origin}/${locale}/u/${settings.slug}` : null;
  const toggleField = (f: PublicField) => {
    const fields = settings.fields.includes(f) ? settings.fields.filter((x) => x !== f) : [...settings.fields, f];
    void save({ public: settings.public, fields });
  };

  return (
    <ProgressSection id="progress-public" title={t("pages.progress.public.title")} icon={Globe}>
      <p className="max-w-2xl text-sm text-chalk-400">{t("pages.progress.public.text")}</p>
      <label className="flex items-center gap-3 text-sm font-semibold text-chalk-100">
        <input
          type="checkbox"
          role="switch"
          checked={settings.public}
          disabled={busy}
          onChange={(e) => void save({ public: e.target.checked, fields: settings.fields.length ? settings.fields : ["quiz", "mlbbdle", "badges"] })}
          className="size-5 accent-gold-500"
        />
        {t("pages.progress.public.toggle")}
      </label>
      {settings.public && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-chalk-400">{t("pages.progress.public.fields")}</legend>
            {PUBLIC_FIELDS.map((f) => (
              <label key={f} className="flex items-center gap-3 text-sm text-chalk-200">
                <input type="checkbox" checked={settings.fields.includes(f)} disabled={busy} onChange={() => toggleField(f)} className="size-4 accent-gold-500" />
                {t(`pages.progress.public.field.${f}`)}
              </label>
            ))}
          </fieldset>
          {url && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="bevel-sm max-w-full truncate bg-night-950 px-3 py-2 text-xs text-chalk-300">{url}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(url).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
                className="btn btn-secondary btn-sm"
              >
                {copied ? t("pages.progress.public.copied") : t("pages.progress.public.copy")}
              </button>
              <a href={url} className="text-xs font-semibold text-gold-400 hover:underline">
                {t("pages.progress.public.open")}
              </a>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-chalk-500">{t("pages.progress.public.privacy")}</p>
      {error && <p role="alert" className="text-sm text-blood-500">{t("pages.progress.public.error")}</p>}
    </ProgressSection>
  );
}

function DeleteCopy() {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <p role="status" className="text-sm text-chalk-400">{t("pages.progress.delete.done")}</p>;
  return (
    <section aria-labelledby="progress-delete" className="border-t border-night-800 pt-6">
      <h2 id="progress-delete" className="text-sm font-semibold text-chalk-200">{t("pages.progress.delete.title")}</h2>
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
        <button type="button" onClick={() => setConfirming(true)} className="mt-3 text-xs font-semibold text-chalk-400 underline underline-offset-4 hover:text-blood-500">
          {t("pages.progress.delete.action")}
        </button>
      )}
      {state === "error" && <p role="alert" className="mt-2 text-xs text-blood-500">{t("pages.progress.delete.error")}</p>}
    </section>
  );
}

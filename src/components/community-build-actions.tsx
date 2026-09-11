"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, ThumbsUp, Trash2 } from "lucide-react";
import Link from "@/components/lien";
import { useLangue, useT } from "@/i18n/fournisseur";
import { prefixer } from "@/i18n/liens";
import type { BuildCode } from "@/lib/build-code";
import { LIMITS, NOTES_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/community-builds";
import { cn } from "@/lib/utils";

/**
 * Community build actions in the browser: vote, delete one's own build,
 * publish the simulator's build. Every refusal of the API (`/api/builds`)
 * turns into a sentence; nothing is retried behind the visitor's back.
 */

export function VoteButton({
  id,
  votes,
  voted,
  own,
  signedIn,
}: {
  id: string;
  votes: number;
  voted: boolean;
  /** The viewer wrote the build: no vote, only the count. */
  own: boolean;
  signedIn: boolean;
}) {
  const t = useT();
  const [state, setState] = useState({ votes, voted });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (own || !signedIn) {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 text-sm text-craie-300">
        <ThumbsUp size={16} aria-hidden className="text-craie-500" />
        <span className="tabular-nums">{t("pages.communityBuildsUI.votes", { n: state.votes })}</span>
        {!own && (
          <Link href="/login" className="text-or-400 underline underline-offset-4 hover:text-or-500">
            {t("pages.communityBuildsUI.signInToVote")}
          </Link>
        )}
      </span>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/builds/${id}/vote`, { method: "POST" });
      if (r.ok) {
        setState((await r.json()) as { votes: number; voted: boolean });
      } else if (r.status === 401) {
        setError(t("pages.communityBuildsUI.errors.signIn"));
      } else if (r.status === 429) {
        setError(t("pages.communityBuildsUI.errors.tooFast"));
      } else {
        setError(t("pages.communityBuildsUI.errors.voteFailed"));
      }
    } catch {
      setError(t("pages.communityBuildsUI.errors.voteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-pressed={state.voted}
        disabled={busy}
        onClick={toggle}
        className={cn(
          "biseau-sm flex min-h-11 items-center gap-2 px-3 text-sm font-semibold transition-colors disabled:opacity-60",
          state.voted ? "bg-or-500 text-nuit-950 hover:bg-or-400" : "border border-nuit-700 text-craie-200 hover:border-or-500/60",
        )}
      >
        <ThumbsUp size={16} aria-hidden />
        {state.voted ? t("pages.communityBuildsUI.voted") : t("pages.communityBuildsUI.vote")}
        <span className="tabular-nums">{state.votes}</span>
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs text-sang-500">
          {error}
        </span>
      )}
    </span>
  );
}

export function DeleteBuildButton({ id, hero }: { id: string; hero: string }) {
  const t = useT();
  const langue = useLangue();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(t("pages.communityBuildsUI.deleteConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/builds/${id}`, { method: "DELETE" });
      if (r.status === 204) {
        router.push(prefixer(`/builds/${hero}`, langue));
        router.refresh();
        return;
      }
      setError(r.status === 401 ? t("pages.communityBuildsUI.errors.signIn") : t("pages.communityBuildsUI.errors.deleteFailed"));
    } catch {
      setError(t("pages.communityBuildsUI.errors.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex min-h-11 items-center gap-2 border border-sang-500/50 px-3 text-sm text-craie-200 transition-colors hover:border-sang-500 hover:text-craie-100 disabled:opacity-60"
      >
        <Trash2 size={16} aria-hidden />
        {t("pages.communityBuildsUI.delete")}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs text-sang-500">
          {error}
        </span>
      )}
    </span>
  );
}

type Session = { connecte: boolean; pseudo?: string };
type Status =
  | { type: "idle" }
  | { type: "sending" }
  | { type: "done"; id: string; hero: string }
  | { type: "error"; message: string };

/** Publishing form of the simulator's current build, for signed-in players. */
export function PublishBuild({ build }: { build: BuildCode }) {
  const t = useT();
  const titleId = useId();
  const notesId = useId();
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then((r) => r.json() as Promise<Session>)
      .then((d) => !cancelled && setSession(d))
      .catch(() => !cancelled && setSession({ connecte: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = build.hero !== null && build.items.length > 0;

  function errorMessage(httpStatus: number, error: string | undefined): string {
    if (httpStatus === 400 && error === "title") return t("pages.communityBuildsUI.errors.title", { min: TITLE_MIN, max: TITLE_MAX });
    if (httpStatus === 400 && error === "notes") return t("pages.communityBuildsUI.errors.notes", { max: NOTES_MAX });
    if (httpStatus === 400 && error === "link") return t("pages.communityBuildsUI.errors.link");
    if (httpStatus === 400 && error === "build") return t("pages.communityBuildsUI.errors.build");
    if (httpStatus === 401) return t("pages.communityBuildsUI.errors.signIn");
    if (httpStatus === 429 && error === "day") return t("pages.communityBuildsUI.errors.day", { n: LIMITS.perAccountPerDay });
    if (httpStatus === 429 && error === "total") return t("pages.communityBuildsUI.errors.total", { n: LIMITS.perAccountTotal });
    if (httpStatus === 429) return t("pages.communityBuildsUI.errors.tooFast");
    return t("pages.communityBuildsUI.errors.unavailable");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setStatus({ type: "sending" });
    try {
      const r = await fetch("/api/builds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, notes, build }),
      });
      if (r.status === 201) {
        const d = (await r.json()) as { id: string; hero: string };
        setStatus({ type: "done", id: d.id, hero: d.hero });
        setTitle("");
        setNotes("");
        return;
      }
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setStatus({ type: "error", message: errorMessage(r.status, d.error) });
    } catch {
      setStatus({ type: "error", message: errorMessage(503, undefined) });
    }
  }

  const field =
    "biseau-sm mt-1 block w-full border border-nuit-700 bg-nuit-900 px-3 text-sm text-craie-100 outline-none transition-colors focus:border-or-500";

  return (
    <section aria-labelledby="publish-title" className="space-y-3">
      <h2 id="publish-title" className="font-titre text-xl font-bold text-craie-100">
        {t("pages.communityBuildsUI.publishTitle")}
      </h2>
      {session === null ? (
        <p className="text-sm text-craie-500">{t("pages.communityBuildsUI.checkingSession")}</p>
      ) : !session.connecte ? (
        <p className="text-sm text-craie-300">
          {t("pages.communityBuildsUI.signInToPublish")}{" "}
          <Link href="/login" className="text-or-400 underline underline-offset-4 hover:text-or-500">
            {t("pages.communityBuildsUI.signIn")}
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-craie-500">{t("pages.communityBuildsUI.publishAs", { name: session.pseudo ?? "" })}</p>
          <div>
            <label htmlFor={titleId} className="flex justify-between text-xs text-craie-400">
              <span>{t("pages.communityBuildsUI.titleLabel")}</span>
              <span className="tabular-nums">
                {[...title].length}/{TITLE_MAX}
              </span>
            </label>
            <input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={TITLE_MIN}
              maxLength={TITLE_MAX}
              autoComplete="off"
              className={cn(field, "h-11")}
            />
          </div>
          <div>
            <label htmlFor={notesId} className="flex justify-between text-xs text-craie-400">
              <span>{t("pages.communityBuildsUI.notesLabel")}</span>
              <span className="tabular-nums">
                {[...notes].length}/{NOTES_MAX}
              </span>
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={NOTES_MAX}
              rows={4}
              className={cn(field, "py-2")}
            />
          </div>
          <p className="text-xs leading-relaxed text-craie-500">{t("pages.communityBuildsUI.rules")}</p>
          {!ready && <p className="text-sm text-craie-400">{t("pages.communityBuildsUI.needHeroAndItem")}</p>}
          <button
            type="submit"
            disabled={!ready || status.type === "sending"}
            className="biseau-sm flex h-11 items-center gap-2 bg-or-500 px-4 text-sm font-semibold text-nuit-950 transition-colors hover:bg-or-400 disabled:opacity-50"
          >
            <Send size={16} aria-hidden />
            {status.type === "sending" ? t("pages.communityBuildsUI.publishing") : t("pages.communityBuildsUI.publish")}
          </button>
          {status.type === "done" && (
            <p role="status" className="text-sm text-craie-200">
              {t("pages.communityBuildsUI.published")}{" "}
              <Link href={`/builds/${status.hero}/${status.id}`} className="text-or-400 underline underline-offset-4 hover:text-or-500">
                {t("pages.communityBuildsUI.viewBuild")}
              </Link>
            </p>
          )}
          {status.type === "error" && (
            <p role="alert" className="text-sm text-sang-500">
              {status.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

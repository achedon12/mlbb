"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { prefix } from "@/i18n/links";
import { trackEvent } from "@/lib/analytics";
import { HERO_TAGS_MAX, REPLY_BODY_MAX, THREAD_BODY_MAX, TITLE_MAX, TITLE_MIN, type Category } from "@/lib/community/constants";
import { cn } from "@/lib/utils";
import { HeroTagsInput, type HeroOption } from "./hero-tags-input";
import { QUIET } from "./post-actions";
import { refusal, send } from "./request";

/**
 * The forum's one writing form: a new thread, a reply, or the edit of
 * either. Markdown in a plain textarea, with a one-line reminder of the
 * syntax: no editor library, no preview script.
 */

export type ComposerMode =
  | { type: "thread"; category: Category }
  | { type: "reply"; threadId: number; threadPath: string }
  | { type: "editThread"; id: number; title: string; body: string; heroes: string[] }
  | { type: "editReply"; id: number; body: string };

const FIELD = "bevel-sm mt-1 block w-full border border-night-700 bg-night-900 px-3 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";

export function Composer({ mode, heroes = [], onDone }: { mode: ComposerMode; heroes?: HeroOption[]; onDone?: () => void }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const ids = { title: useId(), body: useId(), hint: useId() };
  const isThread = mode.type === "thread" || mode.type === "editThread";
  const [title, setTitle] = useState(mode.type === "editThread" ? mode.title : "");
  const [body, setBody] = useState(mode.type === "editThread" || mode.type === "editReply" ? mode.body : "");
  const [tags, setTags] = useState<string[]>(mode.type === "editThread" ? mode.heroes : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = isThread ? THREAD_BODY_MAX : REPLY_BODY_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const answer =
      mode.type === "thread"
        ? await send("POST", "/api/community/threads", { category: mode.category, title, body, heroes: tags })
        : mode.type === "reply"
          ? await send("POST", `/api/community/threads/${mode.threadId}/replies`, { body })
          : mode.type === "editThread"
            ? await send("PATCH", `/api/community/threads/${mode.id}`, { title, body, heroes: tags })
            : await send("PATCH", `/api/community/posts/${mode.id}`, { body });
    setBusy(false);
    if (answer.status !== 200 && answer.status !== 201) {
      setError(refusal(t, answer, !isThread));
      return;
    }
    if (mode.type === "thread") {
      trackEvent("Community", "Thread", mode.category);
      router.push(prefix(String(answer.data.path), locale));
      return;
    }
    if (mode.type === "reply") {
      trackEvent("Community", "Reply");
      setBody("");
      const page = Number(answer.data.page) || 1;
      router.push(prefix(`${mode.threadPath}${page > 1 ? `?page=${page}` : ""}#post-${String(answer.data.id)}`, locale));
      router.refresh();
      return;
    }
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {isThread && (
        <div>
          <label htmlFor={ids.title} className="flex justify-between text-xs text-chalk-400">
            <span>{t("pages.communityUI.titleLabel")}</span>
            <span className="tabular-nums">
              {[...title].length}/{TITLE_MAX}
            </span>
          </label>
          <input
            id={ids.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={TITLE_MIN}
            maxLength={TITLE_MAX}
            autoComplete="off"
            className={cn(FIELD, "h-11")}
          />
        </div>
      )}
      <div>
        <label htmlFor={ids.body} className="flex justify-between text-xs text-chalk-400">
          <span>{isThread ? t("pages.communityUI.bodyLabel") : t("pages.communityUI.replyLabel")}</span>
          <span className="tabular-nums">
            {[...body].length}/{max}
          </span>
        </label>
        <textarea
          id={ids.body}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={max}
          rows={isThread ? 8 : 4}
          aria-describedby={ids.hint}
          className={cn(FIELD, "py-2 leading-relaxed")}
        />
        <p id={ids.hint} className="mt-1 text-xs text-chalk-500">
          {t("pages.communityUI.markdownHint")}
        </p>
      </div>
      {isThread && (
        <HeroTagsInput
          heroes={heroes}
          value={tags}
          onChange={setTags}
          max={HERO_TAGS_MAX}
          label={t("pages.communityUI.heroesLabel")}
          hint={t("pages.communityUI.heroesHint", { n: HERO_TAGS_MAX })}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bevel-sm inline-flex min-h-11 items-center gap-2 bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
        >
          <Send size={16} aria-hidden />
          {busy
            ? t("pages.communityUI.sending")
            : mode.type === "thread"
              ? t("pages.communityUI.publishThread")
              : mode.type === "reply"
                ? t("pages.communityUI.publishReply")
                : t("pages.communityUI.save")}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className={QUIET}>
            {t("pages.communityUI.cancel")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-blood-400">
          {error}
        </p>
      )}
    </form>
  );
}

/** "New thread": the form stays folded behind a button until asked for, so the list comes first. */
export function NewThread({ category, heroes }: { category: Category; heroes: HeroOption[] }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="bevel-sm inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
      >
        {t("pages.communityUI.newThread")}
      </button>
      {open && (
        <div id={id} className="bevel mt-4 border border-night-700 bg-night-900/70 p-4 sm:p-6">
          <Composer mode={{ type: "thread", category }} heroes={heroes} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

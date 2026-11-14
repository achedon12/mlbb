"use client";

import { useId, useState } from "react";
import { useT } from "@/i18n/provider";
import { Composer } from "./composer";
import type { HeroOption } from "./hero-tags-input";
import { DeleteButton, EditToggle, ReportButton, VoteButton } from "./post-actions";

/**
 * A post's text and the actions under it. The HTML comes from the server,
 * already through the sanitizer (`src/lib/community/markdown.ts`); the
 * author's Markdown source is only sent along when they may still edit it.
 */
export function PostShell({
  kind,
  id,
  html,
  score,
  voted,
  own,
  signedIn,
  edit,
  deletable,
  afterDelete,
  heroes,
}: {
  kind: "thread" | "post";
  id: number;
  html: string;
  score: number;
  voted: boolean;
  own: boolean;
  signedIn: boolean;
  /** The source, when the viewer wrote it and may still edit it. */
  edit: { body: string; title?: string; heroes?: string[] } | null;
  deletable: boolean;
  /** Where to go once deleted: the category for a thread, null to stay. */
  afterDelete: string | null;
  heroes?: HeroOption[];
}) {
  const t = useT();
  const editorId = useId();
  const [editing, setEditing] = useState(false);

  return (
    <div>
      {editing && edit ? (
        <div id={editorId} className="mt-1">
          <p className="sr-only" role="status">
            {t("pages.communityUI.editing")}
          </p>
          <Composer
            mode={
              kind === "thread"
                ? { type: "editThread", id, title: edit.title ?? "", body: edit.body, heroes: edit.heroes ?? [] }
                : { type: "editReply", id, body: edit.body }
            }
            heroes={heroes}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : (
        // Sanitized on the server: allowlisted tags, http(s) links only.
        <div className="prose-mlbb break-words text-[0.95rem]" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0">
        <VoteButton kind={kind} id={id} score={score} voted={voted} own={own} signedIn={signedIn} />
        {edit && <EditToggle expanded={editing} controls={editorId} onClick={() => setEditing((e) => !e)} />}
        {own && deletable && <DeleteButton kind={kind} id={id} after={afterDelete} />}
        {!own && <ReportButton kind={kind} id={id} signedIn={signedIn} />}
      </div>
    </div>
  );
}

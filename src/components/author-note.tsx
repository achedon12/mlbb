import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { toHtml } from "@/lib/content";
import { EDITORIAL_LOCALE, readAuthor, readNote, type AuthorNote as Note, type NoteKind } from "@/lib/editorial";
import { cleanGuideHtml } from "@/lib/html";
import { longDate } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * The author's signed text on a patch or on the tier list: a bevelled surface
 * with a gold edge, the text in the author's words, and the signature (name,
 * rank, date) under it.
 *
 * The text is never translated: in every other language it is shown in
 * French, marked as such (`lang="fr"` for screen readers and the browser's own
 * translator, one line saying so for the reader). Renders nothing when there is
 * no text, so a page never shows an empty or placeholder opinion.
 */
export function AuthorNote({
  kind,
  version,
  locale,
  className,
}: {
  kind: NoteKind;
  version: string;
  locale: Locale;
  className?: string;
}) {
  const note = readNote(kind, version);
  if (!note) return null;
  return <AuthorNoteView note={note} locale={locale} profile={readAuthor() !== null} className={className} />;
}

/** The rendering alone, for a note already read (and for the tests). */
export function AuthorNoteView({
  note,
  locale,
  profile,
  className,
}: {
  note: Note;
  locale: Locale;
  /** The author's profile is published: the name links to it. */
  profile: boolean;
  className?: string;
}) {
  const t = createT(locale);
  const id = `author-note-${note.kind}`;
  const heading =
    note.kind === "patchs" ? t("editorial.note.titlePatch", { version: note.key }) : t("editorial.note.titleTierList");
  const name = <strong className="font-semibold text-chalk-100">{note.name}</strong>;

  return (
    <aside
      aria-labelledby={id}
      data-author-note={note.kind}
      className={cn("bevel max-w-3xl bg-night-900 p-5 shadow-[inset_3px_0_0_var(--color-gold-400)] sm:p-7", className)}
    >
      <h2 id={id} className="font-heading text-lg font-bold uppercase leading-tight text-gold-400 sm:text-xl">
        {heading}
      </h2>
      <div lang={EDITORIAL_LOCALE}>
        {note.title && <p className="type-subtitle mt-3 text-chalk-100">{note.title}</p>}
        <div
          className="prose-mlbb mt-3"
          dangerouslySetInnerHTML={{ __html: cleanGuideHtml(toHtml(note.body), locale) }}
        />
      </div>
      {locale !== EDITORIAL_LOCALE && <p className="mt-4 text-xs text-chalk-500">{t("editorial.original")}</p>}
      <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-night-700 pt-4 text-sm text-chalk-400">
        <span aria-hidden>—</span>
        {profile ? (
          <Link href="/about#auteur" className="transition-colors hover:text-gold-400">
            {name}
          </Link>
        ) : (
          name
        )}
        {note.rank && (
          <>
            <span aria-hidden>·</span>
            <span>{t("editorial.note.rank", { rank: note.rank })}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <time dateTime={note.date}>{t("editorial.note.written", { date: longDate(locale, note.date) })}</time>
      </p>
    </aside>
  );
}

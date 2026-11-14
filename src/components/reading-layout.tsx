import { Foldable } from "@/components/foldable";
import { PatchToc, type Entry } from "@/components/patch-toc";
import { cn } from "@/lib/utils";

/**
 * Layout of every page that is read rather than browsed: news, guides,
 * legal and about pages.
 *
 * The text keeps about seventy characters a line whatever the screen; the
 * width around it is given to what helps the reading. From `lg` up the table
 * of contents sits on the left, sticky and following the reading; from `xl`
 * up the `aside` (heroes mentioned, related guides or articles) takes a
 * column on the right. Below, the table of contents folds above the text and
 * the aside follows it, laid out across the width.
 */
export function ReadingLayout({
  toc,
  tocLabel,
  aside,
  className,
  children,
}: {
  /** Headings of the text; no table of contents under two. */
  toc?: Entry[];
  /** Label of the folded table of contents on narrow screens. */
  tocLabel: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const hasToc = (toc?.length ?? 0) > 1;
  return (
    <div
      className={cn(
        "page-wrap lg:grid lg:justify-center lg:gap-x-10 2xl:gap-x-14",
        hasToc
          ? aside
            ? "lg:grid-cols-[13rem_minmax(0,70ch)] xl:grid-cols-[13rem_minmax(0,70ch)_minmax(16rem,20rem)] 2xl:grid-cols-[15rem_minmax(0,70ch)_22rem]"
            : "lg:grid-cols-[13rem_minmax(0,70ch)] 2xl:grid-cols-[15rem_minmax(0,70ch)]"
          : aside
            ? "lg:grid-cols-[minmax(0,70ch)_minmax(16rem,20rem)] 2xl:grid-cols-[minmax(0,70ch)_22rem]"
            : "lg:grid-cols-[minmax(0,70ch)]",
        className,
      )}
    >
      {hasToc && (
        <>
          <Foldable label={tocLabel} className="mb-6 lg:hidden">
            <ol className="space-y-1.5">
              {toc!.map((h) => (
                <li key={h.anchor}>
                  <a href={`#${h.anchor}`} className="text-chalk-300 transition-colors hover:text-gold-400">
                    {h.title}
                  </a>
                </li>
              ))}
            </ol>
          </Foldable>
          <aside className="hidden lg:block">
            <PatchToc entries={toc!} />
          </aside>
        </>
      )}
      <article className="min-w-0 max-w-[70ch]">{children}</article>
      {aside && (
        <aside
          className={cn(
            "mt-12 min-w-0 space-y-8 border-t border-night-800 pt-8",
            // Beside the text from `xl` with a table of contents, from `lg` without one.
            hasToc
              ? "lg:col-span-2 lg:col-start-1 lg:mt-14 xl:sticky xl:top-24 xl:col-span-1 xl:col-start-auto xl:mt-0 xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto xl:border-t-0 xl:pt-0 xl:[scrollbar-width:thin]"
              : "lg:sticky lg:top-24 lg:mt-0 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:border-t-0 lg:pt-0 lg:[scrollbar-width:thin]",
          )}
        >
          {aside}
        </aside>
      )}
    </div>
  );
}

/** A titled block of the aside: a small heading and its content. */
export function AsideBlock({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-heading text-lg font-bold text-chalk-100">
        {title}
      </h2>
      <div aria-hidden className="gold-rule mt-1.5 h-0.5 w-12" />
      <div className="mt-4">{children}</div>
    </section>
  );
}

import { cn } from "@/lib/utils";

/**
 * Layout of a tool page: the tool on the width of the page, its notes (the
 * method, the sources, the links to related tools) in a column beside it
 * from `xl` up, under it below. The notes are read once; the tool is used
 * every time, and gets the room.
 */
export function ToolLayout({
  aside,
  className,
  children,
}: {
  aside?: React.ReactNode;
  /** Vertical rhythm of the page, kept from the stacked layout. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "page-wrap",
        aside && "xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-x-12 2xl:grid-cols-[minmax(0,1fr)_26rem]",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {aside && (
        <aside className="mt-12 min-w-0 space-y-10 text-[0.95rem] xl:mt-0 xl:border-l xl:border-night-800 xl:pl-8 [&_h2]:text-xl xl:[&_.grid]:grid-cols-1">
          {aside}
        </aside>
      )}
    </div>
  );
}

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explanation folded away.
 *
 * Method notes, reading keys and source lists are worth keeping — a reader
 * must be able to challenge a figure — but they are not what the page is
 * about, and read one after another they push the actual content off the
 * screen. They go here: a `<details>` closed by default, whose content stays
 * in the document (search engines and the content smoke check still see it)
 * and opens without a line of JavaScript.
 *
 * No absolute or animated height: a closed block occupies its summary and
 * nothing else, so nothing moves while the page loads.
 */
export function Foldable({
  label,
  open = false,
  id,
  className,
  children,
}: {
  /** Summary line, always visible ("Method and sources"). */
  label: string;
  /** Open on load; closed by default, which is the point of the component. */
  open?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className={cn("foldable bevel group border border-night-700/70 bg-night-900/60", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-heading text-sm font-bold text-gold-400 outline-none transition-colors hover:text-gold-500 focus-visible:ring-2 focus-visible:ring-gold-500 sm:text-base [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <ChevronDown
          size={18}
          aria-hidden
          className="shrink-0 text-chalk-500 transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-night-800 px-4 py-4 text-sm leading-relaxed text-chalk-300">{children}</div>
    </details>
  );
}

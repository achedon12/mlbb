import { cn } from "@/lib/utils";

/**
 * The mark of a visual that may not be the final one: a skin's artwork put
 * up ahead of its release, a skin announced but not out yet. Set on the
 * visual itself, so a screenshot of it carries the warning. No translation
 * inside: the server-rendered and the client-side cards share it, each
 * passes its text (`visualStatus.provisional`, `visualStatus.provisionalHint`).
 */
export function ProvisionalBadge({ label, hint, className }: { label: string; hint?: string; className?: string }) {
  return (
    <span
      title={hint}
      className={cn(
        "bevel-sm pointer-events-none z-20 inline-block border border-gold-400/70 bg-night-950/90 px-1.5 py-0.5 font-heading text-[0.7rem] font-bold uppercase leading-none tracking-wide text-gold-300",
        className,
      )}
    >
      {label}
      {hint && <span className="sr-only"> : {hint}</span>}
    </span>
  );
}

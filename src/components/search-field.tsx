import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Search field with a magnifier, shared by the hero catalogue, the items and
 * the draft. The magnifier sits above the field: otherwise the field's
 * background, which forms its own stacking context, covered it.
 */
export function SearchField({
  value,
  onChange,
  label,
  dense = false,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder text, and field name for screen readers. */
  label: string;
  dense?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={dense ? 16 : 18}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-chalk-500"
      />
      <input
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className={cn(
          "bevel-sm w-full border border-night-700 text-chalk-100 outline-none transition-colors placeholder:text-chalk-500 focus:border-gold-500",
          dense ? "bg-night-950 py-2 pl-9 pr-3" : "bg-night-900 py-2.5 pl-10 pr-4",
        )}
      />
    </div>
  );
}

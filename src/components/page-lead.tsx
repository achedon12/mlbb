"use client";

import { ChevronDown } from "lucide-react";
import { useT } from "@/i18n/provider";
import { splitLead, LEAD_SHORT } from "@/lib/lead";

/**
 * Opening paragraph of a page.
 *
 * Short lead: a plain paragraph. Long lead: the first sentence stays visible,
 * clamped to two lines on a phone, and the rest waits under a "Learn more"
 * line. The whole thing is a `<details>`: the text never leaves the document,
 * it opens with a tap or with the keyboard, and it needs no JavaScript —
 * which matters, since this sits above the fold on every page of the site.
 */
export function PageLead({ lead }: { lead: string }) {
  const t = useT();
  const { visible, rest } = splitLead(lead);

  // Nothing to fold and nothing to clamp: the paragraph stands on its own.
  if (!rest && visible.length <= LEAD_SHORT) {
    return <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chalk-300 sm:text-base">{visible}</p>;
  }

  return (
    <details className="group mt-3 max-w-2xl">
      <summary className="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-gold-500 [&::-webkit-details-marker]:hidden">
        {/* `line-clamp` sets its own display: no `block` here, it would win and
            the clamp would do nothing. */}
        <span className="line-clamp-2 text-sm leading-relaxed text-chalk-300 group-open:line-clamp-none sm:line-clamp-none sm:text-base">
          {visible}
        </span>
        {/* On a wide screen the first sentence is whole already: the line only
            shows when something is actually hidden. */}
        <span
          className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold-400 group-open:text-chalk-500 ${rest ? "" : "sm:hidden"}`}
        >
          <span className="group-open:sr-only">{t("common.readMore")}</span>
          <ChevronDown size={14} aria-hidden className="transition-transform duration-150 group-open:rotate-180" />
        </span>
      </summary>
      {rest && <p className="mt-2 text-sm leading-relaxed text-chalk-300 sm:text-base">{rest}</p>}
    </details>
  );
}

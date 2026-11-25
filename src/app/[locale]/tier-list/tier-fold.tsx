"use client";

import { useState } from "react";
import { Foldable } from "@/components/foldable";
import Link from "@/components/link";
import { TierLines, type LabelsTier, type RowTier } from "./tier-lines";
import type { LabelsPeek, PeekDict } from "./tier-peek";

/**
 * A folded tier of the tier list.
 *
 * Its full rows (icon, rates, the preview with counters and items) are most
 * of the page's markup and pictures, for tiers most visitors never open. So
 * the closed fold holds the heroes' names alone, each a link to their page:
 * a crawler follows them and the browser's find-in-page still reaches them
 * (finding one opens the fold). The full rows mount on the first opening.
 */
export function TierFold({
  label,
  rows,
  labels,
  dict,
  peekLabels,
}: {
  label: string;
  rows: RowTier[];
  labels: LabelsTier;
  dict?: PeekDict;
  peekLabels?: LabelsPeek;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <Foldable label={label} className="mt-4" onToggle={(open) => open && setOpened(true)}>
      {opened ? (
        <TierLines rows={rows} labels={labels} dict={dict} peekLabels={peekLabels} />
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {rows.map((l) => (
            <li key={l.slug}>
              <Link href={`/heroes/${l.slug}`} prefetch={false} className="text-chalk-300 hover:text-gold-300">
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Foldable>
  );
}

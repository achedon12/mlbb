"use client";

import Link from "@/components/link";
import { LightImage } from "@/components/light-image";
import { usualPortrait } from "@/components/meta/portraits";
import "@/components/meta/meta.css";
import type { LabelsTier, RowTier } from "./tier-lines";

/**
 * The heroes of an open tier, as cards: the tall portrait first, the name in
 * the display face, the win rate as the card's figure (its week's move in
 * ally blue or enemy red), ban and pick beside it, the editorial note under.
 *
 * Client component for the same weight reason as `TierLines`: only the
 * values travel in the page data, and the markup carries named classes
 * (`meta.css`), not the same utilities thirty times.
 */
export function TierTiles({ rows, labels, start = 0 }: { rows: RowTier[]; labels: LabelsTier; start?: number }) {
  return (
    <ul className="tt-grid">
      {rows.map((l, i) => {
        const portrait = l.portrait === undefined ? usualPortrait(l.slug) : l.portrait;
        return (
          <li key={l.slug}>
            <Link href={`/heroes/${l.slug}`} className="tt-card">
              <span className="tt-art">
                {portrait ? (
                  // 100 × 162 CSS pixels at most; the optimiser sends the 2x.
                  <LightImage src={portrait} alt="" width={100} height={162} immediate={start + i < 6} />
                ) : (
                  <i aria-hidden className="tt-initials">
                    {l.name.slice(0, 2)}
                  </i>
                )}
                <span aria-hidden className="tt-rank">
                  {start + i + 1}
                </span>
              </span>
              <span className="tt-body">
                <span className="tt-name">
                  <span>{l.name}</span>
                  {l.weak && (
                    <span className="tt-weak" title={labels.tooFew}>
                      *
                    </span>
                  )}
                </span>
                <span className="tt-lanes">{l.lanes}</span>
                {l.note && <span className="tt-note">{l.note}</span>}
                <dl className="tt-rates">
                  <div>
                    <dt>{labels.win}</dt>
                    <dd>
                      {l.win}
                      {l.trend && (
                        <span className={`tt-trend ${l.trend.rise ? "is-up" : "is-down"}`}>
                          <span aria-hidden>
                            {l.trend.rise ? "↑" : "↓"}
                            {l.trend.text}
                          </span>
                          <span className="sr-only"> {l.trend.description}</span>
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{labels.ban}</dt>
                    <dd>{l.ban}</dd>
                  </div>
                  <div>
                    <dt>{labels.pick}</dt>
                    <dd>{l.pick}</dd>
                  </div>
                </dl>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import Link from "@/components/link";
import { usualIcon } from "@/lib/tier-list-filters";
import { cn } from "@/lib/utils";

/**
 * Rows of one tier list tier.
 *
 * Client component for a weight reason: rendered by the server, each
 * row was written twice in the page, as HTML then in the React
 * data that comes with it (over 300 KB for 132 heroes). Here only the
 * values travel, one compact row per hero, and the markup is written
 * only once, with no repeated class: the styles live in `globals.css`.
 * Texts and numbers arrive formatted, nothing to translate here.
 */
export interface RowTier {
  slug: string;
  name: string;
  /** Icon somewhere other than its usual slot; null when there is none. */
  icon?: string | null;
  /** The hero's lanes, already translated and joined. */
  lanes: string;
  win: string;
  ban: string;
  pick: string;
  /** Seven-day change: arrow and gap, and its description for screen readers. */
  trend?: { rise: boolean; text: string; description: string };
  /** Played too little for its rates to be stable. */
  weak?: boolean;
  note?: string;
}

export interface LabelsTier {
  win: string;
  ban: string;
  pick: string;
  tooFew: string;
}

export function TierLines({ rows, labels }: { rows: RowTier[]; labels: LabelsTier }) {
  return (
    <ul className="tier-rows mt-4 space-y-1.5">
      {rows.map((l) => {
        const icon = l.icon === undefined ? usualIcon(l.slug) : l.icon;
        return (
          <li key={l.slug}>
            <Link href={`/heroes/${l.slug}`} className="tier-row">
              {icon ? (
                // Icon already shrunk at sync time (webp of 4 to 10 KB),
                // served as is: next/image added its attributes to
                // each row for no gain. The name follows, hence the empty alt.
                // eslint-disable-next-line @next/next/no-img-element -- file already shrunk, served as is (see above)
                <img src={icon} alt="" width={40} height={40} loading="lazy" className="tier-row-icon" />
              ) : (
                <span aria-hidden className="tier-row-icon grid place-items-center font-heading text-sm font-bold text-chalk-500">
                  {initials(l.name)}
                </span>
              )}

              <div className="tier-row-identity">
                <span className="tier-row-name">{l.name}</span>
                {l.weak && (
                  <span className="ml-1 text-gold-400" title={labels.tooFew}>
                    *
                  </span>
                )}
                <span className="tier-row-lanes">{l.lanes}</span>
              </div>

              {/* The win rate, first, is highlighted by the stylesheet. */}
              <dl className="tier-row-rates">
                <Rate label={labels.win} value={l.win} trend={l.trend} />
                <Rate label={labels.ban} value={l.ban} />
                <Rate label={labels.pick} value={l.pick} />
              </dl>

              {l.note && <p className="tier-row-note">{l.note}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Rate({ label, value, trend }: { label: string; value: string; trend?: RowTier["trend"] }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {trend && (
          <span className={cn("tier-rate-trend", trend.rise ? "text-emerald-400" : "text-blood-500")}>
            <span aria-hidden>
              {trend.rise ? "↑" : "↓"}
              {trend.text}
            </span>
            <span className="sr-only"> {trend.description}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}

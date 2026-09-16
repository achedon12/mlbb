import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { Foldable } from "@/components/foldable";
import Link from "@/components/link";
import { PageLead } from "@/components/page-lead";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Section title, with the gold rule borrowed from the game's interface.
 *
 * Compact on a phone, like `PageHeader`: nine of these stacked on the home
 * page cost a screen and a half of headings alone. The lead keeps its three
 * lines from `sm` up and is clamped to two below, where it is a caption and
 * not the section itself.
 */
export function SectionTitle({
  children,
  lead,
  action,
}: {
  children: React.ReactNode;
  lead?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 sm:mb-8">
      <div>
        <h2 className="font-heading text-xl font-bold text-chalk-100 sm:text-3xl">{children}</h2>
        <div aria-hidden className="gold-rule mt-1.5 h-0.5 w-16 sm:mt-2" />
        {lead && <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-chalk-500 sm:mt-3 sm:line-clamp-none">{lead}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}


/** Colours of a tier, reused by the statistics table. */
export const COLOR_TIER: Record<Tier, string> = {
  "S+": "bg-blood-500 text-night-950",
  S: "bg-gold-500 text-night-950",
  A: "bg-azure-500 text-night-950",
  B: "bg-night-600 text-chalk-100",
  C: "bg-night-700 text-chalk-300",
};

export function BadgeTier({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "bevel-sm grid size-9 shrink-0 place-items-center font-heading text-base font-bold",
        COLOR_TIER[tier],
      )}
    >
      {tier}
    </span>
  );
}

/** Generic card: dark bevelled surface, used everywhere. */
export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bevel border border-night-700/70 bg-night-900/60 p-5 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Page header banner, shared by all sections.
 *
 * Compact on purpose: it used to take the whole first screen of a phone —
 * breadcrumb, oversized title, rule, four lines of lead — and push the first
 * hero card, the first tier row or the first field of a tool out of sight.
 * Padding is tighter, the breadcrumb is one small line, and the lead is
 * handled by `PageLead`: first sentence visible, clamped to two lines on a
 * phone, the rest folded under it without a line of JavaScript.
 *
 * Three optional slots keep pages from rebuilding the same thing: `meta`, a
 * row of small facts ("133 heroes", "patch 2.1.90"); `actions`, the links or
 * buttons of the page, aligned with the title; and `details`, an explanation
 * folded into a closed `Foldable` — where a method note belongs, rather than
 * between the filters and the content.
 */
export function PageHeader({
  title,
  lead,
  crumbs,
  icon,
  meta,
  actions,
  details,
  children,
}: {
  title: string;
  lead: string;
  /** Breadcrumb; by default, the page alone under the home page. */
  crumbs?: Crumb[];
  /** Visual placed before the title (item, emblem or spell icon). */
  icon?: React.ReactNode;
  /** Short facts shown as chips under the title; empty entries are dropped. */
  meta?: React.ReactNode[];
  /** Links or buttons of the page, on the title's line from `sm` up. */
  actions?: React.ReactNode;
  /** Method note, reading key or sources, folded closed under the lead. */
  details?: { label: string; content: React.ReactNode };
  children?: React.ReactNode;
}) {
  const h1 = <h1 className="font-heading text-2xl font-bold text-chalk-100 sm:text-3xl lg:text-4xl">{title}</h1>;
  const facts = meta?.filter(Boolean) ?? [];
  return (
    <div className="border-b border-night-700/70 bg-night-900/30">
      <div className="mx-auto max-w-6xl px-4 pb-5 pt-3 sm:pb-8 sm:pt-5">
        <Breadcrumb
          crumbs={crumbs ?? [{ name: title }]}
          className="mb-2.5 [&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs sm:mb-3"
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {icon ? (
            <div className="flex min-w-0 items-center gap-3">
              {icon}
              <div className="min-w-0">{h1}</div>
            </div>
          ) : (
            h1
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <PageLead lead={lead} />
        {facts.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-chalk-500">
            {facts.map((fact, i) => (
              <li key={i} className="bevel-sm border border-night-700/70 bg-night-950/50 px-2 py-1">
                {fact}
              </li>
            ))}
          </ul>
        )}
        {details && (
          <Foldable label={details.label} className="mt-4 max-w-2xl">
            {details.content}
          </Foldable>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * In-game rating, shown as a bar rather than a bare number: two heroes can be
 * compared at a glance, which a lone value does not allow.
 */
export function Gauge({
  value,
  max = 10,
  text,
}: {
  value: number;
  max?: number;
  /** Displayed value, already formatted for the locale (an average with decimals). */
  text?: string;
}) {
  const part = Math.max(0, Math.min(1, value / max));

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-1.5 flex-1 bg-night-700">
        <span
          className={cn("block h-full", part >= 0.8 ? "bg-gold-400" : "bg-azure-500")}
          style={{ width: `${part * 100}%` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-chalk-300">
        {text ?? value}
      </span>
      {/* "/ 10" reads the same in every language: the gauge is also used outside client components. */}
      <span className="sr-only">/ {max}</span>
    </span>
  );
}

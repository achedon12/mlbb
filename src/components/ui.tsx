import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { Foldable } from "@/components/foldable";
import Link from "@/components/link";
import { PageLead } from "@/components/page-lead";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Section title: the display face, in capitals, with the éclat under it.
 *
 * One size everywhere (2.25 to 3.5 rem, `type-section`): a section is
 * announced as loudly on a phone as on a monitor, the condensed face keeps
 * it on one or two lines. The lead stays a sentence, clamped to two lines
 * on a phone, where it is a caption and not the section itself.
 */
export function SectionTitle({
  children,
  lead,
  action,
  id,
}: {
  children: React.ReactNode;
  lead?: string;
  action?: { href: string; label: string };
  /** Id of the heading, for a section's `aria-labelledby`. */
  id?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div className="min-w-0">
        <h2 id={id} className="type-section text-chalk-100">{children}</h2>
        <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
        {lead && <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-chalk-400 sm:line-clamp-none sm:text-base">{lead}</p>}
      </div>
      {action && <ActionLink href={action.href}>{action.label}</ActionLink>}
    </div>
  );
}

/** "See all" link of a section: the condensed face, in gold, with its arrow. */
export function ActionLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

/**
 * Colours of a tier, as a fill, for the places that colour a cell or a bar
 * rather than draw the crest (statistics table, the home page's split).
 */
export const COLOR_TIER: Record<Tier, string> = {
  "S+": "bg-tier-splus text-night-950",
  S: "bg-tier-s text-night-950",
  A: "bg-tier-a text-night-950",
  B: "bg-tier-b text-night-950",
  C: "bg-tier-c text-chalk-100",
};

/**
 * Tier crest: a bevelled shield coloured by tier, the letter in heavy italic
 * (`.crest`, globals.css). The insignia of the tier everywhere it is shown.
 */
export function BadgeTier({ tier, size = "md", className }: { tier: Tier; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span data-tier={tier} className={cn("crest", size === "sm" && "crest-sm", size === "lg" && "crest-lg", className)}>
      {tier}
    </span>
  );
}

/**
 * The score figure: a big number in the display face, gold, with its unit
 * smaller beside it. One per screen; `outline` draws a secondary figure.
 */
export function Score({
  value,
  unit,
  outline = false,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  outline?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("score inline-flex items-baseline", outline && "score-outline", className)}>
      {value}
      {unit && <span className="ml-[0.06em] text-[0.45em]">{unit}</span>}
    </span>
  );
}

/** Generic card: a bevelled night surface, no frame. */
export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("card border border-transparent", className)} {...props}>
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
  const h1 = <h1 className="display-caps text-[clamp(2.6rem,1.7rem+3.4vw,4.75rem)] text-chalk-100">{title}</h1>;
  const facts = meta?.filter(Boolean) ?? [];
  return (
    <div>
      <div className="page-wrap pb-6 pt-3 sm:pb-10 sm:pt-5">
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
        <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
        <PageLead lead={lead} />
        {facts.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-chalk-500">
            {facts.map((fact, i) => (
              <li key={i} className="bevel-sm bg-night-800 px-2 py-1 text-chalk-300">
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
      <div aria-hidden className="eclat-rule" />
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
  // Ten slanted notches, like the game's own rating bars.
  const lit = Math.round(part * 10);

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn("h-2 flex-1 -skew-x-[25deg]", i < lit ? (part >= 0.8 ? "bg-gold-400" : "bg-chalk-300") : "bg-night-700")}
          />
        ))}
      </span>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-chalk-300">
        {text ?? value}
      </span>
      {/* "/ 10" reads the same in every language: the gauge is also used outside client components. */}
      <span className="sr-only">/ {max}</span>
    </span>
  );
}

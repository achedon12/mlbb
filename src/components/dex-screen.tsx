import type { ReactNode } from "react";
import { Dex, type DexPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * A page where something did not go as planned (not found, an error,
 * offline): Dex, big, with a line in a bubble, beside a giant figure, the
 * title and the ways out. No data and no hook, so the client boundaries
 * (`error.tsx`, the 404 view) can render it without the site's catalogue.
 *
 * The figure is drawn outlined, as the secondary score of the design
 * system, in gold or enemy red; the title is the page's only `h1`.
 */
export function DexScreen({
  figure,
  tone = "gold",
  pose = "surpris",
  title,
  text,
  line,
  actions,
  children,
  className,
  ...rest
}: {
  figure: string;
  tone?: "gold" | "enemy";
  pose?: DexPose;
  title: string;
  text: string;
  /** What Dex says, in the bubble. */
  line: string;
  actions: ReactNode;
  /** Under the actions: more ways out. */
  children?: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean>) {
  return (
    <div {...rest} className={cn("page-wrap relative isolate overflow-hidden py-10 sm:py-16 lg:py-20", className)}>
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <div className="stage-enter order-2 min-w-0 lg:order-none">
          <p
            aria-hidden
            className={cn(
              "score score-outline affiche-name block text-[clamp(6rem,3rem+14vw,13rem)] leading-[0.78]",
              tone === "enemy" && "[-webkit-text-stroke-color:var(--text-color-blood-400)]",
            )}
          >
            {figure}
          </p>
          <h1 className="display-caps mt-4 text-[clamp(2.6rem,1.7rem+3.4vw,4.75rem)] text-chalk-100">{title}</h1>
          <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
          <p className="mt-4 max-w-xl leading-relaxed text-chalk-300 sm:text-lg">{text}</p>
          <div className="mt-7 flex flex-wrap gap-3">{actions}</div>
          {children}
        </div>
        <div className="stage-dex dex-host order-1 flex flex-col items-center lg:order-none lg:items-end">
          <div className="dex-bubble mb-3 max-w-xs font-heading text-lg font-semibold leading-snug text-chalk-100 sm:text-xl">{line}</div>
          <span className="hidden sm:block">
            <Dex pose={pose} height={340} priority />
          </span>
          <span className="block sm:hidden">
            <Dex pose={pose} height={190} priority />
          </span>
        </div>
      </div>
    </div>
  );
}

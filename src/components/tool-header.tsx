import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { Foldable } from "@/components/foldable";
import { Dex, type DexPose } from "@/components/mascot";
import { PageLead } from "@/components/page-lead";
import { toolArt } from "@/components/tool-art";
import { cn } from "@/lib/utils";
import "./tools.css";

/**
 * Poster header of a tool or game page: the tool's hero artwork across the
 * right of the header, night closing in from the left and the foot where the
 * text sits, the title in the display face and Dex standing at the edge of
 * the art in the tool's pose. The same slots as `PageHeader` (meta, actions,
 * folded details, children), so a page swaps one for the other.
 *
 * Kept short: the tool, not its poster, is what the visitor came for, and it
 * starts within the first screen even on a phone.
 */
export function ToolHeader({
  path,
  title,
  lead,
  crumbs,
  meta,
  actions,
  details,
  dex,
  children,
}: {
  /** Path of the tool (`/tools/build`), which picks its artwork and Dex's pose. */
  path: string;
  title: string;
  lead: string;
  crumbs?: Crumb[];
  meta?: React.ReactNode[];
  actions?: React.ReactNode;
  details?: { label: string; content: React.ReactNode };
  /** Dex's pose, when the page wants another than the tool's own. */
  dex?: DexPose;
  children?: React.ReactNode;
}) {
  const { art, dex: pose } = toolArt(path);
  const facts = meta?.filter(Boolean) ?? [];
  return (
    <div className="tool-affiche relative isolate overflow-hidden">
      {art && (
        <div aria-hidden className="absolute inset-0 -z-10 sm:left-auto sm:w-[68%]">
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="(min-width: 640px) 68vw, 100vw"
            className="affiche-art object-cover object-[65%_22%]"
          />
          <div className="absolute inset-0 bg-night-950/70 sm:hidden" />
          <div className="absolute inset-y-0 left-0 hidden w-3/4 bg-linear-to-r from-night-950 via-night-950/75 to-transparent sm:block" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night-950 via-night-950/60 to-transparent" />
        </div>
      )}
      <div className="page-wrap relative pb-6 pt-3 sm:pb-10 sm:pt-5">
        <Breadcrumb
          crumbs={crumbs ?? [{ name: title }]}
          className="mb-3 [&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs sm:mb-4"
        />
        <div className="flex items-end justify-between gap-4 sm:min-h-[12rem] lg:min-h-[13.5rem]">
          <div className="min-w-0 max-w-3xl flex-1">
            <h1 className="affiche-name display-caps text-[clamp(2.75rem,1.6rem+4.6vw,6rem)] text-chalk-100 [text-shadow:0_2px_24px_rgb(6_8_15/0.6)]">
              {title}
            </h1>
            <div aria-hidden className="eclat mt-4 h-1 w-28" />
            <div className="[&_p]:text-chalk-200 [&_span]:text-chalk-200">
              <PageLead lead={lead} />
            </div>
            {facts.length > 0 && (
              <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                {facts.map((fact, i) => (
                  <li key={i} className="bevel-sm bg-night-800/90 px-2 py-1 text-chalk-200">
                    {fact}
                  </li>
                ))}
              </ul>
            )}
            {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
            {details && (
              <Foldable label={details.label} className="mt-4 max-w-2xl">
                {details.content}
              </Foldable>
            )}
            {children}
          </div>
          {/* Wrapped: `.dex` sets its own display, which would beat `hidden`. */}
          <span className="hidden shrink-0 sm:block">
            <Dex pose={dex ?? pose} height={176} className="tool-dex" />
          </span>
          <span className={cn("shrink-0 self-start sm:hidden", !art && "opacity-90")}>
            <Dex pose={dex ?? pose} height={92} className="tool-dex" />
          </span>
        </div>
      </div>
      <div aria-hidden className="eclat-rule" />
    </div>
  );
}

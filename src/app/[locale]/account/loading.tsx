import { DexLoading } from "@/components/dex-loading";
import { Skeleton } from "@/components/dex-states";

/**
 * While the account hub reads the profile, stats and friends: the poster's
 * frame (picture, name, facts) and the row of section chips hold their
 * place, so the page does not jump when it lands, and Dex says what is
 * being read.
 */
export default function Loading() {
  return (
    <>
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="stage-glow" />
        <div className="page-wrap relative pb-8 pt-3 sm:pb-12 sm:pt-5">
          <Skeleton className="mb-6 h-6 w-40 sm:mb-10" />
          <div className="flex items-end gap-4 sm:gap-6">
            <Skeleton className="size-20 shrink-0 sm:size-28 lg:size-32" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-3/4 max-w-md sm:h-14" />
              <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
            </div>
          </div>
          <div aria-hidden className="mt-4 flex flex-wrap gap-1.5 sm:mt-5">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
        <div aria-hidden className="eclat-rule" />
      </div>
      <div aria-hidden className="sticky top-16 z-30 border-b border-night-800 bg-night-950/95 backdrop-blur">
        <div className="page-wrap flex gap-2 overflow-hidden py-2.5">
          {["w-24", "w-20", "w-24", "w-28", "w-20", "w-24"].map((w, i) => (
            <Skeleton key={i} className={`h-10 shrink-0 ${w}`} />
          ))}
        </div>
      </div>
      <div className="page-wrap py-10 sm:py-14">
        <DexLoading say="loadingProfile" lines={4} className="max-w-4xl" />
      </div>
    </>
  );
}

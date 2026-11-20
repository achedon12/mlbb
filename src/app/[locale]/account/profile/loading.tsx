import { DexLoading } from "@/components/dex-loading";

/** While the page reads its data: Dex hops, skeletons hold the place of the list. */
export default function Loading() {
  return (
    <div className="page-wrap py-10 sm:py-14">
      <DexLoading say="loadingProfile" lines={5} className="max-w-4xl" />
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * The site's mark and wordmark, in one place: the logo drawn by hand lives
 * in `public/brand/` (the emblem: the base crystal, half blue, half red, in a
 * winged gold crest; see `docs/logo-brief.md`), and replacing its files
 * there changes it everywhere.
 *
 * The mark is a plain `<img>`: an SVG gains nothing from the image
 * optimiser, and its fixed size reserves its room before it loads. The
 * wordmark is text in the display face ("MLBB" in chalk, "DEX" in gold),
 * so it stays sharp and costs no request. The whole is decorative next to a
 * link that already says the site's name, hence `alt=""` on the mark and
 * the wordmark's text doubling as the link's name.
 */
export function BrandMark({
  size = "md",
  wordmark = true,
  className,
}: {
  size?: "sm" | "md";
  /** Show "MLBBDex" beside the mark. */
  wordmark?: boolean;
  className?: string;
}) {
  const height = size === "sm" ? 32 : 40;
  // The emblem (crystal in the winged crest) is drawn on a 216 × 208 box.
  const px = Math.round((height * 216) / 208);
  return (
    <span className={cn("flex shrink-0 items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG at a fixed size: the optimiser has nothing to do */}
      <img
        src="/brand/emblem.svg"
        alt=""
        width={px}
        height={height}
        decoding="async"
        className="shrink-0 transition-transform duration-200 group-hover:-translate-y-px"
        style={{ width: px, height }}
      />
      {wordmark && <Wordmark className={size === "sm" ? "text-[1.35rem]" : "text-[1.6rem]"} />}
    </span>
  );
}

/** "MLBBDex" in the display face, with "Dex" in gold. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display-caps leading-none tracking-[0.01em] text-chalk-100", className)}>
      MLBB<span className="text-gold-400">Dex</span>
    </span>
  );
}

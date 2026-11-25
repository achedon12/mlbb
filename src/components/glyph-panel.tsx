import Image from "next/image";
import { cn } from "@/lib/utils";
import motion from "@/components/catalogue-motion.module.css";

/**
 * An item, emblem, spell or monster icon shown large: a bevelled night
 * panel, lit from its top edge, the éclat crossing it behind the icon. The
 * icon is the thing shown, so it gets the room, never a thumbnail.
 *
 * `flash` replays the éclat and a short turn of the icon when the panel is
 * mounted: give the panel a `key` that changes with the selection and the
 * newly chosen item lands with it. No text inside: the name is beside it.
 */
export function GlyphPanel({
  image,
  size,
  className,
  flash = false,
  priority = false,
  cover = false,
}: {
  image: string | null;
  /** Rendered size of the icon, in CSS pixels. */
  size: number;
  className?: string;
  flash?: boolean;
  priority?: boolean;
  /** A square artwork (a monster) rather than a round icon: cut to the panel. */
  cover?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "bevel-lg relative isolate grid shrink-0 place-items-center overflow-hidden bg-night-800 shadow-[inset_0_3px_0_var(--color-gold-400)]",
        flash && motion.flash,
        className,
      )}
    >
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,var(--color-night-700),var(--color-night-900)_62%,var(--color-night-950))]" />
      <span className={motion.blade} />
      <span className={motion.bladeThin} />
      {image ? (
        cover ? (
          <Image src={image} alt="" fill priority={priority} sizes={`${size * 2}px`} className={cn("object-cover", motion.glyphImage)} />
        ) : (
          <Image
            src={image}
            alt=""
            width={size}
            height={size}
            priority={priority}
            className={cn("relative object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/calc(0.55*var(--shadow-strength)))]", motion.glyphImage)}
            style={{ width: size, height: size }}
          />
        )
      ) : (
        <span className="display-caps relative text-5xl text-chalk-600">?</span>
      )}
    </span>
  );
}

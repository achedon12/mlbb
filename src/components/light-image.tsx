import { getImageProps } from "next/image";

/**
 * Fixed-size image served from a single optimised address, the 2x one.
 *
 * `next/image` writes for each image a two-address `srcset`, a `src` and a
 * style: nearly 400 bytes, more than the rest of a table row. Over 132 rows
 * or a hundred thumbnails, it was the largest item in the HTML. The address
 * is still the Next optimiser's (resized, as AVIF or WebP); only the choice
 * between 1x and 2x goes away, in favour of 2x.
 */
export function LightImage({
  src,
  alt,
  width,
  height,
  immediate = false,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Above the fold: loaded right away rather than on approach. */
  immediate?: boolean;
  className?: string;
}) {
  const { props } = getImageProps({ src, alt, width, height });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Next optimiser address, without srcset (see above)
    <img
      src={props.src}
      alt={alt}
      width={width}
      height={height}
      loading={immediate ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

const PX = { sm: 32, md: 44, lg: 64 } as const;

/**
 * A hero's face as the home page lists it: the game's round icon, set on
 * the page with no frame or ground of its own. Decorative: the name always
 * follows it. Without an icon, the name's initials in its place.
 */
export function Face({
  source,
  name,
  size = "sm",
  className,
}: {
  source: string | null | undefined;
  name: string;
  size?: keyof typeof PX;
  className?: string;
}) {
  const px = PX[size];
  if (!source) {
    return (
      <span
        aria-hidden
        style={{ width: px, height: px }}
        className={cn("grid shrink-0 place-items-center rounded-full border border-night-700 font-heading text-xs font-bold text-chalk-500", className)}
      >
        {name.slice(0, 2)}
      </span>
    );
  }
  return (
    <Image
      src={source}
      alt=""
      width={px}
      height={px}
      style={{ width: px, height: px }}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}

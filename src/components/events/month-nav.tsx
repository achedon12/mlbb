import Image from "next/image";
import Link from "@/components/link";
import { cn } from "@/lib/utils";

interface Neighbour {
  href: string;
  name: string;
  /** The month's StarLight artwork, when it has one. */
  art: string | null;
}

/**
 * Previous and next month as two slim posters, their StarLight artwork
 * behind the month's name, and the way back to every month between them.
 */
export function MonthNav({
  label,
  all,
  previous,
  next,
}: {
  label: string;
  all: string;
  previous: Neighbour | null;
  next: Neighbour | null;
}) {
  const side = (n: Neighbour, dir: "prev" | "next") => (
    <Link
      href={n.href}
      rel={dir}
      className="eclat-under group relative block min-w-0 flex-1 transition-[translate] duration-200 hover:-translate-y-0.5"
    >
      <span className="bevel relative flex h-24 items-center overflow-hidden bg-night-800 px-4 sm:h-28 sm:px-6">
        {n.art && (
          <Image
            src={n.art}
            alt=""
            fill
            sizes="(min-width: 640px) 40vw, 45vw"
            className="object-cover object-[50%_25%] opacity-60 transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.05] group-hover:opacity-90"
          />
        )}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 from-night-950 via-night-950/70 to-transparent",
            dir === "prev" ? "bg-linear-to-r" : "bg-linear-to-l",
          )}
        />
        <span
          className={cn(
            "display-caps relative w-full text-[clamp(1.5rem,1.1rem+1.4vw,2.4rem)] text-chalk-100 transition-colors group-hover:text-gold-300",
            dir === "next" && "text-right",
          )}
        >
          {dir === "prev" ? `← ${n.name}` : `${n.name} →`}
        </span>
      </span>
    </Link>
  );

  return (
    <nav aria-label={label} className="space-y-3">
      <div className="flex gap-2.5 sm:gap-4">
        {previous ? side(previous, "prev") : <span className="flex-1" />}
        {next ? side(next, "next") : <span className="flex-1" />}
      </div>
      <p className="text-center">
        <Link
          href="/events"
          className="font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
        >
          {all}
        </Link>
      </p>
    </nav>
  );
}

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
      className="eclat-under group relative block min-w-0 transition-[translate] duration-200 hover:-translate-y-0.5"
    >
      <span className="bevel relative flex h-24 items-center overflow-hidden bg-night-800 px-4 sm:h-28 sm:px-6">
        {n.art && (
          <Image
            src={n.art}
            alt=""
            fill
            sizes={previous && next ? "(min-width: 640px) 46vw, 48vw" : "96vw"}
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
    <nav aria-label={label} className="space-y-4">
      {/* The row is always full: two halves, or a single month across it. */}
      {(previous || next) && (
        <div className={cn("grid gap-2.5 sm:gap-4", previous && next && "grid-cols-2")}>
          {previous && side(previous, "prev")}
          {next && side(next, "next")}
        </div>
      )}
      <p className="flex justify-center">
        <Link href="/events" className="btn btn-secondary btn-sm">
          {all}
        </Link>
      </p>
    </nav>
  );
}

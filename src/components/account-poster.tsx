import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";

/**
 * Opening of a player's page — their own account, their public profile — as
 * a poster: an official artwork behind, night closing in from the left and
 * the foot, the slow gold glow of the home stage, then the player's picture
 * in a bevelled gold frame beside their name in the display face. On a phone
 * the picture and the name share the first line; the facts and actions wrap
 * under them.
 *
 * A server component: everything it gets is data or already-rendered nodes.
 */
export function AccountPoster({
  name,
  kicker,
  avatar,
  art,
  artPosition = "60% 20%",
  crumbs,
  meta,
  actions,
  children,
  plainAvatar = false,
}: {
  name: string;
  kicker?: React.ReactNode;
  /** Picture address, or null for the initials. */
  avatar: string | null;
  art?: string | null;
  artPosition?: string;
  crumbs?: Crumb[];
  meta?: React.ReactNode[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * A picture from an address `next/image` is not configured for (Discord's
   * CDN): drawn by a plain `<img>`, the server having checked the address.
   */
  plainAvatar?: boolean;
}) {
  const facts = meta?.filter(Boolean) ?? [];
  return (
    <div className={art ? "scheme-dark relative isolate overflow-hidden bg-night-950" : "relative isolate overflow-hidden"}>
      <div aria-hidden className="stage-glow" />
      {art && (
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 w-full lg:w-[62%]">
          <Image
            src={art}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="(min-width: 1024px) 62vw, 100vw"
            className="affiche-art object-cover opacity-60 lg:opacity-100"
            style={{ objectPosition: artPosition }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/60 to-night-950/20" />
          <div className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-night-950 via-night-950/80 to-transparent lg:w-3/4" />
        </div>
      )}
      <div className="page-wrap relative pb-8 pt-3 sm:pb-12 sm:pt-5">
        <Breadcrumb crumbs={crumbs ?? [{ name }]} className="mb-6 [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs sm:mb-10" />
        <div className="flex flex-wrap items-end gap-x-7 gap-y-5">
          <div className="flex min-w-0 flex-1 items-end gap-4 sm:gap-6">
            <span className="relative shrink-0">
              <span aria-hidden className="bevel-lg absolute -inset-[3px] bg-linear-to-br from-gold-300 via-gold-500 to-gold-700" />
              <span className="bevel-lg relative block size-20 overflow-hidden bg-night-800 sm:size-28 lg:size-32">
                {avatar ? (
                  plainAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" width={128} height={128} className="size-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Image src={avatar} alt="" fill sizes="128px" className="object-cover" />
                  )
                ) : (
                  <span className="display-caps grid size-full place-items-center text-3xl text-chalk-400 sm:text-4xl">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              {kicker && <p className="mb-1 font-heading text-sm font-bold uppercase tracking-wide text-gold-400 sm:text-base">{kicker}</p>}
              <h1 className="affiche-name display-caps break-words text-[clamp(2.3rem,1.5rem+4vw,5.5rem)] leading-[0.9] text-chalk-100">{name}</h1>
              <div aria-hidden className="eclat stage-blade mt-3 h-[3px] w-24" />
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {facts.length > 0 && (
          <ul className="mt-4 flex flex-wrap items-center gap-1.5 text-xs sm:mt-5">
            {facts.map((fact, i) => (
              <li key={i} className="bevel-sm bg-night-800/90 px-2.5 py-1.5 text-chalk-300">
                {fact}
              </li>
            ))}
          </ul>
        )}
        {children && <div className="stage-enter mt-6 sm:mt-8">{children}</div>}
      </div>
      <div aria-hidden className="eclat-rule" />
    </div>
  );
}

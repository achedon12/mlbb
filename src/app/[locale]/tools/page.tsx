import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import { Dex } from "@/components/mascot";
import { toolArt } from "@/components/tool-art";
import { ToolHeader } from "@/components/tool-header";
import { SectionTitle } from "@/components/ui";
import { TOOL_GROUPS, type Entry } from "@/lib/sections";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.toolsHub.metaTitle"),
    description: t("pages.toolsHub.metaDescription"),
    path: "/tools",
  });
}

/** The marquee of the menu: the draft, then the two games of the day. */
const MARQUEE = "/draft";
const DAILY = ["/mlbbdle", "/quiz"];

/**
 * Tools hub, built as an arcade menu: every tool is a big card with its
 * hero's artwork, its name in the display face and what it does in one
 * line. The draft and the two daily games open the menu; the rest follows by
 * what it is for — the same groups as the header's Tools panel, from
 * `TOOL_GROUPS`, so a tool added there appears here with no other change.
 */
export default async function ToolsPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const all = TOOL_GROUPS.flatMap((g) => g.entries);
  const count = new Set(all.map((e) => e.href)).size;
  const find = (href: string) => all.find((e) => e.href === href);
  const marquee = find(MARQUEE);
  const daily = DAILY.flatMap((h) => find(h) ?? []);
  const featured = new Set([MARQUEE, ...DAILY]);

  return (
    <>
      <ToolHeader
        path="/tools"
        title={t("pages.toolsHub.title")}
        lead={t("pages.toolsHub.lead")}
        meta={[t("pages.toolsHub.nTools", { n: count })]}
      >
        <p className="game-bubble mt-4 max-w-md text-sm max-sm:hidden">{t("pages.toolsHub.hello")}</p>
      </ToolHeader>

      <div className="tool-enter page-wrap space-y-14 py-8 sm:space-y-20 sm:py-12">
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[3fr_2fr]">
          {marquee && (
            <ArcadeCard
              entry={marquee}
              label={t(`nav.${marquee.key}.label`)}
              desc={t(`nav.${marquee.key}.desc`)}
              cta={t("pages.toolsHub.open")}
              size="marquee"
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-1">
            {daily.map((e) => (
              <ArcadeCard
                key={e.href}
                entry={e}
                label={t(`nav.${e.key}.label`)}
                desc={t(`nav.${e.key}.desc`)}
                cta={t("pages.toolsHub.play")}
                size="game"
              />
            ))}
          </div>
        </div>

        {TOOL_GROUPS.map((group) => {
          const entries = group.entries.filter((e) => !featured.has(e.href));
          if (entries.length === 0) return null;
          const heading = `tools-${group.key}`;
          return (
            <section key={group.key} aria-labelledby={heading} className="min-w-0">
              <SectionTitle id={heading}>{t(`nav.columns.${group.key}`)}</SectionTitle>
              <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
                {entries.map((e, i) => (
                  <li key={e.href} className={cn(entries.length <= 2 && i === 0 && "xl:col-span-2")}>
                    <ArcadeCard
                      entry={e}
                      label={t(`nav.${e.key}.label`)}
                      desc={t(`nav.${e.key}.desc`)}
                      cta={t("pages.toolsHub.open")}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

/**
 * One tool of the menu: its hero's artwork as the cover, the name over it in
 * the display face, the promise in a line and the way in. The marquee card is
 * taller; a game's card has Dex in its corner, in the game's pose.
 */
function ArcadeCard({
  entry: { href, icon: Icon },
  label,
  desc,
  cta,
  size = "tool",
}: {
  entry: Entry;
  label: string;
  desc: string;
  cta: string;
  size?: "marquee" | "game" | "tool";
}) {
  const { art, dex } = toolArt(href);
  return (
    <Link
      href={href}
      className={cn(
        "arcade-card group h-full p-4 sm:p-5",
        size === "marquee" && "min-h-[19rem] sm:min-h-[24rem] sm:p-8",
        size === "game" && "min-h-[11rem] sm:min-h-[13rem] lg:min-h-0",
        size === "tool" && "min-h-[12rem] p-3 sm:min-h-[15rem]",
      )}
    >
      {art && (
        <span aria-hidden className="arcade-card-art">
          <Image
            src={art}
            alt=""
            fill
            sizes={size === "marquee" ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"}
            className="object-cover object-[60%_22%]"
          />
        </span>
      )}
      {size === "game" && (
        <span aria-hidden className="absolute bottom-2 right-2 sm:bottom-3 sm:right-4">
          <Dex pose={dex} height={120} still />
        </span>
      )}
      <span className={cn("relative block min-w-0", size === "game" && "pr-24")}>
        <span aria-hidden className="bevel-sm mb-2 grid size-9 place-items-center bg-gold-400 text-night-950 sm:mb-3 sm:size-10">
          <Icon size={20} />
        </span>
        <span
          className={cn(
            "display-caps block text-chalk-100 transition-colors group-hover:text-gold-300",
            size === "marquee" ? "text-[clamp(3rem,2rem+4vw,5.5rem)]" : size === "game" ? "text-[2rem] sm:text-[2.4rem]" : "text-[1.45rem] sm:text-[2.4rem]",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "mt-2 block max-w-md text-chalk-200",
            size === "marquee" ? "text-base sm:text-lg" : size === "game" ? "text-sm" : "line-clamp-3 text-xs sm:line-clamp-none sm:text-sm",
          )}
        >
          {" "}
          {desc}
        </span>
        <span
          aria-hidden
          className={cn("arcade-go btn btn-primary btn-sm pointer-events-none mt-4", size === "tool" && "max-sm:hidden")}
        >
          {cta}
          <ArrowRight size={15} />
        </span>
      </span>
    </Link>
  );
}

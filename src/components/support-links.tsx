"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { parseSupportLinks, SUPPORT_PLATFORM_NAMES, type SupportLink } from "@/lib/support";
import { dismissSupport, readSupportMemory, supportCardAllowed } from "@/lib/support-prompt";
import { cn } from "@/lib/utils";
import { Dex } from "./mascot";

/**
 * The donation links (Ko-fi, PayPal.me), discreet by design: never a popup or
 * an overlay, always in the flow of the page.
 *
 * - Always there: a link in the footer, an item in the header's Community
 *   menu, a block on the About page.
 * - A card at a moment of satisfaction (the daily quiz finished, MLBBdle
 *   solved, a nickname copied, a result shared) or at the end of a busy
 *   content page (hero, tier list, events, skins calendar, patch notes).
 *   At most one card per page, "Later" hides them all for 14 days, and the
 *   daily games' cards wait for the second completion (`lib/support-prompt.ts`).
 *
 * The links come from `/api/support`, read at runtime on the server (see
 * `lib/support.ts`): asked once per page load, shared by every placement.
 * Until it answers, or when nothing is configured, nothing renders.
 *
 * Matomo, category "Support": "Donate" on a click (name `<placement>:<platform>`),
 * "Support view" when a card enters the screen, "Support dismiss" on "Later"
 * (name `<placement>`).
 */
let request: Promise<SupportLink[]> | null = null;

function load(): Promise<SupportLink[]> {
  request ??= fetch("/api/support")
    .then((r) => (r.ok ? r.json() : null))
    .then(parseSupportLinks)
    .catch(() => {
      request = null; // offline: try again on the next mount
      return [];
    });
  return request;
}

export function useSupportLinks(): SupportLink[] {
  const [links, setLinks] = useState<SupportLink[]>([]);
  useEffect(() => {
    let live = true;
    void load().then((l) => {
      if (live) setLinks(l);
    });
    return () => {
      live = false;
    };
  }, []);
  return links;
}

export type SupportPlacement =
  | "Footer" | "Menu" | "About"
  | "Quiz" | "MLBBdle" | "Nickname" | "Share"
  | "Hero" | "TierList" | "Events" | "SkinsCalendar" | "PatchNotes";

function SupportAnchor({
  link,
  placement,
  className,
  children,
}: {
  link: SupportLink;
  placement: SupportPlacement;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => trackEvent("Support", "Donate", `${placement}:${link.platform}`)}
    >
      {children}
    </a>
  );
}

/** Footer: one link, next to the Discord one, to the first configured platform. */
export function SupportFooterLink({ className }: { className?: string }) {
  const t = useT();
  const [link] = useSupportLinks();
  if (!link) return null;
  return (
    <SupportAnchor link={link} placement="Footer" className={className}>
      <Heart size={15} aria-hidden className="text-gold-400" />
      {t("support.footer")}
      <span className="sr-only"> ({SUPPORT_PLATFORM_NAMES[link.platform]})</span>
    </SupportAnchor>
  );
}

/** Header, Community menu: an entry shaped like the others, to the first configured platform. */
export function SupportNavEntry() {
  const t = useT();
  const [link] = useSupportLinks();
  if (!link) return null;
  return (
    <SupportAnchor
      link={link}
      placement="Menu"
      className="bevel-sm group flex items-center gap-3 px-2 py-2 transition-colors hover:bg-night-800/70"
    >
      <span aria-hidden className="bevel-sm grid size-8 shrink-0 place-items-center bg-night-800 text-gold-400">
        <Heart size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-chalk-100">
          {t("support.footer")}
          <span className="sr-only"> ({SUPPORT_PLATFORM_NAMES[link.platform]})</span>
        </span>
        <span className="hidden text-xs leading-snug text-chalk-500 sm:block">{t("support.menuDesc")}</span>
      </span>
    </SupportAnchor>
  );
}

const platformButton =
  "bevel-sm inline-flex min-h-11 items-center gap-2 border border-gold-500/50 px-4 py-2 text-sm font-semibold text-gold-300 transition-colors hover:border-gold-400 hover:bg-gold-500/10";

function PlatformButtons({ links, placement }: { links: SupportLink[]; placement: SupportPlacement }) {
  const t = useT();
  return links.map((link) => (
    <SupportAnchor key={link.platform} link={link} placement={placement} className={platformButton}>
      {/* The name a screen reader hears: "Support MLBBDex — Ko-fi", the visible word kept in it. */}
      <span className="sr-only">{t("support.footer")} — </span>
      {SUPPORT_PLATFORM_NAMES[link.platform]}
      <span aria-hidden>↗</span>
    </SupportAnchor>
  ));
}

/** About page: what a donation pays for, and a button per configured platform. */
export function SupportBlock() {
  const t = useT();
  const links = useSupportLinks();
  if (links.length === 0) return null;
  return (
    <section id="support" aria-labelledby="support-title" className="page-wrap scroll-mt-24 pb-12 sm:pb-16">
      <div className="bevel-sm max-w-3xl border border-night-700/70 bg-night-900 p-5 sm:p-6">
        <h2 id="support-title" className="flex items-center gap-2 font-heading text-xl font-bold uppercase text-chalk-100">
          <Heart size={18} aria-hidden className="text-gold-400" />
          {t("support.title")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-chalk-300">{t("support.body")}</p>
        <p className="mt-2 text-sm leading-relaxed text-chalk-400">{t("support.free")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <PlatformButtons links={links} placement="About" />
        </div>
      </div>
    </section>
  );
}

// ── One card per page ────────────────────────────────────────────────
// The first card allowed to show takes the page's single slot; the others
// wait, and one takes it over if it frees up (the first one unmounted).

let owner: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setOwner(next: string | null) {
  owner = next;
  for (const listener of listeners) listener();
}

const MOMENTS: readonly SupportPlacement[] = ["Quiz", "MLBBdle", "Nickname", "Share"];
const GATED: readonly SupportPlacement[] = ["Quiz", "MLBBdle"];

/**
 * The support card: Dex, one line of thanks, a button per configured
 * platform and "Later". `compact` drops Dex, for a narrow column (under a
 * share button).
 */
export function SupportCard({
  placement,
  compact = false,
  className,
}: {
  placement: Exclude<SupportPlacement, "Footer" | "Menu" | "About">;
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  const id = useId();
  const links = useSupportLinks();
  // Read after mount: the server and the first render show nothing.
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage read after mount
    setAllowed(supportCardAllowed(readSupportMemory(), { gated: GATED.includes(placement), now: Date.now() }));
  }, [placement]);

  const eligible = allowed && links.length > 0;
  const current = useSyncExternalStore(subscribe, () => owner, () => null);
  useEffect(() => {
    if (eligible && current === null) setOwner(id);
  }, [eligible, current, id]);
  useEffect(() => {
    if (!eligible) return;
    return () => {
      if (owner === id) setOwner(null);
    };
  }, [eligible, id]);
  // After "Later" the card keeps the slot, empty: no other card replaces it.
  const [gone, setGone] = useState(false);
  const shown = eligible && current === id && !gone;

  // "Support view": once per card, when half of it is on screen.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!shown || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackEvent("Support", "Support view", placement);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, placement]);

  if (!shown) return null;

  const later = () => {
    dismissSupport(Date.now());
    trackEvent("Support", "Support dismiss", placement);
    setGone(true);
  };
  const titleId = `${id}-title`;

  return (
    <aside
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        "bevel-sm flex items-center gap-4 border border-gold-500/25 bg-night-900/80",
        compact ? "p-3" : "max-w-3xl p-4 sm:p-5",
        className,
      )}
    >
      {!compact && (
        <span className="dex-host hidden shrink-0 min-[400px]:block">
          <Dex pose={MOMENTS.includes(placement) ? "joie" : "salut"} height={72} still />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p id={titleId} className={cn("font-heading font-bold text-chalk-100", compact ? "text-base" : "text-lg")}>
          {t("support.cardTitle")}
        </p>
        {!compact && <p className="mt-1 text-sm leading-relaxed text-chalk-400">{t("support.cardBody")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PlatformButtons links={links} placement={placement} />
          <button
            type="button"
            onClick={later}
            className="inline-flex min-h-11 items-center px-2 text-sm text-chalk-500 underline-offset-2 transition-colors hover:text-chalk-200 hover:underline"
          >
            {t("support.later")}
          </button>
        </div>
      </div>
    </aside>
  );
}

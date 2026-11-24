"use client";

import { useEffect, useRef, useState } from "react";
import { classesChip } from "@/components/chip";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * The account page's sticky row of chips, under the header, as on the hero
 * pages: one chip per section, the one being read lit, the row scrolling
 * sideways on a phone to keep it in view. Plain anchors: without
 * JavaScript, a chip still jumps to its section.
 */
export function AccountHubNav({ sections }: { sections: { id: string; label: string }[] }) {
  const t = useT();
  const [reading, setReading] = useState(sections[0]?.id ?? "");
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = sections.map((s) => document.getElementById(s.id)).filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;
    // The section just reached under the header and the row, not the largest one on screen.
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setReading(seen[0].target.id);
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const strip = row.current;
    const chip = strip?.querySelector<HTMLElement>(`[data-chip="${reading}"]`);
    if (!strip || !chip) return;
    const left = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: Math.max(0, left), behavior: still ? "auto" : "smooth" });
  }, [reading]);

  return (
    <nav aria-label={t("common.jumpToSection")} className="sticky top-16 z-30 border-b border-night-800 bg-night-950/95 backdrop-blur">
      <div ref={row} className="page-wrap flex gap-2 overflow-x-auto py-2.5 [scrollbar-width:none]">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-chip={s.id}
            aria-current={s.id === reading ? "true" : undefined}
            onClick={() => {
              trackEvent("Account", "Section nav", s.id);
              setReading(s.id);
            }}
            className={cn(classesChip(s.id === reading), "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap font-heading font-bold uppercase")}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

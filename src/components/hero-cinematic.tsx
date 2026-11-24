"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The hero poster's depth: while it is on screen, it writes the pointer's
 * position (`--px`, `--py`, from -1 to 1, fine pointers only) and how far
 * the page has scrolled past it (`--scroll`, 0 to 1) on itself. The layers
 * inside read them (`.cine-art`, `.cine-light`, `.cine-name` in globals.css) and drift at their own
 * depth: the artwork slowly, the light faster, the name barely. Transforms
 * only, one frame at a time; nothing is written under
 * `prefers-reduced-motion`, and the layers then stay still.
 */
export function PosterParallax({ children, className, ...rest }: { children: ReactNode; className?: string } & Record<`aria-${string}`, string>) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;
    let visible = false;
    let frame = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const scroll = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
      el.style.setProperty("--scroll", scroll.toFixed(3));
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
    };
    const request = () => {
      if (visible && !frame) frame = requestAnimationFrame(paint);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
      py = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
      request();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      request();
    });
    io.observe(el);
    window.addEventListener("scroll", request, { passive: true });
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (fine) window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={root} className={cn("cine-poster", className)} {...rest}>
      {children}
    </section>
  );
}

/**
 * Children revealed one after the other (`.cascade` in globals.css, each
 * child's place in `--i`). On a block already on screen at load, the CSS
 * plays the cascade on its own from the first paint; one still below the
 * fold is held back, out of sight, and plays when it comes into view. Under
 * `prefers-reduced-motion` nothing is held and nothing moves.
 */
export function Cascade({ as: Tag = "div", children, className }: { as?: ElementType; children: ReactNode; className?: string }) {
  const root = useRef<HTMLElement>(null);
  const [state, setState] = useState<"load" | "armed" | "in">("load");

  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    // On screen already: the load-time cascade plays (or played) there.
    if (r.top < window.innerHeight && r.bottom > 0) return;
    setState("armed");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState("in");
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={root} className={cn("cascade", state === "armed" && "is-armed", state === "in" && "is-in", className)}>
      {children}
    </Tag>
  );
}

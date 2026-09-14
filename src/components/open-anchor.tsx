"use client";

import { useEffect } from "react";
import { resolveAnchor, type AnchorAliases } from "@/lib/anchors";

/**
 * Opens the `<details>` targeted by an anchor ("#rank-mythic"): Chromium does
 * not expand it by itself, neither on load nor on click, and the link would
 * land on a closed section. The content is already in the HTML; this
 * component only opens it, and renders nothing.
 *
 * `aliases` keeps renamed anchors working: an old one found in the address
 * ("#rang-mythic") is replaced by the current one, then scrolled to.
 */
export function OpenAnchor({ aliases = {} }: { aliases?: AnchorAliases }) {
  useEffect(() => {
    const open = (id: string) => {
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (target instanceof HTMLDetailsElement) target.open = true;
      return target;
    };
    const fromAddress = () => {
      const current = resolveAnchor(decodeURIComponent(location.hash), aliases);
      if (current) {
        history.replaceState(null, "", `#${current}`);
        open(current)?.scrollIntoView({ block: "start" });
        return;
      }
      open(location.hash.slice(1));
    };
    // The click handler also covers a second click on the same anchor, which does not change the URL.
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
      if (link) open(link.getAttribute("href")!.slice(1));
    };
    fromAddress();
    addEventListener("hashchange", fromAddress);
    document.addEventListener("click", onClick);
    return () => {
      removeEventListener("hashchange", fromAddress);
      document.removeEventListener("click", onClick);
    };
    // A page's aliases do not change after render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Opens the `<details>` targeted by an anchor ("#rang-mythic"): Chromium does
 * not expand it by itself, neither on load nor on click, and the link would
 * land on a closed section. The content is already in the HTML; this
 * component only opens it, and renders nothing.
 */
export function OpenAnchor() {
  useEffect(() => {
    const open = (id: string) => {
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (target instanceof HTMLDetailsElement) target.open = true;
    };
    const fromAddress = () => open(location.hash.slice(1));
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
  }, []);
  return null;
}

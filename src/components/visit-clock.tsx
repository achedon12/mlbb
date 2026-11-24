"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { touchVisit } from "@/lib/since-visit";

/**
 * Keeps the time of this visit's last page in the browser, so the home
 * page can tell a returning visitor what changed since (`SinceLastVisit`).
 * One local storage write per page, nothing sent anywhere, no output.
 */
export function VisitClock() {
  const path = usePathname();
  useEffect(() => {
    touchVisit();
  }, [path]);
  return null;
}

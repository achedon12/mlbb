"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { communityInvite } from "@/lib/bot/public";
import {
  DWELL_BEFORE_SHOWING_MS,
  isExcludedPath,
  readDiscordPopupMemory,
  readDiscordPopupSession,
  rememberDiscordPopupDismissed,
  rememberDiscordPopupJoined,
  shouldShowDiscordPopup,
  writeDiscordPopupSession,
} from "@/lib/discord-popup";

/**
 * Invitation to the community Discord server: a small card in a corner,
 * never a modal.
 *
 * This part only counts the session's pages and keeps the timer; the card
 * itself is fetched once it is due (`shouldShowDiscordPopup`), when the
 * browser is idle, so it weighs nothing on the pages where it never shows.
 * Being fixed, it cannot shift the layout either.
 *
 * The site's other bottom bars come first: the offline banner, a tool's
 * action bar or toast, an open drawer or menu mark themselves with
 * `data-bottom-ui`, and the card steps aside while one of them is on
 * screen (and on the 404 page), rather than stacking over it.
 */
const DiscordPopupCard = dynamic(() => import("./discord-popup-card").then((m) => m.DiscordPopupCard), {
  ssr: false,
});

// `hidden` is how the mobile menu closes: a hidden element does not count.
const BLOCKING = "[data-bottom-ui]:not([hidden]), [data-not-found]";

/** Whether something the card must give way to is on the page, watched only while `active`. */
function useBlocked(active: boolean): boolean {
  const subscribe = useCallback(
    (refresh: () => void) => {
      if (!active) return () => {};
      const observer = new MutationObserver(refresh);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
      return () => observer.disconnect();
    },
    [active],
  );
  return useSyncExternalStore(
    subscribe,
    () => active && document.querySelector(BLOCKING) !== null,
    () => false,
  );
}

function whenIdle(run: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  // Safari has no idle callback: a short delay keeps it off the page's own work.
  const id = setTimeout(run, 200);
  return () => clearTimeout(id);
}

export function DiscordPopup() {
  const pathname = usePathname();
  const invite = communityInvite();
  const counted = useRef<string | null>(null);
  const [due, setDue] = useState(false);
  const [closed, setClosed] = useState(false);
  const shown = useRef(false);
  const blocked = useBlocked(due && !closed);

  useEffect(() => {
    if (!invite || due) return;
    const session = readDiscordPopupSession();
    const memory = readDiscordPopupMemory();
    // Storage unreadable: nothing would remember a dismissal, so no card at all.
    if (!session || !memory) return;
    // Once per page: React runs effects twice in development.
    if (counted.current !== pathname) {
      counted.current = pathname;
      session.views += 1;
      writeDiscordPopupSession(session);
    }
    const ready = (dwellMs: number) =>
      shouldShowDiscordPopup({
        invite,
        pathname,
        notFound: document.querySelector("[data-not-found]") !== null,
        pageViews: session.views,
        dwellMs,
        now: Date.now(),
        memory,
        shownThisSession: session.shown,
      });
    let cancelIdle = () => {};
    const show = () => {
      cancelIdle = whenIdle(() => setDue(true));
    };
    // A new page restarts the reading time: the effect is cleaned up on every navigation.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (ready(0)) show();
    else timer = setTimeout(() => ready(DWELL_BEFORE_SHOWING_MS) && show(), DWELL_BEFORE_SHOWING_MS);
    return () => {
      clearTimeout(timer);
      cancelIdle();
    };
  }, [invite, pathname, due]);

  const visible = Boolean(invite) && due && !closed && !blocked && !isExcludedPath(pathname);

  // Counted once it is actually on screen, which a blocking bar can delay.
  useEffect(() => {
    if (!visible || shown.current) return;
    shown.current = true;
    const session = readDiscordPopupSession();
    if (session) writeDiscordPopupSession({ ...session, shown: true });
    trackEvent("Discord", "Popup shown");
  }, [visible]);

  const join = () => {
    rememberDiscordPopupJoined();
    trackEvent("Discord", "Popup join");
    setClosed(true);
  };
  const dismiss = () => {
    rememberDiscordPopupDismissed(Date.now());
    trackEvent("Discord", "Popup dismiss");
    setClosed(true);
  };

  // The live region stays mounted, empty, so the card is announced when it appears.
  return <div aria-live="polite">{visible && invite && <DiscordPopupCard invite={invite} onJoin={join} onDismiss={dismiss} />}</div>;
}

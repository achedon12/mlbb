"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import Link from "@/components/link";
import { Dex } from "@/components/mascot";
import { useT } from "@/i18n/provider";
import { analyticsEnabled } from "@/lib/analytics";
import {
  chooseConsent,
  closeConsent,
  getConsentState,
  getServerConsentState,
  reconcileConsent,
  reopenConsent,
  subscribeConsent,
} from "@/lib/consent";

/**
 * The cookie banner: audience measurement cookies, yes or no.
 *
 * A bar along the bottom of the page, never a modal: the page stays usable
 * around it, and its absence of an answer counts as nothing — the
 * measurement simply stays cookieless. "Refuse" and "Accept" look exactly
 * alike, side by side, so that saying no is as easy as saying yes (CNIL).
 * Escape is not an answer: on a first visit it does nothing; reopened from
 * "Manage cookies", it closes the bar and keeps the choice already made.
 *
 * The server renders nothing, nor does the first render in the browser: a
 * visitor who has already chosen never sees it flash. Being fixed, it
 * cannot shift the layout. It carries `data-bottom-ui`, so the Discord
 * invitation steps aside while it is on screen.
 *
 * Mounted first in the page, just after the skip link: a keyboard reaches
 * it before the header. Reopened, it takes the focus, and gives it back to
 * the link that opened it once closed.
 */
export function ConsentBanner() {
  const t = useT();
  const { record, open } = useSyncExternalStore(subscribeConsent, getConsentState, getServerConsentState);
  const title = useId();
  const text = useId();
  const first = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    reconcileConsent();
  }, []);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      first.current?.focus();
    } else if (opener.current instanceof HTMLElement) {
      opener.current.focus();
      opener.current = null;
    }
  }, [open]);

  const visible = analyticsEnabled && (open || record === null);

  return (
    <div aria-live="polite">
      {visible && (
        <section
          data-bottom-ui
          aria-labelledby={title}
          aria-describedby={text}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) closeConsent();
          }}
          className="fixed inset-x-0 bottom-0 z-50 bg-night-900 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgb(0_0_0/0.5)]"
        >
          <div aria-hidden className="eclat-rule" />
          <div className="page-wrap flex flex-col gap-3 py-3 sm:py-4 md:flex-row md:items-center md:gap-6">
            <span aria-hidden className="-my-2 hidden shrink-0 self-end md:block">
              <Dex pose="idee" height={84} still />
            </span>
            <div className="min-w-0 flex-1">
              <p id={title} className="font-heading text-lg font-bold uppercase text-chalk-100">
                {t("consent.title")}
              </p>
              <p id={text} className="mt-1 text-sm leading-snug text-chalk-300">
                {t("consent.text")}{" "}
                <Link href="/privacy#cookies" className="text-gold-400 underline underline-offset-2 hover:text-gold-300">
                  {t("consent.more")}
                </Link>
              </p>
              {open && record && (
                <p className="mt-1 text-xs text-chalk-500">
                  {t(record.choice === "granted" ? "consent.currentGranted" : "consent.currentDenied", {
                    date: new Date(record.at).toLocaleDateString(document.documentElement.lang || undefined),
                  })}
                </p>
              )}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 md:w-72">
              {/* Same size, same look: neither answer is pushed over the other. */}
              <button
                ref={first}
                type="button"
                onClick={() => chooseConsent("denied")}
                className="btn btn-secondary btn-sm"
              >
                {t("consent.refuse")}
              </button>
              <button
                type="button"
                onClick={() => chooseConsent("granted")}
                className="btn btn-secondary btn-sm"
              >
                {t("consent.accept")}
              </button>
              {open && record && (
                <button
                  type="button"
                  onClick={closeConsent}
                  className="col-span-2 text-xs text-chalk-500 underline underline-offset-2 hover:text-chalk-100"
                >
                  {t("consent.keep")}
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** "Manage cookies": a button styled as a link, which reopens the banner. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  const t = useT();
  if (!analyticsEnabled) return null;
  return (
    <button
      type="button"
      onClick={reopenConsent}
      className={className}
    >
      {t("consent.manage")}
    </button>
  );
}

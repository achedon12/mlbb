"use client";

import { useEffect } from "react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";

/**
 * Page error boundary.
 *
 * An unexpected error in a segment (missing data, failing call) is
 * caught here rather than showing Next's raw screen. The detail goes to
 * the server console; the reader gets a clean way out and the means
 * to try again.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
    // Report the incident to the server log, without blocking rendering.
    const body = JSON.stringify({
      message: error.message,
      path: window.location.pathname,
      digest: error.digest,
    });
    const sent = navigator.sendBeacon?.("/api/log", body);
    if (!sent) {
      fetch("/api/log", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-heading text-6xl font-bold text-blood-500">{t("error.oops")}</p>
      <h1 className="mt-4 font-heading text-2xl font-bold text-chalk-100">{t("error.title")}</h1>
      <p className="mt-4 leading-relaxed text-chalk-500">{t("error.pageText")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="bevel-sm bg-gold-500 px-6 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("error.retry")}
        </button>
        <Link
          href="/"
          className="bevel-sm border border-night-600 px-6 py-3 font-semibold text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          {t("error.home")}
        </Link>
      </div>
    </div>
  );
}

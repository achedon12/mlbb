"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import Link from "@/components/link";
import { DexScreen } from "@/components/dex-screen";
import { useT } from "@/i18n/provider";

/**
 * Page error boundary.
 *
 * An unexpected error in a segment (missing data, failing call) is
 * caught here rather than showing Next's raw screen. The detail goes to
 * the server console; the reader gets Dex, a clean way out and the means
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
    <DexScreen
      figure={t("error.oops")}
      tone="enemy"
      pose="reflexion"
      title={t("error.title")}
      text={t("error.pageText")}
      line={t("error.dexLine")}
      actions={
        <>
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw size={17} aria-hidden />
            {t("error.retry")}
          </button>
          <Link href="/" className="btn btn-secondary">
            {t("error.home")}
          </Link>
        </>
      }
    />
  );
}

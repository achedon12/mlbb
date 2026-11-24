"use client";

import { useState } from "react";
import { ImageDown, Share2 } from "lucide-react";
import { BrandSpinner, Flash } from "@/components/dex-states";
import { useLocale, useT } from "@/i18n/provider";
import { trackShare } from "@/lib/analytics";
import { sharePath, type ShareCard } from "@/lib/share-card";
import { cn } from "@/lib/utils";

/**
 * "Partager en image": fetches the branded card of what is on screen
 * (`/api/share/<kind>`, 1080 × 1350) and hands it to the share sheet when
 * the device can share files; otherwise saves the PNG and copies the page's
 * link. A second, quieter link saves the landscape card (1200 × 630), the
 * one link previews use.
 *
 * Measured as `Share / <name> image`, with the method (`native` or `image`).
 */
type Status = "idle" | "busy" | "shared" | "saved" | "savedCopied" | "error";

export function ShareImageButton({
  card,
  name,
  url,
  text,
  label,
  variant = "secondary",
  large = false,
  className,
}: {
  card: ShareCard;
  /** Feature name in the measurements ("Build", "Draft"…). */
  name: string;
  /** Link shared with the image; the current page by default. */
  url?: string;
  /** Message sent with the image to the share sheet; the link alone by default. */
  text?: string;
  /** The button's label, "Share as image" by default. */
  label?: string;
  variant?: "primary" | "secondary";
  /** A bigger, full-width-on-phones button: the main action of a results screen. */
  large?: boolean;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const portrait = sharePath({ locale, format: "portrait", card });
  const landscape = sharePath({ locale, format: "landscape", card });
  const fileName = `mlbbdex-${card.kind}.png`;

  async function share() {
    if (status === "busy") return;
    setStatus("busy");
    const link = url ?? window.location.href;
    let file: File;
    try {
      const response = await fetch(portrait);
      if (!response.ok) throw new Error(String(response.status));
      file = new File([await response.blob()], fileName, { type: "image/png" });
    } catch {
      setStatus("error");
      return;
    }
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: document.title, text: text ?? link });
        setStatus("shared");
        trackShare(`${name} image`, "native");
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") {
          setStatus("idle");
          return;
        }
        // Refused by the platform: fall back on saving it.
      }
    }
    const href = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    trackShare(`${name} image`, "image");
    try {
      await navigator.clipboard.writeText(link);
      setStatus("savedCopied");
    } catch {
      setStatus("saved");
    }
  }

  const busy = status === "busy";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={share}
          aria-busy={busy}
          aria-describedby={`share-hint-${card.kind}`}
          className={cn(
            "btn",
            variant === "primary" ? "btn-primary" : "btn-secondary",
            large && "min-h-14 w-full px-7 text-lg sm:w-auto",
          )}
        >
          {busy ? <BrandSpinner /> : <Share2 size={large ? 20 : 16} aria-hidden />}
          {busy ? t("shareImage.preparing") : (label ?? t("shareImage.button"))}
        </button>
        <a
          href={landscape}
          download={`mlbbdex-${card.kind}-1200x630.png`}
          onClick={() => trackShare(`${name} image landscape`, "image")}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-chalk-400 transition-colors hover:text-gold-400"
        >
          <ImageDown size={15} aria-hidden />
          {t("shareImage.landscape")}
        </a>
      </div>
      <p id={`share-hint-${card.kind}`} className="text-xs text-chalk-500">
        {t("shareImage.hint")}
      </p>
      <p aria-live="polite" className="min-h-5 text-sm">
        {status === "shared" || status === "saved" || status === "savedCopied" ? (
          <Flash>{t(`shareImage.${status}`)}</Flash>
        ) : status === "error" ? (
          <Flash tone="error">{t("shareImage.error")}</Flash>
        ) : null}
      </p>
    </div>
  );
}

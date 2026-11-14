"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { classesChip } from "@/components/chip";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { pointsOf, type Tier } from "@/lib/account-value";
import { READ_TIERS, type ShowcaseReading } from "@/lib/showcase-ocr";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type State =
  | { step: "idle" }
  | { step: "loading" | "reading" }
  | { step: "failed" | "error" }
  | { step: "done"; reading: ShowcaseReading };

/** The first image of a paste or a drop, if any. */
const imageOf = (items: DataTransferItemList | null | undefined, files: FileList | null | undefined): File | null => {
  for (const f of files ?? []) if (f.type.startsWith("image/")) return f;
  for (const item of items ?? []) if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  return null;
};

/**
 * Fills the tier counts from a screenshot of the Showcase panel: chosen from
 * the gallery, dropped on the section or pasted. The OCR runs in the browser
 * and its result only pre-fills the fields, marked for the player to check.
 */
export function ShowcaseScan({
  catalog,
  onRead,
  children,
}: {
  /** Skins per tier in the catalogue, to judge the totals read. */
  catalog: Partial<Record<Tier, number>>;
  onRead: (reading: ShowcaseReading) => void;
  /** The section the image can be dropped on. */
  children: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "idle" });
  const [over, setOver] = useState(false);
  const busy = state.step === "loading" || state.step === "reading";
  const count = new Intl.NumberFormat(LOCALE_INTL[locale]);

  async function scan(image: File) {
    if (busy) return;
    setState({ step: "loading" });
    try {
      const { scanShowcase } = await import("@/lib/showcase-ocr-client");
      const reading = await scanShowcase(image, catalog, (step) => setState({ step }));
      if (!reading) {
        setState({ step: "failed" });
        trackEvent("Account value", "Screenshot", "unreadable");
        return;
      }
      onRead(reading);
      setState({ step: "done", reading });
      trackEvent("Account value", "Screenshot", reading.header?.matches ? "checked" : "partial", reading.rows.length);
    } catch {
      setState({ step: "error" });
    }
  }

  // Ctrl+V anywhere on the page, unless an image is already being read.
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const image = imageOf(e.clipboardData?.items, e.clipboardData?.files);
      if (!image) return;
      e.preventDefault();
      void scanRef.current(image);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const tierNames = (tiers: readonly Tier[]) => tiers.map((x) => t(`pages.accountValueUI.tier.${x}`)).join(", ");
  const reading = state.step === "done" ? state.reading : null;
  const sum = reading ? pointsOf(Object.fromEntries(reading.rows.map((r) => [r.tier, r.owned]))) : 0;
  const unchecked = reading?.rows.filter((r) => !r.checked).map((r) => r.tier) ?? [];
  const missing = reading ? READ_TIERS.filter((x) => !reading.rows.some((r) => r.tier === x)) : [];

  return (
    <div
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        const image = imageOf(e.dataTransfer.items, e.dataTransfer.files);
        setOver(false);
        if (!image) return;
        e.preventDefault();
        void scan(image);
      }}
      className={cn("relative transition-colors", over && "outline-2 outline-offset-8 outline-dashed outline-gold-500/70")}
    >
      <div className="bevel-sm mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border border-night-700/70 bg-night-900/60 p-3">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void scan(file);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cn(classesChip(true), "inline-flex items-center gap-2 disabled:opacity-60")}
        >
          {busy ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <ImageUp size={15} aria-hidden />}
          {t(reading || state.step === "failed" ? "pages.accountValueUI.scan.retry" : "pages.accountValueUI.scan.button")}
        </button>
        <p className="min-w-0 basis-full text-xs leading-relaxed text-chalk-400 sm:basis-0 sm:flex-1">
          <span className="hidden sm:inline">{t("pages.accountValueUI.scan.hint")} </span>
          {t("pages.accountValueUI.scan.privacy")}
        </p>
        <div aria-live="polite" className="w-full space-y-0.5 text-xs empty:hidden">
          {busy && <p className="text-chalk-300">{t(`pages.accountValueUI.scan.${state.step}`)}</p>}
          {state.step === "failed" && <p className="text-gold-400">{t("pages.accountValueUI.scan.failed")}</p>}
          {state.step === "error" && <p className="text-gold-400">{t("pages.accountValueUI.scan.error")}</p>}
          {reading && (
            <>
              <p className="font-semibold text-gold-400">{t("pages.accountValueUI.scan.done")}</p>
              {reading.header?.matches ? (
                <p className="text-chalk-300">{t("pages.accountValueUI.scan.headerOk", { total: count.format(reading.header.value) })}</p>
              ) : reading.header ? (
                <p className="text-chalk-300">
                  {t("pages.accountValueUI.scan.headerOff", { read: count.format(reading.header.value), sum: count.format(sum) })}
                </p>
              ) : null}
              {unchecked.length > 0 && <p className="text-chalk-300">{t("pages.accountValueUI.scan.rowsCheck", { tiers: tierNames(unchecked) })}</p>}
              {missing.length > 0 && <p className="text-chalk-300">{t("pages.accountValueUI.scan.missing", { tiers: tierNames(missing) })}</p>}
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

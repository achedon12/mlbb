"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A button that copies a short value (a colour code) to the clipboard and
 * says so for a moment, out loud too (`aria-live`). The labels come from the
 * server page, so the button needs no catalogue of its own.
 */
export function CopyValue({ value, label, copiedLabel, className }: {
  value: string;
  /** Accessible name, "Copy #F5C451". */
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // No clipboard (insecure context, refused permission): the code stays readable beside the button.
    }
  };

  return (
    <>
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "bevel-sm inline-flex min-h-9 items-center gap-2 bg-night-800 px-3 font-mono text-sm text-chalk-100 transition-[color,background-color,translate] hover:-translate-y-px hover:bg-night-700 hover:text-gold-300 active:translate-y-px",
        className,
      )}
    >
      {copied ? <Check size={15} aria-hidden className="text-azure-400" /> : <Copy size={15} aria-hidden />}
      <span aria-hidden>{value}</span>
    </button>
    <span aria-live="polite" className="sr-only">{copied ? copiedLabel : ""}</span>
    </>
  );
}

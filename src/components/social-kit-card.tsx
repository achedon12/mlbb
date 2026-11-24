"use client";

import { useId, useState } from "react";
import { Download } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { trackEvent } from "@/lib/analytics";
import { KIT_FORMATS, KIT_SIZES, kitFileName, kitPath, type KitCard, type KitFormat, type KitRequest } from "@/lib/social-kit";
import { cn } from "@/lib/utils";

/**
 * One template of the brand page's social kit: a preview of the visual in
 * the chosen format, a picker when the template takes a hero, a skin or a
 * title (always out of the catalogue), and a download link per format.
 * The visual is drawn by `/api/kit/<template>`; the page passes its words.
 *
 * Measured as `Social kit / Download / <template> <format>`.
 */
export interface KitPick {
  label: string;
  /** The field of the card the picker sets. */
  field: "hero" | "skin" | "title";
  options: { value: string; label: string }[];
}

export function SocialKitCard({
  locale,
  name,
  description,
  card: initial,
  pick,
  formats,
  hints,
  downloadLabels,
  previewAlts,
}: {
  locale: Locale;
  name: string;
  description: string;
  card: KitCard;
  pick?: KitPick;
  formats: Record<KitFormat, string>;
  hints: Record<KitFormat, string>;
  downloadLabels: Record<KitFormat, string>;
  previewAlts: Record<KitFormat, string>;
}) {
  const id = useId();
  const [card, setCard] = useState<KitCard>(initial);
  const [shown, setShown] = useState<KitFormat>("portrait");
  const request = (format: KitFormat): KitRequest => ({ locale, format, card });
  const current = pick ? (card as Record<string, unknown>)[pick.field] : null;
  const size = KIT_SIZES[shown];

  return (
    <li className="bevel-lg flex flex-col bg-night-900 p-5 shadow-[inset_0_0_0_1px_var(--color-night-700)]">
      <h3 className="display-caps text-2xl text-chalk-100">{name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-chalk-400">{description}</p>

      {pick && (
        <div className="mt-4">
          <label htmlFor={`${id}-pick`} className="block text-xs font-semibold uppercase tracking-wide text-chalk-400">
            {pick.label}
          </label>
          <select
            id={`${id}-pick`}
            value={String(current ?? "")}
            onChange={(e) => setCard({ ...card, [pick.field]: e.target.value } as KitCard)}
            className="bevel-sm mt-1.5 w-full border border-night-700 bg-night-950 px-3 py-2 text-sm text-chalk-100 outline-none focus:border-gold-500"
          >
            {pick.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 flex gap-1.5" role="group" aria-label={name}>
        {KIT_FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            aria-pressed={shown === format}
            onClick={() => setShown(format)}
            className={cn(
              "bevel-sm min-h-9 flex-1 px-2 text-sm font-semibold transition-colors",
              shown === format ? "bg-gold-400 text-night-950" : "bg-night-800 text-chalk-300 hover:text-gold-300",
            )}
          >
            {formats[format]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex h-[340px] items-center justify-center bg-night-950">
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn on request by the kit's route, not an optimisable file */}
        <img
          key={kitPath(request(shown))}
          src={kitPath(request(shown))}
          alt={previewAlts[shown]}
          width={size.width}
          height={size.height}
          loading="lazy"
          decoding="async"
          className="h-full w-auto max-w-full object-contain"
        />
      </div>
      <p className="mt-2 text-xs text-chalk-500">{hints[shown]}</p>

      <p className="mt-4 flex flex-wrap gap-2">
        {KIT_FORMATS.map((format) => (
          <a
            key={format}
            href={kitPath(request(format))}
            download={kitFileName(request(format))}
            aria-label={downloadLabels[format]}
            onClick={() => trackEvent("Social kit", "Download", `${card.template} ${format}`)}
            className="bevel-sm inline-flex min-h-9 items-center gap-1.5 bg-night-800 px-3 text-sm text-chalk-200 transition-[color,background-color,translate] hover:-translate-y-px hover:bg-night-700 hover:text-gold-300"
          >
            <Download size={14} aria-hidden />
            {formats[format]}
          </a>
        ))}
      </p>
    </li>
  );
}

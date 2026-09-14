"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LOCALES, LOCALE_NAME, isLocale, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de langue.
 *
 * Change le préfixe de langue du chemin courant et mémorise le choix dans un
 * cookie, si bien que les liens non préfixés du site ramènent ensuite vers la
 * bonne langue (la redirection est faite côté serveur, à partir de ce cookie).
 */
export function LocalePicker({ locale }: { locale: Locale }) {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Remplace le préfixe de langue du chemin courant. */
  function pathTo(target: Locale): string {
    const parts = path.split("/").filter(Boolean);
    const rest = isLocale(parts[0]) ? parts.slice(1) : parts;
    return `/${[target, ...rest].join("/")}`;
  }

  function choose(target: Locale) {
    // La navigation vers le chemin prefixe suffit : le proxy pose alors le
    // cookie de langue, qui conservera le choix pour les liens non prefixes.
    setOpen(false);
    router.push(pathTo(target));
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("language.change")}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-chalk-300 transition-colors hover:text-chalk-100"
      >
        <Globe size={16} aria-hidden />
        <span className="hidden sm:inline uppercase">{locale}</span>
        <ChevronDown size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </button>

      <div hidden={!open} className="absolute right-0 top-full z-50 pt-2">
        <ul className="bevel w-40 border border-night-700/80 bg-night-900/98 p-1.5 shadow-2xl shadow-night-950/60 backdrop-blur">
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => choose(l)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active ? "text-gold-400" : "text-chalk-200 hover:bg-night-800/60",
                  )}
                >
                  {LOCALE_NAME[l]}
                  {active && <Check size={15} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

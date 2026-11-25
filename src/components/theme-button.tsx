"use client";

import { useSyncExternalStore } from "react";
import { MonitorSmartphone, Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/provider";
import { THEME_PREFERENCES, getServerTheme, getTheme, setTheme, subscribeTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemePreference, typeof Sun> = { auto: MonitorSmartphone, light: Sun, dark: Moon };

/** The preference after this one, in the order Auto → Light → Dark → Auto. */
export function nextTheme(preference: ThemePreference): ThemePreference {
  return THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length];
}

/**
 * The theme in one button, for the header: its icon shows the current
 * preference, a press moves to the next one (Auto, Light, Dark). Same store
 * as the footer's picker (`lib/theme.ts`, `mlbb_theme`), so both always
 * agree; the label says the state and what a press does.
 *
 * `row`: the menu sheet's version, the icon with its name beside it.
 */
export function ThemeButton({ variant = "icon", className }: { variant?: "icon" | "row"; className?: string }) {
  const t = useT();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const next = nextTheme(theme);
  const Icon = ICONS[theme];
  const label = t("footer.theme.cycle", { current: t(`footer.theme.${theme}`), next: t(`footer.theme.${next}`) });

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={label}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 font-heading text-base font-bold uppercase text-chalk-300 transition-colors hover:text-chalk-100",
          className,
        )}
      >
        <Icon size={18} aria-hidden className="text-gold-400" />
        <span aria-hidden>{t("footer.theme.label")}</span>
        <span aria-hidden className="font-sans text-sm font-normal normal-case text-chalk-500">
          {t(`footer.theme.${theme}`)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center text-chalk-300 transition-[color,transform] hover:text-chalk-100 active:scale-95 max-sm:size-11",
        className,
      )}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}

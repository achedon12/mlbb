"use client";

import { useId, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/provider";
import { THEME_PREFERENCES, getServerTheme, getTheme, setTheme, subscribeTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemePreference, typeof Sun> = { auto: Monitor, light: Sun, dark: Moon };

/**
 * The theme, in three positions: Auto (the system's), Light, Dark. A row of
 * native radio buttons, so the arrows move between them and a screen reader
 * hears one choice among three; each shows its icon and its name.
 *
 * Kept in the footer's bottom line, beside the cookie settings: a setting
 * one changes once, not a control of every page.
 */
export function ThemePicker({ className }: { className?: string }) {
  const t = useT();
  const name = useId();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  return (
    <fieldset className={cn("flex items-center gap-2", className)}>
      <legend className="sr-only">{t("footer.theme.label")}</legend>
      <span aria-hidden className="text-chalk-500">
        {t("footer.theme.label")}
      </span>
      <span className="bevel-sm flex bg-night-800 p-0.5">
        {THEME_PREFERENCES.map((value) => {
          const Icon = ICONS[value];
          const on = theme === value;
          return (
            <label
              key={value}
              className={cn(
                "bevel-sm flex min-h-8 cursor-pointer items-center gap-1 px-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-gold-400",
                on ? "bg-night-600 text-chalk-100" : "text-chalk-400 hover:text-chalk-100",
              )}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={on}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon size={14} aria-hidden />
              <span>{t(`footer.theme.${value}`)}</span>
            </label>
          );
        })}
      </span>
    </fieldset>
  );
}

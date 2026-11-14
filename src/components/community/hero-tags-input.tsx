"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { keySearch } from "@/lib/utils";

export interface HeroOption {
  slug: string;
  name: string;
}

/**
 * Hero picker of a post or a card: a text field with the roster as
 * suggestions (a native `datalist`, so the keyboard, the screen reader and
 * the phone's own picker all work), and the chosen heroes as removable
 * chips. A name typed in full, in any case and without accents, is taken.
 */
export function HeroTagsInput({
  heroes,
  value,
  onChange,
  max,
  label,
  hint,
}: {
  heroes: HeroOption[];
  value: string[];
  onChange: (slugs: string[]) => void;
  max: number;
  label: string;
  hint: string;
}) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState("");
  const names = new Map(heroes.map((h) => [h.slug, h.name]));
  const full = value.length >= max;

  function take(raw: string) {
    const key = keySearch(raw.trim());
    if (!key) return false;
    const hero = heroes.find((h) => keySearch(h.name) === key);
    if (!hero) return false;
    if (!value.includes(hero.slug) && value.length < max) onChange([...value, hero.slug]);
    setText("");
    return true;
  }

  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs text-chalk-400">
        <span>{label}</span>
        <span className="tabular-nums">
          {value.length}/{max}
        </span>
      </label>
      {value.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== slug))}
                aria-label={t("pages.communityUI.removeHero", { name: names.get(slug) ?? slug })}
                className="bevel-sm inline-flex min-h-9 items-center gap-1 border border-night-700 bg-night-850 px-2 text-xs text-chalk-200 transition-colors hover:border-blood-400/60"
              >
                {names.get(slug) ?? slug}
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        list={`${id}-list`}
        value={text}
        disabled={full}
        onChange={(e) => {
          // Picking a suggestion fills the whole name at once: taken, unless
          // it may still grow into another name ("Vale", "Valentina").
          const key = keySearch(e.target.value.trim());
          const longer = heroes.some((h) => keySearch(h.name).startsWith(key) && keySearch(h.name) !== key);
          if (longer || !take(e.target.value)) setText(e.target.value);
        }}
        onBlur={() => take(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            take(text);
          }
        }}
        placeholder={full ? undefined : t("pages.communityUI.heroPlaceholder")}
        autoComplete="off"
        aria-describedby={`${id}-hint`}
        className="bevel-sm mt-1.5 block h-11 w-full border border-night-700 bg-night-900 px-3 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500 disabled:opacity-50"
      />
      <datalist id={`${id}-list`}>
        {heroes
          .filter((h) => !value.includes(h.slug))
          .map((h) => (
            <option key={h.slug} value={h.name} />
          ))}
      </datalist>
      <p id={`${id}-hint`} className="mt-1 text-xs text-chalk-500">
        {hint}
      </p>
    </div>
  );
}

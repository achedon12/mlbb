"use client";

import { useId, useMemo, useRef, useState } from "react";
import { HeroPortrait } from "@/components/hero-portrait";
import { searchOptions } from "@/lib/quiz";
import { cn } from "@/lib/utils";

export interface GuessOption {
  slug: string;
  name: string;
  icon: string | null;
}

/**
 * Quiz answer field: a dropdown list that narrows as you type
 * (ARIA "combobox" pattern). Arrows to browse, Enter to confirm
 * the highlighted suggestion, Escape to close. Picking a suggestion
 * counts as the answer: no typo possible.
 */
export function GuessField({
  options,
  excluded,
  label,
  none,
  onChoose,
  disabled = false,
}: {
  options: GuessOption[];
  /** Already guessed: they do not come back in the list. */
  excluded: Set<string>;
  /** Placeholder text, and field name for screen readers. */
  label: string;
  /** Row shown when nothing matches. */
  none: string;
  onChoose: (slug: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // The list opens below the field, or above when there is not enough room at the bottom
  // of the screen (field at the bottom of the page, keyboard open on mobile).
  const [toTop, setToTop] = useState(false);
  const results = useMemo(() => searchOptions(options, text, excluded), [options, text, excluded]);
  const visible = open && text.trim().length > 0;
  const current = Math.min(active, Math.max(0, results.length - 1));

  function place() {
    const r = field.current?.getBoundingClientRect();
    if (!r) return;
    const view = window.visualViewport;
    const below = (view ? view.offsetTop + view.height : window.innerHeight) - r.bottom;
    setToTop(below < 240 && r.top > below);
  }

  function choose(o: GuessOption) {
    onChoose(o.slug);
    setText("");
    setActive(0);
    setOpen(false);
  }

  function key(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(current + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visible && results[current]) choose(results[current]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={field}
        type="text"
        role="combobox"
        aria-expanded={visible && results.length > 0}
        aria-controls={`${id}-liste`}
        aria-autocomplete="list"
        aria-activedescendant={visible && results[current] ? `${id}-${current}` : undefined}
        aria-label={label}
        placeholder={label}
        value={text}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          place();
        }}
        onFocus={() => {
          setOpen(true);
          place();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={key}
        className="bevel-sm w-full border border-night-600 bg-night-950 px-3 py-2.5 text-base text-chalk-100 outline-none transition-colors placeholder:text-chalk-400 focus:border-gold-500 disabled:opacity-50 sm:text-sm"
      />
      <ul
        id={`${id}-liste`}
        role="listbox"
        aria-label={label}
        hidden={!visible}
        className={cn(
          "absolute inset-x-0 z-30 max-h-72 overflow-y-auto border border-gold-500/40 bg-night-950 py-1 shadow-2xl shadow-black/70",
          toTop ? "bottom-full mb-1" : "top-full mt-1",
        )}
      >
        {results.map((o, i) => (
          <li
            key={o.slug}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === current}
            // The field keeps focus: the list does not close before the click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(o)}
            onMouseMove={() => setActive(i)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 text-sm",
              i === current ? "border-gold-400 bg-gold-500/15 text-gold-400" : "border-transparent text-chalk-100",
            )}
          >
            <HeroPortrait source={o.icon} name={o.name} size="mini" decorative />
            <span className="truncate">{o.name}</span>
          </li>
        ))}
        {results.length === 0 && (
          <li role="presentation" className="px-3 py-2 text-sm text-chalk-500">
            {none}
          </li>
        )}
      </ul>
    </div>
  );
}

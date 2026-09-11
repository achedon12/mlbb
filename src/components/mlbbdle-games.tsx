"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Check, LayoutGrid, Lock, X } from "lucide-react";
import { ChampDevinette } from "@/components/champ-devinette";
import { SelecteurHeros, type HerosChoisissable } from "@/components/choix-heros";
import { PortraitHeros } from "@/components/portrait-heros";
import { useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import {
  COLUMNS,
  compare,
  SKILL_CLUES,
  unlockedClues,
  type Column,
  type ComparedCell,
  type MlbbdleHero,
  type SkillClue,
  type SkillPuzzle,
  type Verdict,
} from "@/lib/mlbbdle";
import { cn } from "@/lib/utils";

/**
 * MLBBdle boards: the classic-mode grid and the skill-mode puzzle. They hold
 * no game state: the daily puzzle and practice keep the guesses, these views
 * show them and report each new guess.
 */

export interface MlbbdleCatalogue {
  heroes: MlbbdleHero[];
  bySlug: Map<string, MlbbdleHero>;
  /** Label of every value, under `<column>.<key>`. */
  labels: Record<string, string>;
  /** The roster in the shape the shared answer field and hero picker expect. */
  options: HerosChoisissable[];
}

export function buildCatalogue(heroes: MlbbdleHero[], labels: Record<string, string>): MlbbdleCatalogue {
  return {
    heroes,
    labels,
    bySlug: new Map(heroes.map((h) => [h.slug, h])),
    options: heroes.map((h) => ({ slug: h.slug, nom: h.name, icone: h.icon, roles: h.roles, lanes: h.lanes })),
  };
}

/** White on dark backgrounds: contrast holds on all three colours. */
const BACKGROUND: Record<Verdict, string> = {
  match: "border-emerald-400/60 bg-emerald-700 text-white",
  partial: "border-orange-400/60 bg-orange-700 text-white",
  miss: "border-red-400/40 bg-red-800 text-white",
  unknown: "border-night-600 bg-night-700 text-chalk-300",
};

/** A cell's flip: declared here since only this grid uses it. */
const FLIP = "@keyframes mlbbdle-flip{from{transform:rotateX(90deg)}to{transform:none}}";

/** Text of a cell: the labels of the hero's values in that column. */
export function cellText(h: MlbbdleHero, c: Column, labels: Record<string, string>): string {
  const label = (column: string, v: string) => labels[`${column}.${v}`] ?? v;
  if (c === "gender") return h.gender ? label("gender", h.gender) : "";
  if (c === "roles" || c === "lanes" || c === "specialties") return h[c].map((v) => label(c, v)).join(", ");
  if (c === "year") return h.year ? String(h.year) : "";
  const v = h[c];
  return v ? label(c, v) : "";
}

function verdictText(c: ComparedCell, column: Column, t: T): string {
  return column === "year" && c.direction
    ? t(`pages.mlbbdleUI.direction.${c.direction}`)
    : t(`pages.mlbbdleUI.verdicts.${c.verdict}`);
}

/**
 * Answer field and "Browse heroes" window: type a name or pick from the
 * roster, by keyboard or by touch.
 */
function HeroInput({
  catalogue,
  excluded,
  onPick,
}: {
  catalogue: MlbbdleCatalogue;
  excluded: Set<string>;
  onPick: (slug: string) => void;
}) {
  const t = useT();
  const [browsing, setBrowsing] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <ChampDevinette
          options={catalogue.options}
          exclus={excluded}
          libelle={t("pages.mlbbdleUI.input")}
          aucun={t("pages.mlbbdleUI.noResult")}
          onChoisir={onPick}
        />
      </div>
      <button
        type="button"
        onClick={() => setBrowsing(true)}
        className="bevel-sm flex min-h-11 items-center justify-center gap-1.5 border border-night-600 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400"
      >
        <LayoutGrid size={15} aria-hidden />
        {t("pages.mlbbdleUI.browse")}
      </button>
      {browsing && (
        <SelecteurHeros
          heros={catalogue.options}
          exclus={excluded}
          lane={null}
          titre={t("pages.mlbbdleUI.browse")}
          onChoisir={(slug) => {
            setBrowsing(false);
            onPick(slug);
          }}
          onFermer={() => setBrowsing(false)}
        />
      )}
    </div>
  );
}

/**
 * Frame shared by both boards. The bevel (clip-path) sits on a background
 * layer: on the section itself it would clip the suggestion list and the
 * fixed "Browse heroes" window.
 */
function Board({
  label,
  question,
  guesses,
  titleRef,
  children,
}: {
  label: string;
  question: string;
  guesses: number;
  titleRef?: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="relative p-4 sm:p-6">
      <div aria-hidden className="bevel absolute inset-0 border border-night-700/70 bg-night-900/60" />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs uppercase tracking-wide text-chalk-500">
          <span>{label}</span>
          <span className="tabular-nums text-chalk-300">{t("pages.mlbbdleUI.guesses", { n: guesses })}</span>
        </div>
        <h3
          ref={titleRef}
          tabIndex={-1}
          className="mt-2 font-heading text-xl font-bold text-chalk-100 outline-none sm:text-2xl"
        >
          {question}
        </h3>
        {children}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Classic mode
// ─────────────────────────────────────────────────────────────

export function ClassicGame({
  target,
  guesses,
  catalogue,
  onGuess,
  label,
  question,
  over = false,
  titleRef,
}: {
  target: MlbbdleHero;
  guesses: string[];
  catalogue: MlbbdleCatalogue;
  onGuess: (slug: string) => void;
  label: string;
  /** Board heading; practice has no "hero of the day". */
  question?: string;
  /** Game closed without a win (answer revealed in practice). */
  over?: boolean;
  titleRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const excluded = useMemo(() => new Set(guesses), [guesses]);
  const found = guesses.includes(target.slug);

  function announcement(): string {
    const last = guesses.at(-1);
    const h = last ? catalogue.bySlug.get(last) : undefined;
    if (!h) return "";
    if (h.slug === target.slug) return t("pages.mlbbdleUI.announceFound", { name: h.name, n: guesses.length });
    const cells = compare(h, target);
    const details = COLUMNS.map(
      (col) =>
        `${t(`pages.mlbbdleUI.columns.${col}`)} ${cellText(h, col, catalogue.labels) || t("pages.mlbbdleUI.unknown")} — ${verdictText(cells[col], col, t)}`,
    ).join(". ");
    return `${t("pages.mlbbdleUI.announceGuess", { name: h.name, n: guesses.length })} ${details}.`;
  }

  return (
    <Board
      label={label}
      question={question ?? t("pages.mlbbdleUI.classicQuestion")}
      guesses={guesses.length}
      titleRef={titleRef}
    >
      {!found && !over && (
        <div className="mt-4">
          <HeroInput catalogue={catalogue} excluded={excluded} onPick={onGuess} />
          {guesses.length === 0 && <p className="mt-3 text-sm text-chalk-400">{t("pages.mlbbdleUI.classicHelp")}</p>}
        </div>
      )}
      {guesses.length > 0 && <ClassicGrid guesses={guesses} target={target} catalogue={catalogue} />}
      <p aria-live="polite" className="sr-only">
        {announcement()}
      </p>
    </Board>
  );
}

function ClassicGrid({
  guesses,
  target,
  catalogue,
}: {
  guesses: string[];
  target: MlbbdleHero;
  catalogue: MlbbdleCatalogue;
}) {
  const t = useT();
  // Guesses already there on mount (a resumed game) do not flip: only those
  // played during the visit are animated.
  const [start] = useState(guesses.length);
  const rows = guesses.map((slug, i) => ({ slug, i })).reverse();

  return (
    <div className="relative mt-5 overflow-x-auto pb-1">
      <style>{FLIP}</style>
      <table className="border-separate border-spacing-1 text-center">
        <caption className="sr-only">{t("pages.mlbbdleUI.gridCaption")}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-1 pb-1 align-bottom text-[0.65rem] font-medium uppercase tracking-wide text-chalk-500">
              {t("pages.mlbbdleUI.heroColumn")}
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-1 pb-1 align-bottom text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-chalk-500"
              >
                {t(`pages.mlbbdleUI.columns.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ slug, i }) => {
            const h = catalogue.bySlug.get(slug);
            if (!h) return null;
            const cells = compare(h, target);
            const winner = slug === target.slug;
            const animated = i >= start;
            return (
              <tr key={slug}>
                <th
                  scope="row"
                  className={cn(
                    "h-[4.5rem] w-[4.5rem] min-w-[4.5rem] border p-1 align-middle font-normal",
                    winner ? BACKGROUND.match : "border-night-600 bg-night-950/60",
                  )}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <PortraitHeros source={h.icon} nom={h.name} taille="icone" decoratif />
                    <span className="block max-w-[4rem] truncate text-[0.62rem] leading-tight text-chalk-100">{h.name}</span>
                  </span>
                </th>
                {COLUMNS.map((c, j) => {
                  const cell = cells[c];
                  const verdict = winner ? "match" : cell.verdict;
                  const text = cellText(h, c, catalogue.labels);
                  const Arrow =
                    !winner && cell.direction === "newer" ? ArrowUp : !winner && cell.direction === "older" ? ArrowDown : null;
                  return (
                    <td
                      key={c}
                      className={cn(
                        "h-[4.5rem] w-[4.5rem] min-w-[4.5rem] max-w-[5.5rem] border px-1 py-1 align-middle text-[0.68rem] font-semibold leading-tight [overflow-wrap:anywhere]",
                        BACKGROUND[verdict],
                        animated && "motion-safe:animate-[mlbbdle-flip_0.45s_ease-out_both]",
                      )}
                      style={animated ? { animationDelay: `${(j + 1) * 110}ms` } : undefined}
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5">
                        <span>{text || t("pages.mlbbdleUI.unknown")}</span>
                        {Arrow && <Arrow size={16} aria-hidden />}
                      </span>
                      <span className="sr-only"> — {verdictText(cell, c, t)}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skill mode
// ─────────────────────────────────────────────────────────────

export function SkillGame({
  puzzle,
  guesses,
  catalogue,
  onGuess,
  label,
  over = false,
  titleRef,
}: {
  puzzle: SkillPuzzle;
  guesses: string[];
  catalogue: MlbbdleCatalogue;
  onGuess: (slug: string) => void;
  label: string;
  over?: boolean;
  titleRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const excluded = useMemo(() => new Set(guesses), [guesses]);
  const found = guesses.includes(puzzle.answer);
  const finished = found || over;
  const misses = guesses.filter((g) => g !== puzzle.answer).length;
  const unlocked = unlockedClues(finished ? Infinity : misses);
  const target = catalogue.bySlug.get(puzzle.answer);
  const clues = SKILL_CLUES.filter((c) => c.key !== "description" || puzzle.excerpt);

  function content(key: SkillClue): React.ReactNode {
    if (key === "colour") return t("pages.mlbbdleUI.colourClue");
    if (key === "name") return puzzle.name;
    if (key === "description") return <q>{puzzle.excerpt}</q>;
    return target ? target.roles.map((r) => catalogue.labels[`roles.${r}`] ?? r).join(", ") : "";
  }

  function announcement(): string {
    const last = guesses.at(-1);
    const h = last ? catalogue.bySlug.get(last) : undefined;
    if (!h) return "";
    if (h.slug === puzzle.answer) return t("pages.mlbbdleUI.announceFound", { name: h.name, n: guesses.length });
    const unlockedNow = SKILL_CLUES.find((c) => c.threshold === misses);
    return [
      t("pages.mlbbdleUI.announceWrong", { name: h.name, n: guesses.length }),
      unlockedNow ? t("pages.mlbbdleUI.announceClue", { clue: t(`pages.mlbbdleUI.clues.${unlockedNow.key}`) }) : "",
    ].join(" ");
  }

  return (
    <Board label={label} question={t("pages.mlbbdleUI.skillQuestion")} guesses={guesses.length} titleRef={titleRef}>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <Image
          src={puzzle.icon}
          alt={t(unlocked.has("colour") ? "pages.mlbbdleUI.skillAlt" : "pages.mlbbdleUI.skillAltGrey")}
          width={96}
          height={96}
          className={cn(
            "bevel-sm size-24 shrink-0 bg-night-800 transition-[filter] duration-700",
            !unlocked.has("colour") && "grayscale",
          )}
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.mlbbdleUI.cluesTitle")}</h4>
          <ol className="mt-2 space-y-1.5">
            {clues.map((clue) =>
              unlocked.has(clue.key) ? (
                <li key={clue.key} className="border-l-2 border-gold-500/60 pl-3 text-sm leading-relaxed text-chalk-200">
                  {/* A dash rather than a colon: its spacing does not depend on the language. */}
                  <span className="font-semibold text-gold-400">{t(`pages.mlbbdleUI.clues.${clue.key}`)}</span>
                  {" — "}
                  {content(clue.key)}
                </li>
              ) : (
                <li key={clue.key} className="flex items-center gap-2 pl-3 text-xs text-chalk-500">
                  <Lock size={12} aria-hidden />
                  {t("pages.mlbbdleUI.lockedClue", {
                    clue: t(`pages.mlbbdleUI.clues.${clue.key}`),
                    n: clue.threshold - misses,
                  })}
                </li>
              ),
            )}
          </ol>
        </div>
      </div>

      {!finished && (
        <div className="mt-5">
          <HeroInput catalogue={catalogue} excluded={excluded} onPick={onGuess} />
        </div>
      )}

      {guesses.length > 0 && (
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label={t("pages.mlbbdleUI.yourGuesses")}>
          {[...guesses].reverse().map((slug) => {
            const h = catalogue.bySlug.get(slug);
            if (!h) return null;
            const right = slug === puzzle.answer;
            return (
              <li
                key={slug}
                className={cn(
                  "bevel-sm flex items-center gap-2 border py-1 pl-1 pr-2.5 text-sm",
                  right ? BACKGROUND.match : "border-red-400/40 bg-red-800/40 text-chalk-100",
                )}
              >
                <PortraitHeros source={h.icon} nom={h.name} taille="petite" decoratif />
                {h.name}
                {right ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
                <span className="sr-only"> — {t(right ? "pages.mlbbdleUI.verdicts.match" : "pages.mlbbdleUI.verdicts.miss")}</span>
              </li>
            );
          })}
        </ol>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement()}
      </p>
    </Board>
  );
}

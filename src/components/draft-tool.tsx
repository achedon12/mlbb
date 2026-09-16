"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, X } from "lucide-react";
import { CardSuggestion, HeroSelector, HeroThumb } from "@/components/hero-picker";
import { LANES, splitSuggestions, suggest, type DraftHero, type SplitSuggestions } from "@/lib/draft";
import { useT } from "@/i18n/provider";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Draft helper, as a guided sequence.
 *
 * Step 1 asks the only thing the tool cannot guess: who you are facing. Each
 * enemy lane is followed, straight away, by what to take against it — the
 * answer sits under the question rather than at the bottom of the page. Step 2
 * is a refinement: your own picks open synergies and remove a lane from the
 * answers still to find.
 */
type Camp = "enemies" | "allies";

const EMPTY: Record<Lane, string | null> = {
  Gold: null,
  Jungle: null,
  Mid: null,
  Exp: null,
  Roam: null,
};

/**
 * Candidates asked of the ranking. Three are shown; the rest feeds "show
 * more", so widening the list never means a second computation.
 */
const CANDIDATES = 12;
/** Suggestions shown before "show more". */
const SHOWN = 3;

const NONE: SplitSuggestions = { head: [], tail: [] };

export function DraftTool({ heroes }: { heroes: DraftHero[] }) {
  const t = useT();
  const [enemies, setEnemies] = useState<Record<Lane, string | null>>(EMPTY);
  const [allies, setAllies] = useState<Record<Lane, string | null>>(EMPTY);
  const [open, setOpen] = useState<{ camp: Camp; lane: Lane } | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<Lane, boolean>>>({});

  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const listEnemies = Object.values(enemies).filter(Boolean) as string[];
  const listAllies = Object.values(allies).filter(Boolean) as string[];
  const known = listEnemies.length > 0;

  const suggestions = useMemo(() => {
    const map = new Map<Lane, SplitSuggestions>();
    for (const lane of LANES) {
      // A lane already filled needs no suggestion, and nothing is suggested
      // before a single opponent is known: it would be a bare tier list.
      map.set(
        lane,
        !known || allies[lane]
          ? NONE
          : splitSuggestions(
              suggest({ candidates: heroes, lane, enemies: listEnemies, allies: listAllies, limit: CANDIDATES }),
              SHOWN,
            ),
      );
    }
    return map;
  }, [heroes, known, allies, listEnemies, listAllies]);

  function choose(camp: Camp, lane: Lane, slug: string | null) {
    const apply = camp === "enemies" ? setEnemies : setAllies;
    apply((state) => ({ ...state, [lane]: slug }));
    setOpen(null);
  }

  const empty = listEnemies.length === 0 && listAllies.length === 0;

  return (
    <div className="space-y-8">
      {/* ── Step 1: the opposing line-up, each lane with its answers ───── */}
      <StepSection n={1} title={t("draftUI.stepEnemyTitle")} help={t("draftUI.waitingEnemy")}>
        <ul className="space-y-3">
          {LANES.map((lane) => {
            const split = suggestions.get(lane) ?? NONE;
            const filled = allies[lane] ? (bySlug.get(allies[lane]!)?.name ?? allies[lane]!) : null;
            return (
              <li key={lane}>
                <LaneField
                  lane={lane}
                  hero={enemies[lane] ? (bySlug.get(enemies[lane]!) ?? null) : null}
                  accent="blood"
                  onOpen={() => setOpen({ camp: "enemies", lane })}
                  onRemove={() => choose("enemies", lane, null)}
                />
                {known && (
                  <Answers
                    lane={lane}
                    split={split}
                    filledBy={filled}
                    expanded={expanded[lane] === true}
                    onToggle={() => setExpanded((e) => ({ ...e, [lane]: !e[lane] }))}
                    onTake={(slug) => choose("allies", lane, slug)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {!known && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk-500">{t("draftUI.intro")}</p>}
      </StepSection>

      {/* ── Step 2: your own picks, an optional refinement ─────────────── */}
      <StepSection n={2} title={t("draftUI.stepYoursTitle")} help={t("draftUI.yoursDesc")} optional={t("draftUI.optional")}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {LANES.map((lane) => (
            <li key={lane}>
              <LaneField
                lane={lane}
                hero={allies[lane] ? (bySlug.get(allies[lane]!) ?? null) : null}
                accent="azure"
                onOpen={() => setOpen({ camp: "allies", lane })}
                onRemove={() => choose("allies", lane, null)}
              />
            </li>
          ))}
        </ul>
      </StepSection>

      {!empty && (
        <button
          type="button"
          onClick={() => {
            setEnemies(EMPTY);
            setAllies(EMPTY);
            setExpanded({});
          }}
          className="bevel-sm inline-flex min-h-11 items-center gap-2 border border-night-700 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          <RotateCcw size={14} aria-hidden />
          {t("draftUI.clearAll")}
        </button>
      )}

      {open && (
        <HeroSelector
          heroes={heroes}
          excluded={new Set([...listEnemies, ...listAllies])}
          lane={open.lane}
          title={t("draftUI.chooseLane", { lane: t(`lanes.${open.lane}`) })}
          onChoose={(slug) => choose(open.camp, open.lane, slug)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** A numbered step: its rank, its question, one line of help. */
function StepSection({
  n,
  title,
  help,
  optional,
  children,
}: {
  n: number;
  title: string;
  help: string;
  /** Word shown next to the title when the step may be skipped. */
  optional?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const id = `draft-step-${n}`;
  return (
    <section aria-labelledby={id}>
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden
          className="bevel-sm grid size-7 shrink-0 translate-y-1 place-items-center bg-gold-500 font-heading text-sm font-bold text-night-950"
        >
          {n}
        </span>
        <h2 id={id} className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
          <span className="sr-only">{t("draftUI.stepLabel", { n })} : </span>
          {title}
        </h2>
        {optional && <span className="text-xs font-medium uppercase tracking-wide text-chalk-500">({optional})</span>}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-chalk-500 sm:ml-9">{help}</p>
      <div className="mt-4 sm:ml-9">{children}</div>
    </section>
  );
}

/** One lane of one camp: the chosen hero, or the button that opens the roster. */
function LaneField({
  lane,
  hero,
  accent,
  onOpen,
  onRemove,
}: {
  lane: Lane;
  hero: DraftHero | null;
  accent: "blood" | "azure";
  onOpen: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-chalk-500 sm:w-24">{t(`lanes.${lane}`)}</span>
      {hero ? (
        <span
          className={cn(
            "bevel-sm flex min-h-11 flex-1 items-center gap-2 border bg-night-900/60 p-1.5",
            accent === "blood" ? "border-blood-500/40" : "border-azure-500/40",
          )}
        >
          <HeroThumb hero={hero} small />
          <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">{hero.name}</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("draftUI.remove", { name: hero.name })}
            className="grid size-8 shrink-0 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
          >
            <X size={14} aria-hidden />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="bevel-sm min-h-11 flex-1 border border-dashed border-night-700 px-3 py-2 text-left text-sm text-chalk-500 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          {t("draftUI.chooseOne")}
        </button>
      )}
    </div>
  );
}

/** What to take in a lane, right under the opponent who sits there. */
function Answers({
  lane,
  split,
  filledBy,
  expanded,
  onToggle,
  onTake,
}: {
  lane: Lane;
  split: SplitSuggestions;
  /** Name of your own pick when the lane is already taken; null otherwise. */
  filledBy: string | null;
  expanded: boolean;
  onToggle: () => void;
  onTake: (slug: string) => void;
}) {
  const t = useT();
  const laneName = t(`lanes.${lane}`);

  if (filledBy) {
    return (
      <p className="ml-3 mt-1.5 text-xs text-chalk-500 sm:ml-24">
        {t("draftUI.alreadyFilled")} — {t("draftUI.filledBy", { name: filledBy })}
      </p>
    );
  }

  const shown = expanded ? [...split.head, ...split.tail] : split.head;

  return (
    <div className="ml-3 mt-2 border-l-2 border-gold-500/30 pl-3 sm:ml-24">
      <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-gold-400">
        {t("draftUI.whatToPickLane", { lane: laneName })}
      </h3>
      {shown.length === 0 ? (
        <p className="mt-1.5 text-xs text-chalk-500">{t("draftUI.noSuggestion")}</p>
      ) : (
        <ul aria-label={t("draftUI.answersLabel", { lane: laneName })} className="mt-2 grid gap-2 md:grid-cols-3">
          {shown.map((s, rank) => (
            <li key={s.hero.slug}>
              <CardSuggestion
                suggestion={s}
                first={rank === 0}
                titleTake={t("draftUI.chooseIn", { name: s.hero.name, lane: laneName })}
                onTake={() => onTake(s.hero.slug)}
              />
            </li>
          ))}
        </ul>
      )}
      {split.tail.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-chalk-300 transition-colors hover:text-gold-400"
        >
          <ChevronDown size={13} aria-hidden className={cn("transition-transform", expanded && "rotate-180")} />
          {expanded ? t("draftUI.showLess") : t("draftUI.showMore", { n: split.tail.length })}
        </button>
      )}
    </div>
  );
}

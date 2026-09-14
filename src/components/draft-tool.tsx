"use client";

import { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { CardSuggestion, HeroSelector, HeroThumb } from "@/components/hero-picker";
import { LANES, suggest, type DraftHero } from "@/lib/draft";
import { useT } from "@/i18n/provider";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Draft helper.
 *
 * You enter what the enemy has picked, lane by lane; the tool suggests
 * answers and explains why. Your own team's picks are entered the same way,
 * which refines the suggestions as you go: an allied pick opens synergies,
 * an enemy pick closes options.
 */
type Camp = "enemies" | "allies";

const EMPTY: Record<Lane, string | null> = {
  Gold: null,
  Jungle: null,
  Mid: null,
  Exp: null,
  Roam: null,
};

export function DraftTool({ heroes }: { heroes: DraftHero[] }) {
  const t = useT();
  const [enemies, setEnemies] = useState<Record<Lane, string | null>>(EMPTY);
  const [allies, setAllies] = useState<Record<Lane, string | null>>(EMPTY);
  const [open, setOpen] = useState<{ camp: Camp; lane: Lane } | null>(null);

  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const listEnemies = Object.values(enemies).filter(Boolean) as string[];
  const listAllies = Object.values(allies).filter(Boolean) as string[];

  const suggestions = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        // A lane already filled needs no suggestion.
        picks: allies[lane]
          ? []
          : suggest({ candidates: heroes, lane, enemies: listEnemies, allies: listAllies }),
      })),
    [heroes, allies, listEnemies, listAllies],
  );

  function choose(camp: Camp, lane: Lane, slug: string | null) {
    const major = camp === "enemies" ? setEnemies : setAllies;
    major((state) => ({ ...state, [lane]: slug }));
    setOpen(null);
  }

  const empty = listEnemies.length === 0 && listAllies.length === 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Column
          title={t("draftUI.enemy")}
          help={t("draftUI.enemyDesc")}
          camp="enemies"
          selection={enemies}
          bySlug={bySlug}
          onOpen={setOpen}
          onRemove={(lane) => choose("enemies", lane, null)}
          accent="blood"
        />
        <Column
          title={t("draftUI.yours")}
          help={t("draftUI.yoursDesc")}
          camp="allies"
          selection={allies}
          bySlug={bySlug}
          onOpen={setOpen}
          onRemove={(lane) => choose("allies", lane, null)}
          accent="azure"
        />
      </div>

      {!empty && (
        <button
          type="button"
          onClick={() => {
            setEnemies(EMPTY);
            setAllies(EMPTY);
          }}
          className="bevel-sm inline-flex items-center gap-2 border border-night-700 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          <RotateCcw size={14} aria-hidden />
          {t("draftUI.clearAll")}
        </button>
      )}

      {/* ── Suggestions ──────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("draftUI.whatToPick")}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

        {empty ? (
          <p className="mt-4 max-w-2xl leading-relaxed text-chalk-500">
            {t("draftUI.intro")}
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {suggestions.map(({ lane, picks }) => (
              <div key={lane}>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
                  {lane}
                  {allies[lane] && (
                    <span className="ml-2 font-medium normal-case tracking-normal text-chalk-500">
                      {t("draftUI.alreadyFilled")}
                    </span>
                  )}
                </h3>

                {picks.length > 0 && (
                  <ul className="mt-2 grid gap-2 md:grid-cols-3">
                    {picks.map((s, rank) => (
                      <li key={s.hero.slug}>
                        <CardSuggestion
                          suggestion={s}
                          first={rank === 0}
                          titleTake={t("draftUI.chooseIn", { name: s.hero.name, lane: t(`lanes.${lane}`) })}
                          onTake={() => choose("allies", lane, s.hero.slug)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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

function Column({
  title,
  help,
  camp,
  selection,
  bySlug,
  onOpen,
  onRemove,
  accent,
}: {
  title: string;
  help: string;
  camp: Camp;
  selection: Record<Lane, string | null>;
  bySlug: Map<string, DraftHero>;
  onOpen: (v: { camp: Camp; lane: Lane }) => void;
  onRemove: (lane: Lane) => void;
  accent: "blood" | "azure";
}) {
  const t = useT();
  return (
    <section>
      <h2 className="font-heading text-lg font-bold text-chalk-100">{title}</h2>
      <p className="mt-0.5 text-xs text-chalk-500">{help}</p>

      <ul className="mt-3 space-y-1.5">
        {LANES.map((lane) => {
          const heroes = selection[lane] ? bySlug.get(selection[lane]!) : null;
          return (
            <li key={lane} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
                {t(`lanes.${lane}`)}
              </span>

              {heroes ? (
                <span
                  className={cn(
                    "bevel-sm flex flex-1 items-center gap-2 border bg-night-900/60 p-1.5",
                    accent === "blood" ? "border-blood-500/40" : "border-azure-500/40",
                  )}
                >
                  <HeroThumb hero={heroes} small />
                  <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">
                    {heroes.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(lane)}
                    aria-label={t("draftUI.remove", { name: heroes.name })}
                    className="grid size-6 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen({ camp, lane })}
                  className="bevel-sm flex-1 border border-dashed border-night-700 px-3 py-2 text-left text-sm text-chalk-500 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                >
                  {t("draftUI.chooseOne")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

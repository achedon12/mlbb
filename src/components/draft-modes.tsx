"use client";

import { useEffect, useRef, useState } from "react";
import { DraftSimulator } from "@/components/draft-simulator";
import { OutilDraft } from "@/components/outil-draft";
import { useT } from "@/i18n/fournisseur";
import type { TypeDegats } from "@/lib/composition";
import { SIMULATOR_MODE, writeAssistant, type MetaEntry, type SimulationHero } from "@/lib/draft-simulation";
import type { RangMesure } from "@/lib/rangs-mesure";
import { cn } from "@/lib/utils";

/**
 * The two modes of the draft page: the assistant (enemy lineup to suggested
 * picks) and the simulator (a whole draft against a bot). The mode lives in
 * the address (`?mode=simulator`), read after mount: the page stays static
 * and a link opens the simulator directly.
 */
type Mode = "assistant" | "simulator";
const MODES: Mode[] = ["assistant", "simulator"];

export function DraftModes({
  heroes,
  ranks,
  meta,
  damageLabels,
}: {
  heroes: SimulationHero[];
  ranks: RangMesure[];
  meta: Partial<Record<RangMesure, MetaEntry[]>>;
  damageLabels: Record<TypeDegats, string>;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("assistant");
  // The simulator only mounts once opened: it loads the rank's measurements,
  // useless to whoever never opens it. Then it stays mounted, so a trip
  // through the assistant does not lose the draft in progress.
  const [simulatorOpened, setSimulatorOpened] = useState(false);
  const tabs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") !== SIMULATOR_MODE) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
    setMode("simulator");
    setSimulatorOpened(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function select(m: Mode, focus = false) {
    setMode(m);
    if (m === "simulator") setSimulatorOpened(true);
    else {
      // The simulator writes its own parameters; the assistant clears them.
      const query = writeAssistant(window.location.search);
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    }
    if (focus) tabs.current[m]?.focus();
  }

  // Arrows, Home and End, like any tab set.
  function onKeyDown(e: React.KeyboardEvent) {
    const i = MODES.indexOf(mode);
    const target =
      e.key === "ArrowRight"
        ? MODES[(i + 1) % MODES.length]
        : e.key === "ArrowLeft"
          ? MODES[(i - 1 + MODES.length) % MODES.length]
          : e.key === "Home"
            ? MODES[0]
            : e.key === "End"
              ? MODES[MODES.length - 1]
              : null;
    if (!target) return;
    e.preventDefault();
    select(target, true);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("pages.draftSimulatorUI.tabsLabel")}
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-night-700"
      >
        {MODES.map((m) => (
          <button
            key={m}
            ref={(el) => {
              tabs.current[m] = el;
            }}
            id={`tab-${m}`}
            type="button"
            role="tab"
            aria-selected={mode === m}
            aria-controls={`panel-${m}`}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => select(m)}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-4 py-2 font-heading text-sm font-semibold uppercase tracking-wider transition-colors",
              mode === m ? "border-gold-500 text-gold-400" : "border-transparent text-chalk-500 hover:text-chalk-100",
            )}
          >
            {t(`pages.draftSimulatorUI.tabs.${m}`)}
          </button>
        ))}
      </div>

      <div id="panel-assistant" role="tabpanel" aria-labelledby="tab-assistant" hidden={mode !== "assistant"} className="pt-8">
        <OutilDraft heros={heroes} />
      </div>
      <div id="panel-simulator" role="tabpanel" aria-labelledby="tab-simulator" hidden={mode !== "simulator"} className="pt-8">
        {simulatorOpened && (
          <DraftSimulator heroes={heroes} ranks={ranks} meta={meta} damageLabels={damageLabels} active={mode === "simulator"} />
        )}
      </div>
    </div>
  );
}

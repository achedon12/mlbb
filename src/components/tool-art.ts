import type { DexPose } from "@/components/mascot";
import { illustrations } from "@/lib/data";

/**
 * The face of each tool: one hero's official artwork for its poster and the
 * hub's card, and the pose Dex takes beside it. Fixed per tool, so a tool is
 * recognised from one visit to the next; a hero whose artwork is missing
 * falls back to the next one that has some.
 */
export const TOOL_ART: Record<string, { hero: string; dex: DexPose }> = {
  "/tools": { hero: "alucard", dex: "salut" },
  "/draft": { hero: "lancelot", dex: "idee" },
  "/tools/team": { hero: "tigreal", dex: "reflexion" },
  "/tools/strategy-planner": { hero: "pharsa", dex: "carte" },
  "/tools/matchups": { hero: "chou", dex: "reflexion" },
  "/compare": { hero: "gusion", dex: "reflexion" },
  "/tools/build": { hero: "granger", dex: "idee" },
  "/tools/damage-calculator": { hero: "claude", dex: "reflexion" },
  "/tools/tier-list-maker": { hero: "lunox", dex: "idee" },
  "/tools/collection": { hero: "freya", dex: "victoire" },
  "/tools/account-value": { hero: "harith", dex: "idee" },
  "/tools/win-rate": { hero: "beatrix", dex: "reflexion" },
  "/tools/draw-calculator": { hero: "kagura", dex: "idee" },
  "/tools/timer": { hero: "martis", dex: "carte" },
  "/tools/retribution": { hero: "hayabusa", dex: "surpris" },
  "/tools/server-time": { hero: "natan", dex: "salut" },
  "/mlbbdle": { hero: "eudora", dex: "salut" },
  "/quiz": { hero: "harley", dex: "reflexion" },
  "/tools/nickname": { hero: "wanwan", dex: "idee" },
};

const FALLBACK = ["layla", "miya", "alucard", "tigreal"];

/** Path of a hero's first shown artwork, or null when it has none. */
export function artOf(hero: string): string | null {
  for (const slug of [hero, ...FALLBACK]) {
    const art = illustrations[slug];
    if (art) {
      const first = Object.values(art)[0];
      if (first) return first;
    }
  }
  return null;
}

/** Artwork and Dex pose of a tool, by its path. */
export function toolArt(href: string): { art: string | null; dex: DexPose } {
  const entry = TOOL_ART[href] ?? { hero: FALLBACK[0], dex: "idee" as DexPose };
  return { art: artOf(entry.hero), dex: entry.dex };
}

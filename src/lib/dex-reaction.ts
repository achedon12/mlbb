import type { DexPose } from "@/components/mascot";
import type { T } from "@/i18n/translations";
import type { Tier } from "@/lib/types";

/**
 * Dex's line on a hero page, by the hero's tier: a cheer when it sits at the
 * top of the tier list (S+, S), a worry at its foot (C), nothing between,
 * where a line would only be noise.
 */
export function dexReaction(t: T, name: string, tier: Tier): { pose: DexPose; text: string } | null {
  if (tier === "S+" || tier === "S") return { pose: "victoire", text: t("dex.heroTop", { name, tier }) };
  if (tier === "C") return { pose: "surpris", text: t("dex.heroLow", { name }) };
  return null;
}

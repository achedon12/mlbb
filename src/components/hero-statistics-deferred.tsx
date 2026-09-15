"use client";

import { lazy, type ComponentProps } from "react";
import type * as Statistics from "./hero-statistics";
import type * as Patch from "./hero-patch";

/**
 * Hero page statistics tab, loaded on opening.
 *
 * The tab is only mounted when first opened (`Tabs`, `deferred`), but
 * importing its components directly still put the charts, the duration bars
 * and the adjustment list in the JavaScript every hero page loads. Loaded
 * lazily, they are requested when the tab opens; the tab's server-rendered
 * summary stays on screen meanwhile (the `Tabs` Suspense fallback).
 */
const HeroStatisticsLazy = lazy(() => import("./hero-statistics").then((m) => ({ default: m.HeroStatistics })));
const HeroAdjustmentsLazy = lazy(() => import("./hero-patch").then((m) => ({ default: m.HeroAdjustments })));

export function HeroStatisticsDeferred(props: ComponentProps<typeof Statistics.HeroStatistics>) {
  return <HeroStatisticsLazy {...props} />;
}

export function HeroAdjustmentsDeferred(props: ComponentProps<typeof Patch.HeroAdjustments>) {
  return <HeroAdjustmentsLazy {...props} />;
}

"use client";

import { BuildSimulator } from "@/components/build-simulator";
import { PublishBuild } from "@/components/community-build-actions";
import type { SimulatorData } from "@/lib/build-simulator";

/**
 * The simulator with its community publishing form. A server page cannot
 * hand a render function to a client component, hence this thin wrapper; it
 * also keeps the simulator out of the community pages' bundles.
 */
export function BuildSimulatorWithPublishing(props: { data: SimulatorData; pageUrl: string; measuredDate: string }) {
  return <BuildSimulator {...props}>{(build) => <PublishBuild build={build} />}</BuildSimulator>;
}

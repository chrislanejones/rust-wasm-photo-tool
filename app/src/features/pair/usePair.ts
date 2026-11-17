// Pairing's hooks (ADR-105). Nothing here imports the engine: the phone runs
// all of this without it.
import { useMemo, useSyncExternalStore } from "react";
import type { ConvexReactClient } from "convex/react";
import { isBetaOn, subscribeBeta } from "@/lib/beta";
import { CLOUD_CONFIGURED, useCloudClient } from "@/lib/cloud";
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import { useUIStore } from "@/stores/useUIStore";
import { pairAvailability, type PairAvailability } from "./messages";
import { pickSignaling, type PairSignaling } from "./signaling";

/** Is Pair a phone offered on this computer (Settings › Beta › "pair", or
 *  `?beta=pair`)? The PHONE does not need it: opening a pairing link is its
 *  own opt-in, and only a computer with the Beta can make one. */
export function usePairBeta(): boolean {
  return useSyncExternalStore(subscribeBeta, () => isBetaOn("pair"), () => false);
}

/** The signaling this page uses: Convex, or the e2e relay; null without either. */
export function usePairSignaling(): PairSignaling | null {
  const client = useCloudClient();
  return useMemo(
    () => pickSignaling(CLOUD_CONFIGURED ? (client as unknown as ConvexReactClient) : null),
    [client],
  );
}

export function usePairAvailability(signaling: PairSignaling | null): PairAvailability {
  const online = useUIStore((s) => s.onlineFeaturesEnabled);
  return pairAvailability(isNetworkPathAllowed("pair", online), signaling !== null);
}

// Is a Beta on for this device, live? Re-renders when it is flipped here
// (Settings › Beta) or in another tab. For a surface that has to LOOK
// different with the Beta on — a file picker's `accept` list, a "Supports …"
// line — rather than only behave differently when something happens.
import { useSyncExternalStore } from "react";
import { isBetaOn, subscribeBeta } from "@/lib/beta";

export function useBetaOn(id: string): boolean {
  return useSyncExternalStore(
    subscribeBeta,
    () => isBetaOn(id),
    () => false, // server render: off, like every other fallback
  );
}

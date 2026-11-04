import { useSyncExternalStore } from "react";
import { isBetaOn, subscribeBeta } from "@/lib/beta";

/** Is the share-link trash on for this device (Settings › Beta › "trash")? */
export function useShareTrash(): boolean {
  return useSyncExternalStore(subscribeBeta, () => isBetaOn("trash"), () => false);
}

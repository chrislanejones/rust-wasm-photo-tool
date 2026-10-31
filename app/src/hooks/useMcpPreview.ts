import { useSyncExternalStore } from "react";
import { isBetaOn, subscribeBeta } from "@/lib/beta";

export function useMcpPreview(): boolean {
  return useSyncExternalStore(subscribeBeta, () => isBetaOn("mcp-connector"), () => false);
}

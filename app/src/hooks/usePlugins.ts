// React's view of lib/plugins/state.ts. One subscription per hook, so a switch
// flipped in Settings → Plugins reaches the Download dialog's picker and the
// Import / Export pane in the same render, with no reload (unlike Beta, whose
// flags are read at boot).
import { useSyncExternalStore } from "react";
import {
  activeFormats,
  arePluginsAllowed,
  isPluginOn,
  subscribePlugins,
} from "@/lib/plugins/state";
import type { ActiveFormat } from "@/lib/plugins/types";

const NONE: ActiveFormat[] = [];

export function usePluginsAllowed(): boolean {
  return useSyncExternalStore(subscribePlugins, arePluginsAllowed, () => false);
}

export function usePluginOn(id: string): boolean {
  return useSyncExternalStore(
    subscribePlugins,
    () => isPluginOn(id),
    () => false,
  );
}

/** Formats the active plugins add — empty while the master switch is off. */
export function useActivePluginFormats(): ActiveFormat[] {
  return useSyncExternalStore(subscribePlugins, activeFormats, () => NONE);
}

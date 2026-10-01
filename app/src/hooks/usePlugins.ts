// React's view of lib/plugins/state.ts. One subscription per hook, so a plugin
// added or switched in Settings → Plugins reaches the Download dialog's picker
// and the Import / Export pane in the same render, with no reload (unlike
// Beta, whose flags are read at boot). Subscribing also hydrates the installed
// list from IndexedDB, so a pane that mounts before boot finished still fills.
import { useSyncExternalStore } from "react";
import {
  activeFormats,
  arePluginsAllowed,
  installedPlugins,
  isPluginOn,
  subscribePlugins,
} from "@/lib/plugins/state";
import type { ActiveFormat, InstalledPlugin } from "@/lib/plugins/types";

const NONE: never[] = [];

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

/** The plugins this device has added, in order. */
export function useInstalledPlugins(): InstalledPlugin[] {
  return useSyncExternalStore(subscribePlugins, installedPlugins, () => NONE);
}

/** Formats the active plugins add — empty while the master switch is off. */
export function useActivePluginFormats(): ActiveFormat[] {
  return useSyncExternalStore(subscribePlugins, activeFormats, () => NONE);
}

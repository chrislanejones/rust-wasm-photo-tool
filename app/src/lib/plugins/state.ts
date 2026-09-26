// Which plugins are on, for this device.
//
// TWO SWITCHES, BOTH OFF BY DEFAULT. "Allow plugins" is the master: while it
// is off, no plugin is active whatever its own switch says, and nothing a
// plugin adds appears anywhere (no format in the Download dialog, no button in
// Import / Export). Under it, one switch per plugin. Turning the master off
// does not clear the per-plugin choices, so turning it back on restores the
// same set — the person's picks are theirs, the master is a gate.
//
// PER DEVICE, IN localStorage, LIKE BETA (ADR-064). Not a synced preference:
// a plugin is code in a BUILD, and a synced "psd: on" arriving on a device
// whose build has no such plugin would be a choice about nothing. Not a flag
// in `featureFlags.ts` either: those are `ih_*` switches for subsystems that
// exist regardless, with no Settings surface on purpose; these are a person's
// choices with a pane. So the keys are their own namespace.
//
// OFF IS THE FALLBACK. Blocked storage, an unknown id, any value that is not
// exactly "1" — off. A plugin that failed open would be one nobody decided on.
import { PLUGINS } from "./registry";
import type { ActiveFormat } from "./types";

export const PLUGINS_ALLOWED_KEY = "imagehorse:plugins";
export const pluginKey = (id: string): string => `imagehorse:plugin:${id}`;

function read(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(key, "1");
    else globalThis.localStorage?.removeItem(key);
  } catch {
    // Storage blocked: the switch shows off again next render, which is true.
  }
}

const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}

/** The master switch. */
export function arePluginsAllowed(): boolean {
  return read(PLUGINS_ALLOWED_KEY);
}

export function setPluginsAllowed(on: boolean): void {
  write(PLUGINS_ALLOWED_KEY, on);
  notify();
}

/** The plugin's own switch, regardless of the master. What the pane shows. */
export function isPluginOn(id: string): boolean {
  return read(pluginKey(id));
}

export function setPluginOn(id: string, on: boolean): void {
  if (!PLUGINS.some((p) => p.id === id)) return;
  write(pluginKey(id), on);
  notify();
}

/** Master on AND the plugin on: the only test the rest of the app asks. */
export function isPluginActive(id: string): boolean {
  return arePluginsAllowed() && isPluginOn(id);
}

/** Subscribe to changes here and, via the `storage` event, in other tabs. */
export function subscribePlugins(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PLUGINS_ALLOWED_KEY || e.key.startsWith("imagehorse:plugin:")) {
      listener();
    }
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

// `useSyncExternalStore` needs the same array back while nothing changed, or
// it re-renders forever. The signature is the one string that decides the
// answer, so the array is rebuilt only when the signature moves.
let cachedSignature = "";
let cachedFormats: ActiveFormat[] = [];

/** Every format an active plugin provides, in catalogue order. Empty while
 *  the master switch is off. */
export function activeFormats(): ActiveFormat[] {
  const allowed = arePluginsAllowed();
  const signature = allowed ? PLUGINS.map((p) => (isPluginOn(p.id) ? "1" : "0")).join("") : "";
  if (signature !== cachedSignature) {
    cachedSignature = signature;
    cachedFormats = allowed
      ? PLUGINS.filter((p) => isPluginOn(p.id)).flatMap((plugin) =>
          plugin.formats.map((format) => ({ plugin, format })),
        )
      : [];
  }
  return cachedFormats;
}

/** The active format with this id, or undefined — a stale pick (a plugin
 *  switched off while the Download dialog was open) resolves to nothing. */
export function activeFormatById(id: string): ActiveFormat | undefined {
  return activeFormats().find((f) => f.format.id === id);
}

// Which plugins this device has, and which are on.
//
// TWO SWITCHES, BOTH OFF BY DEFAULT. "Allow plugins" is the master: while it
// is off, no plugin is active whatever its own switch says, and nothing a
// plugin adds appears anywhere (no format in the Download dialog, no button
// in Import / Export). Under it, one switch per added plugin. Adding a plugin
// turns its own switch on — a person who just handed a file in wants it —
// but the master still has to be on. Turning the master off does not clear
// the per-plugin choices, so turning it back on restores the same set.
//
// THE LIST IS THE DEVICE'S. An added plugin is a record in IndexedDB
// (store.ts): the manifest beside the module's source. This module holds an
// in-memory copy so `activeFormats()` is synchronous — `useSyncExternalStore`
// needs a snapshot, not a promise — hydrated once from the store at boot
// (main.tsx) and again by the first subscriber, whichever is first.
//
// PER DEVICE, IN localStorage, LIKE BETA (ADR-064) — the switches, that is.
// Not a synced preference: a plugin is a file this device was handed, and a
// synced "psd: on" arriving on a device that was never handed the file would
// be a choice about nothing. Not a flag in `featureFlags.ts` either: those
// are `ih_*` switches for subsystems that exist regardless, with no Settings
// surface on purpose; these are a person's choices with a pane.
//
// OFF IS THE FALLBACK. Blocked storage, an unknown id, any value that is not
// exactly "1" — off. A plugin that failed open would be one nobody decided on.
import { fetchPluginSource, loadPluginModule, manifestOf } from "./load";
import { deleteStoredPlugin, listStoredPlugins, putStoredPlugin } from "./store";
import {
  PluginError,
  type ActiveFormat,
  type FormatCodec,
  type InstalledPlugin,
  type PluginModule,
} from "./types";

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

// ── The installed list ──────────────────────────────────────────────────────

let installed: InstalledPlugin[] = [];
let hydration: Promise<void> | null = null;
/** Bumped on every add / remove, so `activeFormats()` knows the list moved. */
let generation = 0;

/** Read the device's plugins out of IndexedDB, once. Safe to call from
 *  anywhere; every call after the first returns the same promise. */
export function hydrateInstalledPlugins(): Promise<void> {
  if (hydration) return hydration;
  hydration = listStoredPlugins().then((list) => {
    installed = list;
    generation++;
    notify();
  });
  return hydration;
}

/** The device's plugins, in the order they were added. Same array back until
 *  something changes. */
export function installedPlugins(): InstalledPlugin[] {
  return installed;
}

export function installedPlugin(id: string): InstalledPlugin | undefined {
  return installed.find((p) => p.id === id);
}

// ── Loading a plugin's code ─────────────────────────────────────────────────

const modules = new Map<string, Promise<PluginModule>>();

/** The running module for an installed plugin, loaded once per source. */
function moduleFor(plugin: InstalledPlugin): Promise<PluginModule> {
  const key = `${plugin.id}\n${plugin.source}`;
  let p = modules.get(key);
  if (!p) {
    p = loadPluginModule(plugin.source);
    modules.set(key, p);
    p.catch(() => modules.delete(key));
  }
  return p;
}

async function codecFor(plugin: InstalledPlugin, formatId: string): Promise<FormatCodec> {
  const mod = await moduleFor(plugin);
  const format = mod.formats.find((f) => f.id === formatId);
  if (!format) {
    throw new PluginError(`The ${plugin.name} plugin no longer provides the "${formatId}" format.`);
  }
  return { read: format.read, write: format.write };
}

// ── Adding and removing ─────────────────────────────────────────────────────

/**
 * Add (or update) a plugin from its module source. Loads and validates it
 * first, so the store never holds a module that will not run; refuses a
 * format id another installed plugin already provides; turns the plugin's own
 * switch on. Returns the record as stored.
 */
export async function addPlugin(source: string, sourceUrl: string | null): Promise<InstalledPlugin> {
  await hydrateInstalledPlugins();
  const mod = await loadPluginModule(source);
  const manifest = manifestOf(mod);
  for (const other of installed) {
    if (other.id === manifest.id) continue;
    const clash = manifest.formats.find((f) => other.formats.some((g) => g.id === f.id));
    if (clash) {
      throw new PluginError(
        `The "${clash.id}" format is already provided by the ${other.name} plugin. Remove that one first.`,
      );
    }
  }
  const record: InstalledPlugin = { ...manifest, source, sourceUrl, addedAt: Date.now() };
  await putStoredPlugin(record);
  installed = [...installed.filter((p) => p.id !== record.id), record].sort(
    (a, b) => a.addedAt - b.addedAt,
  );
  generation++;
  write(pluginKey(record.id), true);
  notify();
  return record;
}

/** Add from a URL the person typed. See `fetchPluginSource` for what is
 *  accepted. */
export async function addPluginFromUrl(input: string): Promise<InstalledPlugin> {
  const { source, url } = await fetchPluginSource(input);
  return addPlugin(source, url);
}

export async function removePlugin(id: string): Promise<void> {
  await hydrateInstalledPlugins();
  await deleteStoredPlugin(id);
  installed = installed.filter((p) => p.id !== id);
  generation++;
  write(pluginKey(id), false);
  notify();
}

// ── The switches ────────────────────────────────────────────────────────────

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

/** A no-op for a plugin this device does not have. */
export function setPluginOn(id: string, on: boolean): void {
  if (!installed.some((p) => p.id === id)) return;
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
  void hydrateInstalledPlugins();
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

// ── What the app can use ────────────────────────────────────────────────────

// `useSyncExternalStore` needs the same array back while nothing changed, or
// it re-renders forever. The signature is the one string that decides the
// answer, so the array is rebuilt only when the signature moves.
let cachedSignature = "";
let cachedFormats: ActiveFormat[] = [];

/** Every format an active plugin provides, in the order the plugins were
 *  added. Empty while the master switch is off. */
export function activeFormats(): ActiveFormat[] {
  const allowed = arePluginsAllowed();
  const signature = allowed
    ? `${generation}:${installed.map((p) => (isPluginOn(p.id) ? "1" : "0")).join("")}`
    : "";
  if (signature !== cachedSignature) {
    cachedSignature = signature;
    cachedFormats = allowed
      ? installed
          .filter((p) => isPluginOn(p.id))
          .flatMap((plugin) =>
            plugin.formats.map((format) => ({
              plugin,
              format: { ...format, load: () => codecFor(plugin, format.id) },
            })),
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

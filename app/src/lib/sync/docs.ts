// The three documents this app syncs, and nothing else.
//
// Adding a fourth is: a key in `keys.ts` (and in SYNC_KEYS in convex/sync.ts
// — `keys.test.ts` asserts the two agree), plus one `defineSyncedDoc` below.
// No schema migration, no new Convex function, no new table.
//
// ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────────
//
// THE PHOTO ARCHIVE. Originals, working copies and the op-log stay on the
// device that made them. Replicating edited pixels is a different problem
// (bytes, not kilobytes; a merge rule that cannot be "last writer wins"
// because the loser's work is a painting) and it is BLOCKED on the op-log
// breakage in docs/PARKING_LOT.md — a sync engine that replicates the archive
// today would copy an un-undone document to the second device and hand it
// back to the first. See ADR-061.
//
// THE GALLERY. Same reason: it names archives that only exist on one device.
//
// USER COLORS and RECENT TEXTS. They already cross devices, each on its own
// Convex table with its own reactive query (hooks/useUserColors.ts,
// hooks/useRecentTexts.ts). Moving them into a blob here would be a data
// migration that buys nothing — a row per swatch is the right shape for a
// list that is appended to and capped, which a whole-document LWW blob is not.
//
// THE ONLINE-FEATURES SWITCH (`onlineFeaturesEnabled`). It is CONSENT — "this
// tab may send data to a server" — and consent is given on the device in
// front of you. Syncing it meant that switching it on at work switched it on
// at home, on a device where nobody had agreed to anything. It stays in
// useUIStore's own persisted state, per browser, and never travels.
import {
  readPreferences,
  adoptPreferences,
  parsePreferences,
  serializePreferences,
  subscribePreferences,
} from "@/lib/preferences";
import { useUIStore, UI_PERSISTED_FIELDS, type MasterTab } from "@/stores/useUIStore";
import {
  useToolStore,
  TOOL_PERSISTED_FIELDS,
  type BrushMode,
  type StampSubMode,
  type ShapesMode,
  type EraserMode,
  type TextMode,
  type BatchMode,
} from "@/stores/useToolStore";
import type { ExportFormat } from "@/lib/exportImage";
import { validateFields, type FieldValidators } from "@/stores/_shared";
import { defineSyncedDoc, type SyncedDoc } from "./syncedDoc";

// ── prefs ────────────────────────────────────────────────────────────────────
// Settings → General / Appearance / Rulers & Grids / Security / Layers and
// Canvas. The blob `users.settings` used to hold on its own.
//
// Applied LIVE from another device: these are preferences — theme, rulers,
// the grid — and seeing the phone's choice arrive is the feature. No ready
// gate, because preferences.ts reads localStorage synchronously at import, so
// `defineSyncedDoc` records the value the moment it is defined.

/** Format 1: the field list of `serializePreferences`. The legacy
 *  `users.settings` blob is treated as format 0. */
const PREFS_FORMAT = 1;

const prefsDoc = defineSyncedDoc({
  key: "prefs",
  format: PREFS_FORMAT,
  read: readPreferences,
  adopt: (p) => adoptPreferences(p),
  serialize: serializePreferences,
  parse: parsePreferences,
});

// Every commit — a user edit or an adopted value — reaches the document. An
// adopted one is ignored inside `changedLocally` (adopting is never an edit),
// so the echo dies there rather than looping back out onto the channel.
subscribePreferences(() => prefsDoc.changedLocally());

// ── zustand-backed documents ─────────────────────────────────────────────────

/** Minimal shape of a persisted zustand store, typed locally rather than
 *  imported: zustand's `StoreApi & { persist: ... }` needs the full state
 *  parameter, and all this needs is read, write, listen, and the hydration
 *  gate. */
interface SyncableStore<S> {
  getState: () => S;
  setState: (partial: Partial<S>) => void;
  subscribe: (listener: () => void) => () => void;
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (cb: () => void) => () => void;
  };
}

interface StoreDocOptions<S extends object> {
  key: "ui" | "tools";
  format: number;
  store: SyncableStore<S>;
  /** The fields that travel, in wire order. APPEND ONLY: the order is the
   *  canonical serialization, and reordering changes every stored blob. */
  fields: readonly (keyof S)[];
  /** Navigation-like fields — which panel is open, which mode a tool is in.
   *  From another device they are held back from a session already under way
   *  and take effect on the next load (see `AdoptContext.live`). */
  deferred: readonly (keyof S)[];
  /** The store's own per-field validators — the SAME table its `merge` runs
   *  on rehydrate, so a blob from another device is held to exactly the
   *  rules a blob from IndexedDB is. Only the fields in `fields` are used. */
  validators: FieldValidators<S>;
}

/**
 * A document over a persisted zustand store's slice.
 *
 * ── HELD-BACK FIELDS ─────────────────────────────────────────────────────────
 * Before, a phone switching to the eraser's magic mode changed the laptop's
 * eraser mode the moment the query delivered it — mid-edit, under the
 * pointer, so the laptop's NEXT stroke did something the person at the laptop
 * never chose. A navigation-like field arriving from another device while
 * this tab's session is under way is therefore not written into the store.
 * It is HELD: the document reports it (so a later push from this tab carries
 * the phone's choice instead of reverting it) while the running session keeps
 * what it had. The next load reconciles with the server again, before anyone
 * is mid-anything, and applies it.
 *
 * A held field is released the moment the user changes that field here: the
 * newer choice is theirs, on this device, and it is what gets sent.
 */
/** The validators for the fields this document carries, and no others. The
 *  store's table can be wider — `ui` leaves the consent switch on the device. */
function pickValidators<S extends object>(o: StoreDocOptions<S>): FieldValidators<S> {
  const out = {} as FieldValidators<S>;
  for (const f of o.fields) out[f] = o.validators[f];
  return out;
}

function defineStoreDoc<S extends object>(o: StoreDocOptions<S>): SyncedDoc {
  function pick(state: S): S {
    const out = {} as S;
    for (const f of o.fields) out[f] = state[f];
    return out;
  }

  /** Fields from another device that the running session has not taken yet. */
  let held: Partial<S> = {};

  /** The document's value: the store's slice, with any held fields on top. */
  const read = (): S => ({ ...pick(o.store.getState()), ...held });

  const doc = defineSyncedDoc<S>({
    key: o.key,
    format: o.format,
    read,
    adopt: (value, { live }) => {
      const now = pick(o.store.getState());
      const apply: Partial<S> = {};
      const hold: Partial<S> = {};
      for (const f of o.fields) {
        if (live && o.deferred.includes(f)) {
          if (!Object.is(value[f], now[f])) hold[f] = value[f];
        } else {
          apply[f] = value[f];
        }
      }
      held = hold;
      o.store.setState(apply);
    },
    serialize: (value) => JSON.stringify(pick(value)),
    // Validated against TODAY'S unions rather than trusted because it came
    // from the server: this blob was written by another build, whose union for
    // `masterTab` may have had a member this one does not.
    parse: (json) => {
      try {
        const p: unknown = JSON.parse(json);
        if (!p || typeof p !== "object" || Array.isArray(p)) return null;
        return validateFields(pickValidators(o), p as Record<string, unknown>, read());
      } catch {
        return null;
      }
    },
    ready: () => whenHydrated(o.store),
  });

  bridge(o.store, doc, (previous, next) => {
    // Release any held field the user has just changed here.
    for (const f of Object.keys(held) as (keyof S)[]) {
      if (!Object.is(previous[f], next[f])) delete held[f];
    }
  }, pick);

  return doc;
}

// ── ui ───────────────────────────────────────────────────────────────────────
// The synced part of useUIStore's persisted slice: which master-bar tab, and
// the command palette's recency and usage counts. Its `partialize` allowlist
// also names `onlineFeaturesEnabled`, which is deliberately NOT here — see the
// header. Transient chrome (open dialogs, the boot flags) is not persisted and
// is not synced: a dialog that opened on the laptop because the phone opened
// one is not "the same thing", it is a haunting.

interface UiSlice {
  masterTab: MasterTab;
  recentCommands: string[];
  commandUsage: Record<string, number>;
}

/** Format 1: masterTab, recentCommands, commandUsage. */
const UI_FORMAT = 1;

const uiDoc = defineStoreDoc<UiSlice>({
  key: "ui",
  format: UI_FORMAT,
  store: useUIStore as unknown as SyncableStore<UiSlice>,
  fields: ["masterTab", "recentCommands", "commandUsage"],
  // The palette's history is a record of habits and is safe to update under a
  // running session; which tab is open is not.
  deferred: ["masterTab"],
  validators: UI_PERSISTED_FIELDS,
});

// ── tools ────────────────────────────────────────────────────────────────────
// The persisted slice of useToolStore: which sub-mode each tool was left in,
// and the export format/quality. Exactly its `partialize` allowlist.
// `activeTool` is not in it — the store deliberately starts on the default
// tool rather than mid-edit, and syncing which tool a phone is holding to a
// laptop would be the same mistake one layer up.

interface ToolSlice {
  brushMode: BrushMode;
  stampSubMode: StampSubMode;
  shapesMode: ShapesMode;
  eraserMode: EraserMode;
  textMode: TextMode;
  batchMode: BatchMode;
  exportFormat: ExportFormat;
  quality: number;
}

/** Format 1: the eight fields below, in this order. */
const TOOLS_FORMAT = 1;

const toolsDoc = defineStoreDoc<ToolSlice>({
  key: "tools",
  format: TOOLS_FORMAT,
  store: useToolStore as unknown as SyncableStore<ToolSlice>,
  fields: [
    "brushMode",
    "stampSubMode",
    "shapesMode",
    "eraserMode",
    "textMode",
    "batchMode",
    "exportFormat",
    "quality",
  ],
  // Every sub-mode decides what the next stroke or click does. The export
  // format and quality are preferences read when an export starts, and apply
  // live like the rest of Settings.
  deferred: ["brushMode", "stampSubMode", "shapesMode", "eraserMode", "textMode", "batchMode"],
  validators: TOOL_PERSISTED_FIELDS,
});

// ── zustand plumbing ─────────────────────────────────────────────────────────

/** Resolves once the store's persisted state has been read back.
 *
 *  Both stores hydrate from IndexedDB, which is ASYNCHRONOUS — for a few
 *  hundred milliseconds after boot `getState()` returns the constructed
 *  defaults, not what the user left behind. Adopting a remote document in that
 *  window looks like it worked and is then overwritten by the hydration a
 *  moment later, on the device that has just been told the truth. Every
 *  document waits on this before it is reconciled.
 *
 *  ⚠️ It NEVER resolves if hydration fails (IndexedDB blocked, some private
 *  modes): zustand calls its finish listeners on success only. Anything that
 *  awaits it must bound the wait — `useCloudSync` does. */
function whenHydrated(store: SyncableStore<unknown>): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const off = store.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

/** Wire a store's changes into its document.
 *
 *  SUBSCRIBED ONLY AFTER HYDRATION, which is the whole subtlety. Rehydration
 *  arrives as an ordinary store update, so a subscription attached at module
 *  load would read the user's own persisted settings landing from IndexedDB as
 *  a change they just made — marking the document dirty and pushing the
 *  laptop's remembered state over whatever the phone last said, on every
 *  single boot. `prime` records the hydrated value instead, dirty flag
 *  untouched, and only what happens AFTER that counts as an edit.
 *
 *  Past that gate, `subscribe` fires on EVERY state change — every dialog
 *  open, every pan — so the serialize-and-compare inside `changedLocally` is
 *  what keeps this from being a write amplifier: only a change to a field the
 *  document actually carries gets past it. */
function bridge<S>(
  store: SyncableStore<S>,
  doc: SyncedDoc,
  observe: (previous: S, next: S) => void,
  pick: (state: S) => S,
): void {
  void whenHydrated(store as SyncableStore<unknown>).then(() => {
    let previous = pick(store.getState());
    doc.prime();
    store.subscribe(() => {
      const next = pick(store.getState());
      observe(previous, next);
      previous = next;
      doc.changedLocally();
    });
  });
}

/** Every synced document, in the order they are reconciled. */
export const SYNCED_DOCS: readonly SyncedDoc[] = [prefsDoc, uiDoc, toolsDoc];

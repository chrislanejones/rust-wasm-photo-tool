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
// USER COLOURS and RECENT TEXTS. They already cross devices, each on its own
// Convex table with its own reactive query (hooks/useUserColors.ts,
// hooks/useRecentTexts.ts). Moving them into a blob here would be a data
// migration that buys nothing — a row per swatch is the right shape for a
// list that is appended to and capped, which a whole-document LWW blob is not.
import {
  readPreferences,
  adoptPreferences,
  parsePreferences,
  serializePreferences,
  subscribePreferences,
} from "@/lib/preferences";
import { useUIStore, MASTER_TABS, type MasterTab } from "@/stores/useUIStore";
import {
  useToolStore,
  BRUSH_MODES,
  STAMP_SUB_MODES,
  SHAPES_MODES,
  ERASER_MODE_VALUES,
  TEXT_MODES,
  BATCH_MODES,
  type BrushMode,
  type StampSubMode,
  type ShapesMode,
  type EraserMode,
  type TextMode,
  type BatchMode,
} from "@/stores/useToolStore";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/exportImage";
import {
  validated,
  validatedNumberInRange,
  validatedNumberRecord,
  validatedStringArray,
} from "@/stores/_shared";
import { defineSyncedDoc, type SyncedDoc } from "./syncedDoc";

// ── prefs ────────────────────────────────────────────────────────────────────
// Settings → General / Appearance / Rulers & Grids / Security / Layers and
// Canvas. The blob `users.settings` used to hold on its own.

const prefsDoc = defineSyncedDoc({
  key: "prefs",
  read: readPreferences,
  adopt: adoptPreferences,
  serialize: serializePreferences,
  parse: parsePreferences,
});

// A commit — from anywhere, including an adopted value — re-serializes and
// compares. An adopted value serializes to what the document already holds, so
// the echo dies here rather than looping back out onto the channel.
subscribePreferences(() => prefsDoc.changedLocally());

// ── ui ───────────────────────────────────────────────────────────────────────
// The persisted slice of useUIStore: which master-bar tab, the command
// palette's recency and usage counts, and the online-features switch. The
// SAME fields its `partialize` allowlist names — this document replicates what
// the store already chose to remember, it does not widen it. Transient chrome
// (open dialogs, the boot flags) is not persisted and is not synced: a dialog
// that opened on the laptop because the phone opened one is not "the same
// thing", it is a haunting.

interface UiSlice {
  masterTab: MasterTab;
  recentCommands: string[];
  commandUsage: Record<string, number>;
  onlineFeaturesEnabled: boolean;
}

function readUi(): UiSlice {
  const s = useUIStore.getState();
  return {
    masterTab: s.masterTab,
    recentCommands: s.recentCommands,
    commandUsage: s.commandUsage,
    onlineFeaturesEnabled: s.onlineFeaturesEnabled,
  };
}

const uiDoc = defineSyncedDoc<UiSlice>({
  key: "ui",
  read: readUi,
  adopt: (v) => useUIStore.setState(v),
  serialize: (v) =>
    JSON.stringify({
      masterTab: v.masterTab,
      recentCommands: v.recentCommands,
      commandUsage: v.commandUsage,
      onlineFeaturesEnabled: v.onlineFeaturesEnabled,
    }),
  // The same guard the store's own `merge` applies on rehydrate, for the same
  // reason: this blob was written by another build, whose union for `masterTab`
  // may have had a member this one does not. Checked field by field against
  // TODAY'S values rather than trusted because it came from the server.
  parse: (json) => {
    try {
      const p: unknown = JSON.parse(json);
      if (!p || typeof p !== "object" || Array.isArray(p)) return null;
      const o = p as Partial<UiSlice>;
      const current = useUIStore.getState();
      return {
        masterTab: validated(o.masterTab, MASTER_TABS, current.masterTab),
        recentCommands: o.recentCommands
          ? validatedStringArray(o.recentCommands)
          : current.recentCommands,
        commandUsage: o.commandUsage
          ? validatedNumberRecord(o.commandUsage)
          : current.commandUsage,
        onlineFeaturesEnabled:
          typeof o.onlineFeaturesEnabled === "boolean"
            ? o.onlineFeaturesEnabled
            : current.onlineFeaturesEnabled,
      };
    } catch {
      return null;
    }
  },
  ready: () => whenHydrated(useUIStore),
});

// ── tools ────────────────────────────────────────────────────────────────────
// The persisted slice of useToolStore: which sub-mode each tool was left in,
// and the export format/quality. Again exactly its `partialize` allowlist.
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

function readTools(): ToolSlice {
  const s = useToolStore.getState();
  return {
    brushMode: s.brushMode,
    stampSubMode: s.stampSubMode,
    shapesMode: s.shapesMode,
    eraserMode: s.eraserMode,
    textMode: s.textMode,
    batchMode: s.batchMode,
    exportFormat: s.exportFormat,
    quality: s.quality,
  };
}

const toolsDoc = defineSyncedDoc<ToolSlice>({
  key: "tools",
  read: readTools,
  adopt: (v) => useToolStore.setState(v),
  serialize: (v) =>
    JSON.stringify({
      brushMode: v.brushMode,
      stampSubMode: v.stampSubMode,
      shapesMode: v.shapesMode,
      eraserMode: v.eraserMode,
      textMode: v.textMode,
      batchMode: v.batchMode,
      exportFormat: v.exportFormat,
      quality: v.quality,
    }),
  parse: (json) => {
    try {
      const p: unknown = JSON.parse(json);
      if (!p || typeof p !== "object" || Array.isArray(p)) return null;
      const o = p as Partial<ToolSlice>;
      const current = useToolStore.getState();
      return {
        brushMode: validated(o.brushMode, BRUSH_MODES, current.brushMode),
        stampSubMode: validated(o.stampSubMode, STAMP_SUB_MODES, current.stampSubMode),
        shapesMode: validated(o.shapesMode, SHAPES_MODES, current.shapesMode),
        eraserMode: validated(o.eraserMode, ERASER_MODE_VALUES, current.eraserMode),
        textMode: validated(o.textMode, TEXT_MODES, current.textMode),
        batchMode: validated(o.batchMode, BATCH_MODES, current.batchMode),
        exportFormat: validated(o.exportFormat, EXPORT_FORMATS, current.exportFormat),
        quality: validatedNumberInRange(o.quality, 1, 100, current.quality),
      };
    } catch {
      return null;
    }
  },
  ready: () => whenHydrated(useToolStore),
});

// ── zustand plumbing ─────────────────────────────────────────────────────────

/** Minimal shape of the `persist` API the two stores expose. Typed locally
 *  rather than imported: zustand's `StoreApi & { persist: ... }` type needs the
 *  full state parameter, and all this needs is the hydration gate. */
interface PersistedStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (cb: () => void) => () => void;
  };
  subscribe: (listener: () => void) => () => void;
}

/** Resolves once the store's persisted state has been read back.
 *
 *  Both stores hydrate from IndexedDB, which is ASYNCHRONOUS — for a few
 *  hundred milliseconds after boot `getState()` returns the constructed
 *  defaults, not what the user left behind. Adopting a remote document in that
 *  window looks like it worked and is then overwritten by the hydration a
 *  moment later, on the device that has just been told the truth. Every
 *  document waits on this before it is reconciled. */
function whenHydrated(store: PersistedStore): Promise<void> {
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
function bridge(store: PersistedStore, doc: SyncedDoc): void {
  void whenHydrated(store).then(() => {
    doc.prime();
    store.subscribe(() => doc.changedLocally());
  });
}

bridge(useUIStore as unknown as PersistedStore, uiDoc);
bridge(useToolStore as unknown as PersistedStore, toolsDoc);

/** Every synced document, in the order they are reconciled. */
export const SYNCED_DOCS: readonly SyncedDoc[] = [prefsDoc, uiDoc, toolsDoc];

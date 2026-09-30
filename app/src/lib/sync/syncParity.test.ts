// Each persisted store's field list, three ways, asserted to agree:
//
//   1. `partialize` — what the store writes to IndexedDB,
//   2. its validator table (UI_PERSISTED_FIELDS / TOOL_PERSISTED_FIELDS) —
//      what `merge` checks on rehydrate AND what the sync document checks on
//      a blob from another device,
//   3. the synced document's wire format (lib/sync/docs.ts).
//
// Before, the field list was spelled out four times per store — partialize,
// merge, and the sync document's serialize and parse — with nothing to notice
// one drifting. A field added to `partialize` but not to the sync document is
// a setting that silently never syncs; one added to the sync document but not
// to `merge` is a blob from another device landing in state unchecked.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

/** Persisted, validated, and deliberately NOT synced. Each entry is a decision
 *  with a reason, not an omission — see the header of lib/sync/docs.ts. */
const DEVICE_ONLY: Record<string, string[]> = {
  // Consent to send data to a server is given per device (finding 11).
  ui: ["onlineFeaturesEnabled"],
  tools: [],
};

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load() {
  vi.resetModules();
  const [docs, ui, tools, channel] = await Promise.all([
    import("@/lib/sync/docs"),
    import("@/stores/useUIStore"),
    import("@/stores/useToolStore"),
    import("@/lib/sync/channel"),
  ]);
  await Promise.all(docs.SYNCED_DOCS.map((d) => d.whenReady()));
  const wireKeys = (key: string) =>
    Object.keys(JSON.parse(docs.SYNCED_DOCS.find((d) => d.key === key)!.snapshot().value));
  return { ui, tools, wireKeys, close: () => channel.closeChannelForTests() };
}

const sorted = (xs: string[]) => [...xs].sort();

describe("persisted-field parity", () => {
  it("useUIStore: partialize, the validator table and the ui document name the same fields", async () => {
    const { ui, wireKeys, close } = await load();
    try {
      const store = ui.useUIStore;
      const persisted = Object.keys(store.persist.getOptions().partialize!(store.getState()));
      expect(sorted(Object.keys(ui.UI_PERSISTED_FIELDS))).toEqual(sorted(persisted));
      expect(sorted([...wireKeys("ui"), ...DEVICE_ONLY.ui])).toEqual(sorted(persisted));
    } finally {
      close();
    }
  });

  it("useToolStore: partialize, the validator table and the tools document name the same fields", async () => {
    const { tools, wireKeys, close } = await load();
    try {
      const store = tools.useToolStore;
      const persisted = Object.keys(store.persist.getOptions().partialize!(store.getState()));
      expect(sorted(Object.keys(tools.TOOL_PERSISTED_FIELDS))).toEqual(sorted(persisted));
      expect(sorted([...wireKeys("tools"), ...DEVICE_ONLY.tools])).toEqual(sorted(persisted));
    } finally {
      close();
    }
  });

  it("keeps each document's wire order — reordering renames nothing and changes every stored blob", async () => {
    // Append-only, and a change here is a format bump in docs.ts.
    const { wireKeys, close } = await load();
    try {
      expect(wireKeys("ui")).toEqual(["masterTab", "recentCommands", "commandUsage"]);
      expect(wireKeys("tools")).toEqual([
        "brushMode",
        "stampSubMode",
        "shapesMode",
        "eraserMode",
        "textMode",
        "batchMode",
        "exportFormat",
        "quality",
      ]);
    } finally {
      close();
    }
  });
});

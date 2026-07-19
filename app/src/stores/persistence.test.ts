// Persisted stores (useToolStore / useUIStore / useGalleryStore) each carry
// two contracts that no type ever checks for you:
//  1. `partialize` persists an EXACT, deliberate set of keys — each store's
//     own comments document which fields "remember your habits" vs which
//     reset on load. A field silently missing (forgot to add it) or silently
//     present (forgot to exclude it) from that set is real drift.
//  2. `merge` validates whatever IndexedDB hands back on rehydrate, falling
//     back to the running code's default for anything stale or corrupted
//     rather than trusting a same-origin-writable blob verbatim.
// These call the store's own `persist.getOptions().partialize`/`.merge`
// directly — pure functions, no real hydration round-trip needed — matching
// this repo's store-level (not component-render) test convention.
import { describe, it, expect } from "vitest";
import { useToolStore } from "./useToolStore";
import { useUIStore } from "./useUIStore";
import { useGalleryStore } from "./useGalleryStore";

describe("useToolStore persistence", () => {
  const { partialize, merge } = useToolStore.persist.getOptions();

  it("partializes exactly the four sub-mode prefs", () => {
    const persisted = partialize!(useToolStore.getState());
    expect(Object.keys(persisted).sort()).toEqual(
      ["brushMode", "eraserMode", "shapesMode", "stampSubMode"].sort(),
    );
  });

  it("does NOT partialize activeTool, selection*, or the settings blobs", () => {
    // These are documented in the store's own comment as deliberately
    // excluded — pinned here so a future "just add it to partialize" edit
    // has to consciously break this test, not silently widen persistence.
    const persisted = partialize!(useToolStore.getState());
    for (const key of ["activeTool", "selectionMask", "toolSettings", "stampSettings"]) {
      expect(persisted).not.toHaveProperty(key);
    }
  });

  it("merge falls back to the current default for a value outside the union", () => {
    const current = useToolStore.getState();
    const merged = merge!(
      {
        brushMode: "deleted-mode",
        stampSubMode: "clone",
        shapesMode: "shapes",
        eraserMode: "magic",
      },
      current,
    ) as typeof current;
    expect(merged.brushMode).toBe(current.brushMode); // stale value, fell back
    expect(merged.stampSubMode).toBe("clone"); // valid, passed through
    expect(merged.eraserMode).toBe("magic"); // valid, passed through
  });

  it("merge treats a missing/corrupted persisted blob as no-op, not a crash", () => {
    const current = useToolStore.getState();
    const merged = merge!(null, current) as typeof current;
    expect(merged.brushMode).toBe(current.brushMode);
    expect(merged.eraserMode).toBe(current.eraserMode);
  });
});

describe("useUIStore persistence", () => {
  const { partialize, merge } = useUIStore.persist.getOptions();

  it("partializes exactly masterTab, recentCommands, commandUsage", () => {
    const persisted = partialize!(useUIStore.getState());
    expect(Object.keys(persisted).sort()).toEqual(
      ["commandUsage", "masterTab", "recentCommands"].sort(),
    );
  });

  it("does NOT partialize transient dialog/celebration/boot flags", () => {
    const persisted = partialize!(useUIStore.getState());
    for (const key of ["showCommandPalette", "settingsOpen", "booting", "deleteAllOpen"]) {
      expect(persisted).not.toHaveProperty(key);
    }
  });

  it("merge falls back masterTab and shape-guards recentCommands/commandUsage", () => {
    const current = useUIStore.getState();
    const merged = merge!(
      {
        masterTab: "deleted-tab",
        recentCommands: ["a", 5, "b"],
        commandUsage: { a: 1, b: "not-a-number" },
      },
      current,
    ) as typeof current;
    expect(merged.masterTab).toBe(current.masterTab); // fell back
    expect(merged.recentCommands).toEqual(["a", "b"]); // non-string dropped
    expect(merged.commandUsage).toEqual({ a: 1 }); // non-number entry dropped
  });

  it("merge rejects a non-array/non-object blob for recentCommands/commandUsage", () => {
    const current = useUIStore.getState();
    const merged = merge!(
      { recentCommands: "not-an-array", commandUsage: "not-an-object" },
      current,
    ) as typeof current;
    expect(merged.recentCommands).toEqual([]);
    expect(merged.commandUsage).toEqual({});
  });
});

describe("useGalleryStore persistence", () => {
  const { partialize, merge } = useGalleryStore.persist.getOptions();

  it("partializes exactly imageSavings", () => {
    const persisted = partialize!(useGalleryStore.getState());
    expect(Object.keys(persisted)).toEqual(["imageSavings"]);
  });

  it("does NOT partialize the photo list or per-session selection state", () => {
    const persisted = partialize!(useGalleryStore.getState());
    for (const key of ["photos", "selectedIds", "modifiedPhotos", "activePhotoId"]) {
      expect(persisted).not.toHaveProperty(key);
    }
  });

  it("merge falls back to {} for a non-object imageSavings blob", () => {
    const current = useGalleryStore.getState();
    const merged = merge!({ imageSavings: "not-an-object" }, current) as typeof current;
    expect(merged.imageSavings).toEqual({});
  });

  it("merge passes through a well-formed imageSavings blob", () => {
    const current = useGalleryStore.getState();
    const merged = merge!(
      { imageSavings: { p1: { savingsPercent: 42 } } },
      current,
    ) as typeof current;
    expect(merged.imageSavings).toEqual({ p1: { savingsPercent: 42 } });
  });
});

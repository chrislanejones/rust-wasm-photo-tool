// The Object Removal mask lives in the store, not in the component that draws
// it — the brush is on the canvas and the controls are in the AI panel, two
// different subtrees. These pin the stroke bookkeeping that used to be the
// popup's local `useState`, because nothing else can: the rasterizer needs a
// real 2D canvas (vitest runs in node) and the registration math needs a laid
// -out DOM, so the browser pass covers those and this covers the reducer.
import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "./useToolStore";
import { hasMaskPaint } from "@/lib/objectRemovalMask";

const s = () => useToolStore.getState();

describe("useToolStore — Object Removal mask strokes", () => {
  beforeEach(() => {
    // `setObjectRemovalMasking` is itself the reset, which is the point of the
    // first test below; using it here keeps the fixture honest about that.
    s().setObjectRemovalMasking(false);
    s().setObjectRemovalBrush(40);
  });

  it("entering and leaving the mode both drop the paint", () => {
    s().setObjectRemovalMasking(true);
    s().beginObjectRemovalStroke({ x: 10, y: 10 });
    expect(s().objectRemovalStrokes).toHaveLength(1);

    s().setObjectRemovalMasking(false);
    expect(s().objectRemovalStrokes).toEqual([]);
    expect(s().objectRemovalMasking).toBe(false);

    // And entering again cannot inherit a mask from the previous visit — a
    // stale mask would remove the wrong region with no visible cause.
    s().setObjectRemovalMasking(true);
    expect(s().objectRemovalStrokes).toEqual([]);
  });

  it("leaving the mode clears the busy flag with it", () => {
    s().setObjectRemovalMasking(true);
    s().setObjectRemovalBusy(true);
    s().setObjectRemovalMasking(false);
    // Otherwise a job that ended by leaving the mode would leave the NEXT mask
    // un-paintable: the overlay refuses the pointer while busy.
    expect(s().objectRemovalBusy).toBe(false);
  });

  it("a stroke records the brush size that was live when it started", () => {
    s().setObjectRemovalMasking(true);
    s().setObjectRemovalBrush(12);
    s().beginObjectRemovalStroke({ x: 1, y: 2 });
    s().setObjectRemovalBrush(90);
    s().beginObjectRemovalStroke({ x: 3, y: 4 });

    expect(s().objectRemovalStrokes.map((k) => k.size)).toEqual([12, 90]);
  });

  it("extend appends to the open stroke and never to a closed one", () => {
    s().setObjectRemovalMasking(true);
    s().beginObjectRemovalStroke({ x: 0, y: 0 });
    s().extendObjectRemovalStroke({ x: 5, y: 5 });
    s().beginObjectRemovalStroke({ x: 9, y: 9 });
    s().extendObjectRemovalStroke({ x: 10, y: 10 });

    expect(s().objectRemovalStrokes[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ]);
    expect(s().objectRemovalStrokes[1].points).toEqual([
      { x: 9, y: 9 },
      { x: 10, y: 10 },
    ]);
  });

  it("extend with no open stroke is a no-op, not a stroke of one point", () => {
    s().setObjectRemovalMasking(true);
    s().extendObjectRemovalStroke({ x: 7, y: 7 });
    expect(s().objectRemovalStrokes).toEqual([]);
  });

  it("extend replaces the stroke object, so the overlay actually repaints", () => {
    // The overlay blits on `strokes` identity. Mutating the open stroke in
    // place would leave the paint invisible until some unrelated state moved.
    s().setObjectRemovalMasking(true);
    s().beginObjectRemovalStroke({ x: 0, y: 0 });
    const before = s().objectRemovalStrokes;
    s().extendObjectRemovalStroke({ x: 1, y: 1 });
    const after = s().objectRemovalStrokes;

    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(before[0]);
    expect(before[0].points).toHaveLength(1);
  });

  it("undo drops one stroke; clear drops them all", () => {
    s().setObjectRemovalMasking(true);
    s().beginObjectRemovalStroke({ x: 0, y: 0 });
    s().beginObjectRemovalStroke({ x: 1, y: 1 });
    s().beginObjectRemovalStroke({ x: 2, y: 2 });

    s().undoObjectRemovalStroke();
    expect(s().objectRemovalStrokes).toHaveLength(2);

    s().clearObjectRemovalStrokes();
    expect(s().objectRemovalStrokes).toEqual([]);

    // Undo past the start is harmless — the button is disabled there, but the
    // Escape/undo paths must not be able to throw either.
    expect(() => s().undoObjectRemovalStroke()).not.toThrow();
    expect(s().objectRemovalStrokes).toEqual([]);
  });

  it("hasMaskPaint gates Remove Object exactly as the popup's hasMask did", () => {
    expect(hasMaskPaint([])).toBe(false);
    // A stroke carrying no points marks no pixel, so it must not enable the
    // button — a mask of pure black asks the model to remove nothing.
    expect(hasMaskPaint([{ size: 40, points: [] }])).toBe(false);
    expect(hasMaskPaint([{ size: 40, points: [{ x: 1, y: 1 }] }])).toBe(true);
  });

  it("the mask is not persisted — the allowlist must not have grown", () => {
    // Persisting any of this would be an IndexedDB schema change and would
    // need the dexie-migration procedure. It is deliberately transient.
    const partialize = useToolStore.persist.getOptions().partialize;
    const persisted = Object.keys(
      (partialize?.(s()) ?? {}) as Record<string, unknown>,
    );
    // Prove the allowlist actually ran before asserting on what is missing
    // from it — `partialize` going undefined would make every `not.toContain`
    // below pass while persisting everything.
    expect(persisted).toContain("eraserMode");
    expect(persisted).not.toContain("objectRemovalMasking");
    expect(persisted).not.toContain("objectRemovalStrokes");
    expect(persisted).not.toContain("objectRemovalBrush");
    expect(persisted).not.toContain("objectRemovalBusy");
  });
});

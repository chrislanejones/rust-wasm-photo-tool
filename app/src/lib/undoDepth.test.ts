import { describe, expect, it } from "vitest";
import { describeUndoDepth, estimateUndoDepth, snapshotBytes } from "./undoDepth";

const MB = 1024 * 1024;
const BUDGET = 512 * MB; // src/settings.rs DEFAULT_MAX_HISTORY_BYTES

describe("snapshotBytes", () => {
  it("counts every layer at W×H×4, Canvas included", () => {
    // A default import is Canvas + Photo: two full buffers, not one.
    expect(snapshotBytes(4000, 3000, 2)).toBe(4000 * 3000 * 4 * 2);
  });

  it("adds the selection mask, 1 byte a pixel, while something is selected", () => {
    // Snapshot::bytes counts `selection.len()` — found by the ADR-052 review.
    expect(snapshotBytes(4000, 3000, 2, true)).toBe(4000 * 3000 * (4 * 2 + 1));
  });

  it("never counts fewer than one layer", () => {
    expect(snapshotBytes(10, 10, 0)).toBe(400);
  });
});

describe("estimateUndoDepth", () => {
  const base = { maxHistory: 50, maxBytes: BUDGET, logDriven: false };

  it("is 100% while the op log drives undo, whatever the image size", () => {
    const d = estimateUndoDepth({ ...base, width: 6000, height: 4000, layerCount: 2, logDriven: true });
    expect(d).toEqual({ steps: 50, maxSteps: 50, percent: 100, logDriven: true });
  });

  it("is 100% on a small image — the step count binds before the bytes", () => {
    // 1024² × 4 × 2 layers = 8 MB a copy; 64 fit, so the setting's 50 binds.
    const d = estimateUndoDepth({ ...base, width: 1024, height: 1024, layerCount: 2 });
    expect(d.steps).toBe(50);
    expect(d.percent).toBe(100);
  });

  it("drops to the byte budget on a 12 MP photo", () => {
    // 4000×3000 × 4 × 2 = 91.6 MB a copy → 5 fit in 512 MB.
    const d = estimateUndoDepth({ ...base, width: 4000, height: 3000, layerCount: 2 });
    expect(d.steps).toBe(5);
    expect(d.percent).toBe(10);
  });

  it("a live selection costs a step on a 12 MP photo", () => {
    // 4000×3000 × (4 × 2 + 1) = 108 MB a copy; 536,870,912 / 108,000,000 = 4.97 → 4.
    const d = estimateUndoDepth({ ...base, width: 4000, height: 3000, layerCount: 2, hasSelection: true });
    expect(d.steps).toBe(4);
    expect(d.percent).toBe(8);
  });

  it("drops further on a 24 MP photo", () => {
    // 6000×4000 × 4 × 2 = 183 MB a copy → 2 fit.
    const d = estimateUndoDepth({ ...base, width: 6000, height: 4000, layerCount: 2 });
    expect(d.steps).toBe(2);
    expect(d.percent).toBe(4);
  });

  it("never reports zero steps — the engine always keeps one copy", () => {
    const d = estimateUndoDepth({ ...base, width: 20000, height: 20000, layerCount: 3 });
    expect(d.steps).toBe(1);
    expect(d.percent).toBe(2);
  });

  it("measures against the History depth setting, not a fixed 50", () => {
    // Raising the setting cannot buy depth the byte budget does not have.
    const d = estimateUndoDepth({ ...base, maxHistory: 1000, width: 4000, height: 3000, layerCount: 2 });
    expect(d.steps).toBe(5);
    expect(d.maxSteps).toBe(1000);
    expect(d.percent).toBe(1);
  });

  it("reports full depth before the engine has a size", () => {
    const d = estimateUndoDepth({ ...base, width: 0, height: 0, layerCount: 0 });
    expect(d.percent).toBe(100);
  });
});

describe("describeUndoDepth", () => {
  it("says how many steps, in plain words, when the budget binds", () => {
    const text = describeUndoDepth({ steps: 2, maxSteps: 50, percent: 4, logDriven: false });
    expect(text).toContain("about 2 steps of 50");
    expect(text).not.toMatch(/snapshot|op log|log/i);
  });

  it("uses the singular for one step", () => {
    expect(describeUndoDepth({ steps: 1, maxSteps: 50, percent: 2, logDriven: false })).toContain(
      "about 1 step of 50",
    );
  });

  it("says full depth when nothing binds", () => {
    expect(describeUndoDepth({ steps: 50, maxSteps: 50, percent: 100, logDriven: true })).toBe(
      "Undo can go back the full 50 steps.",
    );
  });
});

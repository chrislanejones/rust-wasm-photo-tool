import { describe, expect, it, vi } from "vitest";
import { applyLookAsOneStep, decodeLook, describeKind, kindsIn, pickKinds, type LookStep } from "./look";

// The wire is src/look.rs's: a kind code, then that kind's values in its apply
// call's argument order (1 Preset ×5, 2 Levels ×3, 3 Adjustments ×7).
const WIRE = [
  1, 0.1, 1.2, 1.3, 8, -12,
  2, 20, 230, 1.25,
  3, 40, 100, 100, 0, 0, 0, 0,
];

describe("decodeLook", () => {
  it("reads every kind, in wire order", () => {
    const look = decodeLook(new Float64Array(WIRE));
    expect(look.map((s) => s.kind)).toEqual(["preset", "levels", "adjustments"]);
    expect(look[0]!.values).toEqual([0.1, 1.2, 1.3, 8, -12]);
    expect(look[1]!.values).toEqual([20, 230, 1.25]);
    expect(look[2]!.values).toEqual([40, 100, 100, 0, 0, 0, 0]);
  });

  it("an empty wire is an empty look", () => {
    expect(decodeLook([])).toEqual([]);
  });

  it("refuses a code it does not know, or a step cut short, rather than paste half a look", () => {
    expect(() => decodeLook([9, 1, 2])).toThrow(/Unknown look step/);
    expect(() => decodeLook([2, 20, 230])).toThrow(/Unknown look step/);
  });
});

describe("what the dialog shows", () => {
  const look = decodeLook(WIRE);

  it("lists the kinds in dialog order, whatever the history order", () => {
    expect(kindsIn(look)).toEqual(["adjustments", "preset", "levels"]);
  });

  it("names only the Adjustments sliders that moved, as the panel shows them", () => {
    expect(describeKind(look, "adjustments")).toBe("Brightness +40");
    const contrast: LookStep[] = [{ kind: "adjustments", values: [0, 125, 100, 0, 0, 0, 0] }];
    expect(describeKind(contrast, "adjustments")).toBe("Contrast +25");
  });

  it("describes Levels by its three points", () => {
    expect(describeKind(look, "levels")).toBe("black 20, white 230, gamma 1.25");
  });

  it("keeps only the ticked kinds, still in history order", () => {
    expect(pickKinds(look, new Set(["adjustments", "preset"])).map((s) => s.kind)).toEqual(["preset", "adjustments"]);
    expect(pickKinds(look, new Set(["levels"])).map((s) => s.kind)).toEqual(["levels"]);
  });
});

describe("applyLookAsOneStep", () => {
  function fakeTool() {
    const calls: string[] = [];
    const tool = {
      preset_apply: vi.fn((...a: number[]) => (calls.push(`preset ${a.join(",")}`), true)),
      levels_apply: vi.fn((...a: number[]) => (calls.push(`levels ${a.join(",")}`), true)),
      tonal_preview_begin: vi.fn(() => (calls.push("begin"), true)),
      adjust_apply: vi.fn((...a: number[]) => (calls.push(`adjust ${a.join(",")}`), Promise.resolve(true))),
      continue_step: vi.fn(() => void calls.push("continue")),
      undo_count: vi.fn(async () => (calls.push("undo_count"), 1)),
    };
    return { tool, calls };
  }

  it("joins every step after the first with continue_step, in history order", async () => {
    const { tool, calls } = fakeTool();
    await expect(applyLookAsOneStep(tool as never, decodeLook(WIRE))).resolves.toBe(1);
    expect(calls).toEqual([
      "preset 0.1,1.2,1.3,8,-12",
      "continue",
      "levels 20,230,1.25",
      "continue",
      "begin",
      "adjust 40,100,100,0,0,0,0",
      "undo_count",
    ]);
  });

  it("sends every step in the same tick, before the one read it awaits", () => {
    const { tool, calls } = fakeTool();
    void applyLookAsOneStep(tool as never, decodeLook(WIRE));
    // Synchronously, before any await: every step and the closing read are out.
    expect(calls.at(-2)).toBe("adjust 40,100,100,0,0,0,0");
    expect(calls.at(-1)).toBe("undo_count");
  });

  it("a single step sends no continue_step", async () => {
    const { tool, calls } = fakeTool();
    await applyLookAsOneStep(tool as never, pickKinds(decodeLook(WIRE), new Set(["levels"])));
    expect(calls).toEqual(["levels 20,230,1.25", "undo_count"]);
  });
});

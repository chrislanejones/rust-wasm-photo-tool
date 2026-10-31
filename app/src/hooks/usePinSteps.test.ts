import { describe, it, expect, vi } from "vitest";
import type { ImageHorseTool } from "stamp_tool";
import { followLabels } from "./usePinSteps";
import { leaderFor, type CalloutShape, type CalloutText } from "@/lib/callouts";

// A moved label's leader follows it (useTextTool → followLabels). The follow
// must read the ENGINE's state, not the Text tool's list, which trails it by a
// render: e2e/text-placement-undo.spec.ts case 2 failed 4 runs in 5 on CI
// because an undo then a quick redo pushed a no-op "leader back, leader
// forward" step that a later Ctrl+Z spent doing nothing.

const pin: CalloutShape = { id: 1, kind: 5, x0: 90, y0: 90, x1: 110, y1: 110 };
const at = (x: number, y: number): CalloutText => ({ id: 7, x, y, tile_offset_x: 0, tile_offset_y: 0, tile_w: 80, tile_h: 20 });
const A = at(200, 40); // where the label was
const B = at(400, 300); // where Placement put it
const line = (label: CalloutText) => ({ id: 2, kind: 2, ...leaderFor(pin, label), r: 0, g: 0, b: 0, stroke_width: 3, arrow_style: 0, fill_kind: 0, fill_r: 0, fill_g: 0, fill_b: 0, fill_angle: 0, fill_block: 0 });

/** An engine holding `shapes` and `texts` now; records every write. */
function engine(shapes: object[], texts: CalloutText[]) {
  const writes: string[] = [];
  const tool = {
    get_shape_annotations: async () => JSON.stringify(shapes),
    get_text_annotations: async () => JSON.stringify(texts),
    continue_step: vi.fn(() => writes.push("continue_step")),
    update_shape_annotation: vi.fn(async (id: number, _k: number, x0: number) => { writes.push(`update ${id} x0=${x0}`); }),
    reroute_connector: vi.fn(async () => { writes.push("reroute"); }),
  };
  return { tool: tool as unknown as ImageHorseTool, writes };
}

describe("followLabels", () => {
  it("a label moved in the engine, its leader not yet: the leader follows, inside the move's step", async () => {
    const { tool, writes } = engine([pin, line(A)], [B]);
    expect(await followLabels(tool, [A])).toBe(true);
    expect(writes).toEqual(["continue_step", `update 2 x0=${leaderFor(pin, B).x0}`]);
  });

  it("an undo's follow that runs after the redo landed writes nothing", async () => {
    // The undo's effect holds the list from before it (label at B); the engine
    // is already redone (label at B, its leader at B). The old follow paired
    // the Text tool's UNDONE list (label at A) with this leader and moved it.
    const { tool, writes } = engine([pin, line(B)], [B]);
    expect(await followLabels(tool, [B])).toBe(false);
    expect(writes).toEqual([]);
  });

  it("the redo's follow, from the undone list, writes nothing either", async () => {
    const { tool, writes } = engine([pin, line(B)], [B]);
    expect(await followLabels(tool, [A])).toBe(false);
    expect(writes).toEqual([]);
  });

  it("an undo that put label and leader back together writes nothing", async () => {
    const { tool, writes } = engine([pin, line(A)], [A]);
    expect(await followLabels(tool, [B])).toBe(false);
    expect(writes).toEqual([]);
  });
});

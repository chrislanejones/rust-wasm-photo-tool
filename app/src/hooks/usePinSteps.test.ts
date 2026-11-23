import { beforeAll, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ImageHorseTool } from "stamp_tool";
import { withOplogUndo } from "@/lib/tilesFlush";
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

// callout-leader.spec.ts §4 (11-22-2026). On the worker every engine call is a
// round trip, and the follow used to read the shapes and the texts in two of
// them. An undo pressed while it waited on the first reply ran in between:
// pre-undo shapes met post-undo texts, the follow "moved" a leader that needed
// nothing (from the moved pin to the label's old edge), and that write landed
// on the rewound log. It dropped the redo tail, the redo fell back to snapshot
// restore and broke the log, and the reload resumed from the archive, whose
// undo steps carry no shapes. Five of 200 runs at 4× CPU on one core.
//
// This forces that order instead of waiting for it. The REAL engine sits
// behind a port that runs one call per macrotask in strict FIFO order, the way
// engine.worker.ts drains, and the "user" posts Ctrl+Z the moment the follow's
// first read has run and its reply is still in flight.
const WASM = path.resolve(__dirname, "../../../pkg/stamp_tool_bg.wasm");

interface RealEngine {
  load_image(px: Uint8Array): void;
  clear_history(): void;
  insert_pin_annotation(x0: number, y0: number, x1: number, y1: number, n: number, color: string, kind: number): number;
  continue_step(): void;
  add_text_annotation(...a: unknown[]): number;
  set_text_align(id: number, align: number): void;
  add_shape_annotation(...a: unknown[]): number;
  move_annotations(shapes: Uint32Array, texts: Uint32Array, dx: number, dy: number): boolean;
  get_shape_annotations(): string;
  get_text_annotations(): string;
  recomposite(): void;
  undo(): boolean;
  redo(): boolean;
  oplog_op_count(): number;
  oplog_is_broken(): boolean;
}

let real: { ImageHorseTool: new (w: number, h: number) => RealEngine } | null = null;
beforeAll(async () => {
  if (!fs.existsSync(WASM)) return; // the fake-engine tests above still run
  const mod = await import("stamp_tool");
  (mod as unknown as { initSync(o: { module: BufferSource }): void }).initSync({ module: fs.readFileSync(WASM) });
  real = mod as unknown as typeof real;
});

/** The worker's port: calls queue, run one per macrotask, reply in order.
 *  `afterRun(method)` fires once a call has RUN and before its reply reaches
 *  the caller: what the user does while the reply is in flight. */
function fifoPort(engine: RealEngine, afterRun: (method: string, post: (m: string) => void) => void) {
  const queue: { method: string; args: unknown[]; done: (v: unknown) => void }[] = [];
  let pumping = false;
  const pump = () => {
    if (pumping) return;
    pumping = true;
    setTimeout(function step() {
      const req = queue.shift();
      if (!req) { pumping = false; return; }
      const value = (engine as unknown as Record<string, (...a: unknown[]) => unknown>)[req.method](...req.args);
      afterRun(req.method, post);
      req.done(value);
      setTimeout(step, 0);
    }, 0);
  };
  const post = (method: string, ...args: unknown[]) =>
    new Promise((done) => { queue.push({ method, args, done }); pump(); });
  const drained = () => new Promise<void>((r) => { const wait = () => (queue.length || pumping ? setTimeout(wait, 0) : r()); wait(); });
  const tool = new Proxy({}, { get: (_t, m: string) => (...a: unknown[]) => post(m, ...a) });
  return { tool: tool as unknown as ImageHorseTool, drained };
}

describe("followLabels against the real engine, with an undo inside its reads", () => {
  it("a Ctrl+Z that lands between the follow's reads leaves the op log whole", async (ctx) => {
    if (!real) ctx.skip();
    const t = await withOplogUndo(new real!.ImageHorseTool(1200, 900));
    t.load_image(new Uint8Array(1200 * 900 * 4).fill(240));
    t.clear_history();
    // A callout, the way usePinSteps.commitCallout places one: one step.
    t.insert_pin_annotation(283, 433, 317, 467, 1, "#ef4444", 0);
    t.continue_step();
    const id = t.add_text_annotation("Crack", 24, 0, 0, 0, false, 351, 399, 0, 0, 255, 255, 255, 255, 8, 8, 135, "");
    t.continue_step();
    t.set_text_align(id, 4);
    const label = (JSON.parse(t.get_text_annotations()) as CalloutText[])[0];
    const placedPin = (JSON.parse(t.get_shape_annotations()) as CalloutShape[])[0];
    const l = leaderFor(placedPin, label);
    t.continue_step();
    t.add_shape_annotation(2, l.x0, l.y0, l.x1, l.y1, "#ef4444", 3, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4));
    t.recomposite();
    // The §4 nudge: pin, label and leader picked, moved 10 px as one step.
    const shapeIds = (JSON.parse(t.get_shape_annotations()) as CalloutShape[]).map((s) => s.id);
    expect(t.move_annotations(Uint32Array.from(shapeIds), Uint32Array.of(id), 0, 10)).toBe(true);
    t.recomposite();
    const ops = t.oplog_op_count();
    const moved = { shapes: t.get_shape_annotations(), texts: t.get_text_annotations() };

    // The Text tool's list refreshed with the moved label (the effect's
    // `before`), and the user presses Ctrl+Z while the follow's first read is
    // in flight: undo + the flush that follows it.
    let pressed = false;
    const { tool, drained } = fifoPort(t, (method, post) => {
      if (pressed || !method.startsWith("get_")) return;
      pressed = true;
      void post("undo");
      void post("recomposite");
    });
    const followed = await followLabels(tool, JSON.parse(moved.texts) as CalloutText[]);
    await drained();
    t.recomposite(); // the flush after the follow (useTextTool)

    const opsAfterFollow = t.oplog_op_count();
    const redone = t.redo();
    t.recomposite();
    expect({
      followed, // nothing needed following
      opsAfterFollow, // the move is still there to redo
      redone,
      broken: t.oplog_is_broken(), // the redo went through the log
      layer: { shapes: t.get_shape_annotations(), texts: t.get_text_annotations() },
    }).toEqual({ followed: false, opsAfterFollow: ops, redone: true, broken: false, layer: moved });
  });
});

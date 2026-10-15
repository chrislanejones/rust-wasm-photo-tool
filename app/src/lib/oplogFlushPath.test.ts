// The bisect PARKING_LOT asked for ("in the running app, undo of ANY recorded
// edit breaks the op log", 2026-09-15), kept as a test so the answer stays
// checked.
//
// Run A — engine calls only — stays healthy: a recorded stroke, `undo()`,
// cursor 1 → 0, log never broken. The entry's hypothesis was that the app's
// own flush path (`flushToCanvas` → `onOplogFlush` + `blitLiveEngine`) desyncs
// the log somewhere between the edit and the undo, and asked for run A to be
// replayed with each call added one at a time until `oplog_engine_in_sync()`
// fails. This file is that replay, against the BUILT engine
// (pkg/stamp_tool_bg.wasm, same precedent as exif/exifOracle.test.ts) and the
// app's real modules: `onOplogFlush` + `saveOplogNow` over fake-indexeddb,
// `blitLiveEngine` on its local branch, and the diagnostics sampler's
// `tryTilesFlush` + `syncOplog`. Every step undoes through the engine's own
// `undo()` and reads the same three facts the e2e reads
// (e2e/oplog-undo-through-ui.spec.ts): not broken, cursor back to 0, op kept.
//
// Finding (10-11-2026): none of these calls desyncs the log. Every one is a
// read plus `recomposite()`, and `oplog_engine_in_sync` recomposites before
// hashing anyway. What run A had that the running app did not is
// `set_oplog_undo(true)`: the engine's replay switch defaults to OFF, and the
// app pushed it only from `syncOplog` in the Diagnostics sampler, which runs
// while that window is open — which is how the console runs were taken. With
// it off, `undo()` is the snapshot path, and `restore_snapshot` marks a
// non-empty log broken: the exact "cursor stays 1, broken" row. The fix is
// `withOplogUndo` at every `createLiveEngine` site (useEngineCore); the last
// two tests keep the pre-fix reading so the two readings stay told apart.
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/dexie/db";
import {
  __resetOplogPersistenceForTests,
  flushPendingOplogSave,
  onOplogFlush,
  setActiveOplogPhoto,
  setOplogCodecs,
} from "@/lib/oplogPersistence";
import { blitLiveEngine } from "@/lib/engine/port";
import { withOplogUndo } from "@/lib/tilesFlush";

const REPO = path.resolve(__dirname, "../../..");
const WASM = path.join(REPO, "pkg/stamp_tool_bg.wasm");

/** The engine surface this replay drives, all synchronous on the local tool. */
interface Engine {
  load_image(px: Uint8Array): void;
  set_artboard_border(pad: number, r: number, g: number, b: number, a: number): void;
  clear_history(): void;
  set_oplog_undo(on: boolean): void;
  paint_down(x: number, y: number, size: number, color: string, opacity: number, hardness: number, stab: string): void;
  paint_move(x: number, y: number): boolean;
  paint_up(): boolean;
  tonal_preview_begin(): boolean;
  levels_preview_set(black: number, white: number, gamma: number): boolean;
  levels_apply(black: number, white: number, gamma: number): boolean;
  undo(): boolean;
  undo_count(): number;
  oplog_is_broken(): boolean;
  oplog_status(): string;
  oplog_cursor(): number;
  oplog_op_count(): number;
  composite_hash_hex(): string;
  width(): number;
  height(): number;
  free(): void;
}
interface Wasm {
  initSync(o: { module: Uint8Array }): void;
  ImageHorseTool: new (w: number, h: number) => Engine;
}

const W = 64;
const H = 48;
const PAD = 12;

/** The parity tests' seed image (ops_engine_parity.rs `seed_pixels`). */
function seedPixels(w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const seam = x >= w / 2 ? 60 : 0;
      px[i++] = (y * 7) % 256;
      px[i++] = Math.max(0, 255 - ((y * 5) % 256) - seam);
      px[i++] = (x * 3) % 256;
      px[i++] = 255;
    }
  }
  return px;
}

if (!fs.existsSync(WASM)) {
  throw new Error("pkg/stamp_tool_bg.wasm is missing — run `pnpm run build:wasm` first.");
}
const wasm = (await import("stamp_tool")) as unknown as Wasm;
wasm.initSync({ module: fs.readFileSync(WASM) });
/** A feature-free build (CI's rust job) has no op-log surface; nothing to replay. */
const hasOplog = typeof wasm.ImageHorseTool.prototype.oplog_is_broken === "function";

/** The document the app's own import path creates (useEngineCore's artboard
 *  branch): photo, Canvas border, history cleared — and the replay switch
 *  pushed the way every creation site now pushes it (`withOplogUndo`, which
 *  reads `ih_oplog_undo`; unset here, so ON). Run A had the same switch on,
 *  from the Diagnostics window; the fix is that a plain session has it too. */
async function appDocument(): Promise<Engine> {
  const t = new wasm.ImageHorseTool(W, H);
  t.load_image(seedPixels(W, H));
  t.set_artboard_border(PAD, 20, 40, 60, 255);
  t.clear_history(); // the border is part of opening the photo, not an edit
  return withOplogUndo(t);
}

function stroke(t: Engine): void {
  t.paint_down(16, 16, 12, "#ff0000", 1, 0.8, "off");
  t.paint_move(40, 30);
  t.paint_move(60, 40);
  t.paint_up();
}

function levelsApply(t: Engine): void {
  t.tonal_preview_begin();
  t.levels_preview_set(20, 255, 1);
  t.levels_preview_set(48, 255, 1);
  t.levels_apply(48, 255, 1);
}

/** What the e2e reads: the op was recorded, and the undo replayed the log. */
function expectRecorded(t: Engine, what: string): void {
  expect(t.oplog_is_broken(), `${what}: broken before undo`).toBe(false);
  expect(t.oplog_op_count(), `${what}: ops`).toBe(1);
  expect(t.oplog_cursor(), `${what}: cursor`).toBe(1);
}
function expectReplayedUndo(t: Engine, what: string): void {
  expect(t.undo(), `${what}: undo() reports an undo`).toBe(true);
  expect(t.oplog_is_broken(), `${what}: oplog_is_broken() after undo`).toBe(false);
  expect(t.oplog_status(), `${what}: oplog_status() after undo`).toBe("recording");
  expect(t.oplog_cursor(), `${what}: cursor rewound`).toBe(0);
  expect(t.oplog_op_count(), `${what}: op kept as redo tail`).toBe(1);
  expect(t.undo_count(), `${what}: nothing left`).toBe(0);
}

// ── The app's flush path, as `useEngineCore.flushToCanvas` composes it ──────

/** `blitLiveEngine` on its local branch: no worker in node, so `livePort` is
 *  null and it recomposites + copies the composite out, exactly as the worker's
 *  own `blit()` does with the engine beside it. The canvas and ImageData are
 *  the two DOM objects node lacks; both are inert sinks here. */
function blit(t: Engine): void {
  const g = globalThis as { ImageData?: unknown };
  if (!g.ImageData) {
    g.ImageData = class {
      data: Uint8ClampedArray;
      constructor(a: Uint8ClampedArray | number, public width: number, public height?: number) {
        this.data = a instanceof Uint8ClampedArray ? a : new Uint8ClampedArray(a * (height ?? 0) * 4);
      }
    };
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ putImageData: () => {} }),
  } as unknown as HTMLCanvasElement;
  blitLiveEngine(t as never, canvas, null, { current: null });
}

/** `onOplogFlush` then the debounced save it arms, forced to land now. */
async function persist(t: Engine): Promise<void> {
  await onOplogFlush(t);
  await flushPendingOplogSave(t);
}

async function flushToCanvas(t: Engine): Promise<void> {
  // The app's flush, as it is with the Diagnostics sampler gone (10-14-2026):
  // persistence, then the blit. The replay switch comes from `withOplogUndo`.
  await persist(t);
  blit(t);
}

describe.skipIf(!hasOplog)("op-log undo survives the app's flush path (the PARKING_LOT bisect)", () => {
  const tools: Engine[] = [];
  const make = async () => {
    const t = await appDocument();
    tools.push(t);
    return t;
  };

  beforeEach(async () => {
    __resetOplogPersistenceForTests();
    // Persistence ON for the replay, as it is for every user (build default).
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => (k === "ih_oplog_persist" ? "1" : null) },
    };
    setOplogCodecs({
      rgbaToBlob: async (rgba) => new Blob([new Uint8Array(rgba)]),
      blobToRgba: async (blob) => new Uint8Array(await blob.arrayBuffer()),
    });
    await Promise.all([db.opLogs.clear(), db.keyframes.clear(), db.oplogManifests.clear()]);
    setActiveOplogPhoto("p1");
  });
  afterEach(() => {
    setActiveOplogPhoto(null);
    for (const t of tools.splice(0)) t.free();
    delete (globalThis as { window?: unknown }).window;
  });

  it("run A — engine calls only: the control", async () => {
    const t = await make();
    stroke(t);
    expectRecorded(t, "A");
    expectReplayedUndo(t, "A");
  });

  it("run A + blitLiveEngine", async () => {
    const t = await make();
    stroke(t);
    blit(t);
    expectRecorded(t, "A+blit");
    expectReplayedUndo(t, "A+blit");
  });

  it("run A + onOplogFlush (and the save it schedules)", async () => {
    const t = await make();
    stroke(t);
    await persist(t);
    expect(await db.oplogManifests.get("p1"), "the save landed").toMatchObject({ opCount: 1, stale: false });
    expectRecorded(t, "A+persist");
    expectReplayedUndo(t, "A+persist");
  });

  it("run A + the whole flushToCanvas, at paint_down and at paint_up like usePaintTool", async () => {
    const t = await make();
    t.paint_down(16, 16, 12, "#ff0000", 1, 0.8, "off");
    await flushToCanvas(t);
    t.paint_move(40, 30);
    blit(t); // the per-frame path: strokeCoalescer flushes after each move
    t.paint_move(60, 40);
    blit(t);
    t.paint_up();
    await flushToCanvas(t);
    expectRecorded(t, "A+flush");
    expectReplayedUndo(t, "A+flush");
    await flushToCanvas(t); // useHistory flushes after the undo too
    expect(t.oplog_is_broken()).toBe(false);
  });

  it("run B + the whole flushToCanvas: a Levels preview, apply, flush, undo", async () => {
    const t = await make();
    t.tonal_preview_begin();
    t.levels_preview_set(20, 255, 1);
    blit(t); // useTransforms flushes after every accepted preview move
    t.levels_preview_set(48, 255, 1);
    blit(t);
    t.levels_apply(48, 255, 1);
    await flushToCanvas(t);
    t.tonal_preview_begin(); // LevelsSettings reopens its preview after Apply
    expectRecorded(t, "B+flush");
    expectReplayedUndo(t, "B+flush");
  });

  it("the running app's reading before the fix: switch never pushed, undo breaks the log", async () => {
    const t = await make();
    t.set_oplog_undo(false); // the engine's default; nothing in the app pushed it
    stroke(t);
    expectRecorded(t, "switch off");
    expect(t.undo()).toBe(true);
    // Snapshot undo: the pixels are right, the log is now unusable. Cursor
    // still 1, status "broken" — the PARKING_LOT table's row C, verbatim.
    expect(t.oplog_cursor()).toBe(1);
    expect(t.oplog_is_broken()).toBe(true);
    expect(t.oplog_status()).toBe("broken — snapshot undo has taken over");
  });

  it("the levels row of the same table", async () => {
    const t = await make();
    t.set_oplog_undo(false);
    levelsApply(t);
    expectRecorded(t, "levels, switch off");
    expect(t.undo()).toBe(true);
    expect(t.oplog_cursor()).toBe(1);
    expect(t.oplog_is_broken()).toBe(true);
  });
});

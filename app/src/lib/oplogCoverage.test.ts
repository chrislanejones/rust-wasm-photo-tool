// A persisted log that is missing an edit restores without complaint and takes
// the edit away, so a redaction comes back undone. These run the app's real
// save path against the BUILT engine, with the document the app's import path
// makes (photo plus Canvas), because the bug lives between the two.
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/dexie/db";
import {
  __resetOplogPersistenceForTests,
  flushPendingOplogSave,
  hasPersistedOplog,
  onOplogFlush,
  setActiveOplogPhoto,
  setOplogCodecs,
} from "@/lib/oplogPersistence";
import { withOplogUndo } from "@/lib/tilesFlush";

const WASM = path.resolve(__dirname, "../../..", "pkg/stamp_tool_bg.wasm");

interface Engine {
  load_image(px: Uint8Array): void;
  set_artboard_border(pad: number, r: number, g: number, b: number, a: number): void;
  clear_history(): void;
  set_oplog_undo(on: boolean): void;
  paint_down(x: number, y: number, size: number, color: string, opacity: number, hardness: number, stab: string): void;
  paint_up(): boolean;
  effect_down(
    x: number, y: number, size: number, mode: string, intensity: number, pixel: number, color: string, stab: string,
  ): void;
  effect_up(): void;
  add_pin_annotation(x1: number, y1: number, x2: number, y2: number, n: number, color: string, style: number): number;
  remove_pin_annotation(id: number): void;
  recomposite(): void;
  undo_count(): number;
  oplog_cursor(): number;
  oplog_is_broken(): boolean;
  oplog_coverage(): number;
  free(): void;
}
interface Wasm {
  initSync(o: { module: Uint8Array }): void;
  ImageHorseTool: new (w: number, h: number) => Engine;
}

if (!fs.existsSync(WASM)) {
  throw new Error("pkg/stamp_tool_bg.wasm is missing — run `pnpm run build:wasm` first.");
}
const wasm = (await import("stamp_tool")) as unknown as Wasm;
wasm.initSync({ module: fs.readFileSync(WASM) });
const hasCoverage = typeof wasm.ImageHorseTool.prototype.oplog_coverage === "function";

const PHOTO = "p1";

async function appDocument(): Promise<Engine> {
  const t = new wasm.ImageHorseTool(80, 60);
  const px = new Uint8Array(80 * 60 * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = i % 251;
    px[i + 1] = i % 241;
    px[i + 2] = i % 239;
    px[i + 3] = 255;
  }
  t.load_image(px);
  t.set_artboard_border(12, 20, 40, 60, 255);
  t.clear_history();
  return withOplogUndo(t);
}

/** The app's flush, with the debounced save forced to land now. */
async function flush(t: Engine): Promise<void> {
  t.recomposite();
  await onOplogFlush(t);
  await flushPendingOplogSave(t);
}

function paint(t: Engine, x: number): void {
  t.paint_down(x, 20, 6, "#ff0000", 1, 1, "off");
  t.paint_up();
}

function redact(t: Engine): void {
  t.effect_down(30, 40, 10, "solid", 2, 8, "#000000", "off");
  t.effect_up();
}

/** Deleting a pin renumbers the rest: several ops, one undo step. */
function pinsWithCursorSlack(t: Engine): void {
  const first = t.add_pin_annotation(5, 5, 15, 15, 1, "#e03030", 0);
  t.add_pin_annotation(25, 5, 35, 15, 2, "#e03030", 0);
  t.add_pin_annotation(45, 5, 55, 15, 3, "#e03030", 0);
  t.recomposite();
  t.remove_pin_annotation(first);
}

const savedAt = async () => (await db.oplogManifests.get(PHOTO))?.updatedAt;

describe.skipIf(!hasCoverage)("a persisted log never hides a missing edit", () => {
  let t: Engine;

  beforeEach(async () => {
    __resetOplogPersistenceForTests();
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => (k === "ih_oplog_persist" ? "1" : null) },
    };
    setOplogCodecs({
      rgbaToBlob: async (rgba) => new Blob([new Uint8Array(rgba)]),
      blobToRgba: async (blob) => new Uint8Array(await blob.arrayBuffer()),
    });
    await Promise.all([db.opLogs.clear(), db.keyframes.clear(), db.oplogManifests.clear()]);
    setActiveOplogPhoto(PHOTO);
    t = await appDocument();
  });

  afterEach(() => {
    t.free();
    __resetOplogPersistenceForTests();
  });

  it("retires a saved log when a redaction lands inside the cursor slack", async () => {
    pinsWithCursorSlack(t);
    await flush(t);
    expect(await hasPersistedOplog(PHOTO)).toBe(true);

    redact(t);
    t.recomposite();
    // The old check: undo depth under the cursor, nothing broken. No op
    // counter moved either, so the flush path used to call this "nothing new".
    expect(t.undo_count()).toBeLessThanOrEqual(t.oplog_cursor());
    expect(t.oplog_is_broken()).toBe(false);

    await flush(t);
    expect(await hasPersistedOplog(PHOTO)).toBe(false);
  });

  it("never writes a first save that is already missing an edit", async () => {
    pinsWithCursorSlack(t);
    redact(t);
    await flush(t);
    expect(await hasPersistedOplog(PHOTO)).toBe(false);
  });

  it("keeps a log that covers the document", async () => {
    paint(t, 20);
    await flush(t);
    pinsWithCursorSlack(t);
    await flush(t);
    paint(t, 50);
    await flush(t);
    expect(t.oplog_coverage()).toBe(1);
    expect(await hasPersistedOplog(PHOTO)).toBe(true);
  });

  it("does not save again when nothing changed", async () => {
    paint(t, 20);
    await flush(t);
    const before = await savedAt();
    await new Promise((r) => setTimeout(r, 5));
    await flush(t);
    expect(await savedAt()).toBe(before);
  });

  it("saves recorded edits while a stroke is open, then judges the stroke once it ends", async () => {
    pinsWithCursorSlack(t);
    await flush(t);
    t.effect_down(30, 40, 10, "solid", 2, 8, "#000000", "off");
    await flush(t);
    expect(t.oplog_coverage()).toBe(2);
    expect(await hasPersistedOplog(PHOTO)).toBe(true);

    t.effect_up();
    await flush(t);
    expect(await hasPersistedOplog(PHOTO)).toBe(false);
  });
});

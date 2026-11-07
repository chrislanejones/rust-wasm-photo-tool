// A deferred op-log save belongs to the photo it was scheduled for.
//
// The debounce timer fires, then the save waits for the pen to go quiet (up to
// 20 s). During that wait nothing used to track it: `debounceTimer` was already
// null, so a photo switch could neither land it nor cancel it. The wait then
// ended with the live engine (one reused worker proxy) holding the next photo,
// and that photo's ops were written under the first photo's id.
//
// Harness: node + fake-indexeddb, real Dexie transactions, a fake engine.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import { __resetEngineDocument, setEngineDocument } from "@/lib/engineDocument";
import { makeLoadQueue } from "@/hooks/engineLoadQueue";
import {
  __resetOplogPersistenceForTests,
  flushPendingOplogSave,
  onOplogFlush,
  saveOplogNow,
  setActiveOplogPhoto,
  setOplogCodecs,
  setOplogSaveQueue,
  type OplogPersistWasm,
} from "@/lib/oplogPersistence";
import { resetStrokeGate, strokeDown, strokeUp } from "@/lib/strokeGate";

const DEBOUNCE_MS = 2000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One engine, like the reused worker proxy: `hold` swaps the document in it. */
class FakeTool implements OplogPersistWasm {
  ops: number[] = [];
  generation = 0;
  cursor = 0;
  width = 4;
  height = 3;

  hold(...ops: number[]): void {
    this.ops = ops;
    this.cursor = ops.length;
    this.generation++;
  }
  undo_count(): number {
    return this.cursor;
  }
  oplog_active(): boolean {
    return true;
  }
  oplog_is_broken(): boolean {
    return false;
  }
  oplog_op_count(): number {
    return this.ops.length;
  }
  oplog_cursor(): number {
    return this.cursor;
  }
  oplog_generation(): number {
    return this.generation;
  }
  oplog_encoded_ops(from: number, to: number): Uint8Array {
    const out: number[] = [];
    for (const op of this.ops.slice(from, to)) out.push(1, 0, 0, 0, op);
    return new Uint8Array(out);
  }
  oplog_mem_keyframe_ops(): Uint32Array {
    return new Uint32Array([0]);
  }
  oplog_keyframe_pixels_rgba(): Uint8Array {
    return new Uint8Array(this.width * this.height * 4).fill(7);
  }
  oplog_keyframe_annotations(): Uint8Array {
    return new Uint8Array([1, 0]);
  }
  oplog_keyframe_width(): number {
    return this.width;
  }
  oplog_keyframe_height(): number {
    return this.height;
  }
  oplog_restore(): boolean {
    return true;
  }
}

/** The ops on disk for a photo, read from its chunks: what a resume replays. */
async function persistedOps(photoId: string): Promise<number[]> {
  const chunks = await db.opLogs.where("photoId").equals(photoId).sortBy("chunkSeq");
  const ops: number[] = [];
  for (const { bytes } of chunks) {
    for (let i = 4; i < bytes.length; i += 5) ops.push(bytes[i]!);
  }
  return ops;
}

/** A save's waiting room: the debounce has fired, and a stroke holds the gate. */
async function saveWaitingForQuiet(tool: FakeTool): Promise<void> {
  await onOplogFlush(tool);
  strokeDown();
  await wait(DEBOUNCE_MS + 100);
}

/** Lift the pen and give any save still alive time to land. */
async function releaseGate(): Promise<void> {
  strokeUp();
  await wait(DEBOUNCE_MS + 200);
}

beforeEach(async () => {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => (k === "ih_oplog_persist" ? "1" : null) },
  };
  __resetOplogPersistenceForTests();
  __resetEngineDocument();
  resetStrokeGate();
  setOplogCodecs({
    rgbaToBlob: async (rgba) => new Blob([new Uint8Array(rgba)]),
    blobToRgba: async (blob) => new Uint8Array(await blob.arrayBuffer()),
  });
  await Promise.all([db.opLogs.clear(), db.keyframes.clear(), db.oplogManifests.clear()]);
});

afterEach(() => resetStrokeGate());

describe("a save waiting for the pen to go quiet", () => {
  it("lands on a photo switch, and never writes the next photo's ops under this id", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    setEngineDocument("A");
    tool.hold(1, 2, 3);
    await saveWaitingForQuiet(tool);

    await flushPendingOplogSave(tool);
    expect(await persistedOps("A")).toEqual([1, 2, 3]);

    // The switch finishes: the same engine now holds B.
    tool.hold(9);
    setEngineDocument("B");
    setActiveOplogPhoto("B");
    await releaseGate();

    expect(await persistedOps("A")).toEqual([1, 2, 3]);
  }, 15_000);

  it("is canceled when the active photo changes without a flush", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    tool.hold(1, 2);
    await saveWaitingForQuiet(tool);

    tool.hold(9);
    setActiveOplogPhoto("B");
    await releaseGate();

    expect(await persistedOps("A")).toEqual([]);
  }, 15_000);

  it("is refused once the engine holds another photo, even if nothing canceled it", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    setEngineDocument("A");
    tool.hold(1, 2);
    await saveWaitingForQuiet(tool);

    // The load landed and the React effect that moves the active photo has not.
    tool.hold(9);
    setEngineDocument("B");
    await releaseGate();

    expect(await persistedOps("A")).toEqual([]);
  }, 15_000);

  it("still saves when nothing switched", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    setEngineDocument("A");
    tool.hold(1, 2);
    await saveWaitingForQuiet(tool);
    await releaseGate();

    expect(await persistedOps("A")).toEqual([1, 2]);
  }, 15_000);

  it("does not let the next photo's broken log retire this photo's saved log", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    setEngineDocument("A");
    tool.hold(1, 2);
    await saveOplogNow(tool, "A");
    tool.ops.push(3);
    tool.cursor = 3;
    await saveWaitingForQuiet(tool);

    tool.hold(9);
    tool.oplog_is_broken = () => true;
    setEngineDocument("B");
    await releaseGate();

    expect((await db.oplogManifests.get("A"))?.stale).toBe(false);
  }, 15_000);

  it("keeps its wait when edits keep arriving, so they can't push the save back forever", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    tool.hold(1);
    await saveWaitingForQuiet(tool);
    strokeUp();

    // Each flush lands inside the debounce window of the one before it.
    for (let op = 2; op <= 5; op++) {
      tool.ops.push(op);
      tool.cursor = tool.ops.length;
      await onOplogFlush(tool);
      await wait(800);
    }

    expect((await persistedOps("A")).length).toBeGreaterThan(0);
  }, 15_000);

  it("is the one save, so edits during the wait do not start a second", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    tool.hold(1, 2);
    await saveWaitingForQuiet(tool);

    let saves = 0;
    const encode = tool.oplog_mem_keyframe_ops.bind(tool);
    tool.oplog_mem_keyframe_ops = () => {
      saves++;
      return encode();
    };
    tool.ops.push(3);
    tool.cursor = 3;
    await onOplogFlush(tool);
    await wait(DEBOUNCE_MS + 100);
    await releaseGate();

    expect(saves).toBe(1);
    expect(await persistedOps("A")).toEqual([1, 2, 3]);
  }, 15_000);
});

describe("a save and the document queue", () => {
  it("runs through the queue, so it cannot read a load in progress", async () => {
    const tool = new FakeTool();
    const queue = makeLoadQueue();
    setOplogSaveQueue(queue);
    setActiveOplogPhoto("A");
    setEngineDocument("A");
    tool.hold(1, 2);
    await onOplogFlush(tool);

    // A load that spans the debounce, and claims the document as it ends.
    const load = queue(async () => {
      tool.hold(9);
      await wait(DEBOUNCE_MS + 300);
      setEngineDocument("B");
    });
    await wait(DEBOUNCE_MS + 100);
    expect(await persistedOps("A")).toEqual([]);
    await load;
    await wait(100);

    expect(await persistedOps("A")).toEqual([]);
  }, 15_000);

  it("is canceled if the switch lands while it waits its turn", async () => {
    const tool = new FakeTool();
    const queue = makeLoadQueue();
    setOplogSaveQueue(queue);
    setActiveOplogPhoto("A");
    tool.hold(1, 2);
    await onOplogFlush(tool);

    // Past the debounce and the quiet window, so it is queued behind this load.
    const load = queue(() => wait(DEBOUNCE_MS + 2300));
    await wait(DEBOUNCE_MS + 2100);
    setActiveOplogPhoto("B");
    await load;
    await wait(100);

    expect(await persistedOps("A")).toEqual([]);
  }, 15_000);

  it("refuses to commit if the engine changes hands during the encode", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    setEngineDocument("A");
    tool.hold(1, 2);
    const encode = tool.oplog_mem_keyframe_ops.bind(tool);
    tool.oplog_mem_keyframe_ops = () => {
      setEngineDocument("B");
      return encode();
    };

    await saveOplogNow(tool, "A");

    expect(await db.oplogManifests.get("A")).toBeUndefined();
  });

  it("flushing inside the queue does not wait on itself", async () => {
    const tool = new FakeTool();
    const queue = makeLoadQueue();
    setOplogSaveQueue(queue);
    setActiveOplogPhoto("A");
    tool.hold(1, 2);
    await onOplogFlush(tool);

    await queue(() => flushPendingOplogSave(tool));

    expect(await persistedOps("A")).toEqual([1, 2]);
  });

  it("a flush with nothing pending still waits out a save already running", async () => {
    const tool = new FakeTool();
    setActiveOplogPhoto("A");
    tool.hold(1, 2, 3);
    const running = saveOplogNow(tool, "A");

    await flushPendingOplogSave(tool);

    expect(await persistedOps("A")).toEqual([1, 2, 3]);
    await running;
  });
});

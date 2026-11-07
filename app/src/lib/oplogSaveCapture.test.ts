// A save reads the log in several round trips to the engine, so an edit can land
// between any two of them. What it writes has to be one log anyway.
//
// Harness: node + fake-indexeddb, real Dexie transactions, a fake engine.
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  __resetOplogPersistenceForTests,
  onOplogFlush,
  saveOplogNow,
  setActiveOplogPhoto,
  setOplogCodecs,
  type OplogPersistWasm,
} from "@/lib/oplogPersistence";

class FakeTool implements OplogPersistWasm {
  ops: number[] = [];
  generation = 0;
  cursor = 0;
  revision = 0;
  /** Runs once, inside the save, at the named read. */
  during: { read: "frames" | "keyframes" | "generation"; run: () => void } | null = null;

  private fire(read: "frames" | "keyframes" | "generation"): void {
    if (this.during?.read !== read) return;
    const { run } = this.during;
    this.during = null;
    run();
  }
  push(...ops: number[]): void {
    this.ops.push(...ops);
    this.cursor = this.ops.length;
    this.revision++;
  }
  /** Undo back to `length`, then a new edit: the redo tail is gone. */
  branch(length: number, ...ops: number[]): void {
    this.ops = this.ops.slice(0, length);
    this.generation++;
    this.push(...ops);
  }
  undo_count(): number {
    return 0;
  }
  oplog_edit_revision(): number {
    return this.revision;
  }
  oplog_coverage(): number {
    return 1;
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
    this.fire("generation");
    return this.generation;
  }
  oplog_encoded_ops(from: number, to: number): Uint8Array {
    this.fire("frames");
    const out: number[] = [];
    for (const op of this.ops.slice(from, to)) out.push(1, 0, 0, 0, op);
    return new Uint8Array(out);
  }
  oplog_mem_keyframe_ops(): Uint32Array {
    this.fire("keyframes");
    return new Uint32Array([0]);
  }
  oplog_keyframe_pixels_rgba(): Uint8Array {
    return new Uint8Array(48).fill(7);
  }
  oplog_keyframe_annotations(): Uint8Array {
    return new Uint8Array([1, 0]);
  }
  oplog_keyframe_width(): number {
    return 4;
  }
  oplog_keyframe_height(): number {
    return 3;
  }
  oplog_restore(): boolean {
    return true;
  }
}

/** The ops on disk, read from the chunks: what a resume would replay. */
async function persistedOps(photoId: string): Promise<number[]> {
  const chunks = await db.opLogs.where("photoId").equals(photoId).sortBy("chunkSeq");
  const ops: number[] = [];
  for (const { bytes } of chunks) {
    for (let i = 4; i < bytes.length; i += 5) ops.push(bytes[i]!);
  }
  return ops;
}

beforeEach(async () => {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => (k === "ih_oplog_persist" ? "1" : null) },
  };
  __resetOplogPersistenceForTests();
  setOplogCodecs({
    rgbaToBlob: async (rgba) => new Blob([new Uint8Array(rgba)]),
    blobToRgba: async (blob) => new Uint8Array(await blob.arrayBuffer()),
  });
  await Promise.all([db.opLogs.clear(), db.keyframes.clear(), db.oplogManifests.clear()]);
  setActiveOplogPhoto("A");
});

describe("an edit landing inside a save", () => {
  // Each read a branch can land in. The old branch's ops must never be followed
  // by the new branch's frames.
  for (const read of ["generation", "frames", "keyframes"] as const) {
    it(`during the ${read} read: nothing spliced reaches disk`, async () => {
      const tool = new FakeTool();
      tool.push(1, 2, 3);
      await saveOplogNow(tool, "A");
      tool.push(4);
      tool.during = { read, run: () => tool.branch(2, 8, 9) };

      await saveOplogNow(tool, "A");
      expect(await persistedOps("A")).toEqual([1, 2, 3]);

      // The flush that follows the edit saves the log as it now is.
      await saveOplogNow(tool, "A");
      expect(await persistedOps("A")).toEqual([1, 2, 8, 9]);
    });
  }

  it("the flush after it is not read as nothing new", async () => {
    const tool = new FakeTool();
    tool.push(1, 2, 3);
    await saveOplogNow(tool, "A");
    tool.push(4);
    tool.during = { read: "frames", run: () => tool.push(5) };

    await saveOplogNow(tool, "A");

    let scheduled = false;
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void, ms?: number) => {
      scheduled = true;
      return realSetTimeout(fn, ms);
    }) as typeof setTimeout;
    try {
      await onOplogFlush(tool);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
    expect(scheduled).toBe(true);
  });

  it("an unrecorded edit landing after the coverage answer stops the clean write", async () => {
    const tool = new FakeTool();
    tool.push(1, 2);
    tool.during = {
      read: "keyframes",
      run: () => {
        tool.revision++; // no op counter moves
      },
    };

    await saveOplogNow(tool, "A");

    expect(await db.oplogManifests.get("A")).toBeUndefined();
  });

  it("a quiet log still saves", async () => {
    const tool = new FakeTool();
    tool.push(1, 2, 3);

    await saveOplogNow(tool, "A");

    expect(await persistedOps("A")).toEqual([1, 2, 3]);
    expect((await db.oplogManifests.get("A"))?.stale).toBe(false);
  });
});

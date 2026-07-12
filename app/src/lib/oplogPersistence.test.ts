// Write/restore path tests (night-project Tasks B–D). Harness: node env +
// fake-indexeddb — REAL Dexie transactions; the engine is a small fake
// implementing the persistence surface (the true engine side of the round
// trip is proven byte-exact in Rust: src/ops_engine_parity.rs).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  __resetOplogPersistenceForTests,
  restoreOplog,
  saveOplogNow,
  setOplogCodecs,
  type OplogPersistWasm,
} from "@/lib/oplogPersistence";

// Verification switch on (build flag stays OFF — kill-switch default).
beforeEach(() => {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (k === "ih_oplog_persist" ? "1" : null),
    },
  };
});

/** A fake engine: ops are one-byte payloads; frames use the real u32-LE
 *  framing so chunk concatenation is exercised for real. */
class FakeTool implements OplogPersistWasm {
  ops: number[] = [];
  generation = 0;
  cursor = 0;
  broken = false;
  restoreArgs: unknown[] | null = null;
  restoreOk = true;
  width = 4;
  height = 3;

  push(...ops: number[]): void {
    this.ops.push(...ops);
    this.cursor = this.ops.length;
  }
  branchTo(n: number, ...ops: number[]): void {
    this.ops.length = n;
    this.generation += 1;
    this.ops.push(...ops);
    this.cursor = this.ops.length;
  }

  oplog_active(): boolean {
    return !this.broken;
  }
  oplog_is_broken(): boolean {
    return this.broken;
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
    for (const op of this.ops.slice(from, to)) {
      out.push(1, 0, 0, 0, op); // [len=1 LE][payload]
    }
    return new Uint8Array(out);
  }
  oplog_mem_keyframe_ops(): Uint32Array {
    // Base + a 50-boundary keyframe once the log is long enough.
    return this.ops.length >= 50 ? new Uint32Array([0, 50]) : new Uint32Array([0]);
  }
  oplog_keyframe_pixels_rgba(): Uint8Array {
    return new Uint8Array(this.width * this.height * 4).fill(7);
  }
  oplog_keyframe_annotations(): Uint8Array {
    return new Uint8Array([1, 0]); // opaque token; must round-trip verbatim
  }
  oplog_keyframe_width(): number {
    return this.width;
  }
  oplog_keyframe_height(): number {
    return this.height;
  }
  oplog_restore(
    baseRgba: Uint8Array,
    baseW: number,
    baseH: number,
    baseAnnotations: Uint8Array,
    frames: Uint8Array,
    cursor: number,
  ): boolean {
    this.restoreArgs = [baseRgba, baseW, baseH, baseAnnotations, frames, cursor];
    return this.restoreOk;
  }
}

async function seedPhoto(id: string): Promise<void> {
  await db.photos.put({
    id,
    name: `${id}.png`,
    width: 4,
    height: 3,
    originalId: `orig-${id}`,
    createdAt: 1,
    updatedAt: 1,
  });
}

beforeEach(async () => {
  __resetOplogPersistenceForTests();
  setOplogCodecs({
    // Store raw RGBA in the blob; decode returns it verbatim (lossless
    // stand-in for PNG round-tripping).
    rgbaToBlob: async (rgba) => new Blob([new Uint8Array(rgba)]),
    blobToRgba: async (blob) => new Uint8Array(await blob.arrayBuffer()),
  });
  await Promise.all([
    db.photos.clear(),
    db.opLogs.clear(),
    db.keyframes.clear(),
    db.oplogManifests.clear(),
    db.originals.clear(),
    db.workingCopies.clear(),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("write path", () => {
  it("first save writes exactly one chunk, the base keyframe, and the manifest", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(10, 11, 12);
    await saveOplogNow(t, "p1");

    const chunks = await db.opLogs.toArray();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ chunkSeq: 0, opCount: 3 });
    expect(Array.from(chunks[0].bytes)).toEqual([1, 0, 0, 0, 10, 1, 0, 0, 0, 11, 1, 0, 0, 0, 12]);

    const kfs = await db.keyframes.toArray();
    expect(kfs).toHaveLength(1);
    expect(kfs[0].atOp).toBe(0);
    expect(Array.from(kfs[0].annotations!)).toEqual([1, 0]);

    const m = (await db.oplogManifests.get("p1"))!;
    expect(m).toMatchObject({ opCount: 3, chunkCount: 1, cursor: 3, generation: 0 });
  });

  it("a linear follow-up save appends ONE delta chunk (prefix untouched)", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(10, 11);
    await saveOplogNow(t, "p1");
    t.push(12, 13, 14);
    await saveOplogNow(t, "p1");

    const chunks = await db.opLogs.toArray();
    expect(chunks.map((c) => [c.chunkSeq, c.opCount])).toEqual([
      [0, 2],
      [1, 3],
    ]);
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 5, chunkCount: 2 });
  });

  it("keyframes fire at the 50-op boundary", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(...Array.from({ length: 49 }, (_, i) => i));
    await saveOplogNow(t, "p1");
    expect((await db.keyframes.toArray()).map((k) => k.atOp)).toEqual([0]);
    t.push(49, 50);
    await saveOplogNow(t, "p1");
    expect((await db.keyframes.toArray()).map((k) => k.atOp).sort((a, b) => a - b)).toEqual([0, 50]);
  });

  it("a history branch (generation bump) rewrites chunks + keyframes", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(...Array.from({ length: 55 }, (_, i) => i));
    await saveOplogNow(t, "p1");
    expect(await db.opLogs.count()).toBe(1);
    expect(await db.keyframes.count()).toBe(2);

    // Undo to 10, draw 2 new ops → generation bumps, log shrinks.
    t.branchTo(10, 200, 201);
    await saveOplogNow(t, "p1");

    const chunks = await db.opLogs.toArray();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ chunkSeq: 0, opCount: 12 });
    expect((await db.keyframes.toArray()).map((k) => k.atOp)).toEqual([0]);
    expect(await db.oplogManifests.get("p1")).toMatchObject({
      opCount: 12,
      chunkCount: 1,
      generation: 1,
    });
  });

  it("an interrupted transaction leaves the prior state fully intact; retry succeeds", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(10, 11);
    await saveOplogNow(t, "p1");

    t.push(12);
    const put = vi.spyOn(db.opLogs, "put").mockRejectedValueOnce(new Error("torn write"));
    await expect(saveOplogNow(t, "p1")).rejects.toThrow("torn write");
    put.mockRestore();

    // Transaction aborted: nothing moved.
    expect(await db.opLogs.count()).toBe(1);
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 2, chunkCount: 1 });

    // Retry lands the delta.
    await saveOplogNow(t, "p1");
    expect(await db.opLogs.count()).toBe(2);
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 3, chunkCount: 2 });
  });
});

describe("restore path", () => {
  it("round-trips: restore hands the engine the exact base + concatenated frames + cursor", async () => {
    await seedPhoto("p1");
    const writer = new FakeTool();
    writer.push(10, 11);
    await saveOplogNow(writer, "p1");
    writer.push(12);
    writer.cursor = 2; // user undid one op before "closing"
    await saveOplogNow(writer, "p1");

    const reader = new FakeTool();
    expect(await restoreOplog(reader, "p1")).toBe("restored");
    const [rgba, w, h, ann, frames, cursor] = reader.restoreArgs as [
      Uint8Array,
      number,
      number,
      Uint8Array,
      Uint8Array,
      number,
    ];
    expect(w).toBe(4);
    expect(h).toBe(3);
    expect(rgba.length).toBe(4 * 3 * 4);
    expect(rgba[0]).toBe(7);
    expect(Array.from(ann)).toEqual([1, 0]);
    expect(Array.from(frames)).toEqual([1, 0, 0, 0, 10, 1, 0, 0, 0, 11, 1, 0, 0, 0, 12]);
    expect(cursor).toBe(2, "resume lands on the cursor the user last saw");
  });

  it("legacy bridge: a photo with no persisted log restores 'none' (old path), then starts a log on its next save", async () => {
    await seedPhoto("legacy");
    const t = new FakeTool();
    expect(await restoreOplog(t, "legacy")).toBe("none");
    expect(t.restoreArgs).toBeNull();

    // The photo's "history starts now": first edit after opening persists a
    // base keyframe of its current state + the new ops.
    t.push(42);
    await saveOplogNow(t, "legacy");
    expect(await db.oplogManifests.get("legacy")).toMatchObject({ opCount: 1 });
    expect((await db.keyframes.toArray()).map((k) => k.atOp)).toEqual([0]);
  });

  it("fails safe: missing chunks, count mismatch, or engine rejection → 'failed', never throws", async () => {
    await seedPhoto("p1");
    const writer = new FakeTool();
    writer.push(10, 11, 12);
    await saveOplogNow(writer, "p1");

    // Delete a chunk out from under the manifest.
    await db.opLogs.clear();
    const r1 = new FakeTool();
    expect(await restoreOplog(r1, "p1")).toBe("failed");

    // Rebuild, then have the engine reject.
    await saveOplogNow(writer, "p1");
    const r2 = new FakeTool();
    r2.restoreOk = false;
    expect(await restoreOplog(r2, "p1")).toBe("failed");
  });

  it("kill switch: everything is inert when disabled", async () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: () => null },
    };
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(1, 2, 3);
    expect(await restoreOplog(t, "p1")).toBe("none");
  });
});

describe("engine-PNG surface (preferred path)", () => {
  class PngTool extends FakeTool {
    pngRequested: number[] = [];
    restorePngArgs: unknown[] | null = null;
    oplog_keyframe_png(atOp: number): Uint8Array {
      this.pngRequested.push(atOp);
      // Distinctive bytes; must land in the blob VERBATIM.
      return new Uint8Array([137, 80, 78, 71, atOp, 42]);
    }
    oplog_restore_png(
      basePng: Uint8Array,
      baseAnnotations: Uint8Array,
      frames: Uint8Array,
      cursor: number,
    ): boolean {
      this.restorePngArgs = [basePng, baseAnnotations, frames, cursor];
      return true;
    }
  }

  it("stores the engine's PNG bytes verbatim and restores through oplog_restore_png", async () => {
    await seedPhoto("p1");
    const writer = new PngTool();
    writer.push(10, 11);
    await saveOplogNow(writer, "p1");
    expect(writer.pngRequested).toEqual([0]);

    const kf = (await db.keyframes.toArray())[0];
    expect(Array.from(new Uint8Array(await kf.blob.arrayBuffer()))).toEqual([
      137, 80, 78, 71, 0, 42,
    ]);

    const reader = new PngTool();
    expect(await restoreOplog(reader, "p1")).toBe("restored");
    expect(reader.restoreArgs).toBeNull(); // RGBA entry point NOT used
    const [png, , frames, cursor] = reader.restorePngArgs as [
      Uint8Array,
      Uint8Array,
      Uint8Array,
      number,
    ];
    expect(Array.from(png)).toEqual([137, 80, 78, 71, 0, 42]);
    expect(Array.from(frames)).toEqual([1, 0, 0, 0, 10, 1, 0, 0, 0, 11]);
    expect(cursor).toBe(2);
  });
});

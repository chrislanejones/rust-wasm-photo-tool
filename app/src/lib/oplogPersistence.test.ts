// Write/restore path tests (night-project Tasks B–D). Harness: node env +
// fake-indexeddb — REAL Dexie transactions; the engine is a small fake
// implementing the persistence surface (the true engine side of the round
// trip is proven byte-exact in Rust: src/ops_engine_parity.rs).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  __resetOplogPersistenceForTests,
  onOplogFlush,
  restoreOplog,
  saveOplogNow,
  setActiveOplogPhoto,
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

// A fresh engine object = a document reset (every load path constructs a new
// ImageHorseTool). The write path must treat its log as a NEW log, whatever
// the counters happen to say — a fresh log always restarts at generation 0,
// so counters alone can collide exactly with what is already on disk.
describe("write path: a fresh engine log never splices onto persisted chunks", () => {
  it("rewrites when a new engine reaches the persisted op count (same generation)", async () => {
    await seedPhoto("p1");
    const first = new FakeTool();
    first.push(10, 11, 12);
    await saveOplogNow(first, "p1");

    // Document reset on the SAME photo (AI result / re-load): brand-new engine,
    // brand-new base, log restarts at generation 0 — and the user draws enough
    // to reach the persisted count before the first save fires.
    const afterReset = new FakeTool();
    afterReset.width = 6; // a visibly different base keyframe
    afterReset.push(90, 91, 92, 93, 94);
    await saveOplogNow(afterReset, "p1");

    // ONE chunk holding only the NEW log — not [old 0..2] + [new 3..4].
    const chunks = await db.opLogs.toArray();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ chunkSeq: 0, opCount: 5 });
    expect(Array.from(chunks[0].bytes)).toEqual([
      1, 0, 0, 0, 90, 1, 0, 0, 0, 91, 1, 0, 0, 0, 92, 1, 0, 0, 0, 93, 1, 0, 0, 0, 94,
    ]);
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 5, chunkCount: 1 });

    // And the base keyframe is the NEW document's, not the old one's.
    const kfs = await db.keyframes.toArray();
    expect(kfs).toHaveLength(1);
    expect(kfs[0]).toMatchObject({ atOp: 0, width: 6 });

    // The round trip agrees: restore replays exactly the new log.
    const reader = new FakeTool();
    expect(await restoreOplog(reader, "p1")).toBe("restored");
    const [, w, , , frames] = reader.restoreArgs as [
      Uint8Array,
      number,
      number,
      Uint8Array,
      Uint8Array,
      number,
    ];
    expect(w).toBe(6);
    expect(Array.from(frames)).toEqual([
      1, 0, 0, 0, 90, 1, 0, 0, 0, 91, 1, 0, 0, 0, 92, 1, 0, 0, 0, 93, 1, 0, 0, 0, 94,
    ]);
  });

  it("rewrites when a new engine's counters exactly equal the persisted ones", async () => {
    await seedPhoto("p1");
    const first = new FakeTool();
    first.push(10, 11, 12);
    await saveOplogNow(first, "p1");

    // Identical op count, cursor and generation — the pathological collision.
    const afterReset = new FakeTool();
    afterReset.push(90, 91, 92);
    await saveOplogNow(afterReset, "p1");

    const chunks = await db.opLogs.toArray();
    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0].bytes)).toEqual([
      1, 0, 0, 0, 90, 1, 0, 0, 0, 91, 1, 0, 0, 0, 92,
    ]);
  });

  it("still appends the delta for the SAME engine after a restore (no needless rewrite)", async () => {
    await seedPhoto("p1");
    const writer = new FakeTool();
    writer.push(10, 11);
    await saveOplogNow(writer, "p1");

    const resumed = new FakeTool();
    expect(await restoreOplog(resumed, "p1")).toBe("restored");
    // The restored engine holds the persisted log; keep editing it.
    resumed.push(10, 11, 12);
    await saveOplogNow(resumed, "p1");

    const chunks = await db.opLogs.toArray();
    expect(chunks.map((c) => [c.chunkSeq, c.opCount])).toEqual([
      [0, 2],
      [1, 1],
    ]);
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

// An op log only describes a single-PIXEL-layer document, and only while every
// edit was recorded. When that stops being true the log still REPLAYS — it just
// replays into a document the user no longer has. Restoring it would silently
// hand back an older document, and the working copy (which is current) would
// never be consulted, because nothing "failed".
describe("a log that stopped describing the document is retired, not persisted", () => {
  class LayeredTool extends FakeTool {
    /** Real pixel layers — the Canvas does NOT count (ADR-016). */
    contentLayers = 1;
    /** Total layers including the Canvas — what the Layers panel shows. */
    totalLayers = 1;
    content_layer_count(): number {
      return this.contentLayers;
    }
    layer_count(): number {
      return this.totalLayers;
    }
  }

  it("the DEFAULT document (Canvas + Photo) is trustworthy — the Canvas is metadata", async () => {
    // ADR-016, from the JS side. `canvasArtboard` is ON by default, so the
    // artboard fill sits at index 0 of virtually every document: two layers in
    // the panel, ONE pixel layer to the log. Gating on `layer_count()` (2)
    // rather than `content_layer_count()` (1) is exactly what kept op-log
    // persistence dark for every user on defaults — the log got written and
    // then retired as untrustworthy on the very next flush.
    await seedPhoto("p1");
    const t = new LayeredTool();
    t.totalLayers = 2; // Canvas + Photo
    t.contentLayers = 1; // ...one pixel layer
    t.push(10, 11);
    await saveOplogNow(t, "p1");

    expect(await db.oplogManifests.get("p1")).toMatchObject({
      opCount: 2,
      stale: false,
    });
    expect(await restoreOplog(new FakeTool(), "p1")).toBe("restored");
  });

  it("an unrecorded edit (broken log): no write, existing log marked stale, restore falls back", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(10, 11, 12);
    await saveOplogNow(t, "p1");
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 3, stale: false });

    // Clone stamp / filter / mask — the engine can't express it as an op.
    t.broken = true;
    t.push(13); // whatever the counters say now, the log is not the document
    await saveOplogNow(t, "p1");

    // Nothing new written, and the log on disk is retired.
    const chunks = await db.opLogs.toArray();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].opCount).toBe(3);
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 3, stale: true });

    // Resume ⇒ "none" (use the working copy), NOT a confident wrong restore.
    const reader = new FakeTool();
    expect(await restoreOplog(reader, "p1")).toBe("none");
    expect(reader.restoreArgs).toBeNull();
  });

  it("a multi-layer document retires the persisted log (the layers-then-reload data-loss path)", async () => {
    await seedPhoto("p1");
    const t = new LayeredTool();
    t.totalLayers = 2; // the default Canvas + Photo document...
    t.contentLayers = 1; // ...which IS in scope
    t.push(10, 11);
    await saveOplogNow(t, "p1");

    // The user adds a REAL layer (a paste, not the Canvas). oplog_active() goes
    // false, so nothing schedules a save — the stale log used to just sit there
    // and win the next resume.
    t.totalLayers = 3;
    t.contentLayers = 2;
    setActiveOplogPhoto("p1");
    onOplogFlush(t);
    await vi.waitFor(async () =>
      expect(await db.oplogManifests.get("p1")).toMatchObject({ stale: true }),
    );

    const reader = new FakeTool();
    expect(await restoreOplog(reader, "p1")).toBe("none");
  });

  it("recovers: a healthy log after a reset rewrites the photo and clears the stale mark", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(10, 11);
    await saveOplogNow(t, "p1");
    t.broken = true;
    await saveOplogNow(t, "p1");
    expect(await db.oplogManifests.get("p1")).toMatchObject({ stale: true });

    // A load resets the document → fresh engine, fresh (healthy) log.
    const fresh = new FakeTool();
    fresh.push(20, 21, 22);
    await saveOplogNow(fresh, "p1");

    const m = await db.oplogManifests.get("p1");
    expect(m).toMatchObject({ opCount: 3, chunkCount: 1, stale: false });
    const chunks = await db.opLogs.toArray();
    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0].bytes)).toEqual([1, 0, 0, 0, 20, 1, 0, 0, 0, 21, 1, 0, 0, 0, 22]);
    expect(await restoreOplog(new FakeTool(), "p1")).toBe("restored");
  });

  it("back-compat: a manifest written by the shipped v2 code (no `stale` field) restores normally", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(10, 11);
    await saveOplogNow(t, "p1");

    // Rewrite the manifest in the exact shape the shipped code wrote: no
    // `stale` key at all. `undefined` must read as "not stale".
    const m = (await db.oplogManifests.get("p1"))!;
    const { stale: _dropped, ...v2Shape } = m;
    await db.oplogManifests.put(v2Shape as typeof m);
    expect("stale" in (await db.oplogManifests.get("p1"))!).toBe(false);

    expect(await restoreOplog(new FakeTool(), "p1")).toBe("restored");
  });
});

// The 2026-07-14 A/B data loss: same build, flags ON vs OFF, import a 200×150
// photo (default artboard → 220×170 document), edit NOTHING, reload, resume.
// Flags ON came back 200×150 — the write path had persisted the EMPTY log
// (base captured before `set_artboard_border` grew the document), restore
// validated it, reported success, and short-circuited the working-copy
// archive that restores the full stack correctly. Incomplete restore ≠
// success: zero-op logs are never persisted and never restorable.
describe("a zero-op log is never persisted, and never restores (2026-07-14 A/B)", () => {
  it("write path: an empty live log writes NOTHING", async () => {
    await seedPhoto("p1");
    const t = new FakeTool(); // armed, zero ops — the edit-free import
    await saveOplogNow(t, "p1");

    expect(await db.oplogManifests.get("p1")).toBeUndefined();
    expect(await db.opLogs.count()).toBe(0);
    expect(await db.keyframes.count()).toBe(0);
  });

  it("write path: an empty live log RETIRES a previously persisted log (rows kept, reversible)", async () => {
    await seedPhoto("p1");
    const writer = new FakeTool();
    writer.push(10, 11, 12);
    await saveOplogNow(writer, "p1");
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 3, stale: false });

    // A load/reset on the same photo: fresh engine, fresh EMPTY log. The
    // on-disk 3-op log now describes a document the engine is not holding —
    // leaving it restorable would resurrect the old document on next boot.
    const afterReset = new FakeTool();
    await saveOplogNow(afterReset, "p1");

    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 3, stale: true });
    expect(await db.opLogs.count()).toBe(1); // retired, not destroyed
    expect(await db.keyframes.count()).toBe(1);
    expect(await restoreOplog(new FakeTool(), "p1")).toBe("none");
  });

  it("flush path: an empty live log never schedules a save, and retires the on-disk log", async () => {
    await seedPhoto("p1");
    const writer = new FakeTool();
    writer.push(10, 11);
    await saveOplogNow(writer, "p1");

    const afterReset = new FakeTool(); // active, zero ops
    setActiveOplogPhoto("p1");
    onOplogFlush(afterReset);
    await vi.waitFor(async () =>
      expect(await db.oplogManifests.get("p1")).toMatchObject({ stale: true }),
    );
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 2 });
  });

  it("restore path: a zero-op manifest ALREADY on disk (the A/B shape) falls through as 'none'", async () => {
    // Rows exactly as the pre-fix write path left them on real user disks:
    // manifest {opCount:0, stale:false} + a base keyframe of the PRE-artboard
    // plane (200×150 — the document was 220×170).
    await seedPhoto("p1");
    await db.oplogManifests.put({
      photoId: "p1",
      branch: "main",
      opCount: 0,
      chunkCount: 0,
      formatVersion: 1,
      generation: 0,
      cursor: 0,
      stale: false,
      updatedAt: 1,
    });
    await db.keyframes.put({
      photoId: "p1",
      branch: "main",
      atOp: 0,
      blob: new Blob([new Uint8Array(200 * 150 * 4)]),
      annotations: new Uint8Array([2, 0, 0, 0]),
      width: 200,
      height: 150,
      createdAt: 1,
    });

    const reader = new FakeTool();
    expect(await restoreOplog(reader, "p1")).toBe("none");
    expect(reader.restoreArgs, "the engine restore is never invoked").toBeNull();
  });

  it("a log with ops still persists and restores exactly as before", async () => {
    // The guard must not over-trigger: one recorded op is a real document.
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(42);
    await saveOplogNow(t, "p1");
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 1, stale: false });
    expect(await restoreOplog(new FakeTool(), "p1")).toBe("restored");
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

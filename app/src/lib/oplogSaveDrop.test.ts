// #21 — a save that arrives while another is in flight used to be DROPPED.
//
// `saveOplogNow` opened with `if (!hasPersistExports(tool) || saving) return;`
// — a silent no-op with no retry and no signal to the caller. That is data
// loss, not a leak, because of what happens next: `restoreFromOplog` runs
// FIRST in useImageSession and a "restored" result short-circuits the
// working-copy path. So the tail ops never reach disk, and on resume the user
// is handed a valid, internally consistent, OLDER document.
//
// Two ways in, both reproduced below:
//   1. photo switch — `flushPendingOplogSave` fires while a debounced save is
//      still awaiting IndexedDB. It clears the pending timer and calls
//      `saveOplogNow`, which returns immediately. The timer is gone, so
//      nothing retries.
//   2. no switch needed — at a backlog of `OPS_PER_FORCED_SAVE` the debounce
//      delay is 0, so a timer can fire straight into an in-flight save.
//
// Harness: node + fake-indexeddb, the same one the existing write-path tests
// use — real Dexie transactions, a fake engine. Fixtures, never a real gallery.
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  __resetOplogPersistenceForTests,
  flushPendingOplogSave,
  onOplogFlush,
  saveOplogNow,
  setActiveOplogPhoto,
  setOplogCodecs,
  type OplogPersistWasm,
} from "@/lib/oplogPersistence";

beforeEach(() => {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => (k === "ih_oplog_persist" ? "1" : null) },
  };
});

/** Minimal engine fake — ops are one-byte payloads with real u32-LE framing. */
class FakeTool implements OplogPersistWasm {
  ops: number[] = [];
  generation = 0;
  cursor = 0;
  width = 4;
  height = 3;

  push(...ops: number[]): void {
    this.ops.push(...ops);
    this.cursor = this.ops.length;
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

async function seedPhoto(id: string): Promise<void> {
  await db.photos.put({
    id, name: `${id}.png`, width: 4, height: 3,
    originalId: `orig-${id}`, createdAt: 1, updatedAt: 1,
  });
}

/** Persisted op count for a photo — what a resume would actually replay. */
async function persistedOpCount(photoId: string): Promise<number> {
  return (await db.oplogManifests.get(photoId))?.opCount ?? 0;
}

beforeEach(async () => {
  __resetOplogPersistenceForTests();
  setOplogCodecs({
    rgbaToBlob: async (rgba) => new Blob([new Uint8Array(rgba)]),
    blobToRgba: async (blob) => new Uint8Array(await blob.arrayBuffer()),
  });
  await Promise.all([
    db.photos.clear(), db.opLogs.clear(), db.keyframes.clear(),
    db.oplogManifests.clear(), db.originals.clear(), db.workingCopies.clear(),
  ]);
});

describe("#21 — a save arriving during an in-flight save", () => {
  it("does not drop the second save: the tail ops reach disk", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(1, 2, 3);

    // Save A starts and is left un-awaited: it is mid-flight, exactly as it
    // would be while the user keeps drawing.
    const first = saveOplogNow(t, "p1");
    // More strokes land while A is still writing.
    t.push(4, 5, 6);
    // Save B — this is the call that used to hit `saving === true` and return
    // having done nothing at all.
    const second = saveOplogNow(t, "p1");

    await Promise.all([first, second]);

    // The whole point: what is on disk has to describe the document as it is
    // NOW, not as it was when the first save started. Before the fix this
    // came back 3.
    expect(await persistedOpCount("p1")).toBe(6);
  });

  it("photo switch: flushPendingOplogSave cannot silently lose the tail", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    setActiveOplogPhoto("p1");
    t.push(1, 2, 3);

    // A debounced save is in flight...
    const inFlight = saveOplogNow(t, "p1");
    // ...the user keeps drawing, which schedules a NEW debounce timer. That
    // timer is what lets the flush below reach saveOplogNow at all.
    t.push(4, 5, 6, 7);
    onOplogFlush(t);

    // Now the photo switch. This clears the pending timer, so if the save it
    // makes is dropped, nothing is left to retry it.
    await flushPendingOplogSave(t);
    await inFlight;

    expect(await persistedOpCount("p1")).toBe(7);
  });

  it("a caller that awaits the flush can trust it: no write is still pending after it resolves", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    setActiveOplogPhoto("p1");
    t.push(1, 2, 3);
    const inFlight = saveOplogNow(t, "p1");
    t.push(4, 5);
    onOplogFlush(t);

    await flushPendingOplogSave(t);
    await inFlight;

    // Read immediately, with no extra ticks: useImageSession switches photos
    // the moment the flush resolves, and anything landing after that would
    // be written against the WRONG photo's engine document.
    expect(await persistedOpCount("p1")).toBe(5);
  });

  it("serialises rather than interleaves — the manifest never describes a half-written log", async () => {
    await seedPhoto("p1");
    const t = new FakeTool();
    t.push(...Array.from({ length: 10 }, (_, i) => i));

    const a = saveOplogNow(t, "p1");
    t.push(10, 11);
    const b = saveOplogNow(t, "p1");
    t.push(12);
    const c = saveOplogNow(t, "p1");
    await Promise.all([a, b, c]);

    const manifest = await db.oplogManifests.get("p1");
    const chunks = await db.opLogs.where("photoId").equals("p1").toArray();
    const opsInChunks = chunks.reduce((n, ch) => n + ch.opCount, 0);

    // The manifest is the replay target; if it claims more ops than the chunks
    // hold, restore replays off the end of the log.
    expect(manifest?.opCount).toBe(13);
    expect(opsInChunks).toBe(13);
    expect(manifest?.chunkCount).toBe(chunks.length);
  });
});

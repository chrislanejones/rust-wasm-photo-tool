// Op-log persistence schema tests (night-project Task A; dexie-migration
// skill gates). Harness: node env + fake-indexeddb (vitest.setup.ts) — real
// Dexie against a real (in-memory) IDBFactory, no mocks.
//
// Covers the skill's three required paths:
//   1. fresh install boots straight to v2 (empty DB),
//   2. a database created at SHIPPED v1 with real user data upgrades to v2
//      with every v1 record intact and readable,
//   3. the new tables round-trip their records (compound keys included).
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  db,
  deletePhoto,
  getOpLogChunks,
  latestKeyframeAtOrBefore,
  upsertPhotoMetadata,
  type KeyframeRecord,
  type OpLogChunkRecord,
  type PhotoOplogManifest,
} from "@/lib/dexie/db";

function chunk(
  photoId: string,
  seq: number,
  bytes: number[],
  opCount = 1,
): OpLogChunkRecord {
  return {
    photoId,
    branch: "main",
    chunkSeq: seq,
    bytes: new Uint8Array(bytes),
    opCount,
    formatVersion: 1,
    createdAt: Date.now(),
  };
}

function keyframe(photoId: string, atOp: number): KeyframeRecord {
  return {
    photoId,
    branch: "main",
    atOp,
    blob: new Blob([new Uint8Array([atOp])], { type: "image/png" }),
    width: 64,
    height: 48,
    createdAt: Date.now(),
  };
}

beforeEach(async () => {
  await Promise.all([
    db.photos.clear(),
    db.workingCopies.clear(),
    db.originals.clear(),
    db.opLogs.clear(),
    db.keyframes.clear(),
    db.oplogManifests.clear(),
  ]);
});

describe("v2 schema: fresh install", () => {
  it("boots with all five tables usable from empty", async () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "keyframes",
      "opLogs",
      "oplogManifests",
      "originals",
      "photos",
      "workingCopies",
    ]);
    await db.opLogs.put(chunk("p1", 0, [1, 2, 3]));
    await db.keyframes.put(keyframe("p1", 0));
    expect(await db.opLogs.count()).toBe(1);
    expect(await db.keyframes.count()).toBe(1);
  });
});

describe("v1 → v2 upgrade", () => {
  const NAME = "image-horse-dexie-upgrade-test";

  afterEach(async () => {
    await Dexie.delete(NAME);
  });

  it("keeps every v1 record intact and makes the new tables usable", async () => {
    // Seed a database at SHIPPED v1 — the exact schema strings v7.5 shipped.
    const v1 = new Dexie(NAME);
    v1.version(1).stores({
      originals: "id",
      workingCopies: "id, photoId",
      photos: "id, updatedAt, originalId",
    });
    await v1.table("originals").put({
      id: "orig-sha",
      blob: new Blob([new Uint8Array([9, 9])], { type: "image/png" }),
      mimeType: "image/png",
      name: "legacy.png",
      width: 10,
      height: 10,
      createdAt: 111,
    });
    await v1.table("photos").put({
      id: "photo-1",
      name: "legacy.png",
      width: 10,
      height: 10,
      originalId: "orig-sha",
      createdAt: 111,
      updatedAt: 222,
    });
    await v1
      .table("workingCopies")
      .put({ id: "photo-1", photoId: "photo-1", blob: new Blob([]), width: 10, height: 10, updatedAt: 222 });
    v1.close();

    // Reopen with the v1+v2 declaration pair — the same shape ImageHorseDB
    // declares — and verify the upgrade.
    const v2 = new Dexie(NAME);
    v2.version(1).stores({
      originals: "id",
      workingCopies: "id, photoId",
      photos: "id, updatedAt, originalId",
    });
    v2.version(2).stores({
      originals: "id",
      workingCopies: "id, photoId",
      photos: "id, updatedAt, originalId",
      opLogs: "[photoId+branch+chunkSeq], photoId",
      keyframes: "[photoId+branch+atOp], photoId",
      oplogManifests: "photoId",
    });
    await v2.open();
    expect(v2.verno).toBe(2);

    // Every v1 record survived, byte-for-byte where it matters.
    const photo = await v2.table("photos").get("photo-1");
    expect(photo).toMatchObject({ originalId: "orig-sha", updatedAt: 222 });
    const orig = await v2.table("originals").get("orig-sha");
    expect(orig.name).toBe("legacy.png");
    expect(await v2.table("workingCopies").get("photo-1")).toBeTruthy();

    // And the new tables are live.
    await v2.table("opLogs").put(chunk("photo-1", 0, [7]));
    expect(await v2.table("opLogs").count()).toBe(1);
    v2.close();
  });
});

describe("op-log tables: round-trip + helpers", () => {
  it("round-trips chunks in chunkSeq order via the compound key", async () => {
    await db.opLogs.bulkPut([
      chunk("p1", 2, [3]),
      chunk("p1", 0, [1]),
      chunk("p1", 1, [2]),
      chunk("p2", 0, [9]), // different photo — must not leak into p1 reads
    ]);
    const chunks = await getOpLogChunks("p1", "main");
    expect(chunks.map((c) => c.chunkSeq)).toEqual([0, 1, 2]);
    expect(Array.from(chunks[1].bytes)).toEqual([2]);
  });

  it("latestKeyframeAtOrBefore picks the nearest ≤ target", async () => {
    await db.keyframes.bulkPut([keyframe("p1", 0), keyframe("p1", 50), keyframe("p1", 100)]);
    expect((await latestKeyframeAtOrBefore("p1", "main", 75))?.atOp).toBe(50);
    expect((await latestKeyframeAtOrBefore("p1", "main", 100))?.atOp).toBe(100);
    expect((await latestKeyframeAtOrBefore("p1", "main", 0))?.atOp).toBe(0);
    expect(await latestKeyframeAtOrBefore("p2", "main", 100)).toBeUndefined();
  });

  it("manifests round-trip in their own table (gallery-independent)", async () => {
    const m: PhotoOplogManifest = {
      photoId: "p1",
      branch: "main",
      opCount: 3,
      chunkCount: 2,
      formatVersion: 1,
      generation: 0,
      cursor: 3,
      updatedAt: 1,
    };
    await db.oplogManifests.put(m);
    expect(await db.oplogManifests.get("p1")).toMatchObject({ opCount: 3, chunkCount: 2, cursor: 3 });
  });

  it("deletePhoto cascades to op-log chunks and keyframes", async () => {
    await upsertPhotoMetadata({
      id: "p1",
      name: "x.png",
      width: 4,
      height: 4,
      originalId: "o1",
      createdAt: 1,
      updatedAt: 1,
    });
    await db.opLogs.bulkPut([chunk("p1", 0, [1]), chunk("p1", 1, [2]), chunk("p2", 0, [3])]);
    await db.keyframes.bulkPut([keyframe("p1", 0), keyframe("p2", 0)]);
    await db.oplogManifests.put({
      photoId: "p1",
      branch: "main",
      opCount: 3,
      chunkCount: 2,
      formatVersion: 1,
      generation: 0,
      cursor: 3,
      updatedAt: 1,
    });
    await deletePhoto("p1");
    expect(await db.oplogManifests.get("p1")).toBeUndefined();
    expect(await db.opLogs.count()).toBe(1);
    expect((await db.opLogs.toArray())[0].photoId).toBe("p2");
    expect(await db.keyframes.count()).toBe(1);
    expect(await db.photos.get("p1")).toBeUndefined();
  });
});

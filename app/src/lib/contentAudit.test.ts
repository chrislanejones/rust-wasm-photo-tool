import { describe, expect, it } from "vitest";
import {
  classifyStore,
  measureBytes,
  photoIdFromEditKey,
  photoIdFromRow,
  type RawEntry,
} from "./contentAudit";

// The reachability rule behind the GC audit. These tests exist because of a
// specific failure mode: the audit's first real run reported ZERO orphans, and
// a detector that reports zero because it is broken looks exactly like a clean
// store. Pinning the rule here means "0 orphans" can be trusted as a
// measurement rather than read as an absence of evidence.
//
// The audit itself only reads IndexedDB, so these cover the pure parts: which
// rows count as reachable, and how bytes are measured off a structured clone.

describe("photoIdFromEditKey", () => {
  it("strips the edits-store prefix", () => {
    expect(photoIdFromEditKey("edit-1785076956614-51u9nl6cmm4")).toBe(
      "1785076956614-51u9nl6cmm4",
    );
  });

  it("treats an unprefixed key as the id — older writes had no prefix", () => {
    expect(photoIdFromEditKey("1785076956614-x")).toBe("1785076956614-x");
  });

  it("does not strip a prefix that only looks similar", () => {
    expect(photoIdFromEditKey("edited-7")).toBe("edited-7");
  });
});

describe("photoIdFromRow", () => {
  it("takes the leading segment of a Dexie compound key", () => {
    expect(photoIdFromRow("photo-1,main,0", null)).toBe("photo-1");
  });

  it("prefers the record's own photoId — an id with a comma would split wrong", () => {
    expect(photoIdFromRow("weird,id,main,3", { photoId: "weird,id" })).toBe("weird,id");
  });

  it("falls back to the whole key when there is no comma and no record field", () => {
    expect(photoIdFromRow("photo-2", undefined)).toBe("photo-2");
  });
});

describe("measureBytes", () => {
  it("counts ArrayBuffers, typed arrays and Blobs", () => {
    expect(measureBytes(new ArrayBuffer(64))).toBe(64);
    expect(measureBytes(new Uint8Array(10))).toBe(10);
    expect(measureBytes(new Blob([new Uint8Array(32)]))).toBe(32);
  });

  it("sums nested payloads — an edit archive is buffers inside arrays inside objects", () => {
    const archive = {
      canvasPng: new Uint8Array(100),
      undoStack: [{ png: new Uint8Array(50) }, { png: new Uint8Array(25) }],
      redoStack: [],
      canvasW: 800,
      canvasH: 600,
    };
    expect(measureBytes(archive)).toBe(175);
  });

  it("ignores strings and numbers — the figures are a floor, not a total", () => {
    expect(measureBytes({ name: "a-very-long-file-name.png", width: 4000 })).toBe(0);
  });

  it("is depth-capped so a pathological record cannot hang the audit", () => {
    // 8 levels deep; the cap is 6, so the innermost buffer is not counted.
    let nested: unknown = new Uint8Array(99);
    for (let i = 0; i < 8; i++) nested = { inner: nested };
    expect(measureBytes(nested)).toBe(0);
  });

  it("survives null and undefined members", () => {
    expect(measureBytes({ a: null, b: undefined, c: new Uint8Array(8) })).toBe(8);
  });
});

describe("classifyStore", () => {
  const rows = (...pairs: [string, unknown][]): RawEntry[] =>
    pairs.map(([key, value]) => ({ key, value }));

  it("splits reachable from orphaned and measures each side", () => {
    const roots = new Set(["aaa", "bbb"]);
    const result = classifyStore(
      rows(
        ["aaa", { bytes: new ArrayBuffer(1000) }],
        ["bbb", { bytes: new ArrayBuffer(2000) }],
        ["ccc", { bytes: new ArrayBuffer(4000) }],
      ),
      (key) => roots.has(key),
      "test/originals",
      "content-hash",
    );
    expect(result.total).toBe(3);
    expect(result.reachable).toBe(2);
    expect(result.reachableBytes).toBe(3000);
    expect(result.orphans).toBe(1);
    expect(result.orphanBytes).toBe(4000);
    expect(result.orphanKeySample).toEqual(["ccc"]);
  });

  it("an empty root set makes everything an orphan — the no-manifest case", () => {
    const result = classifyStore(
      rows(["aaa", { bytes: new ArrayBuffer(10) }], ["bbb", { bytes: new ArrayBuffer(10) }]),
      () => false,
      "test/originals",
      "content-hash",
    );
    expect(result.orphans).toBe(2);
    expect(result.orphanBytes).toBe(20);
    expect(result.reachable).toBe(0);
  });

  it("reports zero orphans on a genuinely clean store", () => {
    const result = classifyStore(
      rows(["aaa", { bytes: new ArrayBuffer(10) }]),
      () => true,
      "test/originals",
      "content-hash",
    );
    expect(result.orphans).toBe(0);
    expect(result.orphanBytes).toBe(0);
    expect(result.reachable).toBe(1);
  });

  it("caps the orphan-key sample but keeps counting past it", () => {
    const many: [string, unknown][] = Array.from({ length: 30 }, (_, i) => [
      `k${i}`,
      { bytes: new ArrayBuffer(1) },
    ]);
    const result = classifyStore(rows(...many), () => false, "test/x", "content-hash");
    expect(result.orphans).toBe(30);
    expect(result.orphanKeySample).toHaveLength(12);
  });

  it("edit archives are reachable by photo id, not by content key", () => {
    const livePhotoIds = new Set(["p1"]);
    const result = classifyStore(
      rows(
        ["edit-p1", { canvasPng: new Uint8Array(500) }],
        ["edit-p2-deleted", { canvasPng: new Uint8Array(9000) }],
      ),
      (key) => livePhotoIds.has(photoIdFromEditKey(key)),
      "test/edits",
      "photo-id",
    );
    expect(result.reachable).toBe(1);
    expect(result.orphans).toBe(1);
    // The stranded archive is the larger row — deleting a photo leaves its
    // whole undo history behind, which is why this class is measured at all.
    expect(result.orphanBytes).toBe(9000);
  });

  it("op-log chunks follow their photo id out of a compound key", () => {
    const livePhotoIds = new Set(["p1"]);
    const result = classifyStore(
      rows(
        ["p1,main,0", { photoId: "p1", bytes: new Uint8Array(100) }],
        ["p1,main,1", { photoId: "p1", bytes: new Uint8Array(100) }],
        ["gone,main,0", { photoId: "gone", bytes: new Uint8Array(700) }],
      ),
      (key, value) => livePhotoIds.has(photoIdFromRow(key, value)),
      "test/opLogs",
      "photo-id",
    );
    expect(result.reachable).toBe(2);
    expect(result.orphans).toBe(1);
    expect(result.orphanBytes).toBe(700);
  });
});

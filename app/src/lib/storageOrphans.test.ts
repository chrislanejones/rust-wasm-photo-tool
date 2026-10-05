// The orphan sweep's decision (convex/storageOrphans.ts), proven without a
// Convex backend. The repo has no convex-test harness; the sweep's Convex half
// (convex/storageSweep.ts) only reads rows and hands them to `findOrphans`, so
// this is the part that can be wrong in a way that deletes user data.
//
// Fixture ids and row shapes are copied from the live backend (09-24-2026).
import { describe, expect, it } from "vitest";
import {
  classifyStorage,
  collectStorageRefs,
  findOrphans,
  totalsByWeek,
  type StoredFile,
} from "../../../convex/storageOrphans";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 24, 12); // 09-24-2026 12:00 UTC
const GRACE = 24 * HOUR;

function file(id: string, ageHours: number, size = 31_000_000): StoredFile {
  return { _id: id, _creationTime: NOW - ageHours * HOUR, size, contentType: "application/octet-stream" };
}

// Real-shaped ids: lowercase base32, 32 characters.
const ABANDONED = "kg2eyqx3rfvrx442wq98fz5xe98ek39x";
const SAVED = "kg24p42gwsk97rm49kysd5yq4h8ejeme";
const SHARED = "kg202qt8q43708vq61tw0chj3n8ewddh";
const IN_JSON = "kg20z2wrn2ae28ty7d2j3g9kz58ca4yj";
const IN_ANY = "kg20zays1yad3azaqnxe00vkyh8cbmhz";
const IN_FLIGHT = "kg2d9hbkzj1em7zgwgs6cnc5dx8cdzhv";

const rows = [
  // photo_edits — the pointer `save` commits.
  { _id: "p1", userId: "jx7ar7fy79jnpf949ykzs1vr7h8baeex", photoKey: "1789651415471-xjkdd8gitfb", storageId: SAVED, canvasW: 1, canvasH: 1, updatedAt: 0 },
  // shares
  { _id: "s1", token: "e39e5e681ceb412b9852c86b3823ce65", userId: "jx72dwnk62fcc57rb10zdnrphn8es587", storageId: SHARED, views: 2 },
  // a JSON blob in a string field (sync_docs.value / users.settings shape)
  { _id: "d1", key: "prefs", value: JSON.stringify({ theme: "system", pinned: { file: IN_JSON } }) },
  // a v.any() field, nested (annotations.data / ai_jobs.output shape)
  { _id: "a1", data: { layers: [{ meta: { src: IN_ANY } }] } },
];

describe("findOrphans — what the sweep may delete", () => {
  it("identifies an abandoned upload (no row points at it, past the grace period) as an orphan", () => {
    const v = findOrphans([file(ABANDONED, 48)], rows, NOW, GRACE);
    expect(v.orphans.map((f) => f._id)).toEqual([ABANDONED]);
  });

  it("never marks a referenced file, however old — by a typed field, a JSON string, or a nested any", () => {
    const files = [SAVED, SHARED, IN_JSON, IN_ANY].map((id) => file(id, 24 * 60));
    const v = findOrphans(files, rows, NOW, GRACE);
    expect(v.orphans).toEqual([]);
    expect(v.referenced).toBe(4);
  });

  it("leaves a young unreferenced file alone: it is an upload whose save has not landed yet", () => {
    const v = findOrphans([file(IN_FLIGHT, 0.01)], rows, NOW, GRACE);
    expect(v.orphans).toEqual([]);
    expect(v.tooYoung.map((f) => f._id)).toEqual([IN_FLIGHT]);
  });

  it("the grace boundary: exactly at the grace age is eligible, a millisecond younger is not", () => {
    const at = { ...file(ABANDONED, 0), _creationTime: NOW - GRACE };
    const under = { ...file(IN_FLIGHT, 0), _creationTime: NOW - GRACE + 1 };
    const v = classifyStorage([at, under], new Set(), NOW, GRACE);
    expect(v.orphans.map((f) => f._id)).toEqual([ABANDONED]);
    expect(v.tooYoung.map((f) => f._id)).toEqual([IN_FLIGHT]);
  });

  it("with no rows at all, every old file is an orphan and nothing else is claimed", () => {
    const v = findOrphans([file(ABANDONED, 48), file(SAVED, 48)], [], NOW, GRACE);
    expect(v.orphans).toHaveLength(2);
    expect(v.referenced).toBe(0);
  });
});

describe("collectStorageRefs", () => {
  it("counts only strings that ARE (or contain as a token) a real storage id", () => {
    const known = new Set([SAVED]);
    const found = new Set<string>();
    // Id-shaped but not a stored file; a user id; a prefix of a real id.
    collectStorageRefs(
      { a: "kg2zzzzzzzzzzzzzzzzzzzzzzzzzzzzz", b: "jx7ar7fy79jnpf949ykzs1vr7h8baeex", c: SAVED.slice(0, 20) },
      known,
      found,
    );
    expect([...found]).toEqual([]);
    collectStorageRefs([[`https://x.convex.cloud/api/storage/${SAVED}?t=1`]], known, found);
    expect([...found]).toEqual([SAVED]);
  });
});

describe("totalsByWeek", () => {
  it("buckets by the Monday of the UTC week, oldest first", () => {
    const sun = { ...file("a", 0, 10), _creationTime: Date.UTC(2026, 8, 13, 23) }; // Sun 09-13
    const mon = { ...file("b", 0, 20), _creationTime: Date.UTC(2026, 8, 14, 1) }; // Mon 09-14
    const thu = { ...file("c", 0, 5), _creationTime: Date.UTC(2026, 8, 10, 12) }; // Thu 09-10
    expect(totalsByWeek([mon, sun, thu])).toEqual([
      { weekOf: "2026-09-07", files: 2, bytes: 15 },
      { weekOf: "2026-09-14", files: 1, bytes: 20 },
    ]);
  });
});

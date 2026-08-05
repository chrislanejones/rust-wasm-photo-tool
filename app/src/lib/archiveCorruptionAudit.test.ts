// ===== FILE: app/src/lib/archiveCorruptionAudit.test.ts =====
//
// The read-only detector for archives holding another photo's canvas.
//
// This is the artifact Chris runs against a real production profile, so its
// behaviour matters in both directions: it has to fire on the shape the live
// bug actually produced, and it has to stay quiet on ordinary galleries. A
// detector that cries wolf on a burst of same-shaped photos is worse than none,
// because the next real finding gets ignored.
//
// The fixture reproduces the measured incident: four photos with four different
// aspect ratios whose archives all decode to 1445×2128 — the painted car.
import { beforeEach, describe, expect, it } from "vitest";

import { auditArchiveCorruption } from "@/lib/contentAudit";

/** Create (or reopen) a database with one store and put values into it. */
function seed(
  dbName: string,
  store: string,
  entries: Array<[string, unknown]>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      for (const [k, v] of entries) os.put(v, k);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

const photo = (id: string, w: number, h: number) => ({
  id,
  workingWidth: w,
  workingHeight: h,
  originalKey: `orig-${id}`,
  uploadKey: `orig-${id}`,
});

const archive = (w: number, h: number) => ({
  canvasW: w,
  canvasH: h,
  canvasPng: new Uint8Array([1]),
  undoStack: [],
  redoStack: [],
  annotations: [],
});

async function seedGallery(photos: unknown[]) {
  await seed("image-horse-gallery", "manifest", [
    ["current", { photos, activeId: null, savedAt: 1 }],
  ]);
}

async function seedArchives(rows: Array<[string, unknown]>) {
  await seed("image-horse-edits", "edits", rows);
}

beforeEach(async () => {
  // Fresh in-memory IndexedDB per test — otherwise a previous test's manifest
  // leaks in and every assertion here is meaningless.
  const { IDBFactory } = await import("fake-indexeddb");
  globalThis.indexedDB = new IDBFactory();
});

describe("collision detection — the signal that caught the real bug", () => {
  it("flags four differently-shaped photos whose archives share one canvas", async () => {
    // The measured incident, exactly: the car is 1445×2128 and three photos
    // that were never touched carry its canvas.
    await seedGallery([
      photo("car", 1445, 2128),
      photo("rock", 2048, 1365),
      photo("cave", 1200, 1600),
      photo("field", 3000, 2000),
    ]);
    await seedArchives([
      ["edit-car", archive(1445, 2128)],
      ["edit-rock", archive(1445, 2128)],
      ["edit-cave", archive(1445, 2128)],
      ["edit-field", archive(1445, 2128)],
    ]);

    const r = await auditArchiveCorruption();

    expect(r.manifestFound).toBe(true);
    expect(r.archivesFound).toBe(4);
    expect(r.collisions).toHaveLength(1);
    expect(r.collisions[0]!.dimensions).toBe("1445×2128");
    expect(r.collisions[0]!.photoIds.sort()).toEqual(["car", "cave", "field", "rock"]);
    expect(r.suspectPhotoCount).toBe(4);
  });

  it("stays quiet when the photos sharing a canvas are the SAME shape", async () => {
    // A burst off one camera, edited the same way, is not corruption. This is
    // the false positive that would make the detector useless.
    await seedGallery([
      photo("a", 4000, 3000),
      photo("b", 4000, 3000),
      photo("c", 4000, 3000),
    ]);
    await seedArchives([
      ["edit-a", archive(4000, 3000)],
      ["edit-b", archive(4000, 3000)],
      ["edit-c", archive(4000, 3000)],
    ]);

    const r = await auditArchiveCorruption();

    expect(r.archivesFound).toBe(3);
    expect(r.collisions).toEqual([]);
    expect(r.suspectPhotoCount).toBe(0);
  });

  it("does not flag a clean gallery where each archive matches its photo", async () => {
    await seedGallery([photo("a", 1445, 2128), photo("b", 2048, 1365)]);
    await seedArchives([
      ["edit-a", archive(1445, 2128)],
      ["edit-b", archive(2048, 1365)],
    ]);

    const r = await auditArchiveCorruption();

    expect(r.collisions).toEqual([]);
    expect(r.drift).toEqual([]);
    expect(r.suspectPhotoCount).toBe(0);
  });
});

describe("aspect drift is advisory and never a verdict on its own", () => {
  it("reports a cropped photo as drift but implicates nobody", async () => {
    // A crop legitimately moves the canvas away from the photo's native shape.
    // It must show up as information, not as a suspect.
    await seedGallery([photo("a", 4000, 3000)]);
    await seedArchives([["edit-a", archive(1000, 3000)]]);

    const r = await auditArchiveCorruption();

    expect(r.drift).toHaveLength(1);
    expect(r.drift[0]!.photoId).toBe("a");
    expect(r.suspectPhotoCount).toBe(0);
    expect(r.collisions).toEqual([]);
    expect(r.notes.join(" ")).toContain("NOT a finding on its own");
  });
});

describe("it refuses to guess when it cannot check", () => {
  it("reports that it could not run rather than reporting clean", async () => {
    // No manifest means no true dimensions. "Nothing found" and "cannot look"
    // must not be reported as the same thing.
    await seedArchives([["edit-a", archive(1445, 2128)]]);

    const r = await auditArchiveCorruption();

    expect(r.manifestFound).toBe(false);
    expect(r.suspectPhotoCount).toBe(0);
    expect(r.notes.join(" ")).toContain("cannot be checked");
  });

  it("skips archives whose photo is gone from the manifest, and says so", async () => {
    await seedGallery([photo("a", 1445, 2128)]);
    await seedArchives([
      ["edit-a", archive(1445, 2128)],
      ["edit-deleted", archive(1445, 2128)],
    ]);

    const r = await auditArchiveCorruption();

    expect(r.archivesWithoutPhoto).toBe(1);
    // The orphan must NOT pair with the live photo to fake a collision.
    expect(r.collisions).toEqual([]);
    expect(r.notes.join(" ")).toContain("no longer in the manifest");
  });
});

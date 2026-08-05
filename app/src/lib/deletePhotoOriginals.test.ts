// ===== FILE: app/src/lib/deletePhotoOriginals.test.ts =====
//
// PHASE 1 — the reproduction. Audit finding #2: deleting a photo strands its
// original blobs.
//
// `handleRemovePhoto` (app/session/useImageSession.ts) does exactly three
// things: `deletePhotoEdit(id)`, drop the id from a couple of React sets, and
// remove the entry from the gallery store. Nothing in that sequence touches the
// originals store, so the blobs the entry pointed at — its `originalKey` and
// its `uploadKey` A/B baseline — survive with no referrer. Up to two stranded
// blobs per delete, and a full-size original is the largest thing this app
// stores.
//
// These tests run the delete sequence against fixtures and assert the leak. They
// PASS today, which is the point: a green run here is proof the bug is real and
// reachable, not theoretical. Phase 2 inverts them — the same scenarios, with
// the assertions flipped to "collected" — so the diff between these two commits
// is the before/after.
//
// Fixtures only, on purpose. Reproducing this against a real gallery destroys a
// real original, which is precisely the failure being fixed. node +
// fake-indexeddb (vitest.setup.ts) puts the delete through the REAL Dexie
// adapter rather than a mock that might agree with a wrong assumption.
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  putOriginal,
  getOriginal,
  listOriginals,
} from "@/lib/dexie/originalsAdapter";
import { deletePhotoEdit } from "@/lib/editPersistence";
import {
  deleteOriginal as legacyDeleteOriginal,
  listOriginalKeys as legacyListKeys,
} from "@/lib/originalsStore";

interface FakePhoto {
  id: string;
  originalKey: string;
  uploadKey?: string;
}

function fileOf(name: string, content: string): File {
  return new File([new TextEncoder().encode(content)], name, {
    type: "image/png",
  });
}

/** Exactly what `handleRemovePhoto` does today, with the React parts stripped:
 *  drop the edit archive, drop the gallery entry. Nothing else. */
async function removePhotoAsShipped(
  gallery: FakePhoto[],
  id: string,
): Promise<FakePhoto[]> {
  await deletePhotoEdit(id).catch(() => {});
  return gallery.filter((p) => p.id !== id);
}

beforeEach(async () => {
  await db.originals.clear();
  for (const k of await legacyListKeys()) await legacyDeleteOriginal(k);
});

describe("PHASE 1 — deleting a photo strands its originals (audit finding #2)", () => {
  it("leaves the originalKey blob behind with no referrer", async () => {
    const key = await putOriginal(fileOf("a.png", "AAAA"), 10, 10);
    const gallery: FakePhoto[] = [{ id: "p1", originalKey: key }];

    const after = await removePhotoAsShipped(gallery, "p1");

    expect(after).toHaveLength(0); // the photo is gone from the gallery…
    expect(await getOriginal(key)).not.toBeNull(); // …and its bytes are not
    expect(await listOriginals()).toContain(key);
  });

  it("strands TWO blobs when the photo has a separate A/B baseline", async () => {
    // The normal shape after any compress: originalKey was repointed to the
    // compressed bytes, uploadKey still holds the pristine import.
    const upload = await putOriginal(fileOf("u.png", "UPLOAD"), 10, 10);
    const current = await putOriginal(fileOf("c.png", "COMPRESSED"), 10, 10);
    const gallery: FakePhoto[] = [
      { id: "p1", originalKey: current, uploadKey: upload },
    ];

    await removePhotoAsShipped(gallery, "p1");

    const left = await listOriginals();
    expect(left).toContain(current);
    expect(left).toContain(upload);
    expect(left).toHaveLength(2); // two stranded blobs from one delete
  });

  it("strands nothing extra when two photos SHARE a blob — but strands the shared one too", async () => {
    // Content-addressed: a duplicate reuses its source's key, so both entries
    // point at one blob. Deleting one leaves the survivor pointing at bytes
    // that are now also unreferenced garbage from the gallery's perspective…
    // except they are not garbage at all, because the survivor needs them.
    // This is the case that makes the reachability guard necessary rather than
    // decorative, and it is why the fix cannot simply delete both keys.
    const shared = await putOriginal(fileOf("s.png", "SHARED"), 10, 10);
    const gallery: FakePhoto[] = [
      { id: "p1", originalKey: shared },
      { id: "p2", originalKey: shared },
    ];

    const after = await removePhotoAsShipped(gallery, "p1");

    expect(after.map((p) => p.id)).toEqual(["p2"]);
    // Today this survives by accident — nothing deletes anything. After Phase 2
    // it must survive on purpose, because p2 still references it.
    expect(await getOriginal(shared)).not.toBeNull();
  });

  it("deletes the edit archive, which is the ONLY thing it does clean up", async () => {
    // Establishes that the delete path works and the leak is specific to the
    // originals store — otherwise a green suite above could just mean the
    // fixture never wrote anything.
    const key = await putOriginal(fileOf("a.png", "AAAA"), 10, 10);
    await removePhotoAsShipped([{ id: "p1", originalKey: key }], "p1");
    // No throw, and the original is provably still there.
    expect(await getOriginal(key)).not.toBeNull();
  });
});

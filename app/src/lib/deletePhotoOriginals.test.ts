// ===== FILE: app/src/lib/deletePhotoOriginals.test.ts =====
//
// Audit finding #2 — deleting a photo used to strand its original blobs.
//
// PHASE 1 (commit b24ef0a) ran the shipped delete sequence and asserted the
// leak: two stranded blobs from one delete. PHASE 2 routes the delete through
// `collectDeletedPhotoOriginals`, and these are the same scenarios with the
// assertions inverted — the diff between the two commits is the before/after.
//
// Fixtures only. Reproducing this on a real gallery destroys a real original,
// which is the failure being fixed. node + fake-indexeddb (vitest.setup.ts)
// puts every delete through the REAL Dexie adapter, not a mock that could agree
// with a wrong assumption.
//
// The bias under test is one-directional and deliberate: when in doubt, KEEP.
// Over-keeping leaves garbage the audit measures. Over-deleting destroys a
// photo with no backup and no server copy.
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  putOriginal,
  getOriginal,
  listOriginals,
} from "@/lib/dexie/originalsAdapter";
import { deletePhotoEdit } from "@/lib/editPersistence";
import {
  collectDeletedPhotoOriginals,
  type OriginalRef,
} from "@/lib/originalRefs";
import {
  registerExtraRootProvider,
  collectExtraRoots,
  __resetExtraRootProviders,
} from "@/lib/extraRoots";
import {
  deleteOriginal as legacyDeleteOriginal,
  listOriginalKeys as legacyListKeys,
} from "@/lib/originalsStore";

function fileOf(name: string, content: string): File {
  return new File([new TextEncoder().encode(content)], name, {
    type: "image/png",
  });
}

/** `handleRemovePhoto` with the React parts stripped: drop the edit archive,
 *  drop the gallery entry, then collect what the entry pointed at. */
async function removePhoto(
  gallery: OriginalRef[],
  id: string,
  extraRoots: readonly (string | undefined)[] = [],
): Promise<OriginalRef[]> {
  const doomed = gallery.find((p) => p.id === id);
  await deletePhotoEdit(id).catch(() => {});
  const after = gallery.filter((p) => p.id !== id);
  if (doomed) {
    await collectDeletedPhotoOriginals({
      entry: doomed,
      photos: after,
      extraRoots,
    });
  }
  return after;
}

beforeEach(async () => {
  await db.originals.clear();
  for (const k of await legacyListKeys()) await legacyDeleteOriginal(k);
  __resetExtraRootProviders();
});

// ── 1. deleting a photo collects its blobs ──────────────────────────────────

describe("deleting a photo collects its originals", () => {
  it("collects the originalKey blob", async () => {
    const key = await putOriginal(fileOf("a.png", "AAAA"), 10, 10);

    const after = await removePhoto([{ id: "p1", originalKey: key }], "p1");

    expect(after).toHaveLength(0);
    expect(await getOriginal(key)).toBeNull();
    expect(await listOriginals()).toHaveLength(0);
  });

  it("collects BOTH blobs when the photo has a separate A/B baseline", async () => {
    // Phase 1 asserted `toHaveLength(2)` here — two stranded blobs. Now zero.
    const upload = await putOriginal(fileOf("u.png", "UPLOAD"), 10, 10);
    const current = await putOriginal(fileOf("c.png", "COMPRESSED"), 10, 10);

    await removePhoto(
      [{ id: "p1", originalKey: current, uploadKey: upload }],
      "p1",
    );

    expect(await listOriginals()).toHaveLength(0);
  });

  it("reports one verdict per distinct key, not one per field", async () => {
    // Fresh import: originalKey === uploadKey. Asking twice would report two
    // verdicts for one blob and imply work that did not happen.
    const key = await putOriginal(fileOf("a.png", "SAME"), 10, 10);
    const verdicts = await collectDeletedPhotoOriginals({
      entry: { id: "p1", originalKey: key, uploadKey: key },
      photos: [],
    });
    expect(verdicts).toEqual(["deleted"]);
  });
});

// ── 2. a shared blob survives its sibling's deletion ────────────────────────

describe("a shared blob survives its sibling's deletion", () => {
  it("keeps the blob a surviving duplicate still points at", async () => {
    // THE case that makes the guard necessary rather than decorative.
    // `handleDuplicateSelected` reuses the source's originalKey for a
    // zero-pixel copy, so both entries name one blob. Deleting either must not
    // take the other's bytes.
    const shared = await putOriginal(fileOf("s.png", "SHARED"), 10, 10);
    const gallery: OriginalRef[] = [
      { id: "p1", originalKey: shared },
      { id: "p2", originalKey: shared },
    ];

    const after = await removePhoto(gallery, "p1");

    expect(after.map((p) => p.id)).toEqual(["p2"]);
    expect(await getOriginal(shared)).not.toBeNull();
  });

  it("collects the shared blob only once the LAST referrer is deleted", async () => {
    const shared = await putOriginal(fileOf("s.png", "SHARED"), 10, 10);
    let gallery: OriginalRef[] = [
      { id: "p1", originalKey: shared },
      { id: "p2", originalKey: shared },
    ];

    gallery = await removePhoto(gallery, "p1");
    expect(await getOriginal(shared)).not.toBeNull(); // p2 still needs it

    await removePhoto(gallery, "p2");
    expect(await getOriginal(shared)).toBeNull(); // now nothing does
  });

  it("keeps a blob that is another photo's UPLOAD baseline", async () => {
    // p2 was compressed, so it points at fresh bytes but still A/B's against
    // the shared import. Deleting p1 must not remove p2's baseline.
    const shared = await putOriginal(fileOf("s.png", "SHARED"), 10, 10);
    const p2current = await putOriginal(fileOf("c.png", "P2NEW"), 10, 10);
    const gallery: OriginalRef[] = [
      { id: "p1", originalKey: shared },
      { id: "p2", originalKey: p2current, uploadKey: shared },
    ];

    await removePhoto(gallery, "p1");

    expect(await getOriginal(shared)).not.toBeNull();
    expect(await getOriginal(p2current)).not.toBeNull();
  });

  it("keeps a blob held only by a batch baseline outside the gallery", async () => {
    // BatchSettings' pre-logo baseline lives in a React ref and appears in no
    // manifest. Without extraRoots the delete sees an unreferenced blob and
    // takes it, and re-applying a logo then stacks instead of replacing.
    const baseline = await putOriginal(fileOf("b.png", "PRELOGO"), 10, 10);
    const gallery: OriginalRef[] = [{ id: "p1", originalKey: baseline }];

    await removePhoto(gallery, "p1", [baseline]);

    expect(await getOriginal(baseline)).not.toBeNull();
  });

  it("reads those baselines through the provider registry", async () => {
    // Proves the seam the delete path actually uses, not just the argument.
    const baseline = await putOriginal(fileOf("b.png", "PRELOGO"), 10, 10);
    const refLike = new Map([["p1", baseline]]);
    registerExtraRootProvider(() => refLike.values());

    await removePhoto([{ id: "p1", originalKey: baseline }], "p1", collectExtraRoots());

    expect(await getOriginal(baseline)).not.toBeNull();
  });

  it("stops protecting a baseline once its provider deregisters", async () => {
    // An unmounted BatchSettings holds no live baselines, so its keys must stop
    // counting — otherwise the registry becomes a permanent leak of its own.
    const baseline = await putOriginal(fileOf("b.png", "PRELOGO"), 10, 10);
    const unregister = registerExtraRootProvider(() => [baseline]);
    expect(collectExtraRoots()).toContain(baseline);

    unregister();
    expect(collectExtraRoots()).not.toContain(baseline);

    await removePhoto([{ id: "p1", originalKey: baseline }], "p1", collectExtraRoots());
    expect(await getOriginal(baseline)).toBeNull();
  });
});

// ── 3. a failed delete is swallowed, not thrown ─────────────────────────────

describe("a failed collect leaves garbage, never a broken gallery", () => {
  it("does not throw when the adapter rejects", async () => {
    const key = await putOriginal(fileOf("a.png", "AAAA"), 10, 10);

    const verdicts = await collectDeletedPhotoOriginals({
      entry: { id: "p1", originalKey: key },
      photos: [],
      remove: async () => {
        throw new Error("quota exceeded");
      },
    });

    expect(verdicts).toEqual(["kept: still referenced"]);
    expect(await getOriginal(key)).not.toBeNull(); // garbage, which is recoverable
  });

  it("keeps going after one key fails so the other is still collected", async () => {
    const upload = await putOriginal(fileOf("u.png", "UPLOAD"), 10, 10);
    const current = await putOriginal(fileOf("c.png", "CURRENT"), 10, 10);

    const verdicts = await collectDeletedPhotoOriginals({
      entry: { id: "p1", originalKey: current, uploadKey: upload },
      photos: [],
      remove: async (k) => {
        if (k === current) throw new Error("boom");
        await legacyDeleteOriginalShim(k);
      },
    });

    expect(verdicts).toHaveLength(2);
    expect(verdicts).toContain("kept: still referenced"); // the failure
    expect(verdicts).toContain("deleted"); // the one after it
  });
});

/** Small shim so the test above can delete for real through the adapter. */
async function legacyDeleteOriginalShim(key: string): Promise<void> {
  const { deleteOriginal } = await import("@/lib/dexie/originalsAdapter");
  await deleteOriginal(key);
}

// ── the caller-error case the signature is designed to absorb ───────────────

describe("robustness of the photos argument", () => {
  it("collects correctly even when handed the PRE-removal gallery", async () => {
    // If the entry were left in `photos` it would root its own keys and the
    // collect would silently do nothing — a no-op that looks like success.
    // The function filters by id, so both call shapes behave identically.
    const key = await putOriginal(fileOf("a.png", "AAAA"), 10, 10);
    const entry: OriginalRef = { id: "p1", originalKey: key };

    await collectDeletedPhotoOriginals({ entry, photos: [entry] }); // pre-removal

    expect(await getOriginal(key)).toBeNull();
  });
});

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

// ── 5. deleting the WHOLE gallery ───────────────────────────────────────────
//
// Found 2026-08-07 by measuring the deployed app: Delete All left the row
// counts unchanged (189 and 72) while 26 reachable rows dropped to zero —
// +108.6 MiB stranded from one click. `confirmDeleteAll` collected the edit
// archives and never collected the blobs, then `setPhotos([])` dropped the only
// roots that pointed at them. The single-photo path had been correct all along.
//
// The subtle argument is `photos: []`. It is the SURVIVING gallery, and in a
// delete-all nothing survives. Handing it the doomed list instead would have
// every photo rooted by its neighbours, collect nothing, and look exactly like
// success — which is the shape of the original bug.

/** `confirmDeleteAll` with the React parts stripped. Mirrors the real handler:
 *  read the entries first, clear the gallery, then collect each against an
 *  EMPTY surviving set. */
async function deleteAllPhotos(
  gallery: OriginalRef[],
  extraRoots: readonly (string | undefined)[] = [],
): Promise<void> {
  const doomed = [...gallery];
  for (const id of doomed.map((p) => p.id)) await deletePhotoEdit(id).catch(() => {});
  for (const entry of doomed) {
    await collectDeletedPhotoOriginals({ entry, photos: [], extraRoots });
  }
}

describe("deleting the whole gallery collects every original", () => {
  it("collects all of them, not just the last", async () => {
    const a = await putOriginal(fileOf("a.png", "AAAA"), 10, 10);
    const b = await putOriginal(fileOf("b.png", "BBBB"), 10, 10);
    const c = await putOriginal(fileOf("c.png", "CCCC"), 10, 10);

    await deleteAllPhotos([
      { id: "p1", originalKey: a },
      { id: "p2", originalKey: b },
      { id: "p3", originalKey: c },
    ]);

    expect(await listOriginals()).toHaveLength(0);
  });

  it("collects a blob two doomed photos share, exactly once", async () => {
    const shared = await putOriginal(fileOf("dup.png", "SAME"), 10, 10);

    // Both entries point at the same content hash — the duplicate case that
    // makes a bulk key-sweep dangerous. The second collect finds it already
    // gone and must not throw.
    await deleteAllPhotos([
      { id: "p1", originalKey: shared },
      { id: "p2", originalKey: shared },
    ]);

    expect(await getOriginal(shared)).toBeFalsy();
  });

  it("collects the A/B upload baseline too", async () => {
    const orig = await putOriginal(fileOf("small.png", "SMALL"), 10, 10);
    const upload = await putOriginal(fileOf("big.png", "BIGGER"), 40, 40);

    await deleteAllPhotos([{ id: "p1", originalKey: orig, uploadKey: upload }]);

    expect(await listOriginals()).toHaveLength(0);
  });

  it("still keeps a blob held only by a batch baseline outside the gallery", async () => {
    const gone = await putOriginal(fileOf("gone.png", "GONE"), 10, 10);
    const held = await putOriginal(fileOf("held.png", "HELD"), 10, 10);
    registerExtraRootProvider(() => [held]);

    await deleteAllPhotos(
      [{ id: "p1", originalKey: gone }, { id: "p2", originalKey: held }],
      collectExtraRoots(),
    );

    // Bias is KEEP: a still-mounted Batch panel holding a baseline is a live
    // reference whatever the gallery is doing.
    expect(await getOriginal(gone)).toBeFalsy();
    expect(await getOriginal(held)).toBeTruthy();
  });

  it("leaks a SHARED blob if the doomed list is passed as the surviving set", async () => {
    // Why `photos: []` is load-bearing, stated as a test — and narrower than I
    // first wrote it. `collectDeletedPhotoOriginals` filters the entry out of
    // `photos` itself, so photos with DISTINCT keys collect correctly either
    // way. The mistake only bites on a shared key: pass the doomed list and
    // each of the two entries is rooted by the other, so the blob survives them
    // both. Silently, looking like success.
    const shared = await putOriginal(fileOf("dup.png", "SAME"), 10, 10);
    const gallery: OriginalRef[] = [
      { id: "p1", originalKey: shared },
      { id: "p2", originalKey: shared },
    ];

    for (const entry of gallery) {
      await collectDeletedPhotoOriginals({ entry, photos: gallery, extraRoots: [] });
    }
    expect(await getOriginal(shared), "the wrong-argument leak").toBeTruthy();

    // The real handler passes [] and the blob goes.
    await deleteAllPhotos(gallery);
    expect(await getOriginal(shared), "the correct argument").toBeFalsy();
  });
});

// The tests above mirror `confirmDeleteAll`; they cannot notice the handler
// forgetting to call the collector at all — which is exactly what shipped. This
// reads the source, like the tool-surface contract guard, because the bug was
// an absent call rather than a wrong value.
describe("confirmDeleteAll actually collects", () => {
  it("calls collectDeletedPhotoOriginals with an empty surviving set", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    // ⚠️ ANCHORED ON THIS FILE, NEVER ON THE LAUNCH DIRECTORY (v8.30). Resolving
    // source paths against `process.cwd()` makes a guard's reach depend on where
    // vitest was started — from the repo root this one threw ENOENT and the
    // walk-based guards elsewhere read zero files and passed vacuously.
    const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
    const src = readFileSync(join(APP_ROOT, "src/app/AppShell.tsx"), "utf8");

    const start = src.indexOf("const confirmDeleteAll");
    expect(start, "confirmDeleteAll not found — was it renamed?").toBeGreaterThan(-1);
    const raw = src.slice(start, src.indexOf("}, [clearAllEdits", start));

    // Strip comments FIRST. The first version of this check passed against a
    // handler with the call deleted, because the comment explaining the fix
    // contains the function name — a test satisfied by its own documentation.
    const body = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(body, "confirmDeleteAll no longer collects originals — the blobs leak")
      .toContain("collectDeletedPhotoOriginals");
    expect(body, "the surviving gallery must be [] in a delete-all")
      .toMatch(/photos:\s*\[\]/);
  });
});

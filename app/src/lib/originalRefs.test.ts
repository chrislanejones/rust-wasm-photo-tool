// The guard in front of every `deleteOriginal`, and a fixture reproduction of
// the data-loss bug it exists to stop.
//
// The bug was found by READING the four repoint paths and deliberately NOT run
// against a real gallery, because reproducing it destroys one of the user's
// originals. These tests are that missing reproduction, done where it is safe:
// node + fake-indexeddb (vitest.setup.ts), the same harness the adapter tests
// use, so the delete goes through the REAL adapter against a real IndexedDB
// implementation — not a mock that could agree with a wrong assumption.
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  getOriginal,
  putOriginal,
  deleteOriginal,
  listOriginals,
} from "@/lib/dexie/originalsAdapter";
import {
  deleteReplacedOriginal,
  referencedOriginalKeys,
  type OriginalRef,
} from "@/lib/originalRefs";
import {
  deleteOriginal as legacyDeleteOriginal,
  listOriginalKeys as legacyListKeys,
} from "@/lib/originalsStore";

function fileOf(name: string, content: string): File {
  return new File([new TextEncoder().encode(content)], name, { type: "image/png" });
}

beforeEach(async () => {
  await db.originals.clear();
  for (const k of await legacyListKeys()) await legacyDeleteOriginal(k);
});

describe("referencedOriginalKeys", () => {
  const photos: OriginalRef[] = [
    { id: "p", originalKey: "N", uploadKey: "K" },
    { id: "c", originalKey: "N", uploadKey: "K" }, // duplicate of p — shares BOTH
    { id: "z", originalKey: "Z", uploadKey: "Z" },
  ];

  it("counts where the repointed photo is GOING, not where it was", () => {
    const refs = referencedOriginalKeys(photos, "c", "M");
    expect(refs.has("M")).toBe(true);
    // "c" no longer contributes N — but "p" still does, which is the point.
    expect(refs.has("N")).toBe(true);
  });

  it("keeps every photo's upload baseline, including the one being repointed", () => {
    const refs = referencedOriginalKeys(photos, "c", "M");
    expect(refs.has("K")).toBe(true); // the old `oldKey !== uploadKey` guard, preserved
  });

  it("drops a key once its LAST referrer moves off it", () => {
    const solo: OriginalRef[] = [{ id: "z", originalKey: "Z" }];
    expect(referencedOriginalKeys(solo, "z", "M").has("Z")).toBe(false);
  });

  it("honours roots that live outside the gallery (batch baselines in a ref)", () => {
    const solo: OriginalRef[] = [{ id: "z", originalKey: "Z" }];
    expect(referencedOriginalKeys(solo, "z", "M", ["Z"]).has("Z")).toBe(true);
  });

  it("ignores a photo id that is not in the gallery any more", () => {
    const refs = referencedOriginalKeys(photos, "deleted-id", "M");
    expect(refs.has("N")).toBe(true); // p and c still point at it
    expect(refs.has("M")).toBe(false); // nothing claims the new key
  });
});

describe("deleteReplacedOriginal — verdicts", () => {
  const photos: OriginalRef[] = [{ id: "p", originalKey: "N", uploadKey: "K" }];

  it("does nothing without an old key", async () => {
    const v = await deleteReplacedOriginal({
      oldKey: undefined, newKey: "M", photoId: "p", photos,
      remove: async () => { throw new Error("must not be called"); },
    });
    expect(v).toBe("kept: no old key");
  });

  it("does nothing when the key did not change (identical bytes re-encoded)", async () => {
    const v = await deleteReplacedOriginal({
      oldKey: "N", newKey: "N", photoId: "p", photos,
      remove: async () => { throw new Error("must not be called"); },
    });
    expect(v).toBe("kept: unchanged");
  });

  it("keeps a blob another photo still points at", async () => {
    const shared: OriginalRef[] = [
      { id: "p", originalKey: "N", uploadKey: "K" },
      { id: "c", originalKey: "N", uploadKey: "K" },
    ];
    const v = await deleteReplacedOriginal({
      oldKey: "N", newKey: "M", photoId: "c", photos: shared,
      remove: async () => { throw new Error("must not be called"); },
    });
    expect(v).toBe("kept: still referenced");
  });

  it("deletes when it is genuinely the last referrer", async () => {
    const removed: string[] = [];
    const v = await deleteReplacedOriginal({
      oldKey: "N", newKey: "M", photoId: "p",
      photos: [{ id: "p", originalKey: "N", uploadKey: "K" }],
      remove: async (k) => { removed.push(k); },
    });
    expect(v).toBe("deleted");
    expect(removed).toEqual(["N"]);
  });

  it("a failing delete is swallowed — garbage beats a broken edit", async () => {
    const v = await deleteReplacedOriginal({
      oldKey: "N", newKey: "M", photoId: "p",
      photos: [{ id: "p", originalKey: "N" }],
      remove: async () => { throw new Error("quota"); },
    });
    expect(v).toBe("kept: still referenced");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The reproduction. Real adapter, real (fake) IndexedDB, the exact four steps
// from the audit write-up.
describe("compress → duplicate → compress (the data-loss sequence)", () => {
  /** Steps 1-3: import P, compress it once, duplicate it to C. Returns the
   *  gallery and the keys involved. */
  async function seedThroughDuplicate() {
    const K = await putOriginal(fileOf("p.png", "ORIGINAL-UPLOAD"), 10, 10);
    const N = await putOriginal(fileOf("p.png", "COMPRESSED-ONCE"), 10, 10);
    // P has been compressed once: it points at N, its baseline is still K.
    // C is a zero-copy duplicate, so it shares BOTH keys.
    const photos: OriginalRef[] = [
      { id: "p", originalKey: N, uploadKey: K },
      { id: "c", originalKey: N, uploadKey: K },
    ];
    return { K, N, photos };
  }

  it("FIXTURE CHECK: the old unguarded delete really does destroy P's bytes", async () => {
    const { N, photos } = await seedThroughDuplicate();
    expect(await getOriginal(N)).not.toBeNull();

    // What the old code did at step 4: oldKey !== newKey && oldKey !== C's
    // uploadKey, so it deleted — knowing nothing about P.
    const M = await putOriginal(fileOf("c.png", "COMPRESSED-TWICE"), 10, 10);
    const cUploadKey = photos[1]!.uploadKey;
    if (N !== M && N !== cUploadKey) await deleteOriginal(N);

    // P still points at N, and N is gone. This is the bug, reproduced.
    expect(photos[0]!.originalKey).toBe(N);
    expect(await getOriginal(N)).toBeNull();
  });

  it("the guard keeps N, because P still points at it", async () => {
    const { N, photos } = await seedThroughDuplicate();
    const M = await putOriginal(fileOf("c.png", "COMPRESSED-TWICE"), 10, 10);

    const verdict = await deleteReplacedOriginal({
      oldKey: N, newKey: M, photoId: "c", photos,
    });

    expect(verdict).toBe("kept: still referenced");
    const survived = await getOriginal(N);
    expect(survived).not.toBeNull();
    expect(new TextDecoder().decode(new Uint8Array(survived!.bytes))).toBe("COMPRESSED-ONCE");
  });

  it("and once P moves off N too, the next repoint collects it", async () => {
    const { K, N, photos } = await seedThroughDuplicate();
    const M = await putOriginal(fileOf("c.png", "COMPRESSED-TWICE"), 10, 10);

    // C compresses first: N kept (P holds it).
    await deleteReplacedOriginal({ oldKey: N, newKey: M, photoId: "c", photos });
    const afterC: OriginalRef[] = [
      { id: "p", originalKey: N, uploadKey: K },
      { id: "c", originalKey: M, uploadKey: K },
    ];
    expect(await getOriginal(N)).not.toBeNull();

    // Now P compresses: it was the last referrer, so N goes.
    const M2 = await putOriginal(fileOf("p.png", "P-COMPRESSED-TWICE"), 10, 10);
    const verdict = await deleteReplacedOriginal({
      oldKey: N, newKey: M2, photoId: "p", photos: afterC,
    });

    expect(verdict).toBe("deleted");
    expect(await getOriginal(N)).toBeNull();
    // The shared upload baseline is untouched — nobody compressed it away.
    expect(await getOriginal(K)).not.toBeNull();
    expect((await listOriginals()).sort()).toEqual([K, M, M2].sort());
  });

  it("a batch baseline held only in a React ref is not collected", async () => {
    // BatchSettings remembers the pre-logo key so re-apply replaces rather than
    // stacks. That key is in no manifest and no PhotoEntry.
    const baseline = await putOriginal(fileOf("b.png", "PRE-LOGO"), 10, 10);
    const photos: OriginalRef[] = [{ id: "p", originalKey: baseline }];
    const stamped = await putOriginal(fileOf("b.png", "WITH-LOGO"), 10, 10);

    const verdict = await deleteReplacedOriginal({
      oldKey: baseline, newKey: stamped, photoId: "p", photos,
      extraRoots: [baseline],
    });

    expect(verdict).toBe("kept: still referenced");
    expect(await getOriginal(baseline)).not.toBeNull();
  });
});

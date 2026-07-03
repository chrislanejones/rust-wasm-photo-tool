// Read-through migration adapter tests (Night A, Task A).
//
// Harness: node env + fake-indexeddb (vitest.setup.ts). Both the raw-IndexedDB
// legacy store and Dexie run against the same in-memory IDBFactory, so these
// exercise the real code paths, not mocks — except where we deliberately fault
// `db.originals.put` to simulate a torn/interrupted copy.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  getOriginal as legacyGetOriginal,
  putOriginal as legacyPutOriginal,
  deleteOriginal as legacyDeleteOriginal,
  listOriginalKeys as legacyListKeys,
} from "@/lib/originalsStore";
import {
  getOriginal,
  putOriginal,
  deleteOriginal,
  listOriginals,
} from "@/lib/dexie/originalsAdapter";

function fileOf(name: string, content: string, type = "image/png"): File {
  return new File([new TextEncoder().encode(content)], name, { type });
}

function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(new Uint8Array(buf));
}

async function clearLegacy(): Promise<void> {
  for (const k of await legacyListKeys()) await legacyDeleteOriginal(k);
}

beforeEach(async () => {
  await db.originals.clear();
  await clearLegacy();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("originals adapter — lazy read-through", () => {
  it("copies a legacy-only original into Dexie exactly once", async () => {
    const key = await legacyPutOriginal(fileOf("a.png", "AAA"), 3, 3);
    // Legacy has it; Dexie does not, yet.
    expect(await db.originals.get(key)).toBeUndefined();

    const putSpy = vi.spyOn(db.originals, "put");
    const first = await getOriginal(key);
    expect(first).not.toBeNull();
    expect(decode(first!.bytes)).toBe("AAA");
    expect(first!.name).toBe("a.png");
    expect(first!.mimeType).toBe("image/png");

    // Copy landed in Dexie.
    expect(await db.originals.get(key)).toBeDefined();

    // Second read is served from Dexie — no second copy.
    const second = await getOriginal(key);
    expect(decode(second!.bytes)).toBe("AAA");
    expect(putSpy).toHaveBeenCalledTimes(1);
  });

  it("interrupt-during-copy leaves legacy intact and a retry succeeds", async () => {
    const key = await legacyPutOriginal(fileOf("b.png", "BBB"), 1, 1);

    // Simulate a torn/interrupted copy: the first Dexie write throws.
    const putSpy = vi
      .spyOn(db.originals, "put")
      .mockRejectedValueOnce(new Error("torn write"));

    // The read still returns the correct legacy bytes (copy is best-effort).
    const first = await getOriginal(key);
    expect(decode(first!.bytes)).toBe("BBB");
    // The failed copy did not land, and legacy is untouched.
    expect(await db.originals.get(key)).toBeUndefined();
    expect(await legacyGetOriginal(key)).not.toBeNull();

    // Retry: the copy now succeeds.
    putSpy.mockRestore();
    const second = await getOriginal(key);
    expect(decode(second!.bytes)).toBe("BBB");
    expect(await db.originals.get(key)).toBeDefined();
  });

  it("delete removes the original from BOTH stores (no read-through resurrection)", async () => {
    const key = await legacyPutOriginal(fileOf("c.png", "CCC"), 1, 1);
    // Also land it in Dexie via read-through.
    await getOriginal(key);
    expect(await db.originals.get(key)).toBeDefined();
    expect(await legacyGetOriginal(key)).not.toBeNull();

    await deleteOriginal(key);

    expect(await db.originals.get(key)).toBeUndefined();
    expect(await legacyGetOriginal(key)).toBeNull();
    // A subsequent read cannot resurrect it.
    expect(await getOriginal(key)).toBeNull();
  });

  it("listOriginals returns the deduped union of both stores' keys", async () => {
    const legacyOnly = await legacyPutOriginal(fileOf("l.png", "LLL"), 1, 1);
    const dexieOnly = await putOriginal(fileOf("d.png", "DDD"), 1, 1);
    // A key present in BOTH stores (same bytes → same content-address key).
    const shared = await legacyPutOriginal(fileOf("s.png", "SSS"), 1, 1);
    const sharedDexie = await putOriginal(fileOf("s.png", "SSS"), 1, 1);
    expect(sharedDexie).toBe(shared);

    const keys = await listOriginals();
    expect(keys).toContain(legacyOnly);
    expect(keys).toContain(dexieOnly);
    expect(keys).toContain(shared);
    // Deduped: `shared` appears once, not twice.
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === shared)).toHaveLength(1);
  });

  it("fresh install (no legacy data) works with zero errors", async () => {
    // Nothing seeded. Unknown key → null.
    expect(await getOriginal("deadbeef")).toBeNull();
    expect(await listOriginals()).toEqual([]);

    // Write-then-read round-trips through Dexie alone.
    const key = await putOriginal(fileOf("fresh.png", "FRESH"), 2, 2);
    const rec = await getOriginal(key);
    expect(decode(rec!.bytes)).toBe("FRESH");
    expect(await listOriginals()).toEqual([key]);
  });
});

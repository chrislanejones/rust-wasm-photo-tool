// Task C — kill switch. With USE_DEXIE_ORIGINALS=false the adapter must bypass
// Dexie entirely: reads and writes hit the legacy raw-IndexedDB store ONLY, with
// no read-through copy. This is the runtime rollback, so it gets its own proof.
//
// The flag is a compile-time const, so we mock the one file it lives in
// (`@/lib/dexie/flags`) and re-import the adapter with modules reset.
import { afterEach, describe, expect, it, vi } from "vitest";

function fileOf(name: string, content: string, type = "image/png"): File {
  return new File([new TextEncoder().encode(content)], name, { type });
}
function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(new Uint8Array(buf));
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/dexie/flags");
});

describe("kill switch — USE_DEXIE_ORIGINALS = false → legacy only", () => {
  it("routes put/get/delete to the legacy store and never writes Dexie", async () => {
    vi.doMock("@/lib/dexie/flags", () => ({ USE_DEXIE_ORIGINALS: false }));

    const adapter = await import("@/lib/dexie/originalsAdapter");
    const { db } = await import("@/lib/dexie/db");
    const legacy = await import("@/lib/originalsStore");

    await db.originals.clear();
    for (const k of await legacy.listOriginalKeys()) await legacy.deleteOriginal(k);

    // put → legacy only.
    const key = await adapter.putOriginal(fileOf("k.png", "KKK"), 1, 1);
    expect(await legacy.getOriginal(key)).not.toBeNull();
    expect(await db.originals.get(key)).toBeUndefined();

    // get → served from legacy, no read-through copy into Dexie.
    const rec = await adapter.getOriginal(key);
    expect(decode(rec!.bytes)).toBe("KKK");
    expect(await db.originals.get(key)).toBeUndefined();

    // list → legacy keys only.
    expect(await adapter.listOriginals()).toEqual([key]);

    // delete → legacy.
    await adapter.deleteOriginal(key);
    expect(await legacy.getOriginal(key)).toBeNull();
  });
});

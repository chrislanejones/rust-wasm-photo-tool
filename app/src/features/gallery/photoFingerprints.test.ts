import { describe, expect, it } from "vitest";
import { fingerprintPhotos, toFingerprint } from "./photoFingerprints";

/** A fake engine + decoder that count their calls. Each blob's text is its
 *  "pixels", so different blobs fingerprint differently. */
function fakes() {
  const calls = { decode: 0, fingerprint: 0 };
  return {
    calls,
    deps: {
      decode: async (blob: Blob) => {
        calls.decode++;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return { rgba: bytes, w: bytes.length, h: 1 };
      },
      fingerprint: (px: Uint8Array) => {
        calls.fingerprint++;
        return px[0] === 0xff ? new Uint32Array(0) : new Uint32Array([px[0]!, px.length, 0x808080]);
      },
    },
  };
}

describe("toFingerprint", () => {
  it("reads the engine's three numbers, and nothing from an empty answer", () => {
    expect(toFingerprint(new Uint32Array([0xffffffff, 1, 0x102030]))).toEqual({ hi: 0xffffffff, lo: 1, rgb: 0x102030 });
    expect(toFingerprint(new Uint32Array(0))).toBeNull();
  });
});

describe("fingerprintPhotos — the in-memory cache", () => {
  it("hashes a thumbnail once, and again only when the thumbnail changes", async () => {
    const { calls, deps } = fakes();
    const a = { id: "cache-a", thumbBlob: new Blob([new Uint8Array([1, 2, 3])]) };
    const b = { id: "cache-b", thumbBlob: new Blob([new Uint8Array([4, 5])]) };

    const first = await fingerprintPhotos([a, b], deps);
    expect(first.get("cache-a")).toEqual({ hi: 1, lo: 3, rgb: 0x808080 });
    expect(calls.fingerprint).toBe(2);

    // Same blobs: served from the cache.
    await fingerprintPhotos([a, b], deps);
    expect(calls).toEqual({ decode: 2, fingerprint: 2 });

    // An edit writes a NEW thumbnail Blob: only that photo is hashed again.
    const edited = { id: "cache-a", thumbBlob: new Blob([new Uint8Array([9, 9, 9, 9])]) };
    const after = await fingerprintPhotos([edited, b], deps);
    expect(calls).toEqual({ decode: 3, fingerprint: 3 });
    expect(after.get("cache-a")).toEqual({ hi: 9, lo: 4, rgb: 0x808080 });
  });

  it("forgets photos that left the gallery", async () => {
    const { calls, deps } = fakes();
    const a = { id: "gone-a", thumbBlob: new Blob([new Uint8Array([1])]) };
    await fingerprintPhotos([a], deps);
    await fingerprintPhotos([], deps);
    await fingerprintPhotos([a], deps);
    expect(calls.fingerprint).toBe(2);
  });

  it("leaves out a thumbnail that will not decode or fingerprint", async () => {
    const { deps } = fakes();
    const bad = { id: "bad", thumbBlob: new Blob([new Uint8Array([0xff])]) };
    const broken = { id: "broken", thumbBlob: new Blob([]) };
    const ok = { id: "ok", thumbBlob: new Blob([new Uint8Array([7])]) };
    const out = await fingerprintPhotos([bad, broken, ok], {
      ...deps,
      decode: async (blob: Blob) => {
        if (blob.size === 0) throw new Error("not an image");
        return deps.decode(blob);
      },
    });
    expect([...out.keys()]).toEqual(["ok"]);
  });
});

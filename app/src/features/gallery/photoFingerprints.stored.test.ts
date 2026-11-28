// ADR-112 §5–6: a photo keeps its fingerprints on its gallery row. The current
// one is trusted while it was computed from the photo's current thumbnail
// (the SAME Blob, which IndexedDB's structured clone keeps), so opening the
// gallery after a reload hashes nothing; the original is written once.
import { describe, expect, it, vi } from "vitest";
import type { Fingerprint } from "@/lib/duplicates";

const fakes = () => {
  const calls = { fingerprint: 0 };
  return {
    calls,
    decode: async (blob: Blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { rgba: bytes, w: bytes.length, h: 1 };
    },
    fingerprint: (px: Uint8Array) => {
      calls.fingerprint++;
      return new Uint32Array([px[0]!, px.length, 0x808080]);
    },
  };
};

/** A fresh module: what a page reload gives (the in-memory cache is gone). */
const fresh = async () => {
  vi.resetModules();
  return import("./photoFingerprints");
};

describe("fingerprints stored on the photo (ADR-112)", () => {
  it("a stored fingerprint for the current thumbnail is used, not recomputed", async () => {
    const { fingerprintPhotos } = await fresh();
    const f = fakes();
    const thumb = new Blob([new Uint8Array([5, 6])]);
    const stored: Fingerprint = { hi: 77, lo: 88, rgb: 0x112233 };
    const photo = { id: "s1", thumbBlob: thumb, fingerprintCurrent: stored, fingerprintThumb: thumb };
    const out = await fingerprintPhotos([photo], f);
    expect(f.calls.fingerprint, "no engine call").toBe(0);
    expect(out.get("s1")).toEqual(stored);
  });

  it("a stored fingerprint for an OLDER thumbnail is not trusted", async () => {
    const { fingerprintPhotos } = await fresh();
    const f = fakes();
    const old = new Blob([new Uint8Array([1])]);
    const now = new Blob([new Uint8Array([9, 9])]);
    const photo = { id: "s2", thumbBlob: now, fingerprintCurrent: { hi: 1, lo: 1, rgb: 0 }, fingerprintThumb: old };
    const out = await fingerprintPhotos([photo], f);
    expect(f.calls.fingerprint).toBe(1);
    expect(out.get("s2")).toEqual({ hi: 9, lo: 2, rgb: 0x808080 });
  });

  it("a computed fingerprint is handed back to store; the original only when the photo has none", async () => {
    const { fingerprintPhotos } = await fresh();
    const f = fakes();
    const remember = vi.fn();
    const thumbA = new Blob([new Uint8Array([3])]);
    const thumbB = new Blob([new Uint8Array([4])]);
    const original: Fingerprint = { hi: 50, lo: 1, rgb: 0x0000ff };
    await fingerprintPhotos(
      [
        { id: "old", thumbBlob: thumbA },
        { id: "edited", thumbBlob: thumbB, fingerprintOriginal: original },
      ],
      { ...f, remember },
    );
    const patches = new Map(remember.mock.calls.map(([id, patch]) => [id, patch]));
    // A photo saved before ADR-112: its current fingerprint becomes its
    // original too (it can't recover a pre-edit original, and says so in the ADR).
    expect(patches.get("old")).toEqual({
      fingerprintCurrent: { hi: 3, lo: 1, rgb: 0x808080 },
      fingerprintThumb: thumbA,
      fingerprintOriginal: { hi: 3, lo: 1, rgb: 0x808080 },
    });
    expect(patches.get("edited")).toEqual({ fingerprintCurrent: { hi: 4, lo: 1, rgb: 0x808080 }, fingerprintThumb: thumbB });
  });

  it("an old photo is hashed once: after the patch is stored, a reload hashes nothing", async () => {
    const f = fakes();
    const thumb = new Blob([new Uint8Array([8, 8, 8])]);
    let photo: Record<string, unknown> & { id: string; thumbBlob: Blob } = { id: "once", thumbBlob: thumb };
    const remember = (id: string, patch: object) => {
      if (id === photo.id) photo = { ...photo, ...patch };
    };
    await (await fresh()).fingerprintPhotos([photo], { ...f, remember });
    expect(f.calls.fingerprint).toBe(1);
    await (await fresh()).fingerprintPhotos([photo], { ...f, remember });
    expect(f.calls.fingerprint, "the reload used the stored one").toBe(1);
  });

  it("the original at import comes from the first thumbnail", async () => {
    const { fingerprintAtImport } = await fresh();
    const f = fakes();
    expect(await fingerprintAtImport(new Blob([new Uint8Array([6, 1])]), f)).toEqual({ hi: 6, lo: 2, rgb: 0x808080 });
  });
});

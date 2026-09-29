import { beforeEach, describe, expect, it, vi } from "vitest";

// The codec worker and the EXIF writer are not what is under test — the
// decisions this module makes about them are. Both are stubbed to record what
// they were asked for.
const encodeCalls: Array<{ format: string; quality: number }> = [];
let encodeReturns: string | null = null; // mime the fake encoder answers with
vi.mock("@/lib/exportImage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/exportImage")>();
  return {
    ...real,
    encodeRgba: vi.fn(async (_px: Uint8Array, _w: number, _h: number, format: string, quality: number) => {
      encodeCalls.push({ format, quality });
      return new Blob([new Uint8Array([1, 2, 3])], { type: encodeReturns ?? `image/${format}` });
    }),
  };
});
vi.mock("@/lib/exif", () => ({
  readExifTiff: vi.fn(() => new Uint8Array([9])),
  applyExifToVerbatim: vi.fn((b: Uint8Array) => b),
  applyExifToReencoded: vi.fn((b: Uint8Array) => b),
}));

import { untouchedZipEntry, zipKeepsStoredBytes, type DecodeToRgba } from "./zipEntry";
import { applyExifToVerbatim, readExifTiff } from "@/lib/exif";

const png = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer, mimeType: "image/png" };
const jpeg = { bytes: new Uint8Array([0xff, 0xd8, 0xff]).buffer, mimeType: "image/jpeg" };
const keep = { mode: "keep" as const, stripMode: "all" as const };

let decodes = 0;
const fakeDecode: DecodeToRgba = async () => {
  decodes++;
  return { pixels: new Uint8ClampedArray(4 * 2 * 2), width: 2, height: 2 };
};

beforeEach(() => {
  encodeCalls.length = 0;
  encodeReturns = null;
  decodes = 0;
  vi.mocked(readExifTiff).mockClear();
  vi.mocked(applyExifToVerbatim).mockClear();
});

describe("zipKeepsStoredBytes", () => {
  it("keeps a file already in the chosen format", () => {
    expect(zipKeepsStoredBytes("image/jpeg", "jpeg")).toBe(true);
    expect(zipKeepsStoredBytes("image/png", "png")).toBe(true);
  });
  it("converts one that is not", () => {
    expect(zipKeepsStoredBytes("image/png", "webp")).toBe(false);
    expect(zipKeepsStoredBytes("image/jpeg", "png")).toBe(false);
  });
  it("never treats an unplaceable mime as a match", () => {
    expect(zipKeepsStoredBytes("application/octet-stream", "png")).toBe(false);
  });
});

describe("untouchedZipEntry", () => {
  it("copies a same-format photo untouched — no decode, no encode", async () => {
    const out = await untouchedZipEntry(png, "png", 0.8, keep, fakeDecode);
    expect(decodes).toBe(0);
    expect(encodeCalls).toHaveLength(0);
    expect([...out.bytes]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(out).toMatchObject({ mime: "image/png", ext: ".png" });
    expect(applyExifToVerbatim).toHaveBeenCalledTimes(1);
  });

  it("re-encodes a photo into the chosen format, at the chosen quality", async () => {
    const out = await untouchedZipEntry(png, "webp", 0.8, keep, fakeDecode);
    expect(decodes).toBe(1);
    expect(encodeCalls).toEqual([{ format: "webp", quality: 0.8 }]);
    expect(out).toMatchObject({ mime: "image/webp", ext: ".webp" });
  });

  it("names the file after what was WRITTEN — an AVIF that fell back to PNG is .png", async () => {
    encodeReturns = "image/png";
    const out = await untouchedZipEntry(jpeg, "avif", 0.8, keep, fakeDecode);
    expect(encodeCalls).toEqual([{ format: "avif", quality: 0.8 }]);
    expect(out).toMatchObject({ mime: "image/png", ext: ".png" });
  });

  it("carries metadata onto a re-encode only where the format can hold it", async () => {
    await untouchedZipEntry(png, "jpeg", 0.8, keep, fakeDecode);
    expect(readExifTiff).toHaveBeenCalledTimes(1);
    vi.mocked(readExifTiff).mockClear();
    await untouchedZipEntry(jpeg, "png", 0.8, keep, fakeDecode);
    expect(readExifTiff).not.toHaveBeenCalled();
  });

  it("reads no metadata at all when stripping", async () => {
    await untouchedZipEntry(png, "jpeg", 0.8, { mode: "strip", stripMode: "all" }, fakeDecode);
    expect(readExifTiff).not.toHaveBeenCalled();
  });
});

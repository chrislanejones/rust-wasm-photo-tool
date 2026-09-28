import { describe, expect, it } from "vitest";
import { autoCompressedPatch, sizeDeltaPercent } from "./sizeDelta";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

describe("sizeDeltaPercent", () => {
  it("measures against the upload, not the previous file", () => {
    // Upload 1 MB → compressed to 300 KB → compressed again to 200 KB. The
    // badge must read 80%, not the 33% a second run measured against 300 KB.
    expect(sizeDeltaPercent({ originalByteSize: 1_000_000, byteSize: 200_000 })).toBe(80);
  });

  it("is signed: a file that grew reads negative", () => {
    expect(sizeDeltaPercent({ originalByteSize: 100, byteSize: 250 })).toBe(-150);
  });

  it("is null when either size is unknown", () => {
    expect(sizeDeltaPercent({ originalByteSize: 0, byteSize: 10 })).toBeNull();
    expect(sizeDeltaPercent({ originalByteSize: 10, byteSize: 0 })).toBeNull();
  });
});

describe("autoCompressedPatch", () => {
  const photo = { mimeType: "image/jpeg" } as PhotoEntry;
  const thumb = new Blob();

  it("records what was written: dims, MIME and quality", () => {
    const file = new File([new Uint8Array(5)], "a.webp", { type: "image/webp" });
    expect(
      autoCompressedPatch(photo, file, "k", thumb, { width: 1920, height: 1080, quality: 63 }),
    ).toMatchObject({
      originalKey: "k",
      byteSize: 5,
      mimeType: "image/webp",
      origWidth: 1920,
      origHeight: 1080,
      workingWidth: 1920,
      workingHeight: 1080,
      encodeQuality: 63,
    });
  });

  it("drops the quality for a lossless PNG fallback", () => {
    const file = new File([new Uint8Array(5)], "a.png", { type: "image/png" });
    expect(
      autoCompressedPatch(photo, file, "k", thumb, { width: 1, height: 1, quality: 70 }).encodeQuality,
    ).toBeUndefined();
  });
});

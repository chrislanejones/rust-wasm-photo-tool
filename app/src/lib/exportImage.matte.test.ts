import { describe, it, expect } from "vitest";
import {
  matteOntoOpaque,
  JPEG_MATTE,
  formatCarriesAlpha,
  type ExportFormat,
} from "./exportImage";

/**
 * #46 — JPEG has no alpha channel, so a transparent pixel has to be
 * composited onto something before encoding. Nothing did that, so the encoder
 * got alpha it could not represent and wrote opaque BLACK: an erased hole came
 * out as a black blob in the middle of the photo.
 *
 * These tests are on `matteOntoOpaque` rather than `encodeRgba` because the
 * encode itself needs `OffscreenCanvas.convertToBlob`, which does not exist in
 * this test environment. The matte is the whole of the fix; the encode is the
 * browser's.
 */

/** An `w × h` opaque red image with a fully transparent rectangular hole. */
function imageWithHole(w: number, h: number, hole: { x: number; y: number; w: number; h: number }) {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inHole =
        x >= hole.x && x < hole.x + hole.w && y >= hole.y && y < hole.y + hole.h;
      px[i] = 200;       // r
      px[i + 1] = 30;    // g
      px[i + 2] = 30;    // b
      px[i + 3] = inHole ? 0 : 255;
    }
  }
  return px;
}

const at = (px: Uint8Array, w: number, x: number, y: number) => {
  const i = (y * w + x) * 4;
  return [px[i], px[i + 1], px[i + 2], px[i + 3]];
};

describe("#46 — an interior hole must not encode as black", () => {
  const W = 8, H = 8;
  const HOLE = { x: 3, y: 3, w: 2, h: 2 };

  it("the hole is transparent before the matte — the setup is real", () => {
    const px = imageWithHole(W, H, HOLE);
    expect(at(px, W, 3, 3)).toEqual([200, 30, 30, 0]);
  });

  it("THE BUG: every hole pixel is opaque and NOT black after matteing", () => {
    const px = imageWithHole(W, H, HOLE);
    matteOntoOpaque(px);
    for (let y = HOLE.y; y < HOLE.y + HOLE.h; y++) {
      for (let x = HOLE.x; x < HOLE.x + HOLE.w; x++) {
        const [r, g, b, a] = at(px, W, x, y);
        expect(a, `alpha at ${x},${y}`).toBe(255);
        // The failure this exists to catch is exactly (0,0,0).
        expect([r, g, b], `colour at ${x},${y}`).not.toEqual([0, 0, 0]);
        expect([r, g, b], `colour at ${x},${y}`).toEqual([...JPEG_MATTE]);
      }
    }
  });

  it("opaque pixels are left byte-for-byte alone", () => {
    const px = imageWithHole(W, H, HOLE);
    const before = at(px, W, 0, 0);
    matteOntoOpaque(px);
    expect(at(px, W, 0, 0)).toEqual(before);
    expect(before).toEqual([200, 30, 30, 255]);
  });

  it("a half-transparent pixel blends toward the matte, not to black", () => {
    // 50% alpha red over white → a pink, and specifically not darker than the
    // source. The old behaviour drove it toward 0.
    const px = new Uint8Array([200, 30, 30, 128]);
    matteOntoOpaque(px);
    const [r, g, b, a] = [px[0], px[1], px[2], px[3]];
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(200);   // pulled UP toward white
    expect(g).toBeGreaterThan(30);
    expect(b).toBeGreaterThan(30);
    expect([r, g, b]).not.toEqual([0, 0, 0]);
  });

  it("an all-transparent buffer becomes a solid matte, not a black rectangle", () => {
    const px = new Uint8Array(4 * 4 * 4); // every byte 0 — transparent black
    matteOntoOpaque(px);
    for (let i = 0; i < px.length; i += 4) {
      expect([px[i], px[i + 1], px[i + 2], px[i + 3]]).toEqual([...JPEG_MATTE, 255]);
    }
  });

  it("honours a caller-supplied matte", () => {
    const px = new Uint8Array([0, 0, 0, 0]);
    matteOntoOpaque(px, [10, 20, 30]);
    expect([px[0], px[1], px[2], px[3]]).toEqual([10, 20, 30, 255]);
  });

  it("is idempotent — matteing twice changes nothing the second time", () => {
    const px = imageWithHole(W, H, HOLE);
    matteOntoOpaque(px);
    const once = Array.from(px);
    matteOntoOpaque(px);
    expect(Array.from(px)).toEqual(once);
  });
});

describe("#46 — only alpha-less formats get matted", () => {
  it("JPEG is the one format that cannot carry alpha", () => {
    const formats: ExportFormat[] = ["png", "jpeg", "webp", "avif"];
    const without = formats.filter((f) => !formatCarriesAlpha(f));
    expect(without).toEqual(["jpeg"]);
  });

  it("the matte is white — black is the absence of a matte, not a choice", () => {
    expect([...JPEG_MATTE]).toEqual([255, 255, 255]);
  });
});

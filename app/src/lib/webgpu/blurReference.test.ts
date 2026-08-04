// ===== FILE: app/src/lib/webgpu/blurReference.test.ts =====
// The CPU oracle has to be right before it can judge the GPU. There is no
// WebGPU in jsdom, so the shader itself is checked by the in-browser harness
// (`selfTest.ts`) — these tests pin the parts that CAN be checked in node, and
// they are the parts most likely to drift away from the Rust:
//
//   • the kernel (sigma = max(r,1)/2, normalised, symmetric)
//   • clamp-to-edge at the boundary
//   • the u8 quantisation BETWEEN passes, which is the detail a GPU port
//     silently "improves" and thereby breaks
import { describe, it, expect } from "vitest";
import {
  buildGaussianKernel,
  clampRadius,
  gaussianBlurCpu,
} from "./blurReference";

describe("buildGaussianKernel", () => {
  it("has length 2r+1", () => {
    expect(buildGaussianKernel(1)).toHaveLength(3);
    expect(buildGaussianKernel(5)).toHaveLength(11);
    expect(buildGaussianKernel(30)).toHaveLength(61);
  });

  it("normalises to 1", () => {
    for (const r of [1, 2, 5, 13, 30]) {
      const sum = [...buildGaussianKernel(r)].reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("is symmetric and peaks in the centre", () => {
    const k = buildGaussianKernel(7);
    for (let i = 0; i < k.length; i++) {
      expect(k[i]).toBeCloseTo(k[k.length - 1 - i], 6);
    }
    expect(Math.max(...k)).toBe(k[7]);
  });

  it("uses sigma = max(r,1)/2 — NOT r/3", () => {
    // Pins the constant against the Rust. With sigma = r/2 the ratio of the
    // edge tap to the centre tap is exp(-r^2 / (2*(r/2)^2)) = exp(-2).
    const r = 6;
    const k = buildGaussianKernel(r);
    expect(k[0] / k[r]).toBeCloseTo(Math.exp(-2), 6);
  });

  it("treats radius 0 as sigma 0.5 rather than dividing by zero", () => {
    const k = buildGaussianKernel(0);
    expect(k).toHaveLength(1);
    expect(k[0]).toBe(1);
  });
});

describe("clampRadius", () => {
  it("matches intensity.clamp(1, 30)", () => {
    expect(clampRadius(0)).toBe(1);
    expect(clampRadius(-5)).toBe(1);
    expect(clampRadius(7)).toBe(7);
    expect(clampRadius(30)).toBe(30);
    expect(clampRadius(999)).toBe(30);
  });
});

describe("gaussianBlurCpu", () => {
  const solid = (w: number, h: number, rgba: [number, number, number, number]) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < px.length; i += 4) px.set(rgba, i);
    return px;
  };

  it("leaves a uniform image untouched", () => {
    // A normalised kernel over a constant field is the identity — and because
    // edges CLAMP rather than fading to transparent, that holds at the border
    // too. If edge handling ever became zero-padding, this test goes red.
    const w = 16, h = 9;
    const px = solid(w, h, [12, 200, 77, 210]);
    const out = gaussianBlurCpu(px, w, h, 4);
    expect([...out]).toEqual([...px]);
  });

  it("blurs the alpha channel too", () => {
    // The engine blurs all four channels. A port that forces alpha to 255 would
    // pass every opaque test and wreck transparent images.
    const w = 8, h = 1;
    const px = new Uint8ClampedArray(w * 4);
    for (let i = 0; i < w; i++) px[i * 4 + 3] = i < 4 ? 0 : 255;
    const out = gaussianBlurCpu(px, w, h, 3);
    const alphas = [...out].filter((_, i) => i % 4 === 3);
    expect(alphas.some((a) => a !== 0 && a !== 255)).toBe(true);
  });

  it("preserves total energy at an edge (clamp, not darken)", () => {
    // Clamp-to-edge means the corner of a white image stays white. Zero-padding
    // would pull it down — the classic dark-border blur bug.
    const w = 12, h = 12;
    const px = solid(w, h, [255, 255, 255, 255]);
    const out = gaussianBlurCpu(px, w, h, 6);
    expect(out[0]).toBe(255);
    expect(out[(w * h - 1) * 4]).toBe(255);
  });

  it("is deterministic", () => {
    const w = 10, h = 10;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < px.length; i++) px[i] = (i * 37) % 256;
    const a = gaussianBlurCpu(px, w, h, 5);
    const b = gaussianBlurCpu(px, w, h, 5);
    expect([...a]).toEqual([...b]);
  });

  it("does not mutate its input", () => {
    const w = 6, h = 6;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < px.length; i++) px[i] = (i * 13) % 256;
    const before = [...px];
    gaussianBlurCpu(px, w, h, 3);
    expect([...px]).toEqual(before);
  });

  it("quantises between passes — the detail a GPU port breaks", () => {
    // The whole shader design rests on this: the engine rounds to u8 BETWEEN
    // the horizontal and vertical passes, so a GPU version that keeps f32
    // throughout is cheaper, arguably produces a nicer image, and disagrees
    // with the CPU path — which means the same document renders differently
    // depending on who drew it.
    //
    // Measured over 400 random 16x16 images at radii 1-6: every single one
    // differs, max delta 1, around a fifth of all channels. Small, and not
    // optional.
    const w = 16, h = 16, r = 2;
    const px = new Uint8ClampedArray(w * h * 4);
    let s = 12345 >>> 0;
    for (let i = 0; i < px.length; i++) {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      px[i] = s & 0xff;
    }
    const quantised = gaussianBlurCpu(px, w, h, r);

    // The same two passes with a float intermediate — the wrong way.
    const k = buildGaussianKernel(r);
    const mid = new Float32Array(px.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 4; c++) {
          let acc = 0;
          for (let ki = -r; ki <= r; ki++)
            acc += px[(y * w + Math.min(w - 1, Math.max(0, x + ki))) * 4 + c] * k[ki + r];
          mid[(y * w + x) * 4 + c] = acc;
        }
    const floaty = new Uint8ClampedArray(px.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 4; c++) {
          let acc = 0;
          for (let ki = -r; ki <= r; ki++)
            acc += mid[(Math.min(h - 1, Math.max(0, y + ki)) * w + x) * 4 + c] * k[ki + r];
          floaty[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, Math.round(acc)));
        }

    let differing = 0, maxDelta = 0;
    for (let i = 0; i < quantised.length; i++) {
      const d = Math.abs(quantised[i] - floaty[i]);
      if (d) { differing++; if (d > maxDelta) maxDelta = d; }
    }
    expect(differing).toBeGreaterThan(0);   // the two really are different
    expect(maxDelta).toBeLessThanOrEqual(1); // and the difference is +/-1, not a bug
  });
});

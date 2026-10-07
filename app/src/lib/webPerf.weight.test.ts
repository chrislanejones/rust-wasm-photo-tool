import { describe, it, expect, vi } from "vitest";

// The real engine model, re-stated: projected = cur × area × min(q,100)/100 × fmt.
vi.mock("@/lib/engineGate", () => ({
  importEngine: async () => ({
    web_perf_metrics: (cw: number, ch: number, cb: number, _ob: number, nw: number, nh: number, q: number, cf: number, nf: number) => {
      const w = (c: number) => ({ 0: 2.6, 1: 1, 2: 0.8, 3: 0.6 } as Record<number, number>)[c] ?? 1;
      const projected = cb * ((nw * nh) / (cw * ch)) * Math.min(1, q / 100) * (w(nf) / w(cf));
      return [(projected / Math.max(1, (nw * nh) / 6)) * 100, 0];
    },
  }),
}));

import { getImageWeight, googleImageLimitBytes } from "./webPerf";

describe("googleImageLimitBytes", () => {
  it("is pixels / 6 plus Lighthouse's 4096-byte threshold, unclamped", () => {
    expect(googleImageLimitBytes(256, 256)).toBe(Math.floor(65536 / 6) + 4096); // 15,018 — not the 28 KB floor
    expect(googleImageLimitBytes(1920, 1080)).toBe(345600 + 4096);
    expect(googleImageLimitBytes(0, 10)).toBe(0);
  });
});

describe("getImageWeight", () => {
  const base = { curW: 2000, curH: 1500, curBytes: 900_000, origBytes: 900_000, newW: 2000, newH: 1500, curMime: "image/jpeg" };

  it("an image exactly at the limit passes", async () => {
    const limit = googleImageLimitBytes(256, 256);
    const r = await getImageWeight({ ...base, curW: 256, curH: 256, newW: 256, newH: 256, curBytes: limit, origBytes: limit, relativeQuality: 100 });
    expect(r.projectedBytes).toBe(limit);
    expect(r.pass).toBe(true);
  });

  it("raising quality makes the estimate BIGGER, not unchanged", async () => {
    const same = await getImageWeight({ ...base, relativeQuality: 100 });
    const up = await getImageWeight({ ...base, relativeQuality: 180 }); // q50 file → q90
    expect(up.projectedBytes).toBeGreaterThan(same.projectedBytes);
    expect(up.gainPercent).toBeLessThan(0);
  });

  it("halving width and height quarters the estimate and moves the verdict", async () => {
    const full = await getImageWeight({ ...base, relativeQuality: 100 });
    const half = await getImageWeight({ ...base, newW: 1000, newH: 750, relativeQuality: 100 });
    expect(half.projectedBytes).toBe(Math.round(full.projectedBytes / 4));
    expect(full.pass).toBe(false); // 900,000 B vs a 504,096 B limit
    expect(half.pass).toBe(false); // 225,000 B vs 129,096 B: smaller pixels, smaller limit too
    const halfQ = await getImageWeight({ ...base, newW: 1000, newH: 750, relativeQuality: 50 });
    expect(halfQ.projectedBytes).toBe(112_500);
    expect(halfQ.pass).toBe(true);
    expect(halfQ.gainPercent).toBe(88);
  });

  it("WebP from JPEG weighs 0.8× — the format choice moves the verdict", async () => {
    const jpeg = await getImageWeight({ ...base, newW: 1000, newH: 750, relativeQuality: 60 });
    const webp = await getImageWeight({ ...base, newW: 1000, newH: 750, relativeQuality: 60, newFormat: "webp" });
    expect(webp.projectedBytes).toBe(Math.round(jpeg.projectedBytes * 0.8));
  });
});

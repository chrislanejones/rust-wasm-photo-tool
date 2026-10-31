import { describe, expect, it } from "vitest";
import { encodeUnder, kb, resizeTarget, resolveFormat } from "./batchResize";

describe("resizeTarget", () => {
  it("scales a wide photo to the width", () => {
    expect(resizeTarget(4000, 3000, { fit: "width", size: 1600 })).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a tall photo by its long edge", () => {
    expect(resizeTarget(3000, 4000, { fit: "long", size: 1600 })).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales", () => {
    expect(resizeTarget(1200, 800, { fit: "width", size: 1600 })).toEqual({ width: 1200, height: 800 });
  });

  it("Keep leaves the size alone", () => {
    expect(resizeTarget(4000, 3000, { fit: "width", size: null })).toEqual({ width: 4000, height: 3000 });
  });
});

describe("resolveFormat", () => {
  it("Keep writes the photo's own format, JPEG when unknown", () => {
    expect(resolveFormat({ format: "keep" }, "png")).toBe("png");
    expect(resolveFormat({ format: "keep" }, null)).toBe("jpeg");
    expect(resolveFormat({ format: "webp" }, "png")).toBe("webp");
  });
});

describe("encodeUnder", () => {
  // A fake encoder whose size grows with quality: q × 10 bytes.
  const fake = async (q: number) => new Blob([new Uint8Array(q * 10)]);

  it("keeps the asked quality when it already fits", async () => {
    const r = await encodeUnder(fake, 80, 1000);
    expect(r).toMatchObject({ quality: 80, fits: true, encodes: 1 });
  });

  it("finds the highest quality under the target", async () => {
    const r = await encodeUnder(fake, 80, 455);
    expect(r.quality).toBe(45);
    expect(r.blob.size).toBe(450);
    expect(r.fits).toBe(true);
    expect(r.encodes).toBeLessThanOrEqual(8);
  });

  it("says when nothing fits and returns the smallest tried", async () => {
    const r = await encodeUnder(fake, 80, 50);
    expect(r.fits).toBe(false);
    expect(r.quality).toBe(10);
  });

  it("with no target encodes once", async () => {
    const r = await encodeUnder(fake, 70, null);
    expect(r).toMatchObject({ quality: 70, fits: true, encodes: 1 });
  });
});

it("kb formats with a thousands separator", () => {
  expect(kb(1240 * 1024)).toBe("1,240 KB");
});

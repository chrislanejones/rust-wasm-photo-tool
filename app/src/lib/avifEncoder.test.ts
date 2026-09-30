import { beforeAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { init } from "@jsquash/avif/encode.js";
import { avifQuality, encodeAvif } from "./avifEncoder";
import { canEncode } from "./encodeSupport";

/**
 * "Export as AVIF" used to write PNG bytes: no browser can encode AVIF from a
 * canvas, and `convertToBlob` falls back to PNG without a word. These pin that
 * the shipped encoder really produces an AVIF file — checked by its `ftyp`
 * brand, not by the Blob's `type`, which is only a label we set ourselves.
 */
describe("AVIF export", () => {
  beforeAll(async () => {
    // Node's fetch cannot load the encoder's file:// wasm URL, which a browser
    // resolves itself — hand the same module the compiled binary instead.
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("@jsquash/avif/codec/enc/avif_enc.wasm");
    await init(await WebAssembly.compile(await readFile(wasmPath)));
  });

  it("encodes RGBA with alpha to a real AVIF file", async () => {
    const w = 16, h = 16;
    const px = new Uint8Array(w * h * 4);
    for (let i = 0; i < px.length; i += 4) {
      px[i] = 200; px[i + 1] = 40; px[i + 2] = 90;
      px[i + 3] = i < px.length / 2 ? 255 : 0;
    }
    const before = px.slice();
    const blob = await encodeAvif(px, w, h, 0.8);
    expect(blob.type).toBe("image/avif");
    const head = new Uint8Array(await blob.arrayBuffer()).slice(4, 12);
    expect(new TextDecoder().decode(head)).toBe("ftypavif");
    // The caller's buffer is neither detached nor rewritten.
    expect(px).toEqual(before);
  }, 30_000);

  it("maps 0..1 quality onto the encoder's 0..100, clamped", () => {
    expect(avifQuality(0.92)).toBe(92);
    expect(avifQuality(0)).toBe(0);
    expect(avifQuality(1.7)).toBe(100);
    expect(avifQuality(-1)).toBe(0);
    expect(avifQuality(Number.NaN)).toBe(50);
  });

  it("reports AVIF as encodable without a canvas probe", async () => {
    // Node has no OffscreenCanvas, so a canvas probe would answer false.
    expect(typeof OffscreenCanvas).toBe("undefined");
    await expect(canEncode("image/avif")).resolves.toBe(true);
    await expect(canEncode("image/webp")).resolves.toBe(false);
  });
});

// The real decoder against a real file. e2e/fixtures/sky-building-600x400.heic
// was made from the sky-building.png fixture (never from a personal photo) by
// ImageMagick 7 + libheif 1.19.8 + x265, with a hand-built EXIF block carrying
// Make = "ImageHorseTest". So this covers what heicExif.test.ts cannot: a HEIF
// WRITER's own item table, not one built from the spec in this repo.
//
// libheif runs here because Node, unlike a browser main thread, allows a
// synchronous `new WebAssembly.Module` of any size. In the app it runs only in
// the codec worker (lib/heicCodec.ts says why).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeHeicToRgba } from "@/lib/heicCodec";
import { extractHeicExifTiff } from "@/lib/heicExif";
import { looksLikeHeicBytes } from "@/lib/heic";

const fixture = () =>
  new Uint8Array(readFileSync(join(__dirname, "../../../e2e/fixtures/sky-building-600x400.heic")));

describe("HEIC fixture, end to end below the worker", () => {
  it("sniffs as HEIC", () => {
    expect(looksLikeHeicBytes(fixture())).toBe(true);
  });

  it("decodes to 600x400 RGBA through libheif", async () => {
    const { pixels, width, height } = await decodeHeicToRgba(fixture());
    expect([width, height]).toEqual([600, 400]);
    expect(pixels.length).toBe(600 * 400 * 4);
    // Not a blank buffer: the sky-building fixture has real color in it.
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 0) lit++;
    expect(lit).toBeGreaterThan(600 * 400 * 0.5);
  }, 30_000);

  it("finds the EXIF item the writer put there", () => {
    const tiff = extractHeicExifTiff(fixture() as Uint8Array<ArrayBuffer>);
    expect(tiff).not.toBeNull();
    expect(new TextDecoder("latin1").decode(tiff!)).toContain("ImageHorseTest");
  });
});

// LGPL-3.0 §4(b): the license text goes out with the app. The copy in
// app/public is served at /licenses/libheif-js.LICENSE.txt; this keeps it
// byte-identical to the one in the installed package, so a version bump that
// changes the license cannot ship the old text.
describe("libheif license notice", () => {
  it("ships the installed package's LICENSE verbatim", () => {
    const shipped = readFileSync(join(__dirname, "../../public/licenses/libheif-js.LICENSE.txt"), "utf8");
    const pkg = readFileSync(
      join(__dirname, "../../node_modules/libheif-js/libheif-wasm/LICENSE"),
      "utf8",
    );
    expect(shipped).toBe(pkg);
    expect(shipped).toContain("GNU LESSER GENERAL PUBLIC LICENSE");
  });
});

// ===== FILE: app/src/lib/heic.test.ts =====
//
// Detection tests for the HEIC import boundary.
//
// Detection is the half that has to be right BEFORE anything is decoded: a
// HEIC that the file filters drop never reaches the converter at all, and a
// file wrongly routed INTO the converter costs a pointless 2 MB download. Both
// mistakes are silent, which is exactly why they are pinned here.
//
// The decode itself is not tested here: libheif only runs inside a Web Worker
// (lib/heicCodec.ts says why), and vitest runs in node with no worker, no
// OffscreenCanvas and no `createImageBitmap`.

import { describe, it, expect } from "vitest";
import { isHeicFile, looksLikeHeicBytes } from "@/lib/heic";

/** Build an `ftyp` box: size, "ftyp", major brand, minor version, compat list. */
function ftyp(major: string, compatible: string[] = []): Uint8Array {
  const size = 16 + compatible.length * 4;
  const out = new Uint8Array(size + 8); // + a stub box after it
  const dv = new DataView(out.buffer);
  dv.setUint32(0, size);
  out.set(new TextEncoder().encode("ftyp"), 4);
  out.set(new TextEncoder().encode(major), 8);
  dv.setUint32(12, 0); // minor_version
  compatible.forEach((brand, i) => out.set(new TextEncoder().encode(brand), 16 + i * 4));
  return out;
}

const file = (name: string, type = "") => new File([new Uint8Array(1)], name, { type });

describe("isHeicFile", () => {
  it("accepts the HEIC/HEIF mime types", () => {
    expect(isHeicFile(file("a.jpg", "image/heic"))).toBe(true);
    expect(isHeicFile(file("a.jpg", "image/heif"))).toBe(true);
    expect(isHeicFile(file("a.jpg", "image/heic-sequence"))).toBe(true);
  });

  // The case that matters most in practice: Chrome and Firefox hand over an
  // EMPTY type for a .heic, because the OS has no mime for a format they
  // cannot display. Detection by name is the only thing standing between an
  // iPhone photo and being silently filtered out of a drop.
  it("accepts a typeless file by extension, in any case", () => {
    expect(isHeicFile(file("IMG_0001.HEIC"))).toBe(true);
    expect(isHeicFile(file("IMG_0001.heic"))).toBe(true);
    expect(isHeicFile(file("photo.heif"))).toBe(true);
    expect(isHeicFile(file("photo.hif"))).toBe(true);
  });

  it("leaves every other image alone", () => {
    expect(isHeicFile(file("a.jpg", "image/jpeg"))).toBe(false);
    expect(isHeicFile(file("a.png", "image/png"))).toBe(false);
    expect(isHeicFile(file("a.avif", "image/avif"))).toBe(false);
    expect(isHeicFile(file("a.webp", "image/webp"))).toBe(false);
    expect(isHeicFile(file("heic-notes.txt", "text/plain"))).toBe(false);
  });
});

describe("looksLikeHeicBytes", () => {
  it("accepts the brands real HEIC writers emit", () => {
    // iPhone: major brand heic. libheif/ffmpeg: major brand mif1 with heic in
    // the compatible list (this is the strukturag sample's exact header).
    expect(looksLikeHeicBytes(ftyp("heic"))).toBe(true);
    expect(looksLikeHeicBytes(ftyp("mif1", ["mif1", "heic", "hevc"]))).toBe(true);
    expect(looksLikeHeicBytes(ftyp("heix"))).toBe(true);
    expect(looksLikeHeicBytes(ftyp("msf1", ["msf1", "hevc"]))).toBe(true);
  });

  // AVIF is also ISO-BMFF and also lists mif1. Sending one through libheif
  // would download 2 MB to do slowly what the browser does natively.
  it("refuses AVIF, which shares the container and the mif1 brand", () => {
    expect(looksLikeHeicBytes(ftyp("avif"))).toBe(false);
    expect(looksLikeHeicBytes(ftyp("avis"))).toBe(false);
    expect(looksLikeHeicBytes(ftyp("mif1", ["mif1", "avif"]))).toBe(false);
  });

  it("refuses anything that isn't an ftyp container", () => {
    expect(looksLikeHeicBytes(new Uint8Array(0))).toBe(false);
    expect(looksLikeHeicBytes(new Uint8Array(4))).toBe(false);
    // A JPEG named .heic — the reason convertHeicToWebp sniffs at all, since
    // it hands such a file back untouched for the normal decode path.
    expect(looksLikeHeicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 0]))).toBe(false);
    // An ISO-BMFF video, which is a container we can read and an image we can't.
    expect(looksLikeHeicBytes(ftyp("isom", ["isom", "mp42"]))).toBe(false);
  });
});

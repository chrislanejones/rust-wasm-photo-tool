import { describe, it, expect } from "vitest";
import { includeCanvasInExport, ALPHA_CAPABLE_FORMATS } from "./exportImage";

/**
 * The rule behind the JPEG border bug (2026-08-18).
 *
 * A photo loads onto a backing artboard (`canvasArtboard` default on,
 * `canvasPadding` 10px, fill "transparent") and "Include canvas" is the export
 * default under ADR-016. JPEG carries no alpha, so the browser encoder wrote
 * that transparent margin as opaque black — measured in Chrome, a transparent
 * pixel round-trips out of `convertToBlob({type:"image/jpeg"})` as
 * rgba(0,0,5,255), while png/webp keep rgba(0,0,0,0). Every JPEG export came
 * out framed in a border that was never on screen.
 *
 * The fix is a routing rule, not a pixel change: an unrepresentable backing is
 * left out rather than invented. These pin both halves — the case that must now
 * drop the canvas, and every case that must still keep it.
 */
describe("includeCanvasInExport", () => {
  it('leaves the canvas out of a JPEG when the backing is transparent', () => {
    expect(
      includeCanvasInExport({
        exportCanvasBackground: true,
        format: "jpeg",
        canvasBgTransparent: true,
      }),
    ).toBe(false);
  });

  it("keeps an OPAQUE backing in a JPEG — that border is real, visible content", () => {
    expect(
      includeCanvasInExport({
        exportCanvasBackground: true,
        format: "jpeg",
        canvasBgTransparent: false,
      }),
    ).toBe(true);
  });

  it.each(["png", "webp", "avif"] as const)(
    "keeps a transparent backing in %s — the format can represent it",
    (format) => {
      expect(
        includeCanvasInExport({
          exportCanvasBackground: true,
          format,
          canvasBgTransparent: true,
        }),
      ).toBe(true);
    },
  );

  it.each(["png", "jpeg", "webp", "avif"] as const)(
    '"Photo only" still means photo only for %s',
    (format) => {
      for (const canvasBgTransparent of [true, false]) {
        expect(
          includeCanvasInExport({
            exportCanvasBackground: false,
            format,
            canvasBgTransparent,
          }),
        ).toBe(false);
      }
    },
  );

  it("names JPEG as the only alpha-less export format", () => {
    // If a format is ever added, this fails until someone decides which side of
    // the rule it lands on — rather than defaulting into the black-border bug.
    expect([...ALPHA_CAPABLE_FORMATS].sort()).toEqual(["avif", "png", "webp"]);
  });
});

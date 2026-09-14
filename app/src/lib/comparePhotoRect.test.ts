import { describe, it, expect } from "vitest";
import { comparePhotoRect } from "./comparePhotoRect";

// Measured on edit.imagehorse.app (v8.76): a 400×300 photo on the default 10px
// artboard is a 420×320 document, `photo_bounds` is [10,10,400,300], and the
// compare overlay covered all 420×320 of the canvas.
const box = { left: 632, top: 216, width: 420, height: 320 };
const artboardPhoto = { x: 10, y: 10, width: 400, height: 300 };

describe("comparePhotoRect", () => {
  it("covers the photo, not the artboard band around it", () => {
    expect(comparePhotoRect(box, 420, 320, artboardPhoto)).toEqual({
      left: 642,
      top: 226,
      width: 400,
      height: 300,
    });
  });

  // THE ONE THAT MATTERS. The band left uncovered is the same on every side,
  // so both halves of the divider show the same mount and differ only in pixels.
  it("leaves the same band on every side of the photo", () => {
    const r = comparePhotoRect(box, 420, 320, artboardPhoto);
    const bands = [
      r.left - box.left,
      box.left + box.width - (r.left + r.width),
      r.top - box.top,
      box.top + box.height - (r.top + r.height),
    ];
    expect(bands).toEqual([10, 10, 10, 10]);
  });

  it("scales with zoom — the box is screen px, the bounds are image px", () => {
    const zoomed = { left: 100, top: 50, width: 840, height: 640 };
    expect(comparePhotoRect(zoomed, 420, 320, artboardPhoto)).toEqual({
      left: 120,
      top: 70,
      width: 800,
      height: 600,
    });
  });

  it("is the whole box for a flattened document, where the document IS the picture", () => {
    expect(comparePhotoRect(box, 420, 320, { x: 0, y: 0, width: 420, height: 320 })).toEqual(box);
  });

  it("falls back to the whole box while photo_bounds has not answered", () => {
    expect(comparePhotoRect(box, 420, 320, null)).toBe(box);
  });

  it("falls back to the whole box for a canvas with no size yet", () => {
    expect(comparePhotoRect(box, 0, 0, artboardPhoto)).toBe(box);
  });
});

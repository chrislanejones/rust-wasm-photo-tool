import { describe, it, expect } from "vitest";
import { namePastedImage } from "./pastedImageName";

const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

describe("namePastedImage", () => {
  it.each([
    ["image.png", "image/png", "pasted.png"],
    ["Image.JPG", "image/jpeg", "pasted.jpg"],
    ["image.webp", "image/webp", "pasted.webp"],
    ["", "image/png", "pasted.png"],
  ])("renames the browser's generic clipboard name %j (%s) to %j", (name, type, want) => {
    const out = namePastedImage(new File([bytes], name, { type }));
    expect(out.name).toBe(want);
    expect(out.type).toBe(type);
    expect(out.size).toBe(bytes.length);
  });

  it("names a bare Blob from navigator.clipboard.read() after its type", () => {
    const out = namePastedImage(new Blob([bytes], { type: "image/webp" }));
    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe("pasted.webp");
  });

  it("falls back to PNG for a Blob with no type", () => {
    const out = namePastedImage(new Blob([bytes]));
    expect(out.name).toBe("pasted.png");
    expect(out.type).toBe("image/png");
  });

  it("keeps a real filename from a file manager, returning the same File", () => {
    const real = new File([bytes], "beach.jpg", { type: "image/jpeg" });
    expect(namePastedImage(real)).toBe(real);
  });

  it("does not treat a real name that merely starts with 'image' as generic", () => {
    const real = new File([bytes], "image-of-beach.png", { type: "image/png" });
    expect(namePastedImage(real).name).toBe("image-of-beach.png");
  });

  it("is idempotent", () => {
    const once = namePastedImage(new File([bytes], "image.png", { type: "image/png" }));
    expect(namePastedImage(once)).toBe(once);
  });

  it("gives the stem the export path turns into pasted-revised", () => {
    // Mirrors useImageSession (strip the extension) + useCanvasActions
    // (`${stem}-revised${ext}`), so a change to the rename shows up here.
    const galleryName = namePastedImage(new File([bytes], "image.png", { type: "image/png" }))
      .name.replace(/\.[^.]+$/, "");
    expect(`${galleryName}-revised.png`).toBe("pasted-revised.png");
  });
});

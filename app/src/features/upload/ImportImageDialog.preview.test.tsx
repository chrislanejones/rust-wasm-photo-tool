// @vitest-environment jsdom
//
// UI Night 19: the import dialog's preview.
//
//   • the frame takes its final shape from the decoded size at once (it used to
//     collapse to its padding, then grow when the bare <img> arrived)
//   • nothing grey during the 300 ms grace, a skeleton after it
//   • the picture paints only once decoded
//   • a failed decode says so inside the same box
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportImageDialog } from "./ImportImageDialog";

let probes: FakeImage[];
class FakeImage {
  src = ""; onload: (() => void) | null = null; onerror: (() => void) | null = null;
  decoding = "";
  resolve!: () => void; reject!: () => void;
  decoded = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  decode = () => this.decoded;
  constructor() { probes.push(this); }
}
beforeEach(() => { probes = []; vi.useFakeTimers(); vi.stubGlobal("Image", FakeImage); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function open(w: number, h: number) {
  render(
    <ImportImageDialog
      open
      onOpenChange={() => {}}
      previewUrl="blob:import"
      width={w}
      height={h}
      canUseLayers
      hasActivePhoto
      onNewLayer={() => {}}
      onAddToGallery={() => {}}
    />,
  );
}
const box = () => screen.getByTestId("import-preview-box");

describe("import preview", () => {
  it("reserves the photo's box before anything has decoded", () => {
    open(1080, 720);
    expect(box().style.width).toBe("300px");
    expect(box().style.aspectRatio).toBe("1080 / 720");
    expect(screen.queryByRole("img", { name: "Image to import" })).toBeNull();
  });

  it("never grows a small image past its own width", () => {
    open(120, 80);
    expect(box().style.width).toBe("120px");
  });

  it("a tall image is capped at 200 px high", () => {
    open(1000, 4000);
    expect(box().style.width).toBe("50px");
  });

  it("unknown dimensions get a square", () => {
    open(0, 0);
    expect(box().style.width).toBe("200px");
    expect(box().style.aspectRatio).toBe("1 / 1");
  });

  it("shows nothing during the grace, a skeleton after it", () => {
    open(1080, 720);
    expect(box().querySelector(".skeleton")).toBeNull();
    act(() => vi.advanceTimersByTime(301));
    expect(box().querySelector(".skeleton")).toBeTruthy();
  });

  it("paints the picture once it has decoded", async () => {
    open(1080, 720);
    await act(async () => { probes[0]!.onload?.(); probes[0]!.resolve(); });
    const img = screen.getByRole("img", { name: "Image to import" });
    expect(img.getAttribute("src")).toBe("blob:import");
    expect(box().contains(img)).toBe(true);
  });

  it("a failed decode says so in the same box", async () => {
    open(1080, 720);
    await act(async () => { probes[0]!.onload?.(); probes[0]!.reject(); });
    expect(box().textContent).toContain("Preview unavailable");
  });
});

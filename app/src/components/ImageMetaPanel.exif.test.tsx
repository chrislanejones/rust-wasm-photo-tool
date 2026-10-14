// @vitest-environment jsdom
//
// UI Night 19: Diagnostics › Image meta, while the EXIF is read from IndexedDB.
// It said "reading…". The EXIF already exists, so the wait is a skeleton:
// space held at once, grey only after the 300 ms grace, gone on the answer.
// The canvas hash keeps "computing…": that is new work, not a read.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  resolve: null as null | ((v: { bytes: ArrayBuffer; mimeType: string } | null) => void),
}));
vi.mock("@/lib/dexie/originalsAdapter", () => ({
  getOriginal: () => new Promise((resolve) => { store.resolve = resolve; }),
}));
vi.mock("@/lib/exif", () => ({ parseExifFromImage: () => null }));

import { ImageMetaPanel } from "./ImageMetaPanel";

beforeEach(() => { vi.useFakeTimers(); store.resolve = null; });
afterEach(() => { vi.useRealTimers(); });

const meta = { photoId: "p1", name: "beach", mimeType: "image/jpeg", uploadKey: "k1" };
const skeleton = () => screen.queryByTestId("exif-skeleton");

describe("EXIF loading", () => {
  it("no longer says reading…", () => {
    render(<ImageMetaPanel active meta={meta} />);
    expect(document.body.textContent).not.toContain("reading…");
  });

  it("holds the space at once but paints nothing during the grace", () => {
    render(<ImageMetaPanel active meta={meta} />);
    expect(skeleton()).toBeTruthy();
    expect(skeleton()!.className).toContain("invisible");
  });

  it("paints the skeleton after the grace", () => {
    render(<ImageMetaPanel active meta={meta} />);
    act(() => vi.advanceTimersByTime(300));
    expect(skeleton()!.className).not.toContain("invisible");
    expect(skeleton()!.getAttribute("aria-busy")).toBe("true");
  });

  it("the answer replaces it", async () => {
    render(<ImageMetaPanel active meta={meta} />);
    act(() => vi.advanceTimersByTime(300));
    await act(async () => { store.resolve!({ bytes: new ArrayBuffer(4), mimeType: "image/jpeg" }); });
    expect(skeleton()).toBeNull();
    expect(document.body.textContent).toContain("No EXIF metadata in the original");
  });
});

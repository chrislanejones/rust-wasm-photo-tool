// @vitest-environment jsdom
//
// UI Night 18: the phone's full-screen viewer while the original loads.
//
//   • nothing during the 300 ms grace (it drew a spinner from the first frame)
//   • after it, a skeleton in the photo's own shape, from the known size
//   • one announcement, the skeleton itself decorative
//   • a missing original says so (the spinner used to turn for good)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const store = vi.hoisted(() => ({ original: new Promise<string | null>(() => {}) }));
vi.mock("@/components/UserMenu", () => ({ UserMenu: () => null }));
vi.mock("@/features/mobile/MobileSettingsSheet", () => ({ MobileSettingsSheet: () => null }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({
  getOriginal: vi.fn(async () => null),
  getOriginalAsBlobUrl: vi.fn(() => store.original),
}));

import { MobileShell } from "./MobileShell";

const photo: PhotoEntry = {
  id: "p1",
  name: "beach",
  mimeType: "image/jpeg",
  byteSize: 1000,
  originalByteSize: 1000,
  origWidth: 4000,
  origHeight: 3000,
  workingWidth: 4000,
  workingHeight: 3000,
  thumbBlob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
  originalKey: "key-p1",
};

let host: HTMLDivElement;
let root: Root;

function openViewer(): void {
  act(() => {
    root.render(
      React.createElement(MobileShell, {
        photos: [photo],
        maxPhotos: 12,
        booting: false,
        onAddFiles: () => {},
        onRequestDelete: () => {},
      }),
    );
  });
  const tile = document.body.querySelector<HTMLElement>('button[aria-label="View photo beach"]')!;
  act(() => tile.click());
}
const skeleton = () => document.body.querySelector<HTMLElement>('[data-testid="viewer-skeleton"]');

beforeEach(() => {
  vi.useFakeTimers();
  store.original = new Promise<string | null>(() => {});
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:thumb", revokeObjectURL: () => {} });
  const appShell = document.createElement("div");
  appShell.className = "app-shell";
  host = document.createElement("div");
  appShell.appendChild(host);
  document.body.appendChild(appShell);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("phone viewer loading", () => {
  it("draws nothing during the grace: no spinner, the skeleton only reserved", () => {
    openViewer();
    expect(document.body.querySelector('[aria-label="Loading beach"]')).toBeNull();
    expect(skeleton()).toBeTruthy();
    expect(skeleton()!.className).toContain("invisible");
  });

  it("after the grace, paints a skeleton in the photo's own shape", () => {
    openViewer();
    act(() => vi.advanceTimersByTime(300));
    const el = skeleton()!;
    expect(el.className).not.toContain("invisible");
    expect(el.style.aspectRatio).toBe("4000 / 3000");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("announces the wait once", () => {
    openViewer();
    const status = [...document.body.querySelectorAll('[role="status"]')].filter((n) =>
      n.textContent?.includes("Loading beach"),
    );
    expect(status).toHaveLength(1);
  });

  it("a missing original says so instead of loading for ever", async () => {
    store.original = Promise.resolve(null);
    openViewer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("This photo couldn't be loaded.");
    expect(skeleton()).toBeNull();
  });
});

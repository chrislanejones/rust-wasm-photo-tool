// @vitest-environment jsdom
//
// Plan C §1 point 10 — **the phone grid gets the same thumbnail rule.**
//
// ⚠️ THE PLAN'S PREMISE WAS WRONG, and that is why this file exists. It said
// "the phone grid uses the same thumbnail, so the phone gets the fix too."
// It did not: `MobileShell` carried its own hand-rolled `MobileThumb`, which
// never had the grayscale develop and so was never touched by deleting it.
// What it had instead was an eager placeholder — `useState(true)` — that drew
// a grey box over every tile on every open, and re-armed itself on every edit.
//
// So the phone was not left behind by the fix; it had a different bug that the
// fix happened to describe. These four assertions are the ones that were false
// here while being true on the desktop tile:
//
//   • a decode inside the grace period draws NOTHING
//   • an edit keeps the previous picture up, never a placeholder over a photo
//   • a failed thumbnail says so, with its file name
//   • ONE aria-busy for the grid, not one per tile
//
// Written with `createRoot` + `act` rather than Testing Library because that
// dependency lands on a later branch, and as `.ts` rather than `.tsx` because
// this branch's vitest `include` glob is `.ts` only — a `.tsx` file here would
// not run at all, and would report neither a pass nor a failure.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/UserMenu", () => ({ UserMenu: () => null }));
vi.mock("@/features/mobile/MobileSettingsSheet", () => ({ MobileSettingsSheet: () => null }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({
  getOriginal: vi.fn(async () => null),
  getOriginalAsBlobUrl: vi.fn(async () => null),
}));

import { MobileShell } from "./MobileShell";
import { THUMB_SKELETON_DELAY_MS } from "@/features/gallery/useThumbImage";

// ⚠️ `new Image()` NEVER loads in jsdom — no network and no decoder — so the
// hook's probe would stay pending for ever and every tile would show a
// placeholder. Without this stub "no gray photo" would pass for the boring
// reason that no photo ever arrives: the loaded path would be unreachable.
interface FakeImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}
const probes: FakeImage[] = [];

function installImageStub(): void {
  probes.length = 0;
  class Stub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = "auto";
    src = "";
    constructor() {
      probes.push(this as unknown as FakeImage);
    }
  }
  vi.stubGlobal("Image", Stub);
}

/** Resolve the newest probe, the way a real decode would. */
function decodeLatest(): void {
  const p = probes[probes.length - 1]!;
  act(() => {
    p.onload?.();
  });
}
function failLatest(): void {
  const p = probes[probes.length - 1]!;
  act(() => {
    p.onerror?.();
  });
}

const photo = (id: string, name: string, blob?: Blob): PhotoEntry => ({
  id,
  name,
  mimeType: "image/jpeg",
  byteSize: 1000,
  originalByteSize: 1000,
  origWidth: 100,
  origHeight: 100,
  workingWidth: 100,
  workingHeight: 100,
  thumbBlob: blob ?? new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
  originalKey: `key-${id}`,
});

let appShell: HTMLDivElement;
let host: HTMLDivElement;
let root: Root;
let objectUrls = 0;

function mount(photos: PhotoEntry[]): void {
  act(() => {
    root.render(
      React.createElement(MobileShell, {
        photos,
        maxPhotos: 12,
        booting: false,
        onAddFiles: () => {},
        onRequestDelete: () => {},
      }),
    );
  });
}

/** The grid itself — the one element that may claim to be busy. */
const grid = () => document.body.querySelector<HTMLElement>(".grid.grid-cols-3")!;
const tiles = () => [...document.body.querySelectorAll<HTMLElement>("button.photo-thumb-grid")];
/** A real placeholder on screen: the primitive's own shimmer surface. */
const placeholders = () => [...document.body.querySelectorAll<HTMLElement>(".skeleton")];

beforeEach(() => {
  vi.useFakeTimers();
  installImageStub();
  // jsdom implements neither, and the hook creates one URL per blob.
  objectUrls = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => `blob:fake/${++objectUrls}`,
    revokeObjectURL: () => {},
  });
  appShell = document.createElement("div");
  appShell.className = "app-shell";
  host = document.createElement("div");
  appShell.appendChild(host);
  document.body.appendChild(appShell);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  appShell.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the phone grid draws a photo or a placeholder, never both and never gray", () => {
  it("a decode inside the grace period draws NOTHING — no placeholder flash", () => {
    mount([photo("a", "one.jpg")]);
    // This is what the old `useState(true)` got wrong: a cached thumbnail
    // decodes in single-digit milliseconds, and a twelve-photo grid flashed
    // twelve grey boxes before any of them had a chance to arrive.
    expect(placeholders()).toHaveLength(0);
    decodeLatest();
    expect(placeholders()).toHaveLength(0);
    expect(tiles()[0]!.querySelector("img")!.getAttribute("src")).toBe("blob:fake/1");
  });

  it("a decode SLOWER than the grace period does show a placeholder, then the photo", () => {
    // The control for the test above: if nothing ever draws a placeholder the
    // first assertion passes for the wrong reason.
    mount([photo("a", "one.jpg")]);
    act(() => {
      vi.advanceTimersByTime(THUMB_SKELETON_DELAY_MS + 10);
    });
    expect(placeholders()).toHaveLength(1);
    expect(tiles()[0]!.querySelector("img")).toBeNull();

    decodeLatest();
    expect(placeholders()).toHaveLength(0);
    expect(tiles()[0]!.querySelector("img")!.getAttribute("src")).toBe("blob:fake/1");
  });

  it("an edit keeps the previous picture up — no placeholder over a photo", () => {
    const first = photo("a", "one.jpg");
    mount([first]);
    decodeLatest();
    expect(tiles()[0]!.querySelector("img")!.getAttribute("src")).toBe("blob:fake/1");

    // A new blob is what every edit produces.
    mount([{ ...first, thumbBlob: new Blob([new Uint8Array([9])], { type: "image/webp" }) }]);
    act(() => {
      vi.advanceTimersByTime(THUMB_SKELETON_DELAY_MS * 4);
    });
    // Still the OLD picture, and no placeholder — even well past the grace
    // period, because `src` is whatever last DECODED, not whatever the current
    // blob is. ⚠️ Asserting the placeholder alone is not enough and a mutation
    // run proved it: the markup only reaches the placeholder branch when there
    // is no `src` at all, so "no placeholder" here is true however `pending`
    // is computed. The src assertion is the one that bites.
    expect(placeholders()).toHaveLength(0);
    expect(tiles()[0]!.querySelector("img")!.getAttribute("src")).toBe("blob:fake/1");
    // And the grid must not re-announce itself busy for a photo that is
    // already on screen — the other half of `pending`, invisible on its own.
    expect(grid().getAttribute("aria-busy")).toBe("false");

    decodeLatest();
    expect(tiles()[0]!.querySelector("img")!.getAttribute("src")).toBe("blob:fake/2");
  });

  it("a thumbnail that cannot be decoded says so, with its file name", () => {
    mount([photo("a", "broken.jpg")]);
    failLatest();
    act(() => {
      vi.advanceTimersByTime(THUMB_SKELETON_DELAY_MS * 4);
    });
    // Not a placeholder waiting for ever, and not a bare checkerboard square:
    // the old `onError` just set loading=false and left an empty tile.
    expect(placeholders()).toHaveLength(0);
    expect(tiles()[0]!.querySelector("img")).toBeNull();
    expect(tiles()[0]!.textContent).toContain("broken.jpg");
    expect(tiles()[0]!.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe(
      "broken.jpg could not be displayed",
    );
  });

  it("the checkerboard waits for the picture, so it cannot show through", () => {
    mount([photo("a", "one.jpg")]);
    expect(tiles()[0]!.querySelector(".checkerboard")).toBeNull();
    decodeLatest();
    expect(tiles()[0]!.querySelector(".checkerboard")).not.toBeNull();
  });
});

describe("one aria-busy for the grid, not one per tile", () => {
  it("three pending tiles produce exactly ONE busy element", () => {
    mount([photo("a", "one.jpg"), photo("b", "two.jpg"), photo("c", "three.jpg")]);
    act(() => {
      vi.advanceTimersByTime(THUMB_SKELETON_DELAY_MS + 10);
    });
    expect(tiles()).toHaveLength(3);
    expect(placeholders()).toHaveLength(3);
    // The old markup gave each placeholder its own aria-label, so a hundred
    // photos meant a hundred "Loading <name>" announcements.
    expect(document.body.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(grid().getAttribute("aria-busy")).toBe("true");
    for (const s of placeholders()) expect(s.getAttribute("aria-hidden")).toBe("true");
  });

  it("the grid stops being busy once the last tile has pixels", () => {
    mount([photo("a", "one.jpg"), photo("b", "two.jpg")]);
    expect(grid().getAttribute("aria-busy")).toBe("true");
    decodeLatest();
    expect(grid().getAttribute("aria-busy")).toBe("true");
    // probes[0] is the other tile's; resolve it too.
    act(() => {
      probes[0]!.onload?.();
    });
    expect(grid().getAttribute("aria-busy")).toBe("false");
  });

  it("a failed tile does not leave the grid busy for ever", () => {
    mount([photo("a", "broken.jpg")]);
    failLatest();
    expect(grid().getAttribute("aria-busy")).toBe("false");
  });

  it("a tile deleted mid-decode does not leave the grid busy for ever", () => {
    // The phone is where tiles get deleted, and the pending report is keyed by
    // id — without the unmount cleanup the id would stay in the set for good.
    mount([photo("a", "one.jpg"), photo("b", "two.jpg")]);
    decodeLatest();
    expect(grid().getAttribute("aria-busy")).toBe("true");
    mount([photo("b", "two.jpg")]);
    decodeLatest();
    expect(grid().getAttribute("aria-busy")).toBe("false");
  });
});

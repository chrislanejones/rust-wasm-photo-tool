// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Thumb } from "./Thumb";
import type { PhotoEntry } from "./GalleryBar";

// Plan B §1, last item — pin Plan A's thumbnail rule: **a tile is a skeleton
// or the photo, never a gray photo.**
//
// Plan A could only test the decision as a pure function, because nothing in
// the repo rendered a component. These are the three assertions that needed a
// renderer and were left as e2e or left out entirely:
//
//   • a decode under the grace period draws NOTHING (no placeholder flash)
//   • the tile's box does not change size when the placeholder resolves
//   • one aria-busy for the gallery, reported up, with decorative tiles
//
// ⚠️ `new Image()` never loads in jsdom — no network, no decoder — so the
// probe would hang pending for ever and every test would see a placeholder.
// The stub below is what makes the LOADED path reachable at all; without it
// "no gray photo" would pass for the boring reason that no photo ever arrives.

type FakeImage = { onload: (() => void) | null; onerror: (() => void) | null; src: string; decoding: string };
const probes: FakeImage[] = [];

/** Every probe `useThumbImage` has created, newest last. */
function installImageStub() {
  probes.length = 0;
  class Stub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = "auto";
    #src = "";
    constructor() {
      probes.push(this as unknown as FakeImage);
    }
    set src(v: string) {
      this.#src = v;
    }
    get src() {
      return this.#src;
    }
  }
  vi.stubGlobal("Image", Stub);
}

const entry = (over: Partial<PhotoEntry> = {}): PhotoEntry => ({
  id: "p1",
  name: "IMG_0427.jpg",
  mimeType: "image/jpeg",
  byteSize: 1234,
  originalByteSize: 1234,
  origWidth: 100,
  origHeight: 100,
  workingWidth: 100,
  workingHeight: 100,
  thumbBlob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
  originalKey: "deadbeef",
  ...over,
});

function renderThumb(props: Partial<Parameters<typeof Thumb>[0]> = {}) {
  const onPendingChange = vi.fn();
  const view = render(
    <TooltipProvider>
      <Thumb
        entry={entry()}
        index={0}
        isActive={false}
        onSelect={() => {}}
        onRemove={() => {}}
        selected={false}
        selectionActive={false}
        onToggleSelect={() => {}}
        onPendingChange={onPendingChange}
        {...props}
      />
    </TooltipProvider>,
  );
  return { ...view, onPendingChange };
}

/** The one thing that must never appear. */
const grayness = (root: HTMLElement) =>
  [...root.querySelectorAll("*")].filter((e) => {
    const f = (e as HTMLElement).style.filter || "";
    return f.includes("grayscale") || (e as HTMLElement).className.toString().split(/\s+/).includes("grayscale");
  });

beforeEach(() => {
  installImageStub();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a thumbnail is a placeholder or the photo, never a gray photo", () => {
  it("draws NOTHING while a fast decode is still inside the grace period", () => {
    const { container } = renderThumb();
    // No <img>, because nothing has decoded yet...
    expect(container.querySelector("img")).toBeNull();
    // ...and no placeholder either, because 300 ms has not passed. A cached
    // gallery must show no flash at all.
    expect(container.querySelector('[data-slot="skeleton"], .skeleton')).toBeNull();
    expect(grayness(container)).toHaveLength(0);
  });

  it("shows a placeholder only once the decode is genuinely slow", () => {
    const { container } = renderThumb();
    act(() => {
      vi.advanceTimersByTime(301);
    });
    const skel = container.querySelector(".skeleton");
    expect(skel, "past the grace period a slow tile admits it is waiting").toBeTruthy();
    // Decorative: the gallery owns the one announcement, not thirty tiles.
    expect(skel!.getAttribute("aria-hidden")).toBe("true");
    expect(skel!.getAttribute("role")).toBeNull();
    expect(grayness(container)).toHaveLength(0);
  });

  it("the tile's box does not change size when the placeholder resolves", () => {
    // jsdom has no layout, so pixels cannot be measured — what CAN be checked
    // is the invariant that produces a stable box: every branch is an in-flow
    // element carrying the same sizing classes. An absolutely-positioned
    // placeholder is the bug (the grid's row height comes from its in-flow
    // child, so the row collapses and every tile below it jumps).
    const { container } = renderThumb();
    const sizing = (el: Element | null) =>
      el ? el.className.toString().split(/\s+/).filter((c) => c === "w-full" || c === "aspect-square").sort() : null;

    const duringGrace = sizing(container.querySelector('[data-slot="control"], [aria-hidden="true"]'));
    act(() => {
      vi.advanceTimersByTime(301);
    });
    const asSkeleton = sizing(container.querySelector(".skeleton"));

    expect(asSkeleton).toEqual(["aspect-square", "w-full"]);
    expect(duringGrace, "the grace-period spacer holds the same box").toEqual(asSkeleton);
    // And neither is taken out of flow.
    expect(container.querySelector(".skeleton")!.className).not.toContain("absolute");
  });

  it("swaps to the photo once it decodes, and drops the placeholder", () => {
    const { container } = renderThumb();
    act(() => {
      vi.advanceTimersByTime(301);
    });
    expect(container.querySelector(".skeleton")).toBeTruthy();

    act(() => {
      probes.at(-1)!.onload!();
    });

    const img = container.querySelector("img");
    expect(img, "the photo is on screen").toBeTruthy();
    expect(img!.getAttribute("src")).toContain("blob:");
    expect(container.querySelector(".skeleton")).toBeNull();
    expect(grayness(container)).toHaveLength(0);
    // The checkerboard comes back only now, so it cannot show through a
    // placeholder and read as a failed load.
    expect(container.querySelector(".checkerboard")).toBeTruthy();
  });

  it("a failed decode is an error state naming the file, not a placeholder that waits for ever", () => {
    const { container } = renderThumb();
    act(() => {
      probes.at(-1)!.onerror!();
    });
    expect(screen.getByRole("img", { name: /IMG_0427\.jpg could not be displayed/ })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelector(".skeleton"), "it does not fall back to waiting").toBeNull();
  });

  it("reports pending up to the gallery, and clears it when the photo lands", () => {
    const { onPendingChange } = renderThumb();
    expect(onPendingChange).toHaveBeenCalledWith("p1", true);
    onPendingChange.mockClear();
    act(() => {
      probes.at(-1)!.onload!();
    });
    expect(onPendingChange).toHaveBeenCalledWith("p1", false);
  });

  it("clears pending on unmount, so a tile removed mid-decode cannot wedge aria-busy", () => {
    const { onPendingChange, unmount } = renderThumb();
    onPendingChange.mockClear();
    unmount();
    expect(onPendingChange).toHaveBeenCalledWith("p1", false);
  });
});

describe("the loading mark (Plan A §4.1)", () => {
  it("is absent by default", () => {
    const { container } = renderThumb();
    expect(container.querySelector('[data-status="working"]')).toBeNull();
  });

  it("appears only for the requested-but-not-loaded photo, and says what it means", () => {
    renderThumb({ loading: true, isActive: true });
    const mark = document.querySelector('[data-status="working"]');
    expect(mark).toBeTruthy();
    expect(mark!.querySelector("svg"), "a glyph, so it reads in greyscale").toBeTruthy();
    expect(mark!.textContent).toContain("Loading IMG_0427.jpg");
  });
});


it("leaves the existing gallery region in charge of its deadline", () => {
  const { container, onPendingChange } = renderThumb();
  act(() => vi.advanceTimersByTime(15_001));
  // Without a region's capped context, a gallery tile still reports pending.
  // The independent media deadline must not race the card's cap/logging.
  expect(container.querySelector(".skeleton")).toBeTruthy();
  expect(onPendingChange).not.toHaveBeenCalledWith("p1", false);
});

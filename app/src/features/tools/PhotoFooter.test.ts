// @vitest-environment jsdom
//
// The Tools card's footer line. It moved out of PerPhotoRegion on 10-02-2026
// ("needs to be at the bottom of tools - as a footer of the card that tools
// is"), which turned three things into contract rather than coincidence:
//
//   • it renders for ANY tool, because it belongs to the card and not to the
//     per-photo panels — the old line was gated by PER_PHOTO_TOOLS;
//   • it renders NOTHING when there is no photo, so an empty editor does not
//     carry an empty rule;
//   • it still re-keys on every photo change, which is what restarts the
//     ~400ms highlight. The CSS does the cue; this is the trigger, and a
//     component that stopped re-keying would lose it silently.
//
// The 20px height and the un-bolded text are CSS, pinned in the browser by
// e2e/photo-switch-cue.spec.ts C2b — jsdom has no layout and would say 0.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { create } from "zustand";

// The real gallery store reaches the engine (photoLimits dynamic-imports
// `stamp_tool` for the photo cap), which would make this file need a built
// pkg/ to answer a question about two strings and a key. A stand-in store with
// the same two fields and the same selector API keeps the test about the
// footer. It is a REAL zustand store, not a stub returning fixed values, so
// the re-key case below exercises a genuine subscription.
const useFakeGallery = create<{ photos: { id: string; name: string }[]; activePhotoId: string | null }>(
  () => ({ photos: [], activePhotoId: null }),
);
vi.mock("@/stores/useGalleryStore", () => ({ useGalleryStore: useFakeGallery }));

const { PhotoFooter } = await import("./PhotoFooter");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** Seed the gallery with the named photos and select one by index (-1 = none). */
function seed(names: string[], activeIndex: number) {
  useFakeGallery.setState({
    photos: names.map((name, i) => ({ id: `p${i}`, name })),
    activePhotoId: activeIndex >= 0 ? `p${activeIndex}` : null,
  });
}

function render() {
  act(() => {
    root.render(React.createElement(PhotoFooter));
  });
}

const line = () => container.querySelector(".per-photo-name");

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useFakeGallery.setState({ photos: [], activePhotoId: null });
});

describe("the Tools card footer", () => {
  it("reads '# of # · name' for the active photo", () => {
    seed(["checker", "sky-building", "IMG_2041.jpg"], 1);
    render();
    expect(line()?.textContent).toBe("2 of 3 · sky-building");
  });

  it("carries the full name as a title, for the ones that truncate", () => {
    seed(["a-rather-long-photo-name-that-will-not-fit.jpeg"], 0);
    render();
    expect(line()?.getAttribute("title")).toBe(
      "a-rather-long-photo-name-that-will-not-fit.jpeg",
    );
  });

  it("renders nothing at all when no photo is active", () => {
    seed([], -1);
    render();
    expect(line()).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders nothing when the active id names no photo in the gallery", () => {
    // A stale activePhotoId (the photo was removed) must not print "0 of 2".
    seed(["checker", "sky-building"], 0);
    useFakeGallery.setState({ activePhotoId: "gone" });
    render();
    expect(line()).toBeNull();
  });

  it("does not flash on first paint, and re-keys on every switch after", () => {
    seed(["checker", "sky-building"], 0);
    render();
    // First paint is not a switch — a highlight here would announce a change
    // that did not happen.
    expect(line()?.className).not.toContain("per-photo-name-flash");
    const first = line();

    act(() => {
      useFakeGallery.setState({ activePhotoId: "p1" });
    });
    expect(line()?.textContent).toBe("2 of 2 · sky-building");
    expect(line()?.className).toContain("per-photo-name-flash");
    // A NEW element, not the same one restyled: remounting is what restarts
    // the CSS animation, so a switch always re-highlights.
    expect(line()).not.toBe(first);
  });
});

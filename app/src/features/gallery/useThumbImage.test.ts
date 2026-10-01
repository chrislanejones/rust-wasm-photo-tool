import { describe, it, expect } from "vitest";
import { thumbViewState, THUMB_SKELETON_DELAY_MS } from "./useThumbImage";

/**
 * The thumbnail rule, pinned: a tile shows the photo or a placeholder, and
 * never a gray photo.
 *
 * These assert the pure state function rather than a rendered tile, because
 * the repo has no renderer in its test deps (`@testing-library/react` is not
 * installed, and adding it is a dependency decision, not a test decision).
 * The claims that genuinely need a browser — that the tile's box does not move
 * when the placeholder resolves, and that a real decode under 300 ms draws no
 * placeholder — are in `e2e/gallery-thumbnails.spec.ts`, where there is layout
 * and a real image decoder.
 *
 * What IS covered here is the part that actually broke before: which of the
 * three URLs decides what the tile paints.
 */
const A = "blob:photo-a";
const B = "blob:photo-b";

describe("a thumbnail is the photo or a placeholder, never a gray photo", () => {
  it("before anything has decoded, the tile is pending with nothing to paint", () => {
    const v = thumbViewState({ url: "", shownUrl: null, failedUrl: null });
    expect(v.src).toBe("");
    expect(v.pending).toBe(true);
    expect(v.failed).toBe(false);
  });

  it("a load that landed BEFORE the first effect still counts", () => {
    // The old develop's bug: its effect called setImgReady(false) after mount,
    // so a blob that decoded first had its load erased and the tile stayed
    // gray for good. Nothing here can erase a load — shownUrl is the only
    // input that says "I have pixels", and no code path sets it back to null.
    const v = thumbViewState({ url: A, shownUrl: A, failedUrl: null });
    expect(v.src).toBe(A);
    expect(v.pending).toBe(false);
  });

  it("an edit keeps painting the OLD photo while the new one decodes", () => {
    // shownUrl is the previous blob, url is the new one. The tile must not
    // fall back to a placeholder, which is what comparing the two would do.
    const v = thumbViewState({ url: B, shownUrl: A, failedUrl: null });
    expect(v.src).toBe(A);
    expect(v.pending).toBe(false);
  });

  it("goes red if `pending` is ever made to require shownUrl === url", () => {
    // Guards the comment on thumbViewState. This is the single most likely
    // "tidy-up" a later reader would make, and it reintroduces the flicker:
    // every edit would blank the tile and show a placeholder over a photo
    // that was already on screen.
    expect(thumbViewState({ url: B, shownUrl: A, failedUrl: null }).pending).toBe(false);
  });

  it("a failed decode is an error state, not a placeholder that waits for ever", () => {
    const v = thumbViewState({ url: A, shownUrl: null, failedUrl: A });
    expect(v.failed).toBe(true);
    expect(v.pending).toBe(false);
    expect(v.src).toBe("");
  });

  it("a STALE failure does not condemn the tile", () => {
    // Photo A's thumbnail failed; the photo was re-edited and B is on its way.
    // B has not failed, so the tile is pending again rather than permanently
    // broken.
    const v = thumbViewState({ url: B, shownUrl: null, failedUrl: A });
    expect(v.failed).toBe(false);
    expect(v.pending).toBe(true);
  });

  it("a failure after a successful load keeps the picture it already has", () => {
    const v = thumbViewState({ url: B, shownUrl: A, failedUrl: B });
    expect(v.failed).toBe(true);
    expect(v.src).toBe(A);
  });

  it("`pending` and `failed` are never both true", () => {
    // The gallery's aria-busy sums `pending`. A tile that is both broken and
    // busy would leave the whole gallery announcing "Loading" for ever.
    for (const url of ["", A, B]) {
      for (const shownUrl of [null, A, B]) {
        for (const failedUrl of [null, A, B]) {
          const v = thumbViewState({ url, shownUrl, failedUrl });
          expect(v.pending && v.failed).toBe(false);
        }
      }
    }
  });

  it("anything with a shownUrl paints it, whatever else is true", () => {
    for (const url of ["", A, B]) {
      for (const failedUrl of [null, A, B]) {
        expect(thumbViewState({ url, shownUrl: A, failedUrl }).src).toBe(A);
      }
    }
  });
});

describe("the grace period", () => {
  it("is 300 ms — long enough that a cached decode shows no placeholder", () => {
    // Not a tautology: the number is the whole policy. A cached WebP thumbnail
    // decodes in single-digit ms, so this value is what keeps a normal gallery
    // free of placeholder flashes. Dropping it toward zero brings back a
    // flash on every open, which is what this pins.
    expect(THUMB_SKELETON_DELAY_MS).toBe(300);
  });
});

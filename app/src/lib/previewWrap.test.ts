// `wrapPreviewLines` is one half of a matched pair — `src/text.rs::wrap` is the
// other, and they have to break lines in the same places or what the user drags
// a box out to see is not what gets committed.
//
// These pin the three clauses that make the mirroring work. Each one exists
// because dropping it is a plausible "simplification" that would look correct
// and would silently disagree with Rust.

import { describe, it, expect } from "vitest";
import { wrapPreviewLines } from "./previewWrap";

/** A stand-in for `measureText().width`: every character is 10 units wide. */
const fixed = (s: string) => s.length * 10;

describe("wrapPreviewLines", () => {
  it("does not wrap at all when the width is zero", () => {
    // `wrap_width == 0` is the pre-v8.40 default and what every restored
    // annotation from before then means: size the box to the text.
    const t = "the quick brown fox jumps over the lazy dog";
    expect(wrapPreviewLines(t, 0, fixed)).toEqual([t]);
    expect(wrapPreviewLines(t, -50, fixed)).toEqual([t]);
  });

  it("keeps the author's own newlines as hard breaks", () => {
    expect(wrapPreviewLines("one\ntwo\nthree", 0, fixed)).toEqual(["one", "two", "three"]);
  });

  it("returns a paragraph that already fits VERBATIM", () => {
    // The clause that makes it idempotent by construction, and the one the
    // Rust unit test caught an earlier version violating: no re-spacing, no
    // lost indentation, no trimmed trailing space.
    const t = "  a   b  ";
    expect(wrapPreviewLines(t, 1000, fixed)).toEqual([t]);
  });

  it("is idempotent — wrapping its own output changes nothing", () => {
    const once = wrapPreviewLines("aaa bbb ccc ddd eee", 100, fixed);
    const twice = once.flatMap((l) => wrapPreviewLines(l, 100, fixed));
    expect(twice).toEqual(once);
  });

  it("breaks greedily, filling each line before starting the next", () => {
    // Greedy, not optimal. Optimal would look better and would not agree with
    // Rust, and agreement is the entire point.
    expect(wrapPreviewLines("aaa bbb ccc", 70, fixed)).toEqual(["aaa bbb", "ccc"]);
  });

  it("leaves a single over-long word overlong rather than splitting it", () => {
    // Hyphenation is a typographic decision; silently splitting a URL would be
    // worse than one line sticking out of the box.
    expect(wrapPreviewLines("short supercalifragilistic", 60, fixed)).toEqual([
      "short",
      "supercalifragilistic",
    ]);
  });

  it("normalises inter-word runs ONLY in a paragraph it actually re-breaks", () => {
    // Inherent to re-breaking — carrying the original spacing across a break
    // puts stray leading spaces at the start of wrapped lines. The verbatim
    // clause above is what keeps it from touching text it did not need to.
    expect(wrapPreviewLines("aaa    bbb    ccc", 70, fixed)).toEqual(["aaa bbb", "ccc"]);
  });
});

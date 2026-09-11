// The text overlay's word-wrap, which has to break lines in exactly the places
// the ENGINE will.
//
// Extracted from `CanvasArea` so it is one testable function rather than a
// closure buried in a render path. `src/text.rs::wrap` is the authority; this
// mirrors it clause for clause and the mirroring is the whole point — what the
// user drags a box out to see is what `render_text` commits. Three properties
// carry that:
//
//   * **Greedy, not Knuth-Plass.** Optimal line-breaking would look better and
//     would not agree with Rust, and agreement beats optimal here.
//   * **A paragraph that already fits is returned VERBATIM** — no re-spacing,
//     no lost indentation. Same clause, same reason, as the Rust: it makes the
//     function idempotent by construction.
//   * **A single word longer than the width is left overlong** rather than
//     broken mid-word. Hyphenation is a typographic decision and splitting a
//     URL silently would be worse than one line sticking out.
//
// The fourth property is the font, and it lives at the call site: `measure`
// must be a `CanvasRenderingContext2D.measureText` bound to the SAME face the
// engine will render in. `engineFonts.ts` is what makes that possible — the
// browser and the engine are given one ArrayBuffer, not two files that happen
// to share a name.

/**
 * Re-break `text` so no line's ink exceeds `contentW`, preserving the author's
 * own newlines as hard breaks.
 *
 * `contentW` is the CONTENT width in the same units `measure` returns, not the
 * padded box — the caller subtracts the layout's side padding, exactly as
 * `annotations::wrap_for_tile` does in Rust. A non-positive `contentW` means
 * "no wrapping, size the box to the text", which is what `wrap_width == 0` has
 * meant since v8.40 and what every restored pre-v8.40 annotation means.
 */
export function wrapPreviewLines(
  text: string,
  contentW: number,
  measure: (s: string) => number,
): string[] {
  return text.split("\n").flatMap((para) => {
    if (contentW <= 0 || measure(para) <= contentW) return [para];
    const out: string[] = [];
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= contentW || !line) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
    return out;
  });
}

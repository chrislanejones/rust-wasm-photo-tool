// ADR-024 Stage 3.5, step a2 — the text-metrics cache.
//
// WHAT THIS SOLVES. Two engine reads happen during React's render pass, laying
// out the text overlay while the tree is being built (`CanvasArea`,
// `measure_text` and `text_ink_offset`). A render pass cannot `await`, so
// Stage 3.5's "make every value-consuming call async" cannot reach them: once
// the engine is behind a worker there is no synchronous answer to give.
//
// ADR-024 originally called for a mirrored snapshot of engine state, or a
// layout cache, and treated both as substantial work. That was based on a
// wrong premise. THESE TWO FUNCTIONS READ NO ENGINE STATE:
//
//   measure_text        (src/lib.rs:3457)      -> crate::text::measure
//                                                 (src/text.rs:220)
//   text_ink_offset     (src/annotations.rs)   -> text_ink_offset_bg
//   text_ink_offset_bg  (src/annotations.rs)   -> crate::layer::annotation_ink_offset
//                                                 (src/layer.rs:649)
//
// Both targets are FREE FUNCTIONS — `pub fn measure(text, font_size, bold)` and
// `pub(crate) fn annotation_ink_offset(text, font_size, bold, kind, padding)`.
// Neither takes `self`. The `&self` on the wasm-bindgen wrappers is a calling
// convention, not a data dependency; the only other input is the font, which is
// a `const` byte slice compiled into the binary.
//
// That is the whole difference. A MIRROR of engine state has to be invalidated
// whenever the engine changes, and getting that wrong is a stale-layout bug you
// find weeks later. A CACHE OF A PURE FUNCTION KEYED ON ITS ARGUMENTS CAN NEVER
// GO STALE — same arguments, same answer, for the life of the binary. There is
// nothing to invalidate, so there is no invalidation to get wrong.
//
// It follows that entries are valid across engine INSTANCES too, which is why
// `BatchSettings` (a throwaway engine, per ONE PORT PER DOCUMENT) shares this
// cache with the live document. If these functions ever start reading engine
// state, that sharing becomes a correctness bug rather than an optimisation —
// `textMetricsCache.contract.test.ts` fails if the Rust signatures gain `self`
// access, so the assumption is checked rather than remembered.
//
// `abandoned/scalar-mirror` is NOT rehabilitated by this. It is unnecessary.
//
// ── WHAT STAGE 3.5 CHANGES HERE ──────────────────────────────────────────────
// Exactly one thing: `fill()`. Today a miss calls the engine synchronously,
// because the engine is on this thread. Once it is behind the port, a miss
// cannot be answered during render — the caller takes the documented fallback
// for that frame and `primeTextMetrics()` fills the cache off the render path,
// after which the next render hits.
//
// ⚠️ CORRECTED 2026-08-11. This block used to end: "Every call site below
// already tolerates a miss, because they all had a fallback before this module
// existed." THAT IS FALSE, and it was the stated basis for the whole approach.
// Checked, all six callers:
//
//   CanvasArea:2118   render   ✅ falls back to the JS-measured box centre
//   CanvasArea:2288   render   ✅ falls back to `sx - bgPad`
//   useTextTool:251   commit   tolerates — but commits at the UNCORRECTED
//                              anchor, i.e. text lands off its own preview
//   useTextTool:368   re-edit  tolerates — but the re-edit cycle DRIFTS
//   BatchSettings:1053 batch   ❌ THROWS by design, skipping the photo
//   BatchSettings:1188 batch   ❌ THROWS by design, skipping the photo
//
// BatchSettings says so itself, at both sites: "under Stage 3.5 a miss becomes
// reachable and this is where it has to be handled." This header never caught
// up with that.
//
// AND IT WOULD NOT EVEN THROW. The miss path is
// `Array.from(tool.measure_text(...))`. Once that returns a Promise,
// `Array.from` yields `[]` — TRUTHY — so `if (!m) throw` never fires, `m[0]` is
// `undefined`, and the corner-align arithmetic produces NaN for every photo in
// the batch. A truthy trap created BY the conversion, in a JS caller, which the
// audit cannot see by construction.
//
// SO THE FIX SPLITS BY WHETHER THE CALLER CAN AWAIT, not by which module the
// call lives in:
//   • the 2 RENDER sites keep this sync API + their fallback, primed off the
//     render path by `primeTextMetrics()` — the original plan, correct here;
//   • the 4 NON-render sites (commit, re-edit, both batch stamps) must AWAIT
//     the engine instead. They are not render passes; they never needed a
//     fallback, and a miss there is pixel drift or a skipped photo, not a
//     dropped frame.
// Doing step 3 of the original plan literally — "remove the synchronous engine
// calls from the miss path" — ships the NaN batch. Do not.
import type { ImageHorseTool } from "stamp_tool";

/** Entries, not bytes. Text can be arbitrarily long, so cap the count and let
 *  the LRU handle the rest. A typing session touches one key per keystroke, so
 *  this holds several documents' worth of history comfortably. */
const MAX_ENTRIES = 512;

const store = new Map<string, readonly number[]>();

/** Map insertion order IS the LRU order — re-inserting on hit moves an entry to
 *  the end, and the oldest is `keys().next()`. */
function remember(key: string, value: readonly number[]): readonly number[] {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, value);
  return value;
}

function lookup(key: string): readonly number[] | undefined {
  const hit = store.get(key);
  if (hit === undefined) return undefined;
  store.delete(key);
  store.set(key, hit); // refresh LRU position
  return hit;
}

/**
 * The one seam Stage 3.5 replaces.
 *
 * Returns the cached value, or computes and caches it. `compute` runs ONLY on a
 * miss, so once the engine moves behind the port this is where "cannot answer
 * synchronously" gets handled — and it is the only place.
 */
function cached(key: string, compute: () => readonly number[] | undefined) {
  const hit = lookup(key);
  if (hit !== undefined) return hit;
  const value = compute();
  if (value === undefined) return undefined;
  return remember(key, value);
}

// Keys embed the argument list verbatim. U+0000 as the separator because it
// cannot appear in text the user typed through a textarea, so no combination of
// text and numbers can forge another entry's key.
//
// WRITTEN AS AN ESCAPE, NOT A RAW BYTE, AND THAT MATTERS. Until 2026-08-10
// both the separator and the backtick-quoted mention above were literal 0x00
// bytes in this source file. Two NULs make every grep classify the file as
// BINARY, and a recursive search that skips binaries (`grep -I`, ripgrep and
// ugrep by default) then skips this file ENTIRELY — silently. Searching the
// repo for a caller of anything defined here returned a confident zero.
// `\u0000` is the identical runtime string with none of that.
const SEP = "\u0000";

/**
 * `[width, height]` in pixels of `text` as `commit_text` would render it.
 *
 * Returns `undefined` when there is no engine AND no cached answer — callers
 * fall back to their own measurement for that frame (`CanvasArea` uses an
 * offscreen 2D canvas box, which is what it did before the engine was asked).
 */
export function measureText(
  tool: ImageHorseTool | null | undefined,
  text: string,
  fontSize: number,
  bold: boolean,
): readonly number[] | undefined {
  return cached(`m${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`, () =>
    tool ? Array.from(tool.measure_text(text, fontSize, bold)) : undefined,
  );
}

/** Where the first line's ink begins inside a plain (no background) tile. */
export function textInkOffset(
  tool: ImageHorseTool | null | undefined,
  text: string,
  fontSize: number,
  bold: boolean,
): readonly number[] | undefined {
  // Deliberately NOT delegating to `textInkOffsetBg(..., 0, 0)`: the engine
  // exposes both and the two-arg form is what the render path calls, so it gets
  // its own key rather than depending on the delegation staying true in Rust.
  return cached(`i${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`, () =>
    tool ? Array.from(tool.text_ink_offset(text, fontSize, bold)) : undefined,
  );
}

/** `textInkOffset` extended to every background kind — tail margin and padding
 *  included. Used by the commit and re-edit paths, which must agree with the
 *  overlay to the pixel or committed text lands off where it was typed. */
export function textInkOffsetBg(
  tool: ImageHorseTool | null | undefined,
  text: string,
  fontSize: number,
  bold: boolean,
  backgroundKind: number,
  bgPadding: number,
): readonly number[] | undefined {
  return cached(
    `b${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${backgroundKind}${SEP}${bgPadding}${SEP}${text}`,
    () =>
      tool
        ? Array.from(
            tool.text_ink_offset_bg(text, fontSize, bold, backgroundKind, bgPadding),
          )
        : undefined,
  );
}

/** Entry count. For the contract test and the diagnostics panel — not a public
 *  API anyone should branch on. */
export function textMetricsCacheSize(): number {
  return store.size;
}

/** Drop everything. Nothing in the app calls this: the cache cannot go stale,
 *  so there is no correctness reason to clear it. It exists for tests, which
 *  need a known starting point. If product code ever calls this, that is a sign
 *  someone believes the entries expire — read the header again. */
export function resetTextMetricsCache(): void {
  store.clear();
}

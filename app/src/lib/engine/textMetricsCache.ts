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
// ── WHAT STAGE 3.5 CHANGED HERE — ✅ DONE v8.14 ───────────────────────────────
// A miss no longer calls the engine at all. `cached()` is a pure lookup: on a
// miss the caller takes its documented fallback for that frame, and
// `primeTextMetrics()` fills the entry off the render path so the next render
// hits. Specified in v7.80, built in v8.14.
//
// It was built LAST on purpose. Four of the six callers could not tolerate a
// miss, and removing the synchronous engine call while they were still routed
// through here would have shipped the NaN batch described below. They moved to
// the awaited twins first (v8.12, v8.13); only then was this safe to delete.
// The ordering was the whole fix.
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
// SO THE FIX SPLIT BY WHETHER THE CALLER CAN AWAIT, not by which module the
// call lives in — and all of it has now shipped:
//   • the 2 RENDER sites keep this sync API + their fallback, primed off the
//     render path by `primeTextMetrics()` ......................... v8.14
//   • the 4 NON-render sites (commit, re-edit, both batch stamps) AWAIT the
//     engine through the twins below ......................... v8.12, v8.13
// Doing step 3 of the original plan FIRST — "remove the synchronous engine
// calls from the miss path" — would have shipped the NaN batch.
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
 * The seam Stage 3.5 replaced — and it is now a pure cache read.
 *
 * ✅ b1 COMPLETE (v8.14). This used to take a `compute` thunk and call the
 * engine on a miss. It no longer can: the two remaining callers are React
 * render passes, and a render cannot `await`. A miss now returns `undefined`,
 * the caller takes its documented fallback for that frame, and
 * `primeTextMetrics()` fills the entry off the render path so the next render
 * hits. That is exactly what this file's header specified in v7.80 and what was
 * never built until now.
 *
 * The four callers that could NOT tolerate a miss — the text commit, the
 * re-edit, and both batch stamps — no longer come through here at all; they use
 * the awaited twins above (v8.12, v8.13). Removing the synchronous engine call
 * before those moved would have shipped a NaN batch.
 */
function cached(key: string): readonly number[] | undefined {
  return lookup(key);
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
  // `tool` is no longer read — kept in the signature because every call site
  // has it to hand and dropping it would be churn for no gain, and because
  // `primeTextMetrics` (which does need it) is called with the same arguments.
  void tool;
  return cached(`m${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`);
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
  void tool;
  return cached(`i${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`);
}

// `textInkOffsetBg`'s SYNCHRONOUS form was deleted in v8.14. Its only callers
// were the text commit and re-edit paths, and both moved to
// `textInkOffsetBgAwaited` in v8.12 — leaving a zero-reference export whose
// only remaining effect would have been to keep an unreachable engine call in
// the Stage 3.5 gate. `git log --all -G` shows exactly two commits ever touched
// it (v7.80 introduced it, v8.12 orphaned it), so this is a wire that was
// disconnected on purpose rather than one that was never connected.

/**
 * `measureText` for callers that CAN await — today that is the batch stamp,
 * both of whose call sites are the reason the corrected b1 exists.
 *
 * The sync form returns `undefined` on a miss, and `BatchSettings` handles that
 * by THROWING and skipping the photo, deliberately: every available fallback
 * would corner-align a whole gallery to the wrong place. That guard is correct
 * and it is also the one Stage 3.5 would have broken — the miss path is
 * `Array.from(tool.measure_text(...))`, and `Array.from` of a Promise is `[]`,
 * which is TRUTHY, so `if (!m) throw` stops firing, `m[0]` is `undefined`, and
 * the corner-align arithmetic yields `NaN` for every photo in the batch.
 *
 * Awaiting removes the miss rather than handling it: with a live tool this
 * always resolves, so the throw below becomes genuinely unreachable instead of
 * unreachable-by-luck.
 */
export async function measureTextAwaited(
  tool: ImageHorseTool | null | undefined,
  text: string,
  fontSize: number,
  bold: boolean,
): Promise<readonly number[] | undefined> {
  const key = `m${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`;
  const hit = lookup(key);
  if (hit !== undefined) return hit;
  if (!tool) return undefined;
  return remember(key, Array.from(await tool.measure_text(text, fontSize, bold)));
}

/**
 * `textInkOffsetBg` for callers that CAN await — the commit path, the re-edit
 * path, and the batch stamp. **Use this one unless you are inside a render.**
 *
 * ADR-024 Stage 3.5, b1. The sync forms above exist because a React render pass
 * cannot `await`; they return `undefined` on a miss and their two render callers
 * fall back cleanly. Everywhere else a miss is NOT harmless — it commits text at
 * the uncorrected anchor, drifts a re-edit cycle, or (in `BatchSettings`)
 * corner-aligns a whole gallery from `NaN`. Those callers were never render
 * passes and never needed a fallback: they can simply wait.
 *
 * Same store and the SAME KEY as the sync form, deliberately — a commit warms
 * the entry the next render reads, so this doubles as the prime the render sites
 * were always specified to get.
 */
export async function textInkOffsetBgAwaited(
  tool: ImageHorseTool | null | undefined,
  text: string,
  fontSize: number,
  bold: boolean,
  backgroundKind: number,
  bgPadding: number,
): Promise<readonly number[] | undefined> {
  const key = `b${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${backgroundKind}${SEP}${bgPadding}${SEP}${text}`;
  const hit = lookup(key);
  if (hit !== undefined) return hit;
  if (!tool) return undefined;
  // The one line that differs from `cached()`: the engine is awaited rather
  // than called for an answer it may not be able to give synchronously.
  const value = Array.from(
    await tool.text_ink_offset_bg(text, fontSize, bold, backgroundKind, bgPadding),
  );
  return remember(key, value);
}

/**
 * Fill the cache for the two keys the RENDER path reads, off the render path.
 *
 * ADR-024 b1, and the piece that was specified in this file's header in v7.80
 * and never written. A render pass cannot `await`, so once the engine is behind
 * the port a miss cannot be answered during render: the caller takes its
 * documented fallback for that frame, this fills the cache, and the next render
 * hits. Call it from an effect keyed on the text being laid out.
 *
 * Returns **true if it actually filled something** — the caller uses that to
 * force exactly one re-render. Priming without re-rendering is the failure this
 * whole mechanism is prone to: the fallback would be correct-looking and
 * permanent, which is indistinguishable from working software.
 */
export async function primeTextMetrics(
  tool: ImageHorseTool | null | undefined,
  text: string,
  fontSize: number,
  bold: boolean,
): Promise<boolean> {
  if (!tool) return false;
  const mKey = `m${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`;
  const iKey = `i${SEP}${fontSize}${SEP}${bold ? 1 : 0}${SEP}${text}`;
  let filled = false;
  // `store.has`, NOT `lookup` — lookup re-inserts on hit to maintain LRU order,
  // and priming an entry the render is already using should not reorder it.
  if (!store.has(mKey)) {
    remember(mKey, Array.from(await tool.measure_text(text, fontSize, bold)));
    filled = true;
  }
  if (!store.has(iKey)) {
    remember(iKey, Array.from(await tool.text_ink_offset(text, fontSize, bold)));
    filled = true;
  }
  return filled;
}

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

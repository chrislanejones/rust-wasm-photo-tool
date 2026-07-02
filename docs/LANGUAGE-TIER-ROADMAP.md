# Language-Tier Roadmap

Advisory pass over `app/src/hooks/`, `app/src/app/AppShell.tsx`, and `src/lib.rs`
+ its modules. **This is a recommendation list — nothing below has been ported.**
No code was changed as part of this pass.

Headline finding: the hook layer is already well-tiered. Every tool hook
(`useCloneStamp`, `usePaintTool`, `useMoveLayerTool`, `useTextTool`,
`useDrawingTools`, `useRedStampTool`, `useColorPicker`) is a thin
pointer-event → WASM-method forwarder; all per-pixel, per-stroke, and
hit-testing work already happens in Rust. There is **no hot per-frame or
per-pixel JS loop** left to move down for speed. The two "move down" items
below are correctness-motivated (untrusted binary parsing), not perf-motivated.
The more actionable findings are on the "move up" side: a handful of Rust
`#[wasm_bindgen]` free functions that do pure scalar/string math with no pixel
access, one of which (`photo_limit`) has already drifted into a hand-maintained
duplicate in TypeScript.

## Move down (→ Rust/WASM)

- [ ] 🟡 **EXIF/metadata byte parsing** — `app/src/lib/exif.ts` (whole file,
  ~517 lines: `extractJpegExifTiff`, `stripJpegMetadata`, `injectJpegExif`,
  `parseWebpChunks`, `stripWebpMetadata`, `injectWebpExif`, `parseExifTiff`).
  Current tier: TS. Proposed tier: Rust/WASM.
  Why: hand-rolled JPEG APPn / PNG chunk / WebP RIFF marker walking over
  **untrusted, attacker-controllable bytes** (uploaded photos) — exactly the
  "byte manipulation, untrusted-input parsing" profile the tier guardrails
  call out for a down-move, and Rust already owns the sibling PNG codec
  (`src/codec.rs`). Correctness win (bounds-checked slicing, no silent OOB),
  not a perf win — this runs once per export, not per frame.
  Effort: medium (semantically mechanical port of buffer-offset arithmetic;
  6-8 new wasm-bindgen exports mirroring the existing TS function signatures).
  Boundary caveat: called a handful of times per export/save, not per frame —
  FFI marshalling cost is irrelevant here, so this is purely about parser
  safety, not speed. Already fail-safe (try/catch → return-unchanged) in TS,
  so functionally low-risk to leave as-is if this doesn't get prioritized.

- [ ] 🟡 **Custom binary archive encode/decode** —
  `app/src/hooks/useEditPersistence.ts:47-231` (`encodeArchive`/`decodeArchive`,
  magic/version header + versioned DataView packing for the full undo/redo +
  layer-stack persistence format). Current tier: TS. Proposed tier: Rust/WASM.
  Why: byte-level packing of a custom versioned container format, run on every
  save/load of a photo session. Rust already owns every payload piece that
  goes into it (PNG bytes via `export_png`/snapshot getters, layer/annotation
  JSON via `get_layers`/`get_shape_annotations`) — only the container framing
  is TS-owned. A `encode_archive`/`decode_archive` wasm export would put format
  versioning under one type-checked roof instead of a hand-written
  `DataView`/`pos` counter that a future version bump has to get right by eye.
  Effort: medium (new wasm-bindgen surface taking/returning the same pieces
  already exposed; version-compat logic needs care).
  Boundary caveat: not hot (once per save, async already), so this is a
  correctness/maintainability move, not a speed move.

## Move up (→ TS)

- [ ] 🔴 **`photo_limit(tier)`** — `src/lib.rs:64-71` (3-arm string match
  returning a constant) + its wrapper `app/src/lib/photoLimits.ts:17-21`.
  Current tier: Rust/WASM. Proposed tier: TS.
  Why: pure business-tier config, zero pixel access, zero perf need — and it
  has **already drifted**: `app/src/lib/tiers.ts:9-10,18-19` hand-maintains an
  independent `TIERS[mode].galleryLimit` table with a comment demanding a human
  keep the two in sync ("`galleryLimit` here must equal what `photo_limit`
  returns"). Two SSOTs for the same 3 integers is exactly the drift this repo's
  own conventions try to avoid elsewhere. `photoLimits.ts` also forces an
  `await import("stamp_tool"); await mod.default()` WASM boot just to read one
  of 3 numbers, on the upload-gate path in `AppShell.tsx` (~line 365, 529).
  Effort: small — delete `photo_limit` from `src/lib.rs` + `photoLimits.ts`'s
  WASM path, make `tiers.ts`'s `TIERS` table the sole source, and switch the
  2 AppShell call sites from the async `getPhotoLimit()` to the already-sync
  `galleryLimitFor()`. Highest payoff/effort ratio on this list.
  Boundary caveat: none — removing this FFI hop is pure upside (also removes
  an unnecessary async dependency from the upload gate's hot path).

- [ ] 🟠 **`web_perf_metrics` + `lighthouse_score`/`erf`/`erfc`** —
  `src/lib.rs:184-315` (~130 lines) backing `app/src/lib/webPerf.ts:61-81`,
  consumed live by `ResizeSettings.tsx` (~line 199) on every slider tick.
  Current tier: Rust/WASM. Proposed tier: TS.
  Why: a PageSpeed-Insights-style scoring heuristic (log-normal curve via a
  hand-rolled Abramowitz–Stegun `erf` rational approximation) operating on 9
  already-known scalars (widths/heights/byte counts/quality/format code) —
  no pixel buffer ever touches this function. This is squarely "UI-adjacent
  state / one-call-site helper" per the tier guardrails. Forcing every live
  Resize & Compress slider drag through an async `import("stamp_tool")` +
  `mod.default()` + FFI call for arithmetic on 9 numbers adds latency to a
  UI that wants to feel instant.
  Effort: small–medium (needs a ~15-line TS port of the `erf`/`erfc` rational
  approximation; the rest is straightforward arithmetic already documented
  in the Rust doc comments).
  Boundary caveat: making this synchronous in TS actually *improves*
  responsiveness vs. today's async WASM round-trip on every slider tick.

- [ ] 🟡 **`constrain_crop_to_ratio` + `compute_aspect_crop`** —
  `src/lib.rs:2020-2094` and `:2102-2127`, called from
  `app/src/hooks/useDrawingTools.ts:157-203` (crop-ratio drag snapping) and
  `app/src/features/tools/settings/TransformCropSettings.tsx:118-121`
  (ratio-button crop). Current tier: Rust/WASM. Proposed tier: TS.
  Why: pure scalar rect-geometry (8 numbers in, 4 out) — no arrays, no pixel
  access, called on every `mousemove` during a ratio-locked crop drag. Notably,
  `useDrawingTools.ts:183-200` **already carries a full duplicate JS
  implementation** of this exact math, labeled "Cold-cache JS fallback —
  equivalent geometry" — meaning the same geometry is hand-kept in sync across
  two languages today, the identical anti-pattern as `photo_limit`/`tiers.ts`
  above. Since the JS fallback already exists and is exercised on every cold
  load, it's proven-correct enough to promote to the sole implementation.
  Effort: small — delete the two Rust functions + `stamp_tool.d.ts` entries,
  promote the existing JS fallback in `constrainDrag` to unconditional, drop
  `constrainRef`/the `import("stamp_tool")` in `useDrawingTools.ts:157-162`.
  Boundary caveat: this one *is* called every drag frame, so removing the
  WASM hop also removes real per-frame marshalling overhead, not just
  maintenance burden.

- [ ] 🟢 **`grid_lines`** — `src/lib.rs:106-183`, wrapped by
  `app/src/lib/gridGeometry.ts`, consumed by
  `app/src/features/canvas/CanvasGuidesOverlay.tsx`. Current tier: Rust/WASM.
  Proposed tier: TS (optional / low priority).
  Why: same shape as the items above (pure width/height/kind/param scalar
  math, no pixel access) but it is **not** duplicated in JS today and only
  recomputes when guide settings change (not per frame), so the payoff of
  moving it is marginal. Listed for completeness / consistency if this
  cleanup pass is ever done as a batch; not worth a standalone effort.
  Effort: small. Boundary caveat: negligible either way — low call frequency.

## Leave as-is (already right tier)

- All 6 tool-drag hooks (`useCloneStamp.ts`, `usePaintTool.ts`,
  `useMoveLayerTool.ts`, `useTextTool.ts`, `useDrawingTools.ts`'s commit path,
  `useRedStampTool.ts`, `useEmojiTool.ts`) — thin coordinate-mapping +
  WASM-method forwarders. All brush/stroke/mask math (`paint_down/move/up`,
  `erase_*`, `mask_paint_*`), hit-testing (`text_annotation_at`,
  `shape_annotation_at`), and drag-preview compositing (`set_move_preview`,
  `recomposite`) already live in Rust. Nothing to move.
- `useColorPicker.ts` + `MagnifierOverlay.tsx` — pixel sampling goes through
  `tool.get_pixel_region`/`get_pixel` (Rust); JS only draws an 11×11
  (121-cell) preview grid via Canvas2D `fillRect`. Appropriately cheap
  UI rendering.
- `HistogramView.tsx` — bin data comes from Rust `calculate_histogram()`; the
  256-bin normalize/damp/draw loop in JS is O(256) per `requestAnimationFrame`
  tick for a purely cosmetic settle animation. Below any threshold that would
  justify a WASM round trip.
- `useDrawingTools.ts`'s `drawArrowPreview`/`drawShapePreview` (including the
  hand-drawn-circle noise generator at lines ~842-891, ~70 trig samples per
  drag frame) — Canvas2D-native rendering for the *live, throwaway* rubber-band
  preview only; the real commit rasterizes through Rust
  (`add_shape_annotation`/`update_shape_annotation`). Moving the preview math
  to WASM would add marshalling cost for pixels that get erased next frame.
- `useEmojiTool.ts`'s `renderEmojiPixels` — relies on the browser's own
  font/emoji glyph rendering via `OffscreenCanvas.fillText`. Rust has no
  system font/emoji-glyph stack to replace this with, regardless of
  performance; must stay in JS.
- `app/src/lib/exportImage.ts`, `app/src/lib/workingCopy.ts` — already
  correctly delegate pixel-heavy work to Rust (`encode_png_pixels`, the Rust
  bilinear `resizePixels`), and only reach for browser-native codecs where
  Rust deliberately doesn't ship an encoder (WebP/AVIF, per the project's
  wasm size-budget architecture).
- `src/settings.rs` (undo-history depth constants + `clamp_max_history`) —
  correctly in Rust because the values gate an allocation that happens in
  Rust (`History`'s own snapshot eviction), unlike `photo_limit` which is
  pure UI-facing config with no Rust-side consumer of its own output.
- Hand-rolled JSON string builders in Rust (`layer::get_layers`,
  `annotations::annotations_to_json`/`shapes_to_json`, `utils::json_escape`) —
  technically "simple JSON shuffling" that would normally flag for a move-up,
  but this is a deliberate size-budget tradeoff (avoiding pulling `serde_json`
  into the wasm binary) and `json_escape` correctly handles quotes,
  backslashes, and control characters. Not recommending a move; worth a
  second look only if a hand-escaping bug ever surfaces in practice.

## Larger ports (supervised)

None identified. Every item above is a single-function, single-or-few-call-site
change — no subsystem here is large or risky enough to warrant a dedicated,
sign-off-gated migration project.

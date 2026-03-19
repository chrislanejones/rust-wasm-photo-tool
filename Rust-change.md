# Rust Improvement Notes

## Bugs

### 1. Alpha blending bug in `stamp.rs` `apply_dab()` — HIGH
```rust
// Current (incorrect):
data[di + c] = (dv + (sv - dv) * alpha).round() as u8;
// Missing: dst_alpha multiplication in RGB blend
// Also: destination alpha channel is never updated
```
The clone stamp only blends RGB but doesn't update the alpha channel and doesn't account for `dst_alpha`. `transform.rs::paste_region` gets this right with full over-compositing — `stamp.rs` doesn't match.

### 2. `delete_entry()` in `history.rs` — MEDIUM
```rust
self.undo_stack.truncate(index); // removes items AFTER index
```
This keeps items 0..index and discards index+1..n. If you delete item 5 from a 10-item stack, you lose items 6-9 but also item 5 itself isn't removed — you just truncate at it. The logic is inverted from intent.

---

## Performance

### 3. `paint_dab` allocates inside the inner pixel loop (`lib.rs` ~line 443)
```rust
// Inside nested loops over every pixel:
let [r, g, b] = [r, g, b]; // color re-packed on every iteration
```
For a 50px brush radius, that's ~7,800 iterations per dab. Move color extraction outside both loops.

### 4. Square root in `stamp.rs` `apply_dab` (~line 184)
```rust
if (dx*dx + dy*dy).sqrt() > r { continue; }
// Change to:
if dx*dx + dy*dy > r*r { continue; }
```
Avoids sqrt on every pixel in the dab loop.

### 5. Gaussian blur in `filters.rs` allocates 2 temp buffers per call
Every `blur_region` call allocates `region` and `h_pass` — 4MB each on a 1000×1000 region. High-frequency brush strokes hammer the allocator. Could be collapsed to one buffer with a stride trick, or pre-allocated and reused.

### 6. Circle drawing in `drawing.rs` uses line segments
```rust
let segments = (r * 4.0).max(60.0); // up to 240 segments for shape outlines
```
Should use scanline fill or Midpoint circle algorithm instead — far fewer iterations.

---

## Memory

### 7. Full-buffer history snapshots (`history.rs`)
Every undo snapshot = full `Vec<u8>` copy of the image. A 4K image is ~48MB per snapshot × 50 max = 2.4GB theoretical worst case. Delta encoding (diff only changed regions) or copy-on-write blocks would reduce this dramatically.

---

## What JS Should Move to Rust

### HIGH value — move now

| JS code | Location | Why move |
|---|---|---|
| `parseHex()` called on every `mousemove` | `usePaintTool.ts:82` | Called hundreds of times/second during painting, parses on each event |
| History label sync (Vec join + string split) | `useCloneStamp.ts` | Called on every history update; could return structured data from Rust instead of `|`-joined string |

### MEDIUM value — worth considering

| JS code | Location | Why move |
|---|---|---|
| `drawArrowPreview()` / `drawShapePreview()` | `useDrawingTools.ts:240-343` | Preview math duplicates `drawing.rs` — if one changes, the other drifts; moving preview to WASM eliminates discrepancy |
| Crop region compositing | `useDrawingTools.ts` | Crop selection boundaries/calculations done in JS; could be pixel-accurate in Rust |

### MUST stay in JS

- **Text rendering** — browser font stack, no alternative in WASM
- **Emoji rendering** — OS-native emoji, browser renders it
- **File loading** (`canvas.toBlob`, `FileReader`) — browser APIs
- **Canvas display** (`putImageData`) — DOM API

---

## What's Already Done Well

- **`transform.rs`** over-compositing is correct (`paste_region`)
- **Gaussian blur** is properly separable (2-pass, not 2D convolution) — correct algorithm
- **`drawing.rs`** `blend_pixel` alpha compositing is correct
- **WASM boundary design** — JS never owns pixel data, Rust owns everything; clean ownership model
- **History snapshot timing** — most ops snapshot before mutation (correct for undo semantics)
- **Bilinear interpolation** in `core.rs` and resize — properly clamped, correct lerp

---

## Priority Order

1. Fix `stamp.rs` alpha blending (bug, affects all stamp/clone operations on non-opaque images)
2. Fix `history.rs::delete_entry` (logic inversion bug)
3. Remove sqrt in `apply_dab` hot path (trivial win)
4. Pre-compute color in `paint_dab` inner loop (trivial win)
5. Memoize `parseHex` in `usePaintTool` (easy JS fix)
6. History delta encoding (large memory win, more complex)
7. Unify arrow/shape preview math between JS and Rust

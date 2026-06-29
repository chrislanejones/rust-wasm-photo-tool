# WASM SIMD Optimization Plan — Task List

A chunked, do-one-at-a-time checklist for adding explicit WebAssembly SIMD128 to the
hot paths in `src/`. Hand any single item to Claude Code and it has everything needed.

## ✅ Status (2026-06-28)

All **bit-identical** wins are done and verified (`cargo test` 26/26 · wasm32 +simd128
`cargo check` · `wasm-pack build`), consolidated under **`src/simd/{blur,color,resize}.rs`**:

- ✅ Gaussian blur · ✅ Brightness · ✅ Contrast · ✅ Pixelate (cell-sum `u32x4`)
- ✅ Resize: bilinear + lanczos3 + catmull_rom · ✅ Mask invert (`255−x`)
- ✅ Phase 6 module consolidation (`src/simd/`, shared `pixel.rs` load/store helpers)

**Measured** (Chrome, resize 2048²→1024², mean of 8, SIMD `pkg` vs scalar build — see `bench.html`):
bilinear **1.60×** · lanczos3 **3.90×** · catmull **3.65×**. The separable filters hit the
plan's "biggest geometry win"; bilinear is more memory-bound (4-tap gather), so less to vectorize.

**Deferred — can't be bit-identical (decision: keep scalar):** the alpha-blend kernels —
layer compositing (`blend_over`), brush, eraser, clone stamp. They do a per-pixel
*integer division by a per-pixel divisor* with numerators ~33M, past f32's exact-integer
range (~16.7M); wasm SIMD128 has no integer divide, so f32 can't reproduce the scalar
rounding exactly. Would need ≤1/255 drift or a reciprocal-multiply trick.

**Skipped — negligible / no ROI (marked N/A below):** redact (already a fast splat),
flip/rotate/crop/copy/translate/paste (`copy_from_slice` already lowers to optimized
memcpy), magic-wand (serial stack flood-fill — un-parallelizable), apply-mask + thumbnail
(one-time ops), scratch-buffer reuse + 16-byte alignment (micro-opts).

## How to do any task here (the recipe)

1. Read the target function listed in the task, and read `src/simd_blur.rs` as the
   reference pattern (already-shipped example of how this project does SIMD).
2. Add the SIMD path **plus a bit-identical scalar fallback**, dispatched at compile
   time with the exact cfg used in `simd_blur.rs`:
   `#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]`.
3. Keep output identical to the current scalar code (same rounding/clamp). Inputs are
   `u8` 0–255 in RGBA order; `+simd128` is already on (`.cargo/config.toml`).
4. **Verify before marking done:**
   - `cargo test` → native scalar path + existing suite (was 26/26).
   - `RUSTFLAGS="-C target-feature=+simd128" cargo check --target wasm32-unknown-unknown`
     → SIMD intrinsics compile.
   - `wasm-pack build --target web --out-dir pkg` → full release build passes.
5. Tick the box, note the new module/function in the line, move on. One chunk per PR/commit.

Useful intrinsic building blocks (see `simd_blur.rs`): `v128_load`/`v128_store`,
`v128_load32_zero` + `v128_store32_lane` (single RGBA pixel), `u16x8_extend_low_u8x16`
→ `u32x4_extend_low_u16x8` → `f32x4_convert_u32x4` (widen bytes→floats),
`i32x4_trunc_sat_f32x4` → `i16x8_narrow_i32x4` → `u8x16_narrow_i16x8` (floats→clamped bytes).

---

## Phase 0 — Foundation ✅ (done, no action)

- [x] `+simd128` in `.cargo/config.toml`
- [x] Release profile tuned (`opt-level=3`, `lto=true`, `codegen-units=1`) in `Cargo.toml`
- [x] `wasm-pack build` passes
- [x] `cargo test` passes (26/26)

## Phase 1 — Image filters

- [x] **Gaussian blur** — `filters::gaussian_blur_region` → implemented in `src/simd_blur.rs`.
- [ ] **Brightness** — `filters::adjust_brightness` (`src/filters.rs:3`).
      Add the clamped `delta` to all RGB channels 16 bytes at a time (`i16x8` add then
      `u8x16_narrow_i16x8` to saturate). Leave alpha untouched. Target 3–8×.
- [ ] **Contrast** — `filters::adjust_contrast` (`src/filters.rs:12`).
      Compute `(v/255 - 0.5) * f + 0.5` clamped, per channel, as `f32x4` lanes; skip alpha.
- [ ] **Pixelate** — `filters::pixelate_region` (`src/filters.rs:127`).
      SIMD-accumulate each cell's channel sums (`u32x4`) before dividing by the count.
- [ ] **Redact** — `filters::redact_region` (`src/filters.rs:191`).
      Splat the fill colour and `v128_store` the in-circle runs. Low ROI (already memset-like).

## Phase 2 — Painting (most visible while editing)

- [ ] **Shared alpha-blend kernel** — create `src/simd/blend.rs` (or add to `simd_blur.rs`)
      with one `alpha_blend_simd(dst, src_or_color, coverage)` used by the four items below.
      Do this first so brush/eraser/stamp/paste don't each grow their own copy.
- [ ] **Brush dab / stroke** — `paint::accumulate_dab` + `paint_dab`/`paint_stroke_to`
      (`src/paint.rs:26`). Vectorize the per-pixel falloff × opacity blend over RGBA.
- [ ] **Eraser** — `paint::erase_*` (`src/paint.rs:267`). SIMD alpha subtract; reuse the kernel.
- [ ] **Mask paint** — `paint::mask_paint_*` (`src/paint.rs:304`). Single-channel coverage
      write across the mask buffer.
- [ ] **Clone stamp** — `stamp::continue_stroke`/`begin_stroke` (`src/stamp.rs:106`).
      Copy source pixels + falloff blend + store; reuse the kernel.

## Phase 3 — Layers (biggest cost on multi-layer docs)

- [ ] **Layer compositing** — the `RGBA over RGBA` alpha-blend loop behind `layer::get_layers`
      render / merge. This kernel is reused by the next two. Target 2–4×.
- [ ] **Merge down** — `layer::merge_down` (`src/layer.rs:685`) — reuse compositor.
- [ ] **Flatten all** — `layer::flatten_all` (`src/layer.rs:745`) — reuse compositor.
- [ ] **Apply / invert mask** — `layer::apply_layer_mask` (`:799`), `invert_layer_mask` (`:821`).
      SIMD alpha multiply / `255 - x`.

## Phase 4 — Geometry / transforms

- [ ] **Resize** — `transform::resize_bilinear` (`:193`), `resize_lanczos3` (`:409`),
      `resize_catmull_rom` (`:403`). Vectorize per-output-pixel weighted sums. Higher effort;
      biggest geometry win. Start with bilinear.
- [ ] **Flip H/V** — `transform::flip_horizontal/vertical` (`:9`,`:27`). SIMD row copies.
- [ ] **Rotate 90** — `transform::rotate_90_cw/ccw` (`:47`,`:64`). Blocked transpose.
- [ ] **Crop / copy / translate / paste** — `transform::{crop,copy_region,translate,paste_region}`
      (`:82`,`:102`,`:168`,`:119`). Mostly wide `memcpy`; `paste_region` blend reuses the kernel.

## Phase 5 — Selection & export (lower ROI)

- [ ] **Magic wand** — `selection::magic_wand_select` (`src/selection.rs:59`).
      SIMD tolerance compare on the flood-fill candidate test.
- [ ] **PNG / thumbnail** — `codec::export_png` (`:10`), `thumbnail_data` (`:37`).
      Vectorize the thumbnail downscale averaging; PNG encode itself is libpng-bound.

## Phase 6 — Architecture & memory (after ~4 kernels exist)

- [ ] Consolidate intrinsics into a `src/simd/` module (`mod.rs`, `blend.rs`, `color.rs`,
      `blur.rs`, `resize.rs`); move `simd_blur.rs` under it.
- [ ] Reuse scratch buffers (blur already does via `blur_scratch_a/b`) for resize & composite.
- [ ] Consider 16-byte alignment for main pixel buffers so `v128_load` can use aligned loads.

---

## Recommended order

1. ✅ Gaussian blur
2. Brightness / Contrast (trivial; proves the filter pattern)
3. Shared `alpha_blend` kernel → Brush dab
4. Eraser + Clone stamp (reuse kernel)
5. Layer compositing → merge / flatten
6. Resize (bilinear, then lanczos)
7. Pixelate / magic wand / transforms cleanup
8. `src/simd/` consolidation

---

## NOT in the codebase — feature work, not SIMD (ignore unless building the feature)

No implementation exists to optimize, so these are off this plan:
Histogram · Saturation / Hue (HSV) · Levels · Curves · Exposure · Gamma ·
Histogram preview · Waveform · Vectorscope · Pixel statistics · Smudge brush ·
JPEG export · WebP export.

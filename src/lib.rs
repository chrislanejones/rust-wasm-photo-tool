//! Yet Another Image App — WASM Processing Layer
//!
//! Single `.wasm` binary, internally organized as Rust modules:
//!
//! - `core`      — ImageBuffer (pixel data, bilinear sampling)
//! - `history`   — Undo / redo snapshot system
//! - `stamp`     — Clone stamp brush engine
//! - `transform` — Flip, rotate, copy/paste regions
//! - `filters`   — Brightness, contrast, saturation, shadows, highlights, blur, sharpen
//! - `codec`     — PNG encoding, thumbnail generation
//!
//! The JS side imports `ImageHorseTool` — the API surface is unchanged.

// Several drawing / annotation / composite functions take many positional
// params (colours, coords, flags) by design; grouping them into structs would
// obscure the call sites more than it helps. Allow the lint crate-wide.
#![allow(clippy::too_many_arguments)]

use wasm_bindgen::prelude::*;

mod annotations;
mod codec;
mod core;
mod drawing;
mod edges;
mod effects;
mod history;
mod layer;
mod livewire;
mod paint;
mod selection;
mod settings;
mod stamp;
mod text;
mod transform;
mod utils;

// `filters`/`simd` are private by default (unchanged from before this
// session). They're only made `pub` under the `threads` feature so
// `benches/blur_threads.rs` — compiled as a separate crate, like any Cargo
// bench target — can reach `simd::blur`'s rayon-parallel functions and
// `filters::build_gaussian_kernel` to build a matching kernel. Same pattern
// already used for `ops`/`tiles` below. Zero effect on the default build's
// emitted bytes either way (visibility is a compile-time check only) — gated
// purely so the default build's public Rust API surface doesn't grow for a
// bench-only need.
#[cfg(feature = "threads")]
pub mod filters;
#[cfg(not(feature = "threads"))]
mod filters;
#[cfg(feature = "threads")]
pub mod simd;
#[cfg(not(feature = "threads"))]
mod simd;

// Tile engine core + operation log. Feature-gated (`tiles`) and NOT part of the
// wasm build or the wasm-bindgen surface — see src/tiles.rs / src/ops.rs.
#[cfg(feature = "tiles")]
pub mod ops;
#[cfg(feature = "tiles")]
pub mod tiles;

// Engine-vs-replay parity: unit tests that drive the REAL ImageHorseTool
// (paint_down/effect_down/add_text_annotation) and assert op-log replay
// reproduces the engine's own output byte-for-byte. Lives in src (not
// tests/) because it reads the tool's composite_cache directly.
#[cfg(all(test, feature = "tiles"))]
mod ops_engine_parity;

// Rayon thread-pool bootstrap. Feature-gated (`threads`) and NOT part of the
// default wasm build — see the `threads` feature comment in Cargo.toml and
// `src/simd/blur.rs` for the parallel kernel itself. Re-exporting this is what
// exposes an `initThreadPool(numThreads)` async function in the generated JS
// glue *when* the crate is built with `--features threads` under the
// nightly + atomics toolchain a real wasm32 thread pool needs (not done by
// this crate; see the feature comment). On native, this is inert plumbing —
// nothing calls it, `cargo test --features threads` just proves it compiles.
#[cfg(feature = "threads")]
pub use wasm_bindgen_rayon::init_thread_pool;

use crate::annotations::{annotations_to_json, build_text_annotation};
use crate::core::ImageBuffer;
use crate::history::{History, Snapshot};
use crate::layer::{composite_layers, composite_layers_into, Layer};
use crate::stamp::StampState;

/// Module-init hook: route Rust panics to `console.error` with a readable
/// message + stack (instead of the opaque "unreachable executed" RuntimeError).
/// `set_once` is idempotent, and `#[wasm_bindgen(start)]` runs this exactly once
/// when the module is instantiated — before any tool method or free function —
/// so it covers every entry point. Purely additive; no API surface changes.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Maximum number of gallery photos allowed for a given account tier.
///
/// Single source of truth for the gallery cap, shared by the upload gate
/// (`handleAddPhotos`) and the gallery UI on the JS side.
///
/// - `"demo"`     — anonymous / not signed in → **12**
/// - `"loggedIn"` — free account             → **24**
/// - `"paid"`     — Pro (coming soon)         → **100**
///
/// Unknown tiers fall back to the most restrictive demo limit.
#[wasm_bindgen]
pub fn photo_limit(tier: &str) -> u32 {
    match tier {
        "loggedIn" => 24,
        "paid" => 100,
        _ => 12,
    }
}

/// Diagnostics-only microbench (Task D, `feat/rayon-parallel-blur`): runs the
/// rayon-parallel two-pass Gaussian blur over a synthetic `width`×`height`
/// RGBA buffer at kernel `radius` and discards the result. Exists purely so
/// the Resources diagnostics panel can measure the REAL in-browser speedup
/// once a `--features threads` wasm build + COOP/COEP headers exist (a
/// separate, later decision — see ADR-011) — not reachable from the default
/// build. Deliberately returns no timing itself (no `web_sys`/`js-sys` timer
/// dependency needed for a bench-only export): the JS caller wraps this call
/// in `performance.now()` before/after.
#[cfg(feature = "threads")]
#[wasm_bindgen]
pub fn bench_blur_threaded(width: u32, height: u32, radius: u32) -> u32 {
    let w = width as usize;
    let h = height as usize;
    let len = w.saturating_mul(h).saturating_mul(4);
    if len == 0 {
        return 0;
    }
    // Deterministic synthetic content — a real bench of the kernel's cost, not
    // its input; there's nothing to visually verify here (see the byte-identical
    // correctness tests in src/simd/blur.rs for that).
    let mut data = vec![0u8; len];
    for (i, px) in data.iter_mut().enumerate() {
        *px = (i % 256) as u8;
    }
    let kernel = filters::build_gaussian_kernel(radius);
    let kr = radius as i32;
    let mut h_pass = vec![0u8; len];
    let mut out = vec![0u8; len];
    simd::blur::blur_horizontal_parallel(&data, &mut h_pass, w, h, kr, &kernel);
    simd::blur::blur_vertical_parallel(&h_pass, &mut out, w, h, kr, &kernel);
    out.len() as u32
}

/// Build a solid-color RGBA image and return it PNG-encoded.
///
/// Backs the upload dialog's "Blank Canvas" action so the blank surface is
/// produced entirely in Rust — no JS `<canvas>` allocation or `toBlob`
/// encode/decode round-trip. `r`/`g`/`b`/`a` are all `0..=255`; pass `a = 0`
/// for a fully transparent drawing surface, `a = 255` for an opaque fill.
#[wasm_bindgen]
pub fn blank_png(width: u32, height: u32, r: u8, g: u8, b: u8, a: u8) -> Vec<u8> {
    let px = (width as usize).saturating_mul(height as usize);
    let mut data = Vec::with_capacity(px.saturating_mul(4));
    for _ in 0..px {
        data.extend_from_slice(&[r, g, b, a]);
    }
    codec::export_png(&ImageBuffer {
        width,
        height,
        data,
    })
}

/// Compute the line geometry for the canvas "Rulers & Grids" overlay. The
/// frontend renders the returned segments as a non-destructive SVG overlay
/// (scaled by zoom) — this is the single source for grid-layout math, so all
/// three grid kinds agree everywhere.
///
/// Returns a flat list of segments `[x1, y1, x2, y2, …]` in **image-space pixel
/// coordinates** (origin top-left). Only interior dividers are emitted (no
/// border at 0 / width / height).
///
/// `kind`:
/// - `0` — **square** grid at a fixed pixel spacing (`param_a` = spacing px)
/// - `1` — **golden ratio**: lines at φ⁻¹ ≈ 0.382 and 0.618 on each axis
/// - `2` — **columns × rows**: evenly divide into `param_a` cols, `param_b` rows
#[wasm_bindgen]
pub fn grid_lines(width: u32, height: u32, kind: u8, param_a: f32, param_b: f32) -> Vec<f32> {
    let w = width as f32;
    let h = height as f32;
    let mut out: Vec<f32> = Vec::new();
    if w < 1.0 || h < 1.0 {
        return out;
    }
    match kind {
        // Square grid at a fixed pixel spacing (interior lines only).
        0 => {
            let step = param_a.max(2.0);
            let mut x = step;
            while x < w - 0.5 {
                out.extend_from_slice(&[x, 0.0, x, h]);
                x += step;
            }
            let mut y = step;
            while y < h - 0.5 {
                out.extend_from_slice(&[0.0, y, w, y]);
                y += step;
            }
        }
        // Golden ratio: φ and 1-φ on each axis.
        1 => {
            let phi: f32 = 0.618_034;
            for f in [1.0 - phi, phi] {
                out.extend_from_slice(&[w * f, 0.0, w * f, h]);
                out.extend_from_slice(&[0.0, h * f, w, h * f]);
            }
        }
        // Columns × rows: evenly-spaced interior dividers.
        2 => {
            let cols = (param_a.round() as i32).clamp(1, 64);
            let rows = (param_b.round() as i32).clamp(1, 64);
            for i in 1..cols {
                let x = w * (i as f32) / (cols as f32);
                out.extend_from_slice(&[x, 0.0, x, h]);
            }
            for j in 1..rows {
                let y = h * (j as f32) / (rows as f32);
                out.extend_from_slice(&[0.0, y, w, y]);
            }
        }
        _ => {}
    }
    out
}

/// Web-performance indicators for the Resize &amp; Compress panel.
///
/// Returns `[lighthouse_score, web_performance_gain]`, both in `0..=100`:
///
/// - **Web Performance Gain** — how much smaller the delivered image will be
///   vs. the *original upload* (`orig_bytes`), accounting for everything done so
///   far plus the pending resize + quality: `1 - projected_bytes / orig_bytes`.
///   A freshly uploaded, untouched photo reads `+0%`; resizing, lowering
///   quality, or running Auto Compress (which shrinks `cur_bytes`) all push it
///   up.
/// - **PageSpeed Insights Score** — a Google-PSI-style score derived from the
///   *projected delivered byte size*, mapped through a log-normal curve (the
///   same curve family Lighthouse uses to score its metrics), then adjusted
///   for the three image audits PSI actually runs:
///   - "Efficiently encode images" — the byte projection scales with quality.
///   - "Serve images in next-gen formats" — `cur_format`/`new_format` fold the
///     typical compression ratio of the target codec into the projection
///     (PNG photos ≈ 2.6× JPEG, WebP ≈ 0.8×, AVIF ≈ 0.6×), so switching the
///     Format dropdown to WebP/AVIF raises the score like PSI's audit would.
///   - "Properly size images" — output wider than 1920 px (the widest common
///     desktop display) accrues a linear penalty: those pixels can't be seen
///     and PSI flags them as pure waste.
///
/// Format codes: 0 = PNG, 1 = JPEG, 2 = WebP, 3 = AVIF, other = unknown (1.0).
///
/// `cur_bytes` is the current on-disk size of the active photo and `orig_bytes`
/// the immutable size at upload. Passing `0` for either (size unknown) yields a
/// `0` rather than a misleading perfect value.
#[wasm_bindgen]
pub fn web_perf_metrics(
    cur_w: u32,
    cur_h: u32,
    cur_bytes: f64,
    orig_bytes: f64,
    new_w: u32,
    new_h: u32,
    quality: u32,
    cur_format: u8,
    new_format: u8,
) -> Vec<f64> {
    let cur_area = (cur_w as f64) * (cur_h as f64);
    let new_area = (new_w as f64) * (new_h as f64);
    let area_ratio = if cur_area > 0.0 {
        new_area / cur_area
    } else {
        1.0
    };
    let quality_ratio = (quality as f64 / 100.0).clamp(0.0, 1.0);

    // Typical photographic bytes-per-pixel relative to JPEG at equal visual
    // quality. Grounded in Lighthouse's "next-gen formats" savings estimates
    // (WebP ~25-34% smaller than JPEG, AVIF ~40-50%) and PNG's 2-4× cost for
    // photos.
    fn format_weight(code: u8) -> f64 {
        match code {
            0 => 2.6, // PNG
            1 => 1.0, // JPEG
            2 => 0.8, // WebP
            3 => 0.6, // AVIF
            _ => 1.0, // unknown
        }
    }
    let format_ratio = format_weight(new_format) / format_weight(cur_format);

    // Estimated delivered size after the pending resize + re-encode, on top of
    // whatever the current file already is (e.g. after Auto Compress).
    let projected_bytes = (cur_bytes * area_ratio * quality_ratio * format_ratio).max(0.0);

    // "Properly size images": pixels beyond a 1920px-wide display are waste.
    // Score-only penalty (the bytes still ship, so savings stays honest).
    // Linear (not quadratic) so 4K originals are nudged, not cliffed.
    const MAX_USEFUL_WIDTH: f64 = 1920.0;
    let scored_bytes = if (new_w as f64) > MAX_USEFUL_WIDTH {
        projected_bytes * (new_w as f64 / MAX_USEFUL_WIDTH)
    } else {
        projected_bytes
    };

    // Byte savings vs. the *original upload*, so progress accumulates across
    // resize, quality and Auto Compress instead of resetting to the current file.
    let savings = if orig_bytes > 0.0 {
        ((1.0 - projected_bytes / orig_bytes) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    let score = if cur_bytes > 0.0 {
        // Unknown source size → don't pretend the image is perfectly optimized.
        lighthouse_score(scored_bytes)
    } else {
        0.0
    };

    vec![score, savings]
}

/// Map a projected transfer size (bytes) to a 0..=100 Lighthouse-style score
/// using a log-normal curve, the way Lighthouse scores its metrics. `GOOD` is
/// the size that earns ~90 and `MEDIAN` the size that earns 50; heavier images
/// fall off smoothly toward 0.
fn lighthouse_score(bytes: f64) -> f64 {
    // Control points: a well-optimized web image vs. a heavy one.
    const GOOD: f64 = 100_000.0; // ~100 KB → score ~90
    const MEDIAN: f64 = 500_000.0; // ~500 KB → score 50
                                   // erfc(-Z_P90)/2 = 0.9, i.e. Z_P90 = -erfc⁻¹(1.8); sigma is chosen so that
                                   // score(GOOD) lands on 0.9 and score(MEDIAN) on 0.5.
    const Z_P90: f64 = 0.906_193_802_436_823_2;

    if bytes <= 0.0 {
        return 100.0;
    }
    let sqrt2 = std::f64::consts::SQRT_2;
    let sigma = (MEDIAN.ln() - GOOD.ln()) / (sqrt2 * Z_P90);
    let z = (bytes.ln() - MEDIAN.ln()) / (sqrt2 * sigma);
    (0.5 * erfc(z) * 100.0).clamp(0.0, 100.0)
}

/// Complementary error function via the Abramowitz &amp; Stegun 7.1.26
/// rational approximation (|error| &lt; 1.5e-7) — enough for UI scoring.
fn erfc(x: f64) -> f64 {
    1.0 - erf(x)
}

fn erf(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let t = 1.0 / (1.0 + 0.327_591_1 * x);
    let y = 1.0
        - (((((1.061_405_429 * t - 1.453_152_027) * t) + 1.421_413_741) * t - 0.284_496_736) * t
            + 0.254_829_592)
            * t
            * (-x * x).exp();
    sign * y
}

/// Live, non-destructive "placing" preview for a pasted image: holds the
/// ORIGINAL decoded source pixels (never cumulatively re-resampled) plus the
/// user's current placement rect. `recomposite()` scales+composites this onto
/// the render-only cache every frame; the active layer's stored buffer is
/// untouched until `commit_paste_preview`. Never part of a history `Snapshot`
/// (mirrors `move_preview`).
///
/// Also doubles as the "Resize Layer" preview (`begin_layer_resize_preview`):
/// same drag/commit/cancel flow, except the source pixels are the active
/// layer's OWN current content rather than externally pasted bytes. That case
/// is flagged by `is_layer_source` so `recomposite` can hide the (otherwise
/// untouched, would-double-up) active layer, and `commit_paste_preview` can
/// replace its buffer outright instead of blending onto it.
struct PastePreview {
    pixels: Vec<u8>, // src_w × src_h RGBA, at native/original resolution
    src_w: u32,
    src_h: u32,
    dest_x: i32,
    dest_y: i32,
    dest_w: u32,
    dest_h: u32,
    /// The rect the preview STARTED at (the centered fit box). Compared with
    /// the final dest rect on commit: when they differ, the commit records the
    /// user's move/resize as its own history step after "Paste", so the sizing
    /// shows up in the History panel and undoes independently of the paste.
    init_x: i32,
    init_y: i32,
    init_w: u32,
    init_h: u32,
    is_layer_source: bool,
}

#[wasm_bindgen]
pub struct ImageHorseTool {
    /// Layer stack, bottom (index 0) → top (last). Always non-empty.
    layers: Vec<Layer>,
    /// Index of the active layer in `layers` — receives all tool edits.
    active: usize,
    next_layer_id: u32,
    /// Canvas dimensions, shared by every layer.
    width: u32,
    height: u32,
    /// Cached composite of all visible layers; `data_ptr`/`data_len` expose
    /// this to JS for a zero-copy blit. Rebuilt by `recomposite()`.
    composite_cache: Vec<u8>,
    /// Tile-engine mirror of `composite_cache`, single-document-layer scope
    /// only (see `tiles_flush`). Feature-gated (`tiles`) and NOT part of the
    /// default wasm build — see the `tiles`/`ops` module comments above.
    #[cfg(feature = "tiles")]
    tile_buf: crate::tiles::TileBuffer,
    hist: History,
    stamp: StampState,
    zoom: f64,
    // Scratch buffers reused across blur_region calls to avoid per-stroke allocation.
    blur_scratch_a: Vec<u8>,
    blur_scratch_b: Vec<u8>,
    // Cached Gaussian kernel keyed on intensity — blur strokes call into us
    // many times per second with the same intensity, so rebuilding the kernel
    // on every dab is wasted work.
    blur_kernel_cache: Option<(u32, Vec<f32>)>,
    next_text_id: u32,
    next_shape_id: u32,
    /// When a shape is being edited via the JS Figma-style overlay, it is
    /// suppressed from the composite so the live preview doesn't double up with
    /// the committed pixels. `None` when nothing is editing.
    editing_shape_id: Option<u32>,
    /// Same idea for text: while a text annotation is open in the JS textarea
    /// overlay, suppress its baked tile from the composite so the user sees only
    /// the live overlay (not a doubled copy underneath). `None` when idle.
    editing_text_id: Option<u32>,
    /// Magic-wand selection mask (one bool per pixel, row-major w×h). `None` when
    /// nothing is selected. Built by the Selection Marker tool's flood-fill /
    /// select-all; `delete_selection` clears the masked pixels.
    selection: Option<Vec<bool>>,
    /// In-progress magnetic-lasso session (edge cost map + anchors + the
    /// committed path). `None` when the lasso isn't running — which is always,
    /// unless the user is mid-loop. Ends by writing `selection` like every
    /// other selection tool; see `selection.rs`'s lasso block.
    lasso: Option<crate::livewire::LassoState>,
    /// Smart Brush: when on, a stroke is walled in by strong edges (the SECOND
    /// consumer of the shared edge cost map — the lasso is the first). Off by
    /// default; with it off the brush is byte-for-byte the one that shipped.
    smart_brush: bool,
    /// How hard an edge must be to contain a stroke (0..=255; higher = fewer
    /// walls). See `edges::is_wall`.
    smart_strength: u8,
    /// Edge cost map for the current stroke, built once at `paint_begin` — a
    /// Sobel pass per dab would be unusable. Empty when the Smart Brush is off.
    smart_cost: Vec<u16>,
    /// Per-dab scratch for the containment region-grow: reachability plane
    /// (`w*h`), the flood's stack, and the bbox-local snapshot of the coverage
    /// each dab is about to overwrite. Persistent so a 60-dab/s stroke
    /// allocates NOTHING per dab — see `accumulate_dab`.
    smart_reach: Vec<bool>,
    smart_stack: Vec<usize>,
    smart_prev: Vec<u8>,
    /// Live, non-destructive offset for the Move tool: while the user drags, the
    /// ACTIVE layer is composited shifted by this (dx, dy) without touching its
    /// stored pixels. `None` when no move is in progress. Committed by
    /// `translate_active_layer`; transient (never part of a history snapshot).
    move_preview: Option<(i32, i32)>,
    /// Live, non-destructive placement preview for a pasted image (see
    /// `PastePreview`). `None` when no placement is in progress. Committed by
    /// `commit_paste_preview`; transient (never part of a history snapshot).
    paste_preview: Option<PastePreview>,
    /// Paint stroke-stabilizer trailing tip ("lazy mouse"). Set on stroke start;
    /// advances toward the cursor only when it pulls past the leash. `None` when
    /// no stabilized stroke is active.
    paint_stab_tip: Option<(f64, f64)>,

    // ── Paint-brush stroke state ──────────────────────────────────────────
    /// Per-pixel max coverage (0..255) for the active paint stroke. Dabs combine
    /// with max(), so overlapping dabs within one stroke can't compound alpha —
    /// the whole stroke gets its opacity applied once on composite.
    paint_cov: Vec<u8>,
    /// Active-layer snapshot at stroke start; the stroke is recomposited over it
    /// each move so the rendered opacity stays exactly the slider value.
    paint_base: Vec<u8>,
    /// Stroke colour / opacity / radius — fixed for the whole stroke.
    paint_color: (u8, u8, u8),
    paint_opacity: f32,
    paint_radius: f64,
    /// Stabilizer leash in px (0 = off) + last raw-path point (non-stabilized).
    paint_leash: f64,
    paint_last: Option<(f64, f64)>,
    paint_raw: (f64, f64),
    /// Brush-edge hardness (0..1): fraction of the radius at full coverage before
    /// the smoothstep falloff. 1.0 = crisp edge, lower = softer. Shared by the
    /// paint brush and the eraser (set on `paint_down` / `erase_down`).
    paint_hardness: f32,
    /// When true the active stroke is an ERASER: instead of laying down colour it
    /// clears the active layer's alpha (coverage × opacity) toward transparent,
    /// keeping the base RGB so partial erases fade out without a colour shift.
    paint_erase: bool,
    /// When true the active stroke paints the active layer's MASK (grayscale)
    /// rather than its pixels — same dab/coverage/stabilizer engine, but the
    /// recomposite writes `paint_mask_value` into the mask. `paint_mask_base` is
    /// the mask snapshot at stroke start (keeps opacity from building up).
    paint_mask: bool,
    paint_mask_value: u8,
    paint_mask_base: Vec<u8>,

    // ── Effects-brush (blur / pixelate / redaction) stroke state ──────────
    /// 0 = blur, 1 = pixelate, 2 = redaction (set on effect_down).
    effect_mode: u8,
    effect_radius: f64,
    effect_intensity: u32,      // blur strength
    effect_pixel: u32,          // pixelate block size
    effect_color: (u8, u8, u8), // redaction fill
    effect_last: Option<(f64, f64)>,

    // ── Op-log recorder (tiles feature only — Stage 4 of tile-wiring) ─────
    /// The live operation log for the current single-layer document. Started
    /// by `load_image`; `None` for multi-layer documents. Recording is
    /// always-on when present; whether UNDO consults it is
    /// `oplog_use_for_undo` (the runtime verification switch).
    #[cfg(feature = "tiles")]
    oplog: Option<crate::ops::OpLog>,
    /// Set when the log is known stale (an unrecorded edit changed the
    /// canvas — detected by the composite-hash check at undo time, or by an
    /// explicitly unloggable path). Broken = snapshot undo only, until the
    /// next `load_image` starts a fresh log.
    #[cfg(feature = "tiles")]
    oplog_broken: bool,
    /// JS-controlled: prefer op-log replay for undo/redo when the log is
    /// consistent. Off = snapshot undo exactly as today.
    #[cfg(feature = "tiles")]
    oplog_use_for_undo: bool,
    /// In-flight paint/erase stroke being recorded: (painted polyline, brush).
    #[cfg(feature = "tiles")]
    rec_stroke: Option<(Vec<(f64, f64)>, crate::ops::Brush)>,
    /// In-flight effects stroke: (dab centres, radius, intensity, mode).
    #[cfg(feature = "tiles")]
    #[allow(clippy::type_complexity)]
    rec_effect: Option<(Vec<(f64, f64)>, f64, u32, u8)>,
}

impl ImageHorseTool {
    // ── Canvas vs content (ADR-016) ──────────────────────────────────────
    //
    // The Canvas is the artboard fill at index 0. It is a LAYER to the user
    // (visible, toggleable) and DOCUMENT METADATA to the op log, which counts
    // and indexes only CONTENT layers. Everything that used to ask
    // "is `layers.len()` 1?" or "is `layers[0]` the photo?" must ask these
    // instead — a default document is Canvas + Photo, i.e. ONE content layer.

    /// Index of the Canvas fill, if the document has one.
    pub(crate) fn canvas_idx(&self) -> Option<usize> {
        self.layers.iter().position(|l| l.is_canvas())
    }

    /// Index of the document's ONLY content layer — `None` when there are zero
    /// or several (i.e. when the document is out of op-log scope). Every op-log
    /// path reads/writes pixels through this, never `layers[0]`: with a Canvas
    /// at index 0, `layers[0]` is the fill, not the photo.
    #[cfg(feature = "tiles")]
    pub(crate) fn content_idx(&self) -> Option<usize> {
        let mut it = self
            .layers
            .iter()
            .enumerate()
            .filter(|(_, l)| !l.is_canvas());
        match (it.next(), it.next()) {
            (Some((i, _)), None) => Some(i),
            _ => None,
        }
    }

    /// The Canvas as op-log document metadata: the fill's RGBA (read from its
    /// first pixel — the fill is uniform by construction) plus the compositing
    /// state the engine applies to it. `None` when the document has no Canvas.
    ///
    /// O(1): no scan, so `recomposite` can refresh this every frame without
    /// touching the zero-copy flush budget.
    #[cfg(feature = "tiles")]
    pub(crate) fn canvas_params(&self) -> Option<crate::ops::CanvasParams> {
        let l = self.layers.get(self.canvas_idx()?)?;
        let px = l.buf.data.get(0..4).unwrap_or(&[0, 0, 0, 0]);
        Some(crate::ops::CanvasParams {
            r: px[0],
            g: px[1],
            b: px[2],
            a: px[3],
            visible: l.visible,
            opacity: l.opacity,
        })
    }

    /// Build a history snapshot of the entire current layer stack.
    fn make_snapshot(&self, label: &str) -> Snapshot {
        Snapshot {
            label: label.to_string(),
            layers: self.layers.clone(),
            active: self.active,
            width: self.width,
            height: self.height,
        }
    }

    /// Push a full-stack history snapshot. Every history-creating action
    /// (pixel edits, annotation CRUD, transforms, layer structural ops) records
    /// the whole stack so undo/redo restores layers, pixels and overlays.
    ///
    /// With the `tiles` feature this is ALSO the op-log's pre-mutation choke
    /// point: every recordable edit snaps BEFORE mutating, so this is the one
    /// safe moment to lazily capture the log's base document.
    fn snap(&mut self, label: &str) {
        #[cfg(feature = "tiles")]
        self.oplog_maybe_start();
        let s = self.make_snapshot(label);
        self.hist.push(s);
    }

    /// Replace the live state with a snapshot's layer stack (used by undo/redo).
    fn restore_snapshot(&mut self, snap: Snapshot) {
        // A snapshot restore rewinds the engine in a way an append-only op
        // log cannot represent — if a log with recorded ops exists, it is
        // now stale. Mark it broken (recording + oplog-undo stop; snapshot
        // undo continues exactly as today). An EMPTY log just rebases on
        // the next snap(), so plain undo-after-load costs nothing.
        #[cfg(feature = "tiles")]
        if self.oplog.as_ref().is_some_and(|l| !l.is_empty()) {
            self.oplog_broken = true;
        }
        self.layers = snap.layers;
        self.active = snap.active.min(self.layers.len().saturating_sub(1));
        self.width = snap.width;
        self.height = snap.height;
        // Source point may now reference out-of-bounds pixels.
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    /// Crop every layer + the document to `(x, y, w, h)` without pushing a
    /// history snapshot — callers that need one push their own label first
    /// (see `crop`) so a compound operation (e.g. delete-layer +
    /// shrink-to-content) records as a single undo step.
    pub(crate) fn crop_in_place(&mut self, x: u32, y: u32, w: u32, h: u32) {
        let (ow, oh) = (self.width, self.height);
        let mut nw = self.width;
        let mut nh = self.height;
        // Mirror `transform::crop`'s own x/y clamping so the annotation offset
        // matches the pixel crop exactly even when the requested rect
        // overhangs the canvas.
        let (dx, dy) = if ow == 0 || oh == 0 {
            (0, 0)
        } else {
            let cx = x.min(ow - 1);
            let cy = y.min(oh - 1);
            (-(cx as i32), -(cy as i32))
        };
        for layer in &mut self.layers {
            let (new_data, cw, ch) = transform::crop(&layer.buf.data, ow, oh, x, y, w, h);
            layer.buf.data = new_data;
            layer.buf.width = cw;
            layer.buf.height = ch;
            nw = cw;
            nh = ch;
            for a in &mut layer.text_annotations {
                a.x += dx;
                a.y += dy;
            }
            for s in &mut layer.shape_annotations {
                s.x0 += dx as f64;
                s.y0 += dy as f64;
                s.x1 += dx as f64;
                s.y1 += dy as f64;
                for p in &mut s.points {
                    p.0 += dx as f64;
                    p.1 += dy as f64;
                }
            }
        }
        self.width = nw;
        self.height = nh;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    /// Shrink the document to the tight bounding box of its own composite's
    /// opaque pixels. Used after the artboard's backing "Background" layer is
    /// deleted — the inverse of `set_artboard_border` / `load_image_artboard`
    /// growing one — so the padded canvas doesn't linger (and keep exporting)
    /// once its fill is gone. No-op if the composite is fully transparent, or
    /// already tight.
    pub(crate) fn shrink_to_content(&mut self) {
        let (w, h) = (self.width, self.height);
        if w == 0 || h == 0 {
            return;
        }
        let composite = composite_layers(
            &self.layers,
            w,
            h,
            self.editing_shape_id,
            self.editing_text_id,
        );
        let Some((x, y, cw, ch)) = tight_bbox(&composite, w, h) else {
            return;
        };
        if x == 0 && y == 0 && cw == w && ch == h {
            return; // Already tight — nothing to shrink.
        }
        self.crop_in_place(x, y, cw, ch);
    }

    /// Composite every layer except the Canvas fill (see
    /// `get_image_data_excluding_background`), cropped to the tight bounding
    /// box of what's left. Cropping matters — leaving the full canvas with
    /// just the fill zeroed out would still export at the padded size (a
    /// black border baked in on any format without alpha, e.g. JPEG). Falls
    /// back to the full, untrimmed composite when there's no Canvas to
    /// exclude, or nothing to crop to.
    ///
    /// Selects the Canvas by `kind`, not by name. The old name match
    /// (`layers.len() > 1 && layers[0].name == "Background"`) dropped the
    /// PHOTO of any artboard-off document that had gained a second layer —
    /// `load_image` names the photo "Background" too (ADR-016).
    fn composite_excluding_background(&self) -> (Vec<u8>, u32, u32) {
        let (w, h) = (self.width, self.height);
        // The Canvas is the bottom layer by construction, and `move_layer`
        // enforces it — so excluding it is a slice, not a copy (layer buffers
        // are full-document RGBA; cloning the stack here would cost tens of MB
        // on a large export).
        let layers: &[Layer] = if self.canvas_idx() == Some(0) && self.layers.len() > 1 {
            &self.layers[1..]
        } else {
            &self.layers[..]
        };
        let full = composite_layers(layers, w, h, self.editing_shape_id, self.editing_text_id);
        match tight_bbox(&full, w, h) {
            Some((x, y, cw, ch)) if !(x == 0 && y == 0 && cw == w && ch == h) => {
                let (cropped, ncw, nch) = transform::crop(&full, w, h, x, y, cw, ch);
                (cropped, ncw, nch)
            }
            _ => (full, w, h),
        }
    }
}

/// Tight bounding box `(x, y, w, h)` of every pixel with non-zero alpha in an
/// RGBA `w×h` buffer. `None` if every pixel is fully transparent (nothing to
/// crop to).
fn tight_bbox(data: &[u8], w: u32, h: u32) -> Option<(u32, u32, u32, u32)> {
    let (mut minx, mut miny, mut maxx, mut maxy) = (u32::MAX, u32::MAX, 0u32, 0u32);
    let mut found = false;
    for y in 0..h {
        let row = (y * w) as usize * 4;
        for x in 0..w {
            if data[row + x as usize * 4 + 3] != 0 {
                found = true;
                minx = minx.min(x);
                miny = miny.min(y);
                maxx = maxx.max(x);
                maxy = maxy.max(y);
            }
        }
    }
    found.then(|| (minx, miny, maxx - minx + 1, maxy - miny + 1))
}

#[wasm_bindgen]
impl ImageHorseTool {
    // ── Constructor & dimensions ─────────────────────────────────────────

    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> ImageHorseTool {
        let base = Layer::new(1, "Background".to_string(), width, height);
        ImageHorseTool {
            layers: vec![base],
            active: 0,
            next_layer_id: 2,
            width,
            height,
            composite_cache: Vec::new(),
            #[cfg(feature = "tiles")]
            tile_buf: crate::tiles::TileBuffer::new(width, height),
            hist: History::new(),
            stamp: StampState::new(),
            zoom: 1.0,
            blur_scratch_a: Vec::new(),
            blur_scratch_b: Vec::new(),
            blur_kernel_cache: None,
            next_text_id: 1,
            next_shape_id: 1,
            editing_shape_id: None,
            editing_text_id: None,
            selection: None,
            lasso: None,
            smart_brush: false,
            smart_strength: 128,
            smart_cost: Vec::new(),
            smart_reach: Vec::new(),
            smart_stack: Vec::new(),
            smart_prev: Vec::new(),
            move_preview: None,
            paste_preview: None,
            paint_stab_tip: None,
            paint_cov: Vec::new(),
            paint_base: Vec::new(),
            paint_color: (0, 0, 0),
            paint_opacity: 1.0,
            paint_radius: 0.0,
            paint_leash: 0.0,
            paint_last: None,
            paint_raw: (0.0, 0.0),
            paint_hardness: 0.8,
            paint_erase: false,
            paint_mask: false,
            paint_mask_value: 0,
            paint_mask_base: Vec::new(),
            effect_mode: 0,
            effect_radius: 0.0,
            effect_intensity: 8,
            effect_pixel: 12,
            effect_color: (0, 0, 0),
            effect_last: None,
            #[cfg(feature = "tiles")]
            oplog: None,
            #[cfg(feature = "tiles")]
            oplog_broken: false,
            #[cfg(feature = "tiles")]
            oplog_use_for_undo: false,
            #[cfg(feature = "tiles")]
            rec_stroke: None,
            #[cfg(feature = "tiles")]
            rec_effect: None,
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    // ── Image loading ───────────────────────────────────────────────────

    /// Load a fresh image into a single Background layer, discarding any
    /// existing layer stack, history and overlays.
    pub fn load_image(&mut self, pixels: &[u8]) {
        let mut base = Layer::new(1, "Background".to_string(), self.width, self.height);
        if !base.buf.load(pixels) {
            return;
        }
        self.layers = vec![base];
        self.active = 0;
        self.next_layer_id = 2;
        self.hist.clear();
        self.stamp.stroke_counter = 0;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
        self.next_text_id = 1;
        self.next_shape_id = 1;
        self.editing_shape_id = None;
        self.editing_text_id = None;
        // Fresh document, fresh (lazily-started) op log.
        #[cfg(feature = "tiles")]
        {
            self.oplog = None;
            self.oplog_broken = false;
            self.rec_stroke = None;
            self.rec_effect = None;
        }
    }

    /// Load an image as a two-layer "artboard" (Photoshop-style New Document with
    /// the photo placed on a canvas). The document grows to
    /// `(img_w + 2*pad) × (img_h + 2*pad)`, and the stack becomes:
    ///   • a **Canvas** layer (`LayerKind::Canvas`) — a solid `bg_*` fill
    ///     (`bg_a = 0` ⇒ transparent canvas), sized to the whole document, and
    ///   • a **Photo** layer — the incoming RGBA `pixels` pasted centred at
    ///     `(pad, pad)`, transparent elsewhere.
    /// The Photo layer is left active so the first edit targets the image, not
    /// the backing canvas. Otherwise mirrors `load_image` (clears history,
    /// stamp source, annotation counters, edit state). A `pad` of 0 yields the
    /// same document size as `load_image` but still as two layers.
    ///
    /// This is the DEFAULT import path (`canvasArtboard`), so it is the shape
    /// nearly every document has. The Canvas carries `LayerKind::Canvas`, which
    /// is what keeps the document at ONE content layer and therefore inside
    /// op-log scope (ADR-016) — before that flag, every default document was
    /// permanently out of scope and op-log undo/persistence could never run.
    #[allow(clippy::too_many_arguments)]
    pub fn load_image_artboard(
        &mut self,
        pixels: &[u8],
        img_w: u32,
        img_h: u32,
        pad: u32,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
    ) {
        if pixels.len() != (img_w as usize) * (img_h as usize) * 4 {
            return;
        }
        let doc_w = img_w + 2 * pad;
        let doc_h = img_h + 2 * pad;
        self.width = doc_w;
        self.height = doc_h;

        // Canvas fill: solid fill (skip the write when transparent — the
        // buffer is already zero-filled).
        let mut bg = Layer::new_canvas(1, doc_w, doc_h);
        if bg_a != 0 {
            for px in bg.buf.data.chunks_exact_mut(4) {
                px[0] = bg_r;
                px[1] = bg_g;
                px[2] = bg_b;
                px[3] = bg_a;
            }
        }

        // Photo layer: paste the image into a transparent full-document buffer.
        let mut photo = Layer::new(2, "Photo".to_string(), doc_w, doc_h);
        crate::transform::paste_region(
            &mut photo.buf.data,
            doc_w as i32,
            doc_h as i32,
            pixels,
            img_w,
            img_h,
            pad as i32,
            pad as i32,
        );

        self.layers = vec![bg, photo];
        self.active = 1;
        self.next_layer_id = 3;
        self.hist.clear();
        self.stamp.stroke_counter = 0;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
        self.next_text_id = 1;
        self.next_shape_id = 1;
        self.editing_shape_id = None;
        self.editing_text_id = None;
        // Canvas + Photo = ONE content layer, so this document IS in op-log
        // scope (ADR-016). Fresh document, fresh (lazily-started) log — the
        // base is captured at the first `snap()`, which is also the first
        // moment the log could need it.
        #[cfg(feature = "tiles")]
        {
            self.oplog = None;
            self.oplog_broken = false;
            self.rec_stroke = None;
            self.rec_effect = None;
        }
    }

    /// Flattened composite of all visible layers (RGBA).
    pub fn get_image_data(&self) -> Vec<u8> {
        composite_layers(
            &self.layers,
            self.width,
            self.height,
            self.editing_shape_id,
            self.editing_text_id,
        )
    }

    /// Flattened composite (RGBA), cropped to its own tight content, with the
    /// artboard's backing "Background" layer left out — same convention
    /// `resize_canvas`/`set_artboard_border` use (bottom layer, named
    /// "Background", only when the doc has more than one layer). Backs
    /// Settings → General → "Canvas background on export": off by default,
    /// the padded backing canvas is a compositional guide, not real content,
    /// so exports crop to just the photo — not the full canvas with the fill
    /// merely zeroed out. Its dimensions are
    /// `export_width_excluding_background`/`export_height_excluding_background`
    /// (same convention as `thumbnail_width`/`thumbnail_height`/
    /// `thumbnail_data`). A no-op (full, untrimmed composite) when there's no
    /// backing layer to exclude.
    pub fn get_image_data_excluding_background(&self) -> Vec<u8> {
        self.composite_excluding_background().0
    }

    /// Width of `get_image_data_excluding_background`'s cropped composite.
    pub fn export_width_excluding_background(&self) -> u32 {
        self.composite_excluding_background().1
    }

    /// Height of `get_image_data_excluding_background`'s cropped composite.
    pub fn export_height_excluding_background(&self) -> u32 {
        self.composite_excluding_background().2
    }

    /// Returns true if the flattened composite has any pixel with alpha < 255.
    pub fn has_transparency(&self) -> bool {
        self.get_image_data().chunks_exact(4).any(|px| px[3] < 255)
    }

    /// Recompute the cached composite that `data_ptr`/`data_len` expose. JS
    /// calls this before each zero-copy blit so the canvas reflects the full
    /// visible layer stack (pixels + overlays + opacity).
    pub fn recomposite(&mut self) {
        // Reuse the cache allocation across frames; take it out so we can pass
        // it as `&mut` alongside the immutable layer borrow.
        let mut cache = std::mem::take(&mut self.composite_cache);
        let move_preview = self.move_preview.map(|(dx, dy)| (self.active, dx, dy));
        // A layer-resize preview's source IS the active layer's own pixels, so
        // that layer must be hidden from the base composite below — otherwise
        // its untouched original would show through underneath the scaled
        // copy the overlay pass draws on top of it.
        let hide_layer = self
            .paste_preview
            .as_ref()
            .filter(|p| p.is_layer_source)
            .map(|_| self.active);
        composite_layers_into(
            &mut cache,
            &self.layers,
            self.width,
            self.height,
            self.editing_shape_id,
            self.editing_text_id,
            move_preview,
            hide_layer,
        );
        // Overlay the in-progress paste placement (if any) on top of the
        // flattened composite — render-only, never touches a layer's stored
        // buffer, so it stays out of undo history until `commit_paste_preview`.
        if let Some(p) = &self.paste_preview {
            let scaled = if p.dest_w == p.src_w && p.dest_h == p.src_h {
                p.pixels.clone()
            } else {
                transform::resize_nearest(&p.pixels, p.src_w, p.src_h, p.dest_w, p.dest_h)
            };
            transform::paste_region(
                &mut cache,
                self.width as i32,
                self.height as i32,
                &scaled,
                p.dest_w,
                p.dest_h,
                p.dest_x,
                p.dest_y,
            );
        }
        self.composite_cache = cache;
        // Op-log annotation sync: recomposite is the one choke point every
        // annotation mutation flows through (JS flushes after each), so a
        // cheap engine-vs-log diff here records TextAdd/Edit/Remove and
        // ShapeAdd/Edit/Remove for EVERY mutator — align, pins, shadows,
        // bezier edits included — without per-method hooks.
        #[cfg(feature = "tiles")]
        self.oplog_sync_annotations();
        #[cfg(feature = "tiles")]
        self.oplog_sync_canvas();
    }

    pub fn data_ptr(&self) -> *const u8 {
        self.composite_cache.as_ptr()
    }

    pub fn data_len(&self) -> usize {
        self.composite_cache.len()
    }

    /// Route `composite_cache` through the tile engine: single-document-layer
    /// scope only (see the field doc on `tile_buf`) — multi-layer documents
    /// return `false` and are untouched, so callers fall back to the existing
    /// flat-buffer path with zero behavior change. Call after `recomposite()`,
    /// before reading `data_ptr`/`data_len` (both keep working unchanged;
    /// this only changes what feeds them, not the JS-facing read API).
    ///
    /// First call (or any size change, e.g. crop/resize/new load) does a full
    /// `blit_from_flat` (every tile ends up dirty — there is no "previous
    /// frame" to diff against). Steady-state calls use
    /// `sync_from_flat_diffing`, so only tiles the edit actually touched end
    /// up dirty — that's what the diagnostics dirty-tile count (below)
    /// reports on.
    #[cfg(feature = "tiles")]
    pub fn tiles_flush(&mut self) -> bool {
        if self.layers.len() != 1 {
            return false;
        }
        if self.tile_buf.width() != self.width || self.tile_buf.height() != self.height {
            self.tile_buf
                .blit_from_flat(&self.composite_cache, self.width, self.height);
        } else {
            self.tile_buf.sync_from_flat_diffing(&self.composite_cache);
        }
        self.tile_buf.blit_to_flat(&mut self.composite_cache);
        true
    }

    /// Number of tiles currently marked dirty (written since the last
    /// `tiles_clear_dirty`). `0` whenever `tiles_flush` last returned `false`
    /// (multi-layer document — the tile mirror isn't being kept in sync).
    #[cfg(feature = "tiles")]
    pub fn tiles_dirty_tile_count(&self) -> usize {
        self.tile_buf.dirty_tiles().count()
    }

    /// Clear every tile's dirty flag — call once per displayed frame, after
    /// diagnostics has read `tiles_dirty_tile_count`.
    #[cfg(feature = "tiles")]
    pub fn tiles_clear_dirty(&mut self) {
        self.tile_buf.clear_dirty();
    }

    /// Whether the tile-engine flush path applies to the CURRENT document
    /// (single-layer scope — see `tiles_flush`). JS should feature-detect
    /// this method's existence first (absent entirely on a default,
    /// `tiles`-feature-off build) and then check its return value per
    /// document/layer-count change.
    #[cfg(feature = "tiles")]
    pub fn tiles_supported_for_document(&self) -> bool {
        self.layers.len() == 1
    }

    // ── Op-log recorder + replay undo (tiles feature — Stage 4) ───────────
    //
    // Recording is passive and always-on for single-layer documents: the log
    // lazily captures its BASE document at the first `snap()` (every
    // recordable edit snaps before mutating), pixel ops record at their
    // commit points (paint_up / effect_up / crop / translate), and
    // annotation ops are diffed at `recomposite()` — one choke point instead
    // of a hook per mutator.
    //
    // Undo/redo consult the log only when `oplog_use_for_undo` is on AND the
    // engine's composite hashes identical to the log's — ANY unrecorded edit
    // (clone stamp, filters, masks, pixelate/redact...) makes the check fail,
    // the log marks itself broken, and undo falls back to today's snapshot
    // path. No stage of this can strand the editor.

    /// Lazily start (or rebase an empty) op log — called from `snap()`, i.e.
    /// always BEFORE the mutation the snap precedes.
    #[cfg(feature = "tiles")]
    pub(crate) fn oplog_maybe_start(&mut self) {
        if self.oplog_broken {
            return;
        }
        if !self.oplog_in_scope() {
            // Out of scope. An EMPTY log left over from a transient
            // single-layer moment (e.g. mid-archive-restore, before the
            // layer stack is rebuilt) is stale and free to drop — keeping
            // it would make the first record on this multi-layer doc read
            // as "broken" when the log is simply inactive.
            if self.oplog.as_ref().is_some_and(|log| log.is_empty()) {
                self.oplog = None;
            }
            return;
        }
        // A missing log starts fresh; an EMPTY log rebases freely — this
        // absorbs unlogged setup edits (auto-compress, restores, resizes)
        // that happen before the first recorded op.
        if self.oplog.as_ref().is_none_or(|log| log.is_empty()) {
            self.oplog = Some(crate::ops::OpLog::with_base(self.oplog_doc_from_engine()));
        }
    }

    /// Is the current document one the op log can describe?
    ///
    /// Exactly ONE content layer, and the user is editing THAT layer. The
    /// Canvas doesn't count (ADR-016) — so the default Canvas + Photo document
    /// is in scope, while two content layers (a paste, an added layer) stay out
    /// of it, as they always have.
    ///
    /// The active-layer clause matters: the log models the content plane, so an
    /// edit aimed at the Canvas layer is an edit it cannot represent. Recording
    /// it would replay the user's brush strokes onto the photo instead of the
    /// artboard. Out of scope ⇒ unrecorded ⇒ the sync check breaks the log and
    /// snapshot undo takes over. Safe, and never silently wrong.
    #[cfg(feature = "tiles")]
    fn oplog_in_scope(&self) -> bool {
        self.content_idx() == Some(self.active)
    }

    /// Snapshot the engine's document into op-log form: the CONTENT layer's
    /// pixels + annotations, with the Canvas captured as metadata beside them
    /// (ADR-016). Reading `layers[0]` here — as this did before the Canvas had
    /// a `kind` — would snapshot the artboard fill and call it the photo.
    #[cfg(feature = "tiles")]
    fn oplog_doc_from_engine(&self) -> crate::ops::Document {
        let mut doc = crate::ops::Document::new(self.width, self.height);
        doc.canvas = self.canvas_params();
        if let Some(layer) = self.content_idx().and_then(|i| self.layers.get(i)) {
            doc.pixels
                .blit_from_flat(&layer.buf.data, layer.buf.width, layer.buf.height);
            doc.texts = layer
                .text_annotations
                .iter()
                .map(crate::ops::TextParams::from_annotation)
                .collect();
            doc.shapes = layer
                .shape_annotations
                .iter()
                .map(crate::ops::ShapeParams::from_annotation)
                .collect();
        }
        doc
    }

    /// Append a recorded op (no-op when the log is broken/absent or the
    /// document left single-CONTENT-layer scope).
    #[cfg(feature = "tiles")]
    pub(crate) fn oplog_record(&mut self, op: crate::ops::Op) {
        if self.oplog_broken {
            return;
        }
        if !self.oplog_in_scope() {
            // Document grew past the log's scope mid-session — a SECOND
            // content layer (paste, added layer), or the user selected the
            // Canvas to edit it. The Canvas itself never triggers this: it
            // isn't counted (ADR-016), which is what keeps the default
            // Canvas + Photo document recordable at all.
            //
            // A log with real recorded history can't follow layer-structure
            // changes yet → broken (snapshot undo takes over). A still-EMPTY
            // log is just stale (transient single-layer moment during an
            // archive restore) — drop it silently; the doc reads "inactive"
            // in diagnostics, not "broken".
            match self.oplog.as_ref() {
                Some(log) if !log.is_empty() => self.oplog_broken = true,
                Some(_) => self.oplog = None,
                None => {}
            }
            return;
        }
        if let Some(log) = self.oplog.as_mut() {
            log.append(op);
        }
    }

    /// Diff the engine's annotation lists against the log's and record the
    /// difference as ops. Runs at every `recomposite()` — annotation counts
    /// are tiny, so the comparison is cheap; the empty/empty fast path makes
    /// pure-paint sessions free.
    #[cfg(feature = "tiles")]
    fn oplog_sync_annotations(&mut self) {
        if self.oplog_broken || !self.oplog_in_scope() || self.oplog.is_none() {
            return;
        }
        let Some(content) = self.content_idx() else {
            return;
        };
        let mut pending: Vec<crate::ops::Op> = Vec::new();
        {
            let log_doc = self.oplog.as_ref().unwrap().live_document();
            let layer = &self.layers[content];
            if layer.text_annotations.is_empty()
                && layer.shape_annotations.is_empty()
                && log_doc.texts.is_empty()
                && log_doc.shapes.is_empty()
            {
                return;
            }
            for lt in &log_doc.texts {
                if !layer.text_annotations.iter().any(|a| a.id == lt.id) {
                    pending.push(crate::ops::Op::TextRemove { id: lt.id });
                }
            }
            for a in &layer.text_annotations {
                let params = crate::ops::TextParams::from_annotation(a);
                match log_doc.texts.iter().find(|t| t.id == a.id) {
                    None => pending.push(crate::ops::Op::TextAdd(params)),
                    Some(t) if *t != params => pending.push(crate::ops::Op::TextEdit(params)),
                    _ => {}
                }
            }
            for ls in &log_doc.shapes {
                if !layer.shape_annotations.iter().any(|s| s.id == ls.id) {
                    pending.push(crate::ops::Op::ShapeRemove { id: ls.id });
                }
            }
            for s in &layer.shape_annotations {
                let params = crate::ops::ShapeParams::from_annotation(s);
                match log_doc.shapes.iter().find(|p| p.id == s.id) {
                    None => pending.push(crate::ops::Op::ShapeAdd(params)),
                    Some(p) if *p != params => pending.push(crate::ops::Op::ShapeEdit(params)),
                    _ => {}
                }
            }
        }
        for op in pending {
            self.oplog_record(op);
        }
    }

    /// Refresh the log's Canvas metadata from the engine (ADR-016).
    ///
    /// The Canvas is metadata, so changing it — recolouring the artboard,
    /// hiding it, dropping its opacity — is NOT an op. Without this the log's
    /// composite would still carry the old fill, the sync check would find a
    /// mismatch, and a routine canvas recolour would break op-log undo for the
    /// rest of the session. With it, canvas changes are simply absorbed.
    ///
    /// O(1) and allocation-free on the flush path: `canvas_params` reads one
    /// pixel and two scalars, and the write only happens when they differ.
    #[cfg(feature = "tiles")]
    fn oplog_sync_canvas(&mut self) {
        if self.oplog_broken || self.oplog.is_none() {
            return;
        }
        let params = self.canvas_params();
        let log = self.oplog.as_mut().unwrap();
        if log.canvas() != params {
            log.set_canvas(params);
        }
    }

    /// FNV-1a over a flat byte buffer — cheap exact-sync check.
    #[cfg(feature = "tiles")]
    fn oplog_flat_hash(bytes: &[u8]) -> u64 {
        let mut h = 0xcbf2_9ce4_8422_2325u64;
        for &b in bytes {
            h ^= b as u64;
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
        h
    }

    /// Is the engine's user-visible composite byte-identical to the log's?
    /// The moment-of-truth check before any op-log undo/redo.
    #[cfg(feature = "tiles")]
    fn oplog_engine_in_sync(&mut self) -> bool {
        self.recomposite();
        let Some(log) = self.oplog.as_ref() else {
            return false;
        };
        let log_flat = log.live_document().composite_flat();
        log_flat.len() == self.composite_cache.len()
            && Self::oplog_flat_hash(&log_flat) == Self::oplog_flat_hash(&self.composite_cache)
    }

    /// Op-log undo: verify sync, keep the snapshot stacks aligned, seek the
    /// cursor back one, and restore the log's document into the engine.
    /// Returns false (leaving snapshot undo to handle it) when the log is
    /// absent/broken/at-base, a transient edit is open, or — the safety net
    /// — the sync check fails (which also breaks the log for the session).
    #[cfg(feature = "tiles")]
    fn try_oplog_undo(&mut self) -> bool {
        if self.oplog_broken || !self.oplog_in_scope() {
            return false;
        }
        if self.editing_text_id.is_some()
            || self.editing_shape_id.is_some()
            || self.move_preview.is_some()
            || self.paste_preview.is_some()
        {
            return false;
        }
        let Some(log) = self.oplog.as_ref() else {
            return false;
        };
        if log.cursor() == 0 {
            return false;
        }
        if !self.oplog_engine_in_sync() {
            self.oplog_broken = true;
            return false;
        }
        // Keep the snapshot stacks moving in lockstep (each recorded op
        // pushed exactly one snapshot), discarding the restore — the log is
        // authoritative here. This keeps the history panel + fallback sane.
        let current = self.make_snapshot("Current State");
        let _ = self.hist.undo(current);
        let n = self.oplog.as_ref().unwrap().cursor() - 1;
        self.oplog.as_mut().unwrap().seek(n);
        self.oplog_restore_into_engine();
        true
    }

    /// Op-log redo — mirror of [`try_oplog_undo`].
    #[cfg(feature = "tiles")]
    fn try_oplog_redo(&mut self) -> bool {
        if self.oplog_broken || !self.oplog_in_scope() {
            return false;
        }
        if self.editing_text_id.is_some()
            || self.editing_shape_id.is_some()
            || self.move_preview.is_some()
            || self.paste_preview.is_some()
        {
            return false;
        }
        let Some(log) = self.oplog.as_ref() else {
            return false;
        };
        if log.cursor() >= log.len() {
            return false;
        }
        if !self.oplog_engine_in_sync() {
            self.oplog_broken = true;
            return false;
        }
        let current = self.make_snapshot("Current State");
        let _ = self.hist.redo(current);
        let n = self.oplog.as_ref().unwrap().cursor() + 1;
        self.oplog.as_mut().unwrap().seek(n);
        self.oplog_restore_into_engine();
        true
    }

    /// Make the engine's Canvas layer agree with the document's Canvas metadata
    /// (ADR-016), sized to `w`×`h`: refill/insert it when the document has one,
    /// drop it when it doesn't, and guarantee a content layer survives to
    /// receive the pixels.
    ///
    /// This is what lets a persisted log restore the FULL visual: the persisted
    /// pixel plane is the content layer alone, so without rebuilding the fill a
    /// restored artboard would come back transparent where the user had a
    /// colour.
    #[cfg(feature = "tiles")]
    fn restore_canvas_layer(&mut self, canvas: Option<crate::ops::CanvasParams>, w: u32, h: u32) {
        match canvas {
            Some(c) => {
                let idx = match self.canvas_idx() {
                    Some(i) => i,
                    None => {
                        let id = self.next_layer_id;
                        self.next_layer_id = self.next_layer_id.wrapping_add(1).max(1);
                        self.layers.insert(0, Layer::new_canvas(id, w, h));
                        self.active += 1; // every existing layer shifted up one
                        0
                    }
                };
                let layer = &mut self.layers[idx];
                layer.visible = c.visible;
                layer.opacity = c.opacity;
                layer.buf = ImageBuffer::new(w, h);
                if c.a != 0 {
                    for px in layer.buf.data.chunks_exact_mut(4) {
                        px[0] = c.r;
                        px[1] = c.g;
                        px[2] = c.b;
                        px[3] = c.a;
                    }
                }
            }
            None => {
                if let Some(i) = self.canvas_idx() {
                    self.layers.remove(i);
                    if self.active > i {
                        self.active -= 1;
                    }
                    self.active = self.active.min(self.layers.len().saturating_sub(1));
                }
            }
        }
        // A document always has a content plane to write into. (Only reachable
        // if the stack was Canvas-only — e.g. the photo layer was deleted.)
        if self.content_idx().is_none() && self.layers.iter().all(|l| l.is_canvas()) {
            let id = self.next_layer_id;
            self.next_layer_id = self.next_layer_id.wrapping_add(1).max(1);
            self.layers
                .push(Layer::new(id, "Background".to_string(), w, h));
            self.active = self.layers.len() - 1;
        }
    }

    /// Write the log's live document back into the engine: pixels into the
    /// CONTENT layer, annotation lists rebuilt through the SAME
    /// `build_text_annotation` tile builder the live mutators use, and the
    /// Canvas rebuilt from the document's metadata.
    ///
    /// The write target is `content_idx()`, never `layers[0]`: on a default
    /// document `layers[0]` is the artboard fill, and blitting the photo into
    /// it would hand the user back a document with the image painted onto the
    /// canvas and the real photo layer untouched — an undo that silently
    /// corrupts. This is the sharp edge ADR-016's pre-mortem points at.
    #[cfg(feature = "tiles")]
    fn oplog_restore_into_engine(&mut self) {
        let (w, h, flat, texts, shapes, canvas) = {
            let Some(log) = self.oplog.as_ref() else {
                return;
            };
            let doc = log.live_document();
            let (w, h) = (doc.width(), doc.height());
            let mut flat = vec![0u8; (w as usize) * (h as usize) * 4];
            doc.pixels.blit_to_flat(&mut flat);
            (
                w,
                h,
                flat,
                doc.texts.clone(),
                doc.shapes.clone(),
                doc.canvas,
            )
        };
        self.width = w;
        self.height = h;
        self.restore_canvas_layer(canvas, w, h);
        // After `restore_canvas_layer` the stack has exactly the Canvas the
        // document describes, so a content layer exists at a known index.
        let Some(content) = self.content_idx() else {
            return;
        };
        let layer = &mut self.layers[content];
        layer.buf.data = flat;
        layer.buf.width = w;
        layer.buf.height = h;
        layer.text_annotations = texts
            .iter()
            .map(|t| {
                build_text_annotation(
                    t.id,
                    &t.text,
                    t.font_size,
                    t.r,
                    t.g,
                    t.b,
                    t.bold,
                    t.x,
                    t.y,
                    t.rotation_deg,
                    t.background_kind,
                    t.bg_r,
                    t.bg_g,
                    t.bg_b,
                    t.bg_a,
                    t.bg_padding,
                    t.bg_corner_radius,
                    t.bg_tail,
                    t.shadow_box,
                    t.shadow_text,
                    t.shadow_r,
                    t.shadow_g,
                    t.shadow_b,
                    t.shadow_a,
                    t.shadow_dx,
                    t.shadow_dy,
                    t.shadow_blur,
                )
            })
            .collect();
        layer.shape_annotations = shapes.iter().map(|s| s.to_annotation()).collect();
        let max_text = layer
            .text_annotations
            .iter()
            .map(|a| a.id)
            .max()
            .unwrap_or(0);
        self.next_text_id = self.next_text_id.max(max_text.wrapping_add(1).max(1));
        let max_shape = layer
            .shape_annotations
            .iter()
            .map(|s| s.id)
            .max()
            .unwrap_or(0);
        self.next_shape_id = self.next_shape_id.max(max_shape.wrapping_add(1).max(1));
        self.editing_shape_id = None;
        self.editing_text_id = None;
        self.selection = None;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    // ── Op-log wasm surface (tiles builds only; JS feature-detects) ───────

    /// Runtime switch: prefer op-log replay for undo/redo. Recording is
    /// unaffected (always on for single-layer docs on a tiles build).
    #[cfg(feature = "tiles")]
    pub fn set_oplog_undo(&mut self, enabled: bool) {
        self.oplog_use_for_undo = enabled;
    }

    /// Whether a live, unbroken log exists for the current document.
    #[cfg(feature = "tiles")]
    pub fn oplog_active(&self) -> bool {
        self.oplog.is_some() && !self.oplog_broken && self.oplog_in_scope()
    }

    /// Total recorded ops (including redoable tail past the cursor).
    #[cfg(feature = "tiles")]
    pub fn oplog_op_count(&self) -> usize {
        self.oplog.as_ref().map_or(0, |l| l.len())
    }

    /// Ops currently applied (undo moves this down, redo up).
    #[cfg(feature = "tiles")]
    pub fn oplog_cursor(&self) -> usize {
        self.oplog.as_ref().map_or(0, |l| l.cursor())
    }

    /// Keyframes resident in memory (base + up to KEYFRAMES_IN_MEMORY).
    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_count(&self) -> usize {
        self.oplog.as_ref().map_or(0, |l| l.keyframe_count())
    }

    /// WHY the log is, or is not, recording — in one short phrase for the
    /// diagnostics panel.
    ///
    /// This exists because "0 ops" is ambiguous and that ambiguity has cost real
    /// hours: a log that reads zero might be dead (the feature isn't compiled in),
    /// out of scope (a second content layer, or the Canvas selected), broken (an
    /// unrecorded edit desynced it), or simply idle (nothing edited yet). Every one
    /// of those looks identical on a counter. Say which.
    #[cfg(feature = "tiles")]
    pub fn oplog_status(&self) -> String {
        if self.oplog_broken {
            return "broken — snapshot undo has taken over".into();
        }
        if !self.oplog_in_scope() {
            return if self.content_layer_count() > 1 {
                "out of scope — more than one content layer".into()
            } else {
                // The Canvas is selected. Its edits can't be represented (the log's
                // document IS the content plane), so recording one would replay it
                // onto the photo.
                "out of scope — the Canvas layer is active".into()
            };
        }
        match self.oplog.as_ref() {
            None => "idle — no recordable edit yet".into(),
            Some(log) if log.is_empty() => "armed — base captured, no ops yet".into(),
            Some(_) => "recording".into(),
        }
    }

    /// The active layer's name — so the panel can say *which* layer an edit would
    /// land on. "Canvas" here is the tell that nothing will record.
    #[cfg(feature = "tiles")]
    pub fn active_layer_name(&self) -> String {
        self.layers
            .get(self.active)
            .map(|l| l.name.clone())
            .unwrap_or_default()
    }

    /// True once an unrecorded edit desynced the log (snapshot undo only
    /// until the next image load).
    #[cfg(feature = "tiles")]
    pub fn oplog_is_broken(&self) -> bool {
        self.oplog_broken
    }

    // ── Op-log persistence surface (night project: op log → IndexedDB) ────

    /// Persistence generation: bumps when an append drops a redo tail. The
    /// JS write path compares this to its manifest — unchanged means the
    /// persisted prefix is still valid (append the delta); changed means
    /// rewrite the photo's log.
    #[cfg(feature = "tiles")]
    pub fn oplog_generation(&self) -> u32 {
        self.oplog.as_ref().map_or(0, |l| l.generation() as u32)
    }

    /// Ops `[from, to)` framed for persistence (`[u32 LE length][frame]*`).
    /// Empty on an invalid range or no log.
    #[cfg(feature = "tiles")]
    pub fn oplog_encoded_ops(&self, from: u32, to: u32) -> Vec<u8> {
        let Some(log) = self.oplog.as_ref() else {
            return Vec::new();
        };
        let (from, to) = (from as usize, to as usize);
        if from > to || to > log.len() {
            return Vec::new();
        }
        crate::ops::encode_op_frames(&log.ops()[from..to])
    }

    /// The op-counts of keyframe documents currently resident in the log
    /// (always includes 0 — the base).
    #[cfg(feature = "tiles")]
    pub fn oplog_mem_keyframe_ops(&self) -> Vec<u32> {
        self.oplog.as_ref().map_or_else(Vec::new, |l| {
            l.keyframe_ops().iter().map(|&n| n as u32).collect()
        })
    }

    /// Flat RGBA of the COMPOSITE of the resident keyframe at `at_op`
    /// (empty if not resident). Pair with `oplog_keyframe_width/height` and
    /// `oplog_keyframe_annotations` to persist a full document snapshot.
    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_rgba(&self, at_op: u32) -> Vec<u8> {
        self.oplog
            .as_ref()
            .and_then(|l| l.keyframe_document(at_op as usize))
            .map_or_else(Vec::new, |d| d.composite_flat())
    }

    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_width(&self, at_op: u32) -> u32 {
        self.oplog
            .as_ref()
            .and_then(|l| l.keyframe_document(at_op as usize))
            .map_or(0, |d| d.width())
    }

    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_height(&self, at_op: u32) -> u32 {
        self.oplog
            .as_ref()
            .and_then(|l| l.keyframe_document(at_op as usize))
            .map_or(0, |d| d.height())
    }

    /// The keyframe document's LIVE annotation lists AND Canvas metadata,
    /// postcard-encoded — keyframe pixels alone can't restore re-editable
    /// text/shapes, nor the artboard fill (which is metadata, not pixels, and
    /// so is absent from the persisted plane entirely — ADR-016).
    /// NOTE: the keyframe RGBA above is the composite (annotations drawn
    /// in); the restore path re-renders annotations over the PIXEL plane,
    /// so it pairs this with `oplog_keyframe_pixels_rgba`.
    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_annotations(&self, at_op: u32) -> Vec<u8> {
        self.oplog
            .as_ref()
            .and_then(|l| l.keyframe_document(at_op as usize))
            .map_or_else(Vec::new, |d| {
                crate::ops::encode_annotations(&d.texts, &d.shapes, d.canvas)
            })
    }

    /// Flat RGBA of the keyframe document's PIXEL plane (no annotations) —
    /// what `oplog_restore` takes back, so live annotations don't get baked
    /// by a persist→restore round trip.
    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_pixels_rgba(&self, at_op: u32) -> Vec<u8> {
        self.oplog
            .as_ref()
            .and_then(|l| l.keyframe_document(at_op as usize))
            .map_or_else(Vec::new, |d| {
                let mut flat = vec![0u8; (d.width() as usize) * (d.height() as usize) * 4];
                d.pixels.blit_to_flat(&mut flat);
                flat
            })
    }

    /// The keyframe document's PIXEL plane as PNG bytes, encoded by the
    /// ENGINE's own codec (byte-exact round trip proven in codec.rs tests).
    /// This is the preferred persistence format: the browser-canvas PNG
    /// path (`OffscreenCanvas`/`createImageBitmap`) applies color-space and
    /// premultiplication transforms that are NOT byte-faithful — the exact
    /// corruption the 2026-07-11 real-gallery check caught. Empty when the
    /// keyframe isn't resident.
    #[cfg(feature = "tiles")]
    pub fn oplog_keyframe_png(&self, at_op: u32) -> Vec<u8> {
        self.oplog
            .as_ref()
            .and_then(|l| l.keyframe_document(at_op as usize))
            .map_or_else(Vec::new, |d| {
                let mut flat = vec![0u8; (d.width() as usize) * (d.height() as usize) * 4];
                d.pixels.blit_to_flat(&mut flat);
                crate::codec::export_png(&crate::core::ImageBuffer {
                    width: d.width(),
                    height: d.height(),
                    data: flat,
                })
            })
    }

    /// [`oplog_restore`] with the base as PNG bytes — decoded by the
    /// engine's own codec, so the whole persist→restore pixel path stays
    /// inside proven byte-exact code. Returns false (changing nothing) on
    /// a corrupt/undecodable PNG, exactly like the other validation
    /// failures.
    #[cfg(feature = "tiles")]
    pub fn oplog_restore_png(
        &mut self,
        base_png: &[u8],
        base_annotations: &[u8],
        frames: &[u8],
        cursor: u32,
    ) -> bool {
        let Ok((rgba, w, h)) = crate::codec::decode_png(base_png) else {
            return false;
        };
        self.oplog_restore(&rgba, w, h, base_annotations, frames, cursor)
    }

    /// Rebuild the op log from persisted parts — the resume path. `base_*`
    /// is the base document (PIXEL plane + encoded annotation lists),
    /// `frames` the full framed op stream, `cursor` the applied-op position
    /// the user last saw. Replays everything (rebuilding interior keyframes
    /// as it goes), seeks to `cursor`, restores the document into the
    /// engine, and clears stale history. Returns false — changing nothing —
    /// on any decode error or dimension mismatch.
    #[cfg(feature = "tiles")]
    pub fn oplog_restore(
        &mut self,
        base_rgba: &[u8],
        base_w: u32,
        base_h: u32,
        base_annotations: &[u8],
        frames: &[u8],
        cursor: u32,
    ) -> bool {
        if base_rgba.len() != (base_w as usize) * (base_h as usize) * 4 {
            return false;
        }
        // The log describes a ONE-content-layer document. If the engine is
        // holding more than that (a paste, an extra layer), restoring would
        // have to drop layers the log can't describe — so refuse and leave the
        // document alone. The Canvas is not a content layer and never trips
        // this (ADR-016).
        if self.content_layer_count() > 1 {
            return false;
        }
        let Ok(ops) = crate::ops::decode_op_frames(frames) else {
            return false;
        };
        let (texts, shapes, canvas) = if base_annotations.is_empty() {
            (Vec::new(), Vec::new(), None)
        } else {
            match crate::ops::decode_annotations(base_annotations) {
                Ok(lists) => lists,
                Err(_) => return false,
            }
        };
        if (cursor as usize) > ops.len() {
            return false;
        }
        let mut base = crate::ops::Document::new(base_w, base_h);
        base.pixels.blit_from_flat(base_rgba, base_w, base_h);
        base.texts = texts;
        base.shapes = shapes;
        base.canvas = canvas;
        let mut log = crate::ops::OpLog::with_base(base);
        for op in ops {
            log.append(op);
        }
        log.seek(cursor as usize);
        self.oplog = Some(log);
        self.oplog_broken = false;
        self.rec_stroke = None;
        self.rec_effect = None;
        self.oplog_restore_into_engine();
        // The restored document replaces whatever was loaded; pre-restore
        // snapshots reference the wrong state.
        self.hist.clear();
        true
    }

    /// FNV-1a of the current composite as hex — lets JS assert byte-exact
    /// persist→restore parity without copying pixels out.
    #[cfg(feature = "tiles")]
    pub fn composite_hash_hex(&mut self) -> String {
        self.recomposite();
        format!("{:016x}", Self::oplog_flat_hash(&self.composite_cache))
    }

    /// Per-channel histogram of the current composite (the authoritative RGBA
    /// buffer already blitted to the canvas). Returns a flat 1024-element array:
    /// `[0,256)` = R, `[256,512)` = G, `[512,768)` = B, `[768,1024)` = Luma.
    /// Fully-transparent pixels are skipped. Integer Rec.601-ish luma
    /// `(R*3 + G*6 + B) / 10` keeps it float- and allocation-free — this replaces
    /// the per-resample JS path (offscreen drawImage + getImageData + pixel loop).
    pub fn calculate_histogram(&self) -> Vec<u32> {
        let mut bins = vec![0u32; 256 * 4];
        for px in self.composite_cache.chunks_exact(4) {
            if px[3] == 0 {
                continue; // ignore fully-transparent pixels
            }
            let r = px[0] as usize;
            let g = px[1] as usize;
            let b = px[2] as usize;
            let luma = ((r * 3 + g * 6 + b) / 10).min(255);
            bins[r] += 1;
            bins[256 + g] += 1;
            bins[512 + b] += 1;
            bins[768 + luma] += 1;
        }
        bins
    }

    // ── Selection Marker (magic-wand) ────────────────────────────────────

    // ── Zoom ────────────────────────────────────────────────────────────

    pub fn set_zoom(&mut self, z: f64) {
        self.zoom = z.clamp(0.1, 10.0);
    }

    pub fn get_zoom(&self) -> f64 {
        self.zoom
    }

    pub fn adjust_zoom(&mut self, delta: f64) {
        let factor = if delta > 0.0 { 1.1 } else { 1.0 / 1.1 };
        self.zoom = (self.zoom * factor).clamp(0.1, 10.0);
    }

    // ── Stamp tool settings ─────────────────────────────────────────────

    pub fn set_source(&mut self, x: i32, y: i32) {
        self.stamp.set_source(x, y);
    }

    pub fn has_source(&self) -> bool {
        self.stamp.has_source()
    }

    pub fn set_brush_size(&mut self, size: u32) {
        self.stamp.set_brush_size(size);
    }

    pub fn get_brush_size(&self) -> u32 {
        self.stamp.brush_size
    }

    pub fn set_hardness(&mut self, h: f64) {
        self.stamp.set_hardness(h);
    }

    pub fn set_opacity(&mut self, o: f64) {
        self.stamp.set_opacity(o);
    }

    pub fn set_spacing(&mut self, s: f64) {
        self.stamp.set_spacing(s);
    }

    // ── Stroke lifecycle ────────────────────────────────────────────────

    pub fn begin_stroke(&mut self, dest_x: f64, dest_y: f64) {
        let w = self.width as i32;
        let h = self.height as i32;
        let snap = self.make_snapshot(&format!("Stamp {}", self.stamp.stroke_counter + 1));
        let active = self.active;
        let layer = &mut self.layers[active];
        self.stamp.begin_stroke(
            &mut layer.buf.data,
            w,
            h,
            &mut self.hist.redo_stack,
            dest_x,
            dest_y,
            snap,
        );
    }

    pub fn continue_stroke(&mut self, dest_x: f64, dest_y: f64) {
        let w = self.width as i32;
        let h = self.height as i32;
        self.stamp
            .continue_stroke(&mut self.layers[self.active].buf.data, w, h, dest_x, dest_y);
    }

    pub fn end_stroke(&mut self) {
        self.stamp.end_stroke(&mut self.hist);
    }

    /// Set the undo-history depth (clamped to 50–1000). Trims the oldest
    /// snapshots immediately if the cap is lowered. Driven by the General
    /// settings slider; persisted on the JS side and re-applied on load.
    pub fn set_max_history(&mut self, n: u32) {
        self.hist.set_max_history(n as usize);
    }

    // ── History ─────────────────────────────────────────────────────────

    pub fn undo(&mut self) -> bool {
        // Op-log replay path first (tiles feature + runtime switch + log
        // consistent) — falls through to snapshot undo on ANY doubt.
        #[cfg(feature = "tiles")]
        if self.oplog_use_for_undo && self.try_oplog_undo() {
            return true;
        }
        let current = self.make_snapshot("Current State");
        if let Some(snap) = self.hist.undo(current) {
            self.restore_snapshot(snap);
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        #[cfg(feature = "tiles")]
        if self.oplog_use_for_undo && self.try_oplog_redo() {
            return true;
        }
        let current = self.make_snapshot("Current State");
        if let Some(snap) = self.hist.redo(current) {
            self.restore_snapshot(snap);
            true
        } else {
            false
        }
    }

    pub fn undo_count(&self) -> usize {
        // With op-log undo enabled, the log can rewind deeper than the
        // (count/byte-capped) snapshot stack — report the larger so the UI
        // doesn't disable undo while log steps remain.
        #[cfg(feature = "tiles")]
        if self.oplog_use_for_undo && !self.oplog_broken && self.layers.len() == 1 {
            if let Some(log) = self.oplog.as_ref() {
                return self.hist.undo_count().max(log.cursor());
            }
        }
        self.hist.undo_count()
    }

    pub fn redo_count(&self) -> usize {
        #[cfg(feature = "tiles")]
        if self.oplog_use_for_undo && !self.oplog_broken && self.layers.len() == 1 {
            if let Some(log) = self.oplog.as_ref() {
                return self.hist.redo_count().max(log.len() - log.cursor());
            }
        }
        self.hist.redo_count()
    }

    pub fn history_labels(&self) -> String {
        // After an op-log RESTORE the snapshot stacks are empty (cleared —
        // they referenced pre-reload state) while the log holds the real
        // history. Synthesize the panel's labels from the ops so the
        // restored session's History panel matches its undo depth instead
        // of showing a stale/empty list.
        #[cfg(feature = "tiles")]
        if self.oplog_use_for_undo
            && !self.oplog_broken
            && self.layers.len() == 1
            && self.hist.undo_count() == 0
            && self.hist.redo_count() == 0
        {
            if let Some(log) = self.oplog.as_ref() {
                if !log.is_empty() {
                    let mut parts: Vec<String> = log.ops()[..log.cursor()]
                        .iter()
                        .map(|op| format!("undo:{}", op.label()))
                        .collect();
                    parts.push("current:Current State".to_string());
                    for op in &log.ops()[log.cursor()..] {
                        parts.push(format!("redo:{}", op.label()));
                    }
                    return parts.join("|");
                }
            }
        }
        self.hist.labels()
    }

    pub fn jump_to_history(&mut self, target_index: usize) -> bool {
        let current = self.hist.undo_count();
        if target_index == current {
            return false;
        }
        if target_index < current {
            for _ in 0..(current - target_index) {
                if !self.undo() {
                    break;
                }
            }
        } else {
            for _ in 0..(target_index - current) {
                if !self.redo() {
                    break;
                }
            }
        }
        true
    }

    pub fn delete_history_entry(&mut self, index: usize) -> bool {
        self.hist.delete_entry(index)
    }

    pub fn clear_history(&mut self) {
        self.hist.clear();
    }

    // ── History snapshot serialization (for JS-side persistence) ────────────

    pub fn undo_snapshot_count(&self) -> usize {
        self.hist.undo_stack.len()
    }

    pub fn redo_snapshot_count(&self) -> usize {
        self.hist.redo_stack.len()
    }

    pub fn get_undo_snapshot_png(&self, index: usize) -> Vec<u8> {
        match self.hist.undo_stack.get(index) {
            None => Vec::new(),
            Some(snap) => {
                let data = composite_layers(&snap.layers, snap.width, snap.height, None, None);
                let tmp = ImageBuffer {
                    width: snap.width,
                    height: snap.height,
                    data,
                };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_undo_snapshot_label(&self, index: usize) -> String {
        self.hist
            .undo_stack
            .get(index)
            .map(|s| s.label.clone())
            .unwrap_or_default()
    }

    pub fn get_redo_snapshot_png(&self, index: usize) -> Vec<u8> {
        match self.hist.redo_stack.get(index) {
            None => Vec::new(),
            Some(snap) => {
                let data = composite_layers(&snap.layers, snap.width, snap.height, None, None);
                let tmp = ImageBuffer {
                    width: snap.width,
                    height: snap.height,
                    data,
                };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_redo_snapshot_label(&self, index: usize) -> String {
        self.hist
            .redo_stack
            .get(index)
            .map(|s| s.label.clone())
            .unwrap_or_default()
    }

    /// Append a raw-RGBA snapshot to the undo stack (used when restoring a
    /// session). The snapshot is reconstructed as a single Background layer;
    /// annotations start empty — the JS side adds them one by one with
    /// `push_annotation_to_undo_snapshot` after this returns. (Multi-layer
    /// history is not yet persisted; restored snapshots are single-layer.)
    pub fn inject_undo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        let layer = Layer {
            id: 1,
            name: "Background".to_string(),
            // A restored snapshot is a flattened single plane — content, not a
            // Canvas. "Background" here means the photo (ADR-016).
            kind: crate::layer::LayerKind::Content,
            visible: true,
            opacity: 1.0,
            buf: ImageBuffer {
                width: w,
                height: h,
                data: data.to_vec(),
            },
            mask: None,
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        };
        self.hist.undo_stack.push_back(Snapshot {
            label: label.to_string(),
            layers: vec![layer],
            active: 0,
            width: w,
            height: h,
        });
    }

    /// Append a raw-RGBA snapshot to the redo stack (used when restoring a session).
    pub fn inject_redo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        let layer = Layer {
            id: 1,
            name: "Background".to_string(),
            kind: crate::layer::LayerKind::Content,
            visible: true,
            opacity: 1.0,
            buf: ImageBuffer {
                width: w,
                height: h,
                data: data.to_vec(),
            },
            mask: None,
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        };
        self.hist.redo_stack.push(Snapshot {
            label: label.to_string(),
            layers: vec![layer],
            active: 0,
            width: w,
            height: h,
        });
    }

    /// Per-snapshot annotation state as JSON (active layer's text annotations).
    /// Mirrors `get_text_annotations` so JS can read snapshot overlays with the
    /// same parser. Used by the persistence layer for round-trip saves.
    pub fn get_undo_snapshot_annotations(&self, index: usize) -> String {
        match self
            .hist
            .undo_stack
            .get(index)
            .and_then(|s| s.layers.get(s.active))
        {
            None => String::from("[]"),
            Some(layer) => annotations_to_json(&layer.text_annotations),
        }
    }

    pub fn get_redo_snapshot_annotations(&self, index: usize) -> String {
        match self
            .hist
            .redo_stack
            .get(index)
            .and_then(|s| s.layers.get(s.active))
        {
            None => String::from("[]"),
            Some(layer) => annotations_to_json(&layer.text_annotations),
        }
    }

    /// Push one annotation onto the undo-snapshot at `snap_idx`. The tile is
    /// rebuilt from the config so the persistence layer doesn't have to store
    /// pre-rotated tile bytes. Returns false if the index is out of range.
    pub fn push_annotation_to_undo_snapshot(
        &mut self,
        snap_idx: usize,
        text: &str,
        font_size: f32,
        r: u8,
        g: u8,
        b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u32,
    ) -> bool {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id,
            text,
            font_size,
            r,
            g,
            b,
            bold,
            x,
            y,
            rotation_deg,
            background_kind,
            bg_r,
            bg_g,
            bg_b,
            bg_a,
            bg_padding,
            bg_corner_radius,
            bg_tail,
            false,
            false,
            0,
            0,
            0,
            0,
            0,
            0,
            0, // shadow off; set via set_text_shadow
        );
        match self.hist.undo_stack.get_mut(snap_idx) {
            None => false,
            Some(snap) => {
                let a = snap.active;
                match snap.layers.get_mut(a) {
                    Some(layer) => {
                        layer.text_annotations.push(ann);
                        true
                    }
                    None => false,
                }
            }
        }
    }

    pub fn push_annotation_to_redo_snapshot(
        &mut self,
        snap_idx: usize,
        text: &str,
        font_size: f32,
        r: u8,
        g: u8,
        b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u32,
    ) -> bool {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id,
            text,
            font_size,
            r,
            g,
            b,
            bold,
            x,
            y,
            rotation_deg,
            background_kind,
            bg_r,
            bg_g,
            bg_b,
            bg_a,
            bg_padding,
            bg_corner_radius,
            bg_tail,
            false,
            false,
            0,
            0,
            0,
            0,
            0,
            0,
            0, // shadow off; set via set_text_shadow
        );
        match self.hist.redo_stack.get_mut(snap_idx) {
            None => false,
            Some(snap) => {
                let a = snap.active;
                match snap.layers.get_mut(a) {
                    Some(layer) => {
                        layer.text_annotations.push(ann);
                        true
                    }
                    None => false,
                }
            }
        }
    }

    // ── Codec ───────────────────────────────────────────────────────────

    pub fn export_png(&self) -> Vec<u8> {
        let tmp = ImageBuffer {
            width: self.width,
            height: self.height,
            data: self.get_image_data(),
        };
        codec::export_png(&tmp)
    }

    pub fn thumbnail_width(&self, max_px: u32) -> u32 {
        codec::thumb_dims(self.width, self.height, max_px).0
    }

    pub fn thumbnail_height(&self, max_px: u32) -> u32 {
        codec::thumb_dims(self.width, self.height, max_px).1
    }

    pub fn thumbnail_data(&self, max_px: u32) -> Vec<u8> {
        let tmp = ImageBuffer {
            width: self.width,
            height: self.height,
            data: self.get_image_data(),
        };
        codec::thumbnail_data(&tmp, max_px).0
    }

    // ── Transforms ──────────────────────────────────────────────────────

    pub fn flip_horizontal(&mut self) {
        self.snap("Flip H");
        let w = self.width as usize;
        let h = self.height as usize;
        for layer in &mut self.layers {
            transform::flip_horizontal(&mut layer.buf.data, w, h);
        }
        if let Some(sx) = self.stamp.source_x {
            self.stamp.source_x = Some(self.width as i32 - 1 - sx);
        }
    }

    pub fn flip_vertical(&mut self) {
        self.snap("Flip V");
        let w = self.width as usize;
        let h = self.height as usize;
        for layer in &mut self.layers {
            transform::flip_vertical(&mut layer.buf.data, w, h);
        }
        if let Some(sy) = self.stamp.source_y {
            self.stamp.source_y = Some(self.height as i32 - 1 - sy);
        }
    }

    pub fn rotate_90_cw(&mut self) {
        self.snap("Rotate 90° CW");
        let (ow, oh) = (self.width as usize, self.height as usize);
        for layer in &mut self.layers {
            let (new_data, new_w, new_h) = transform::rotate_90_cw(&layer.buf.data, ow, oh);
            layer.buf.data = new_data;
            layer.buf.width = new_w;
            layer.buf.height = new_h;
        }
        std::mem::swap(&mut self.width, &mut self.height);
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn rotate_90_ccw(&mut self) {
        self.snap("Rotate 90° CCW");
        let (ow, oh) = (self.width as usize, self.height as usize);
        for layer in &mut self.layers {
            let (new_data, new_w, new_h) = transform::rotate_90_ccw(&layer.buf.data, ow, oh);
            layer.buf.data = new_data;
            layer.buf.width = new_w;
            layer.buf.height = new_h;
        }
        std::mem::swap(&mut self.width, &mut self.height);
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.snap("Crop");
        self.crop_in_place(x, y, w, h);
        #[cfg(feature = "tiles")]
        self.oplog_record(crate::ops::Op::Crop {
            rect: crate::ops::Rect {
                x: x as i32,
                y: y as i32,
                w,
                h,
            },
        });
    }

    /// Preview crop overlay in WASM.
    /// Saves a snapshot, applies darkening overlay + dashed border.
    /// Call cancel_crop_preview() or apply_crop_from_preview() when done.
    pub fn preview_crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.snap("Crop Preview");
        transform::apply_crop_overlay(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            x,
            y,
            w,
            h,
            0.5,
        );
        transform::draw_crop_border(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            x,
            y,
            w,
            h,
            [255, 255, 255, 200],
            5,
            5,
        );
    }

    /// Remove the crop preview (undo the snapshot pushed by preview_crop).
    pub fn cancel_crop_preview(&mut self) -> bool {
        self.undo()
    }

    /// Apply crop after preview: undo preview first, then crop for real.
    pub fn apply_crop_from_preview(&mut self, x: u32, y: u32, w: u32, h: u32) {
        // Drop the preview snapshot/overlay, then crop the real pixels.
        self.undo();
        self.crop(x, y, w, h);
    }

    pub fn copy_region(&self, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
        transform::copy_region(
            &self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
            x,
            y,
            w,
            h,
        )
    }

    pub fn paste_region(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
    ) {
        self.snap("Paste");
        transform::paste_region(
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
            pixels,
            src_w,
            src_h,
            dest_x,
            dest_y,
        );
    }

    // ── Resize ───────────────────────────────────────────────────────────

    pub fn resize(&mut self, new_w: u32, new_h: u32) {
        self.resize_with_filter(new_w, new_h, 1);
    }

    /// Resize with a selectable resampling filter.
    /// 0 = nearest, 1 = bilinear, 2 = catmull-rom, 3 = lanczos3.
    /// Unknown codes fall back to bilinear.
    pub fn resize_with_filter(&mut self, new_w: u32, new_h: u32, filter: u8) {
        if new_w == 0 || new_h == 0 {
            return;
        }
        self.snap("Resize");
        let (ow, oh) = (self.width, self.height);
        for layer in &mut self.layers {
            let resized = match filter {
                0 => transform::resize_nearest(&layer.buf.data, ow, oh, new_w, new_h),
                2 => transform::resize_catmull_rom(&layer.buf.data, ow, oh, new_w, new_h),
                3 => transform::resize_lanczos3(&layer.buf.data, ow, oh, new_w, new_h),
                _ => transform::resize_bilinear(&layer.buf.data, ow, oh, new_w, new_h),
            };
            layer.buf.data = resized;
            layer.buf.width = new_w;
            layer.buf.height = new_h;
        }
        self.width = new_w;
        self.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    /// Photoshop-style **Canvas Size**: change the document to `new_w × new_h`
    /// WITHOUT resampling any layer's pixels. Each layer's existing buffer is
    /// re-blitted onto a fresh `new_w × new_h` buffer at the anchor offset, so
    /// content keeps its native resolution — it is cropped where the new canvas
    /// is smaller and surrounded by empty (transparent) space where it is
    /// larger. This is the backing-canvas resize the "Canvas Size" control
    /// wants, as opposed to `resize_with_filter` which resamples every layer.
    ///
    /// `anchor` is a 0..=8 Photoshop nine-grid position
    /// (`0` TL, `1` TC, `2` TR, `3` ML, `4` MC, `5` MR, `6` BL, `7` BC, `8` BR);
    /// `4` (centre) is the default the UI uses. The offset is the position of
    /// the old top-left within the new canvas: each axis is flush at the start
    /// (`col/row 0`), centred (`1`), or flush at the end (`2`).
    ///
    /// The bottom **Background** layer of a multi-layer document (the solid
    /// backing canvas built by `load_image_artboard`) is rebuilt to the full
    /// new size filled with `bg_*` (`bg_a = 0` ⇒ transparent ⇒ checkerboard,
    /// matching that function's convention). A single-layer photo-only document
    /// keeps its one layer anchored on a transparent canvas — its pixels are
    /// preserved byte-for-byte, never resampled. Per-layer masks and live
    /// text/shape annotations travel with their layer by the same anchor
    /// offset. Pushes one undoable "Canvas Size" snapshot.
    pub fn resize_canvas(
        &mut self,
        new_w: u32,
        new_h: u32,
        anchor: u8,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
    ) {
        // Zero dimensions are invalid. A same-size call is intentionally NOT
        // short-circuited: it re-fills the backing layer (so a backing-colour
        // change with an unchanged border still repaints) while preserving the
        // content layers byte-for-byte at offset 0.
        if new_w == 0 || new_h == 0 {
            return;
        }
        self.snap("Canvas Size");
        let (ow, oh) = (self.width as i32, self.height as i32);
        let (nw, nh) = (new_w as i32, new_h as i32);

        // Anchor → where the old top-left lands in the new canvas. `col`/`row`
        // pick 0 = flush start, 1 = centred, 2 = flush end on each axis.
        let col = (anchor % 3) as i32;
        let row = (anchor / 3) as i32;
        let off_x = match col {
            0 => 0,
            1 => (nw - ow) / 2,
            _ => nw - ow,
        };
        let off_y = match row {
            0 => 0,
            1 => (nh - oh) / 2,
            _ => nh - oh,
        };

        // Only the Canvas fill is refilled to the new size; every content layer
        // is anchored and preserved byte-for-byte. Keyed on `kind`, so a
        // photo-only document (whose sole layer `load_image` also names
        // "Background") can never be mistaken for a backing fill and
        // overwritten — ADR-016.
        for layer in self.layers.iter_mut() {
            let is_backing = layer.is_canvas();
            let mut nbuf = vec![0u8; (new_w as usize) * (new_h as usize) * 4];
            if is_backing {
                // Solid backing canvas: refill the whole new document (skip the
                // write when transparent — the buffer is already zero-filled).
                if bg_a != 0 {
                    for px in nbuf.chunks_exact_mut(4) {
                        px[0] = bg_r;
                        px[1] = bg_g;
                        px[2] = bg_b;
                        px[3] = bg_a;
                    }
                }
            } else {
                // Re-blit native pixels at the anchor (cropped where smaller,
                // transparent padding where larger). Pasting onto a zeroed
                // buffer preserves every source pixel exactly — no resample.
                transform::paste_region(
                    &mut nbuf,
                    nw,
                    nh,
                    &layer.buf.data,
                    layer.buf.width,
                    layer.buf.height,
                    off_x,
                    off_y,
                );
                // Live overlays travel with the layer content.
                for a in &mut layer.text_annotations {
                    a.x += off_x;
                    a.y += off_y;
                }
                for s in &mut layer.shape_annotations {
                    s.x0 += off_x as f64;
                    s.y0 += off_y as f64;
                    s.x1 += off_x as f64;
                    s.y1 += off_y as f64;
                    for p in &mut s.points {
                        p.0 += off_x as f64;
                        p.1 += off_y as f64;
                    }
                }
            }
            layer.buf.data = nbuf;
            layer.buf.width = new_w;
            layer.buf.height = new_h;

            // A mask is one grayscale byte per pixel sized to the canvas; re-blit
            // it at the same anchor (revealed in any freshly exposed area) so it
            // stays aligned with the layer it scales.
            if let Some(old_mask) = layer.mask.take() {
                if old_mask.len() == (ow as usize) * (oh as usize) {
                    let mut nmask = vec![255u8; (new_w as usize) * (new_h as usize)];
                    for sy in 0..oh {
                        let ty = sy + off_y;
                        if ty < 0 || ty >= nh {
                            continue;
                        }
                        for sx in 0..ow {
                            let tx = sx + off_x;
                            if tx < 0 || tx >= nw {
                                continue;
                            }
                            nmask[(ty * nw + tx) as usize] = old_mask[(sy * ow + sx) as usize];
                        }
                    }
                    layer.mask = Some(nmask);
                }
            }
        }

        self.width = new_w;
        self.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
        self.editing_shape_id = None;
        self.editing_text_id = None;
        self.recomposite();
    }

    /// Normalize the current document to an **artboard**: the photo content at
    /// its native size, centred, with a uniform `pad`-px border filled with
    /// `bg_*` (`bg_a = 0` ⇒ transparent ⇒ checkerboard). This is the IDEMPOTENT,
    /// ABSOLUTE counterpart to the old delta-based live border — calling it with
    /// the same `pad` always yields exactly
    /// `photoW + 2*pad × photoH + 2*pad`, regardless of the current canvas size.
    /// A "jumbo" document therefore snaps straight back to photo + border, and
    /// repeated calls never accumulate (idempotent).
    ///
    /// The PHOTO content is the tight non-transparent bounding box of the photo
    /// layer (the first CONTENT layer; for a single-layer photo-only doc, the
    /// sole layer). The document is rebuilt to that box plus `2*pad` on every
    /// side WITHOUT resampling (the photo's pixels are re-blitted at the border
    /// offset), the bottom **Canvas** layer is refilled solid to the full new
    /// size, and the photo is placed at `(pad, pad)`. A document that has no
    /// Canvas yet grows one (so artboard-on always ends up as a Canvas + Photo
    /// pair). Per-layer masks and live text/shape annotations travel with their
    /// layer by the same offset. Pushes one undoable "Canvas Border" snapshot;
    /// recomposites.
    pub fn set_artboard_border(&mut self, pad: u32, bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8) {
        let ow = self.width;
        let oh = self.height;
        if ow == 0 || oh == 0 || self.layers.is_empty() {
            return;
        }

        // Whether a Canvas fill already sits at the bottom, and which layer
        // holds the photo. Both keyed on `kind`, not name (ADR-016): the photo
        // is the bottom-most CONTENT layer, whether it is called "Photo" (an
        // artboard import) or "Background" (a `load_image` document).
        let backing_present = self.canvas_idx() == Some(0);
        let photo_idx = self.layers.iter().position(|l| !l.is_canvas()).unwrap_or(0);

        // Tight non-transparent bounding box of the photo layer = its native
        // size and position within the current document.
        let (bx, by, pw, ph) = {
            let data = &self.layers[photo_idx].buf.data;
            let (mut minx, mut miny, mut maxx, mut maxy) = (u32::MAX, u32::MAX, 0u32, 0u32);
            let mut found = false;
            for y in 0..oh {
                let row = (y * ow) as usize * 4;
                for x in 0..ow {
                    if data[row + x as usize * 4 + 3] != 0 {
                        found = true;
                        minx = minx.min(x);
                        miny = miny.min(y);
                        maxx = maxx.max(x);
                        maxy = maxy.max(y);
                    }
                }
            }
            if found {
                (minx, miny, maxx - minx + 1, maxy - miny + 1)
            } else {
                // Fully transparent photo layer — fall back to the whole canvas.
                (0, 0, ow, oh)
            }
        };

        let new_w = pw + 2 * pad;
        let new_h = ph + 2 * pad;
        // Offset that lands the photo's top-left at (pad, pad) in the new doc.
        let off_x = pad as i32 - bx as i32;
        let off_y = pad as i32 - by as i32;

        self.snap("Canvas Border");

        // Ensure a Canvas exists at the bottom. A canvas-less doc (fresh
        // single-layer photo) grows one; the former content is renamed "Photo"
        // — a display name now, not an identifier: `kind` is what the engine
        // reads.
        if !backing_present {
            let id = self.next_layer_id;
            self.next_layer_id = self.next_layer_id.wrapping_add(1).max(1);
            self.layers.insert(0, Layer::new_canvas(id, ow, oh));
            self.active += 1; // every existing layer shifted up one slot
            if let Some(content) = self.layers.get_mut(1) {
                content.name = "Photo".to_string();
            }
        }

        // Reframe every layer into the new document. Layer 0 is now always the
        // Canvas (refilled, never resampled); every other layer's pixels,
        // overlays and mask travel by the border offset (no resample).
        for layer in self.layers.iter_mut() {
            let mut nbuf = vec![0u8; (new_w as usize) * (new_h as usize) * 4];
            if layer.is_canvas() {
                if bg_a != 0 {
                    for px in nbuf.chunks_exact_mut(4) {
                        px[0] = bg_r;
                        px[1] = bg_g;
                        px[2] = bg_b;
                        px[3] = bg_a;
                    }
                }
            } else {
                transform::paste_region(
                    &mut nbuf,
                    new_w as i32,
                    new_h as i32,
                    &layer.buf.data,
                    layer.buf.width,
                    layer.buf.height,
                    off_x,
                    off_y,
                );
                for a in &mut layer.text_annotations {
                    a.x += off_x;
                    a.y += off_y;
                }
                for s in &mut layer.shape_annotations {
                    s.x0 += off_x as f64;
                    s.y0 += off_y as f64;
                    s.x1 += off_x as f64;
                    s.y1 += off_y as f64;
                    for p in &mut s.points {
                        p.0 += off_x as f64;
                        p.1 += off_y as f64;
                    }
                }
            }
            layer.buf.data = nbuf;
            layer.buf.width = new_w;
            layer.buf.height = new_h;

            if let Some(old_mask) = layer.mask.take() {
                if old_mask.len() == (ow as usize) * (oh as usize) {
                    let mut nmask = vec![255u8; (new_w as usize) * (new_h as usize)];
                    for sy in 0..oh as i32 {
                        let ty = sy + off_y;
                        if ty < 0 || ty >= new_h as i32 {
                            continue;
                        }
                        for sx in 0..ow as i32 {
                            let tx = sx + off_x;
                            if tx < 0 || tx >= new_w as i32 {
                                continue;
                            }
                            nmask[(ty * new_w as i32 + tx) as usize] =
                                old_mask[(sy * ow as i32 + sx) as usize];
                        }
                    }
                    layer.mask = Some(nmask);
                }
            }
        }

        self.width = new_w;
        self.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
        self.editing_shape_id = None;
        self.editing_text_id = None;
        self.recomposite();
    }

    /// Record a "Compress" entry in the history without changing pixels.
    /// Used when Apply Compression & Resize re-encodes at a new quality or
    /// format but the dimensions are unchanged — the stored file changed, so
    /// the action should appear in the History panel even though undoing it
    /// is a visual no-op.
    pub fn push_compress_marker(&mut self) {
        self.snap("Compress");
    }

    // ── Filters ─────────────────────────────────────────────────────────

    pub fn adjust_brightness(&mut self, delta: f64) {
        self.snap("Brightness");
        filters::adjust_brightness(&mut self.layers[self.active].buf.data, delta);
    }

    pub fn adjust_contrast(&mut self, factor: f64) {
        self.snap("Contrast");
        filters::adjust_contrast(&mut self.layers[self.active].buf.data, factor);
    }

    /// Saturation: 0 = grayscale, 1 = unchanged, >1 = more saturated (grayscale-
    /// lerp against the pixel's own BT.601 luminance — same technique as CSS
    /// `filter: saturate()`).
    pub fn adjust_saturation(&mut self, factor: f64) {
        self.snap("Saturation");
        filters::adjust_saturation(&mut self.layers[self.active].buf.data, factor);
    }

    /// Shadows: additive brightness shift masked to peak in dark tones.
    /// Positive `amount` lifts (brightens) shadows.
    pub fn adjust_shadows(&mut self, amount: f64) {
        self.snap("Shadows");
        filters::adjust_shadows(&mut self.layers[self.active].buf.data, amount);
    }

    /// Highlights: additive brightness shift masked to peak in bright tones.
    /// Positive `amount` RECOVERS (darkens) blown highlights.
    pub fn adjust_highlights(&mut self, amount: f64) {
        self.snap("Highlights");
        filters::adjust_highlights(&mut self.layers[self.active].buf.data, amount);
    }

    /// Unsharp-mask sharpen over the whole active layer. `amount` 0 = no
    /// sharpening; reasonable range ~0..3.
    pub fn adjust_sharpen(&mut self, amount: f64) {
        self.snap("Sharpen");
        filters::sharpen(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            amount,
        );
    }

    /// Stamp raw RGBA emoji pixels onto the image buffer at (dest_x, dest_y).
    /// The JS side renders the emoji to an OffscreenCanvas, extracts the pixels,
    /// and passes them here for alpha-compositing onto the WASM buffer.
    /// This keeps compositing in Rust (fast) while JS handles text rendering
    /// (which needs browser font/emoji support).
    pub fn stamp_pixels(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
    ) {
        self.snap("Emoji");
        transform::paste_region(
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
            pixels,
            src_w,
            src_h,
            dest_x,
            dest_y,
        );
    }
    /// Like stamp_pixels but scales the source to `target_size × target_size`
    /// first (bilinear), then composites it centered on (dest_x, dest_y).
    /// Pushes "Red Stamp" to history (not "Emoji").
    pub fn stamp_red(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
        target_size: u32,
    ) {
        self.snap("Red Stamp");
        // Scale stamp to target_size preserving aspect ratio
        let scale = target_size as f64 / src_w.max(src_h) as f64;
        let new_w = ((src_w as f64 * scale).round() as u32).max(1);
        let new_h = ((src_h as f64 * scale).round() as u32).max(1);
        let scaled = transform::resize_bilinear(pixels, src_w, src_h, new_w, new_h);
        // Center on dest
        let cx = dest_x - (new_w as i32 / 2);
        let cy = dest_y - (new_h as i32 / 2);
        transform::paste_region(
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
            &scaled,
            new_w,
            new_h,
            cx,
            cy,
        );
    }

    /// DEPRECATED: prefer `add_text_annotation` + `flatten_text_annotations`
    /// for the re-editable overlay flow. Kept as a one-shot direct-to-pixels
    /// fallback for callers that don't need re-edit.
    ///
    /// Render text entirely in Rust (Liberation Sans, embedded font) and
    /// composite it onto the image buffer at (dest_x, dest_y).
    /// Replaces the JS OffscreenCanvas → stamp_pixels pipeline for the text tool.
    /// `dest_x/dest_y` is the top-left corner of the unrotated text block.
    /// `angle_deg` rotates the rendered text clockwise (positive) around its centre.
    pub fn commit_text(
        &mut self,
        text: &str,
        font_size: f32,
        r: u8,
        g: u8,
        b: u8,
        bold: bool,
        dest_x: i32,
        dest_y: i32,
        angle_deg: f32,
    ) {
        let rendered = crate::text::render_text(text, font_size, r, g, b, bold);
        self.snap("Text");

        if angle_deg.abs() < 0.5 {
            transform::paste_region(
                &mut self.layers[self.active].buf.data,
                self.width as i32,
                self.height as i32,
                &rendered.pixels,
                rendered.width,
                rendered.height,
                dest_x,
                dest_y,
            );
        } else {
            // Rotate around the text centre. rotate_pixels(+θ) is clockwise,
            // matching the CSS `rotate(${angle}deg)` preview, so pass as-is.
            let cx = dest_x + rendered.width as i32 / 2;
            let cy = dest_y + rendered.height as i32 / 2;
            let rotated = crate::text::rotate_pixels(
                &rendered.pixels,
                rendered.width,
                rendered.height,
                angle_deg,
            );
            let paste_x = cx - rotated.width as i32 / 2;
            let paste_y = cy - rotated.height as i32 / 2;
            transform::paste_region(
                &mut self.layers[self.active].buf.data,
                self.width as i32,
                self.height as i32,
                &rotated.pixels,
                rotated.width,
                rotated.height,
                paste_x,
                paste_y,
            );
        }
    }

    /// Returns [width, height] in pixels of the text as rendered by `commit_text`,
    /// without modifying the image buffer. Used to size the text-input handle box.
    pub fn measure_text(&self, text: &str, font_size: f32, bold: bool) -> Vec<u32> {
        let (w, h) = crate::text::measure(text, font_size, bold);
        vec![w, h]
    }

    /// Render a stamp label (e.g. "REJECTED") in Rust, scale it to
    /// `target_size`, and composite it centred on (dest_x, dest_y).
    /// Replaces the JS OffscreenCanvas → stamp_red pipeline for red stamps.
    pub fn commit_red_stamp(
        &mut self,
        label: &str,
        r: u8,
        g: u8,
        b: u8,
        dest_x: i32,
        dest_y: i32,
        target_size: u32,
        angle_deg: f32,
    ) {
        let font_size = 48.0f32;
        let rendered = crate::text::render_stamp_label(label, font_size, r, g, b, angle_deg);
        // Scale to target_size preserving aspect ratio
        let scale = target_size as f64 / rendered.width.max(rendered.height) as f64;
        let new_w = ((rendered.width as f64 * scale).round() as u32).max(1);
        let new_h = ((rendered.height as f64 * scale).round() as u32).max(1);
        let scaled = transform::resize_bilinear(
            &rendered.pixels,
            rendered.width,
            rendered.height,
            new_w,
            new_h,
        );
        self.snap("Red Stamp");
        transform::paste_region(
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
            &scaled,
            new_w,
            new_h,
            dest_x - new_w as i32 / 2,
            dest_y - new_h as i32 / 2,
        );
    }

    // ── Color picker helpers ─────────────────────────────────────────────

    /// Returns [r, g, b, a] for the pixel at (x, y), clamped to image bounds.
    pub fn get_pixel(&self, x: i32, y: i32) -> Vec<u8> {
        let w = self.width as i32;
        let h = self.height as i32;
        if w == 0 || h == 0 || x < 0 || y < 0 || x >= w || y >= h {
            return vec![0, 0, 0, 255];
        }
        let idx = (y as usize * self.width as usize + x as usize) * 4;
        self.layers[self.active].buf.data[idx..idx + 4].to_vec()
    }

    /// Returns a flat RGBA grid of (2*radius+1)² pixels centred on (cx, cy).
    /// Out-of-bounds pixels are returned as opaque black.
    pub fn get_pixel_region(&self, cx: i32, cy: i32, radius: i32) -> Vec<u8> {
        let side = 2 * radius + 1;
        let mut out = Vec::with_capacity((side * side * 4) as usize);
        let w = self.width as i32;
        let h = self.height as i32;
        for row in 0..side {
            for col in 0..side {
                let px = cx - radius + col;
                let py = cy - radius + row;
                if w == 0 || h == 0 || px < 0 || py < 0 || px >= w || py >= h {
                    out.extend_from_slice(&[0, 0, 0, 255]);
                } else {
                    let idx = (py as usize * self.width as usize + px as usize) * 4;
                    out.extend_from_slice(&self.layers[self.active].buf.data[idx..idx + 4]);
                }
            }
        }
        out
    }
}

/// Stateless: composite `src` onto a copy of `target` at (dx, dy) with `opacity` (0.0..=1.0).
/// Returns the new buffer. Used by the bulk-logo feature to stamp a logo onto many photos
/// without disturbing the active canvas state.
///
/// `target` is `tw*th*4` RGBA bytes, `src` is `sw*sh*4` RGBA bytes. If lengths don't match,
/// `target` is returned unchanged.
#[wasm_bindgen]
pub fn composite_pixels(
    target: &[u8],
    tw: u32,
    th: u32,
    src: &[u8],
    sw: u32,
    sh: u32,
    dx: i32,
    dy: i32,
    opacity: f64,
) -> Vec<u8> {
    let expected_target = (tw as usize) * (th as usize) * 4;
    let expected_src = (sw as usize) * (sh as usize) * 4;
    if target.len() != expected_target {
        return target.to_vec();
    }
    let mut out = target.to_vec();
    if src.len() != expected_src {
        return out;
    }
    let op = opacity.clamp(0.0, 1.0);
    if (op - 1.0).abs() < 1e-6 {
        transform::paste_region(&mut out, tw as i32, th as i32, src, sw, sh, dx, dy);
    } else if op > 0.0 {
        // Pre-scale src alpha by opacity so paste_region's alpha-compositing applies it.
        let mut scaled = src.to_vec();
        let mut i = 3;
        while i < scaled.len() {
            scaled[i] = ((scaled[i] as f64) * op).round().clamp(0.0, 255.0) as u8;
            i += 4;
        }
        transform::paste_region(&mut out, tw as i32, th as i32, &scaled, sw, sh, dx, dy);
    }
    out
}

/// Stateless bilinear resize of an RGBA buffer. Used by the batch-logo feature
/// to scale logos to a target width without round-tripping through OffscreenCanvas.
#[wasm_bindgen]
pub fn resize_pixels(pixels: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    transform::resize_bilinear(pixels, old_w, old_h, new_w, new_h)
}

/// Stateless filtered resize. `filter`: 0 = nearest, 2 = Catmull-Rom,
/// 3 = Lanczos3, anything else = bilinear. A pure pixels-in/pixels-out utility
/// (no tool state / history) — also the entry point the SIMD benchmark harness
/// times against a scalar build.
#[wasm_bindgen]
pub fn resize_pixels_filter(
    pixels: &[u8],
    old_w: u32,
    old_h: u32,
    new_w: u32,
    new_h: u32,
    filter: u8,
) -> Vec<u8> {
    match filter {
        0 => transform::resize_nearest(pixels, old_w, old_h, new_w, new_h),
        2 => transform::resize_catmull_rom(pixels, old_w, old_h, new_w, new_h),
        3 => transform::resize_lanczos3(pixels, old_w, old_h, new_w, new_h),
        _ => transform::resize_bilinear(pixels, old_w, old_h, new_w, new_h),
    }
}

/// Stateless: encode an RGBA pixel buffer as PNG bytes. Used by the batch-logo
/// feature to skip the `OffscreenCanvas` → `convertToBlob` round-trip when
/// persisting composited photos.
#[wasm_bindgen]
pub fn encode_png_pixels(pixels: &[u8], width: u32, height: u32) -> Vec<u8> {
    let tmp = crate::core::ImageBuffer {
        width,
        height,
        data: pixels.to_vec(),
    };
    codec::export_png(&tmp)
}

/// Return value of `decode_png_to_rgba`: decoded pixels + the dimensions the
/// `png` crate reported for them, out of one wasm-bindgen call.
///
/// Not a JSON string (like `get_layers`) because the payload is binary, and
/// not split into separate `_width`/`_height`/`_data` calls (like
/// `thumbnail_width`/`_height`/`_data`) because that pattern only works when
/// each piece is cheap/pure to recompute independently — here all three come
/// out of one PNG decode, which is also the one place that can fail on bad
/// input, so splitting it would mean parsing the header three times and
/// smearing one `Result` across calls that don't each naturally return one.
#[wasm_bindgen(getter_with_clone)]
pub struct DecodedPng {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// Stateless: decode PNG bytes back into straight (non-premultiplied) RGBA8
/// pixels, normalizing any source color type to the engine's own encode
/// convention (see `codec::decode_png`) — the inverse of `encode_png_pixels`.
///
/// Used by OpenRaster import so encoding (`export_png`, Rust) and decoding a
/// layer's PNG back to pixels go through the *same* codec instead of two
/// different ones (Rust encode, browser `<canvas>` decode) round-tripping the
/// same bytes — a real correctness risk if they ever disagree on alpha
/// handling. Returns `Err` (a JS-catchable exception) rather than panicking
/// on corrupt or non-PNG input, per this engine's no-panics-across-the-
/// boundary rule.
#[wasm_bindgen]
pub fn decode_png_to_rgba(png: &[u8]) -> Result<DecodedPng, JsError> {
    let (rgba, width, height) = codec::decode_png(png)?;
    Ok(DecodedPng {
        width,
        height,
        rgba,
    })
}

/// Parse a CSS-ish color string into RGBA bytes. Accepts:
///   #rgb, #rgba, #rrggbb, #rrggbbaa
///   rgb(r, g, b)       — components 0–255 or 0–255 (no percentages)
///   rgba(r, g, b, a)   — alpha is 0.0–1.0 OR 0–255 (we sniff which)
///
/// Returns a 4-byte `Vec<u8>` `[r, g, b, a]` on success, or an empty vec on
/// any parse failure. Used by the color-swatch picker so the JS side doesn't
/// have to maintain its own regex.
#[wasm_bindgen]
pub fn parse_color(input: &str) -> Vec<u8> {
    let s = input.trim();
    if s.is_empty() {
        return Vec::new();
    }

    // ── Hex ────────────────────────────────────────────────────────────
    if let Some(hex) = s.strip_prefix('#') {
        return parse_hex(hex).map(|c| c.to_vec()).unwrap_or_default();
    }

    // ── Functional notation: rgb(...) / rgba(...) ──────────────────────
    let lower = s.to_ascii_lowercase();
    let (has_alpha, body) = if let Some(rest) = lower.strip_prefix("rgba(") {
        (true, rest)
    } else if let Some(rest) = lower.strip_prefix("rgb(") {
        (false, rest)
    } else {
        return Vec::new();
    };
    let Some(body) = body.strip_suffix(')') else {
        return Vec::new();
    };

    // Allow comma OR whitespace separators (CSS Color 4); split on either.
    let parts: Vec<&str> = body
        .split(|c: char| c == ',' || c == '/' || c.is_whitespace())
        .filter(|p| !p.is_empty())
        .collect();

    let expected = if has_alpha { 4 } else { 3 };
    if parts.len() != expected {
        return Vec::new();
    }

    let r = parse_component(parts[0]);
    let g = parse_component(parts[1]);
    let b = parse_component(parts[2]);
    let a = if has_alpha {
        parse_alpha(parts[3])
    } else {
        Some(255u8)
    };
    match (r, g, b, a) {
        (Some(r), Some(g), Some(b), Some(a)) => vec![r, g, b, a],
        _ => Vec::new(),
    }
}

/// Parse a hex string (no leading `#`). Returns `[r,g,b,a]` on success.
pub(crate) fn parse_hex(hex: &str) -> Option<[u8; 4]> {
    fn h(c: u8) -> Option<u8> {
        match c {
            b'0'..=b'9' => Some(c - b'0'),
            b'a'..=b'f' => Some(c - b'a' + 10),
            b'A'..=b'F' => Some(c - b'A' + 10),
            _ => None,
        }
    }
    let bytes = hex.as_bytes();
    match bytes.len() {
        3 => {
            let r = h(bytes[0])?;
            let g = h(bytes[1])?;
            let b = h(bytes[2])?;
            Some([r * 17, g * 17, b * 17, 255])
        }
        4 => {
            let r = h(bytes[0])?;
            let g = h(bytes[1])?;
            let b = h(bytes[2])?;
            let a = h(bytes[3])?;
            Some([r * 17, g * 17, b * 17, a * 17])
        }
        6 => {
            let r = (h(bytes[0])? << 4) | h(bytes[1])?;
            let g = (h(bytes[2])? << 4) | h(bytes[3])?;
            let b = (h(bytes[4])? << 4) | h(bytes[5])?;
            Some([r, g, b, 255])
        }
        8 => {
            let r = (h(bytes[0])? << 4) | h(bytes[1])?;
            let g = (h(bytes[2])? << 4) | h(bytes[3])?;
            let b = (h(bytes[4])? << 4) | h(bytes[5])?;
            let a = (h(bytes[6])? << 4) | h(bytes[7])?;
            Some([r, g, b, a])
        }
        _ => None,
    }
}

/// 0–255 integer, with optional trailing `%` (0–100).
fn parse_component(s: &str) -> Option<u8> {
    let s = s.trim();
    if let Some(pct) = s.strip_suffix('%') {
        let v: f32 = pct.trim().parse().ok()?;
        if !(0.0..=100.0).contains(&v) {
            return None;
        }
        Some((v * 2.55).round().clamp(0.0, 255.0) as u8)
    } else {
        let v: f32 = s.parse().ok()?;
        if !(0.0..=255.0).contains(&v) {
            return None;
        }
        Some(v.round().clamp(0.0, 255.0) as u8)
    }
}

/// Alpha: 0.0–1.0 OR 0–255 (sniffed by `>1`) OR `N%` (0–100).
fn parse_alpha(s: &str) -> Option<u8> {
    let s = s.trim();
    if let Some(pct) = s.strip_suffix('%') {
        let v: f32 = pct.trim().parse().ok()?;
        if !(0.0..=100.0).contains(&v) {
            return None;
        }
        return Some((v * 2.55).round().clamp(0.0, 255.0) as u8);
    }
    let v: f32 = s.parse().ok()?;
    if v < 0.0 {
        return None;
    }
    if v <= 1.0 {
        Some((v * 255.0).round().clamp(0.0, 255.0) as u8)
    } else if v <= 255.0 {
        Some(v.round() as u8)
    } else {
        None
    }
}

/// Snap a free drag to a locked aspect ratio. The user starts a drag at
/// (`start_x`, `start_y`) and the cursor is currently at (`end_x`, `end_y`);
/// this returns the rect that respects `ratio_w` : `ratio_h`, anchored at
/// the start corner and growing toward the cursor's quadrant. The longer
/// drag axis "leads" — the perpendicular axis is sized to match the ratio,
/// so the box always reaches at least as far as the cursor in the leading
/// direction. The result is clipped to the image bounds. Returns
/// `[x, y, w, h]` as a `Uint32Array`, or `undefined` (`None`) on invalid input
/// so callers can't silently destructure an empty array.
#[wasm_bindgen]
pub fn constrain_crop_to_ratio(
    start_x: i32,
    start_y: i32,
    end_x: i32,
    end_y: i32,
    ratio_w: u32,
    ratio_h: u32,
    image_w: u32,
    image_h: u32,
) -> Option<Vec<u32>> {
    if ratio_w == 0 || ratio_h == 0 || image_w == 0 || image_h == 0 {
        return None;
    }
    let r = ratio_w as f64 / ratio_h as f64;
    // Signed deltas tell us which quadrant the cursor's in.
    let dx = (end_x - start_x) as f64;
    let dy = (end_y - start_y) as f64;
    let sign_x = if dx < 0.0 { -1.0 } else { 1.0 };
    let sign_y = if dy < 0.0 { -1.0 } else { 1.0 };
    let adx = dx.abs();
    let ady = dy.abs();

    // Pick the leading axis: whichever produces the larger ratio-matched
    // rect. |dx|/|dy| > r → width is the binding constraint; else height.
    let (mut w, mut h) = if ady == 0.0 || (adx / ady.max(1e-9)) > r {
        (adx, adx / r)
    } else {
        (ady * r, ady)
    };
    if w < 1.0 || h < 1.0 {
        return Some(vec![start_x.max(0) as u32, start_y.max(0) as u32, 1, 1]);
    }

    // Anchor at start, extend in cursor's direction.
    let mut x0 = start_x as f64;
    let mut y0 = start_y as f64;
    if sign_x < 0.0 {
        x0 -= w;
    }
    if sign_y < 0.0 {
        y0 -= h;
    }

    // Clip to image: if the rect runs off the edge, scale uniformly so the
    // ratio is preserved instead of letting one side get cut.
    let iw = image_w as f64;
    let ih = image_h as f64;
    // Recompute fully-clipped bounds with ratio preservation.
    let max_x = if sign_x >= 0.0 { iw - x0 } else { x0 + w };
    let max_y = if sign_y >= 0.0 { ih - y0 } else { y0 + h };
    let avail_w = max_x.min(iw).max(0.0);
    let avail_h = max_y.min(ih).max(0.0);
    if w > avail_w {
        let scale = avail_w / w;
        w *= scale;
        h *= scale;
        if sign_x < 0.0 {
            x0 = start_x as f64 - w;
        }
    }
    if h > avail_h {
        let scale = avail_h / h;
        w *= scale;
        h *= scale;
        if sign_y < 0.0 {
            y0 = start_y as f64 - h;
        }
    }
    // Final hard clamp (handles negative start positions).
    let x = x0.max(0.0).min(iw - 1.0);
    let y = y0.max(0.0).min(ih - 1.0);
    let w_u = w.floor().clamp(1.0, iw - x) as u32;
    let h_u = h.floor().clamp(1.0, ih - y) as u32;
    Some(vec![x as u32, y as u32, w_u, h_u])
}

/// Compute the largest centred rectangle with the given aspect ratio that
/// fits inside an `image_w` × `image_h` image. Used by the Crop tool's
/// ratio buttons (1:1, 4:3, 16:9, …) so the JS side doesn't reinvent the
/// math. Returns `[x, y, w, h]` as a `Uint32Array`, or `undefined` (`None`)
/// on any non-positive input so callers can't silently destructure empty.
#[wasm_bindgen]
pub fn compute_aspect_crop(
    image_w: u32,
    image_h: u32,
    ratio_w: u32,
    ratio_h: u32,
) -> Option<Vec<u32>> {
    if image_w == 0 || image_h == 0 || ratio_w == 0 || ratio_h == 0 {
        return None;
    }
    let iw = image_w as f64;
    let ih = image_h as f64;
    let r = ratio_w as f64 / ratio_h as f64;
    let image_r = iw / ih;
    let (cw, ch) = if r > image_r {
        // Ratio wider than image → bounded by image width
        (iw, iw / r)
    } else {
        // Ratio taller or equal → bounded by image height
        (ih * r, ih)
    };
    let cw_u = cw.floor().clamp(1.0, iw) as u32;
    let ch_u = ch.floor().clamp(1.0, ih) as u32;
    let x = (image_w - cw_u) / 2;
    let y = (image_h - ch_u) / 2;
    Some(vec![x, y, cw_u, ch_u])
}
#[cfg(test)]
mod layer_tests {
    use super::*;

    /// A solid WxH RGBA image filled with one colour.
    fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&rgba);
        }
        v
    }

    fn px(tool: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
        let data = tool.get_image_data();
        let i = ((y * tool.width + x) * 4) as usize;
        [data[i], data[i + 1], data[i + 2], data[i + 3]]
    }

    #[test]
    fn starts_with_one_background_layer() {
        let t = ImageHorseTool::new(4, 4);
        assert_eq!(t.layer_count(), 1);
        assert_eq!(t.active, 0);
    }

    #[test]
    fn artboard_load_pads_and_makes_two_layers() {
        // 4×4 red photo, 2px white canvas border → 8×8 document, two layers,
        // photo active. Corner is the white canvas; centre is the red photo.
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image_artboard(&solid(4, 4, [255, 0, 0, 255]), 4, 4, 2, 255, 255, 255, 255);
        assert_eq!((t.width, t.height), (8, 8));
        assert_eq!(t.layer_count(), 2);
        assert_eq!(t.active, 1, "photo layer is active");
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "corner = canvas");
        assert_eq!(px(&t, 4, 4), [255, 0, 0, 255], "centre = photo");
    }

    #[test]
    fn resize_canvas_grows_without_resampling() {
        // 4×4 red photo on a 2px white artboard → 8×8 doc, two layers. Mark a
        // single distinctive pixel on the Photo layer, then grow the canvas to
        // 16×16 centred (no resample). The doc grows, the marked pixel survives
        // byte-for-byte at its shifted location (a resample would blend it with
        // its red neighbours), and the freshly exposed border is the bg fill.
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image_artboard(&solid(4, 4, [255, 0, 0, 255]), 4, 4, 2, 255, 255, 255, 255);
        // Photo layer (index 1) doc-coord (2,2) = photo top-left → unique colour.
        let i = ((2 * 8 + 2) * 4) as usize;
        t.layers[1].buf.data[i..i + 4].copy_from_slice(&[1, 2, 3, 255]);

        t.resize_canvas(16, 16, 4, 255, 255, 255, 255);

        assert_eq!((t.width, t.height), (16, 16), "doc grew");
        assert_eq!(t.layer_count(), 2, "layer count unchanged");
        // Centre offset = (16-8)/2 = 4, so doc(2,2) → doc(6,6).
        assert_eq!(
            px(&t, 6, 6),
            [1, 2, 3, 255],
            "photo pixel preserved exactly (not resampled)"
        );
        // Photo centre red(4,4) → doc(8,8) still pure red.
        assert_eq!(px(&t, 8, 8), [255, 0, 0, 255], "photo centre preserved");
        // Freshly exposed corner is the white backing fill.
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "new border = bg fill");
    }

    #[test]
    fn resize_canvas_shrinks_and_crops() {
        // Shrink an 8×8 artboard to 4×4 centred: offset = (4-8)/2 = -2, so the
        // photo region (2..6) lands at (0..4) and fills the whole smaller doc.
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 2, 0, 0, 0, 0);
        t.resize_canvas(4, 4, 4, 0, 0, 0, 0);
        assert_eq!((t.width, t.height), (4, 4), "doc shrank");
        assert_eq!(px(&t, 0, 0), [0, 128, 0, 255], "photo cropped to fill doc");
    }

    #[test]
    fn artboard_transparent_canvas_shows_through_border() {
        // bg_a = 0 → the border is transparent, the photo region opaque.
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 2, 0, 0, 0, 0);
        assert_eq!(px(&t, 0, 0)[3], 0, "border transparent");
        assert_eq!(px(&t, 4, 4), [0, 128, 0, 255], "photo opaque");
    }

    #[test]
    fn set_artboard_border_is_absolute_and_idempotent() {
        // Simulate a "jumbo" doc: a 4×4 red photo on a 20px artboard → 44×44.
        let mut t = ImageHorseTool::new(44, 44);
        t.load_image_artboard(&solid(4, 4, [255, 0, 0, 255]), 4, 4, 20, 200, 200, 200, 255);
        assert_eq!((t.width, t.height), (44, 44), "jumbo doc");
        // Mark the photo top-left (doc 20,20) with a unique colour so we can
        // prove the photo is re-blitted, not resampled.
        let i = ((20 * 44 + 20) * 4) as usize;
        t.layers[1].buf.data[i..i + 4].copy_from_slice(&[1, 2, 3, 255]);

        // Absolute apply: 10px border → the doc snaps to photo(4×4) + 2*10 = 24.
        t.set_artboard_border(10, 255, 255, 255, 255);
        assert_eq!((t.width, t.height), (24, 24), "snaps to photo + 2*pad");
        assert_eq!(t.layer_count(), 2, "still Background + Photo");
        // The marked photo pixel survives byte-for-byte at (10,10) (a resample
        // would have blended it with its red neighbours).
        assert_eq!(px(&t, 10, 10), [1, 2, 3, 255], "photo pixel preserved");
        assert_eq!(px(&t, 13, 13), [255, 0, 0, 255], "photo body preserved");
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "border = white backing");

        // IDEMPOTENT: calling again with the same pad changes nothing.
        t.set_artboard_border(10, 255, 255, 255, 255);
        assert_eq!((t.width, t.height), (24, 24), "size unchanged on re-apply");
        assert_eq!(t.layer_count(), 2, "layer count unchanged on re-apply");
        assert_eq!(
            px(&t, 10, 10),
            [1, 2, 3, 255],
            "photo pixel still preserved"
        );
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "border still white");
    }

    #[test]
    fn set_artboard_border_grows_backing_for_single_layer_doc() {
        // A plain single-layer photo (load_image) gains a Background + Photo
        // pair when bordered, with the photo centred inside the pad.
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [0, 0, 255, 255]));
        assert_eq!(t.layer_count(), 1, "starts single-layer");

        t.set_artboard_border(10, 255, 255, 255, 255);
        assert_eq!((t.width, t.height), (24, 24), "photo + 2*pad");
        assert_eq!(t.layer_count(), 2, "grew a Background layer");
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "corner = backing");
        assert_eq!(px(&t, 11, 11), [0, 0, 255, 255], "photo centred at (10,10)");

        // Idempotent on the now-two-layer doc too.
        t.set_artboard_border(10, 255, 255, 255, 255);
        assert_eq!((t.width, t.height), (24, 24), "size stable");
        assert_eq!(t.layer_count(), 2, "no extra Background layers accrue");
    }

    #[test]
    fn add_layer_inserts_above_and_activates() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [255, 0, 0, 255]));
        let id = t.add_layer("Layer 2");
        assert_eq!(t.layer_count(), 2);
        assert_eq!(t.active_layer_id(), id);
        assert_eq!(t.active, 1);
        // New layer is transparent → composite still shows the red background.
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn upper_opaque_layer_covers_lower() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        t.add_layer("top");
        // Paint the top (active) layer solid blue.
        let top = t.active;
        t.layers[top].buf.data = solid(2, 2, [0, 0, 255, 255]);
        assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
    }

    #[test]
    fn shape_solid_fill_paints_interior() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [255, 255, 255, 255]));
        // Rect (4,4)-(16,16), solid blue fill (kind 1), thin black stroke.
        t.add_shape_annotation(
            0, 4.0, 4.0, 16.0, 16.0, "#000000", 1.0, 0, 1, "#0000ff", "#000000", 0, 0,
        );
        let p = px(&t, 10, 10); // interior centre
        assert_eq!(
            [p[0], p[1], p[2]],
            [0, 0, 255],
            "interior should be blue fill, got {p:?}"
        );
    }

    #[test]
    fn shape_no_fill_leaves_interior_untouched() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [255, 255, 255, 255]));
        // fill_kind 0 = none → interior stays white.
        t.add_shape_annotation(
            0, 4.0, 4.0, 16.0, 16.0, "#000000", 1.0, 0, 0, "#000000", "#000000", 0, 0,
        );
        assert_eq!(px(&t, 10, 10), [255, 255, 255, 255]);
    }

    #[test]
    fn shape_gradient_fill_varies_across_axis() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [255, 255, 255, 255]));
        // Horizontal (angle 0) gradient red→green across a wide rect; no stroke
        // bleed in the centre band we sample.
        t.add_shape_annotation(
            0, 2.0, 2.0, 38.0, 38.0, "#000000", 1.0, 0, 2, "#ff0000", "#00ff00", 0, 0,
        );
        let left = px(&t, 6, 20);
        let right = px(&t, 34, 20);
        assert!(left[0] > left[1], "left end should be redder, got {left:?}");
        assert!(
            right[1] > right[0],
            "right end should be greener, got {right:?}"
        );
    }

    /// A cubic control sequence approximating a circle of radius `r` about
    /// (cx,cy). The final anchor is offset by `gap` px from the first — the
    /// hand-drawn "full circle" case, where the user's last click lands NEAR
    /// the start, never exactly on it.
    fn circle_path(cx: f64, cy: f64, r: f64, gap: f64) -> Vec<f64> {
        let k = 0.552_284_75 * r; // cubic circle-approximation handle length
        vec![
            cx + r,
            cy, // a0  (E)
            cx + r,
            cy + k, // out0
            cx + k,
            cy + r, // in1
            cx,
            cy + r, // a1  (S)
            cx - k,
            cy + r, // out1
            cx - r,
            cy + k, // in2
            cx - r,
            cy, // a2  (W)
            cx - r,
            cy - k, // out2
            cx - k,
            cy - r, // in3
            cx,
            cy - r, // a3  (N)
            cx + k,
            cy - r, // out3
            cx + r,
            cy - k, // in0'
            cx + r,
            cy + gap, // a0' — near the first anchor, NOT on it
        ]
    }

    /// The headline pen bug: a hand-drawn closed circle must FILL even though
    /// its last anchor misses the first by a couple of px. `fill_polygon`
    /// wraps the contour (`(i + 1) % n`), so closure must not be exact.
    #[test]
    fn bezier_near_closed_circle_fills_interior() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [255, 255, 255, 255]));
        // 2px short of closure — a realistic hand-drawn loop.
        let pts = circle_path(20.0, 20.0, 12.0, 2.0);
        t.add_bezier_annotation(&pts, "#000000", 1.0, 1, "#0000ff");

        let centre = px(&t, 20, 20);
        assert_eq!(
            [centre[0], centre[1], centre[2]],
            [0, 0, 255],
            "interior of a near-closed circle should be blue fill, got {centre:?}"
        );
        // Well inside, off-centre, still filled.
        let inner = px(&t, 20, 14);
        assert_eq!(
            [inner[0], inner[1], inner[2]],
            [0, 0, 255],
            "interior should fill to the edges, got {inner:?}"
        );
        // Outside the contour: untouched white.
        assert_eq!(
            px(&t, 1, 1),
            [255, 255, 255, 255],
            "outside the path must stay unfilled"
        );
        assert_eq!(
            px(&t, 38, 38),
            [255, 255, 255, 255],
            "outside the path must stay unfilled"
        );
    }

    /// fill_kind 0 on the same geometry leaves the interior alone — proving the
    /// fill above came from the fill instruction, not from the stroke.
    #[test]
    fn bezier_no_fill_leaves_interior_untouched() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [255, 255, 255, 255]));
        let pts = circle_path(20.0, 20.0, 12.0, 2.0);
        t.add_bezier_annotation(&pts, "#000000", 1.0, 0, "#0000ff");
        assert_eq!(
            px(&t, 20, 20),
            [255, 255, 255, 255],
            "fill_kind 0 → interior stays white"
        );
    }

    #[test]
    fn redact_region_paints_opaque_color() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [255, 255, 255, 255]));
        t.begin_redact_stroke();
        t.redact_region(10.0, 10.0, 5.0, 0, 0, 0);
        assert_eq!(
            px(&t, 10, 10),
            [0, 0, 0, 255],
            "brush centre redacted to black"
        );
        assert_eq!(
            px(&t, 0, 0),
            [255, 255, 255, 255],
            "corner outside brush untouched"
        );
    }

    #[test]
    fn pixelate_region_keeps_solid_color() {
        let mut t = ImageHorseTool::new(32, 32);
        t.load_image(&solid(32, 32, [40, 80, 120, 255]));
        t.begin_pixelate_stroke();
        t.pixelate_region(16.0, 16.0, 16.0, 8);
        // Averaging a uniform region leaves the colour unchanged.
        assert_eq!(px(&t, 16, 16), [40, 80, 120, 255]);
    }

    #[test]
    fn shape_pixelate_fill_quantizes_into_blocks() {
        let mut t = ImageHorseTool::new(16, 16);
        // Horizontal grey ramp so neighbouring columns differ before pixelating.
        let mut data = Vec::with_capacity(16 * 16 * 4);
        for _y in 0..16 {
            for x in 0..16u32 {
                let v = (x * 17) as u8;
                data.extend_from_slice(&[v, v, v, 255]);
            }
        }
        t.load_image(&data);
        // Whole-image rect, pixelate fill (kind 3), one 16px block → one cell.
        t.add_shape_annotation(
            0, 0.0, 0.0, 15.0, 15.0, "#000000", 0.0, 0, 3, "#000000", "#000000", 0, 16,
        );
        let a = px(&t, 2, 8);
        let b = px(&t, 13, 8);
        assert_eq!(
            a, b,
            "a single mosaic block must be uniform, {a:?} vs {b:?}"
        );
    }

    #[test]
    fn shape_json_includes_fill_block() {
        let mut t = ImageHorseTool::new(16, 16);
        t.load_image(&solid(16, 16, [0, 0, 0, 255]));
        t.add_shape_annotation(
            0, 1.0, 1.0, 10.0, 10.0, "#000000", 1.0, 0, 3, "#000000", "#000000", 0, 24,
        );
        let json = t.get_layer_shape_annotations(0);
        assert!(json.contains("\"fill_block\":24"), "got {json}");
    }

    #[test]
    fn visibility_toggle_hides_layer() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [0, 0, 255, 255]);
        assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
        t.set_layer_visible(top, false);
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn opacity_blends_50_percent() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [0, 0, 0, 255]));
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [255, 255, 255, 255]);
        t.set_layer_opacity(top, 0.5);
        let p = px(&t, 0, 0);
        // ~50% white over black ≈ 128 on each channel.
        assert!((p[0] as i32 - 128).abs() <= 2, "got {:?}", p);
        assert_eq!(p[3], 255);
    }

    #[test]
    fn undo_removes_added_layer() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [9, 9, 9, 255]));
        assert_eq!(t.layer_count(), 1);
        t.add_layer("temp");
        assert_eq!(t.layer_count(), 2);
        assert!(t.undo());
        assert_eq!(t.layer_count(), 1);
        assert!(t.redo());
        assert_eq!(t.layer_count(), 2);
    }

    #[test]
    fn cannot_remove_last_layer() {
        let mut t = ImageHorseTool::new(2, 2);
        assert!(!t.remove_layer(t.active_layer_id()));
        assert_eq!(t.layer_count(), 1);
    }

    #[test]
    fn remove_backing_layer_shrinks_canvas_to_content() {
        // A 4×4 photo on a 10px artboard border → 24×24 doc, Background + Photo.
        let mut t = ImageHorseTool::new(24, 24);
        t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 10, 200, 200, 200, 255);
        assert_eq!((t.width, t.height), (24, 24), "jumbo doc with backing");
        assert_eq!(t.layer_count(), 2, "Background + Photo");

        let bg_id = t.layers[0].id;
        assert!(t.remove_layer(bg_id));

        assert_eq!(t.layer_count(), 1, "Background removed");
        assert_eq!(
            (t.width, t.height),
            (4, 4),
            "canvas shrinks back to the photo's tight content — the border must not \
             linger (and reappear in every export) once its fill is gone"
        );
        assert_eq!(px(&t, 0, 0), [0, 128, 0, 255], "photo content preserved");
    }

    #[test]
    fn remove_non_backing_layer_leaves_canvas_size_untouched() {
        // Deleting an ordinary (non-backing) layer must NOT trigger a resize —
        // only removing the bottom "Background" layer of a multi-layer doc does.
        let mut t = ImageHorseTool::new(24, 24);
        t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 10, 200, 200, 200, 255);
        let photo_id = t.layers[1].id;

        assert!(t.remove_layer(photo_id));

        assert_eq!(t.layer_count(), 1, "Photo removed, Background remains");
        assert_eq!((t.width, t.height), (24, 24), "canvas size untouched");
    }

    #[test]
    fn get_image_data_excluding_background_crops_to_the_photo() {
        // A 4×4 photo on a 2px artboard border → 8×8 doc, Background + Photo.
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 2, 200, 200, 200, 255);

        // The full composite still includes the padded backing fill.
        let full = t.get_image_data();
        assert_eq!(
            &full[0..4],
            &[200, 200, 200, 255][..],
            "full composite includes backing"
        );

        // Excluding the backing crops down to just the 4×4 photo — not the
        // full 8×8 canvas with the fill zeroed out (which would still export
        // at the padded size, a black border baked in on formats without
        // alpha like JPEG).
        assert_eq!(t.export_width_excluding_background(), 4);
        assert_eq!(t.export_height_excluding_background(), 4);
        let excl = t.get_image_data_excluding_background();
        assert_eq!(excl.len(), 4 * 4 * 4, "cropped to the photo's own size");
        for px in excl.chunks_exact(4) {
            assert_eq!(px, [0, 128, 0, 255], "every pixel is the photo, no border");
        }
    }

    #[test]
    fn get_image_data_excluding_background_is_a_noop_without_a_backing_layer() {
        // Single-layer (photo-only) doc: excluding "the backing" has nothing
        // to exclude, so both composites must match exactly.
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [10, 20, 30, 255]));
        assert_eq!(t.get_image_data(), t.get_image_data_excluding_background());
    }

    #[test]
    fn merge_down_combines_layers() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [0, 0, 255, 255]);
        assert!(t.merge_down(top));
        assert_eq!(t.layer_count(), 1);
        assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
    }

    #[test]
    fn flatten_all_collapses_stack() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        t.add_layer("a");
        t.add_layer("b");
        assert_eq!(t.layer_count(), 3);
        t.flatten_all();
        assert_eq!(t.layer_count(), 1);
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn move_layer_reorders() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255])); // bottom red
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [0, 255, 0, 255]); // green on top
        assert_eq!(px(&t, 0, 0), [0, 255, 0, 255]);
        // Move green to the bottom → red now on top.
        t.move_layer(top, 0);
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn paste_region_targets_active_layer() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [0, 0, 0, 255]));
        t.add_layer("paste-target");
        // Paste a 2x2 white block at (0,0) into the active (transparent) layer.
        t.paste_region(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0);
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255]);
        // Outside the paste, the black background shows through.
        assert_eq!(px(&t, 3, 3), [0, 0, 0, 255]);
    }
}

#[cfg(test)]
mod layer_persistence_tests {
    use super::*;

    fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&rgba);
        }
        v
    }

    fn px(tool: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
        let data = tool.get_image_data();
        let i = ((y * tool.width + x) * 4) as usize;
        [data[i], data[i + 1], data[i + 2], data[i + 3]]
    }

    #[test]
    fn restore_rebuilds_stack_and_active() {
        let mut t = ImageHorseTool::new(2, 2);
        t.begin_layer_restore();
        let id0 = t.push_restored_layer(
            &solid(2, 2, [10, 20, 30, 255]),
            2,
            2,
            "Background",
            true,
            1.0,
        );
        let id1 = t.push_restored_layer(&solid(2, 2, [0, 0, 0, 0]), 2, 2, "Top", true, 0.5);
        t.finish_layer_restore(1);
        assert_eq!(t.layer_count(), 2);
        assert_eq!(t.active, 1);
        assert_ne!(id0, id1);
        // Top layer transparent → bottom colour shows through.
        assert_eq!(px(&t, 0, 0), [10, 20, 30, 255]);
        // Per-layer PNG serialization is non-empty.
        assert!(!t.get_layer_png(0).is_empty());
        assert!(!t.get_layer_png(1).is_empty());
    }

    #[test]
    fn per_layer_annotation_serialization_is_isolated() {
        let mut t = ImageHorseTool::new(16, 16);
        t.load_image(&solid(16, 16, [0, 0, 0, 255]));
        // Shape on the base layer (active = 0).
        t.add_shape_annotation(
            0, 1.0, 1.0, 5.0, 5.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
        );
        // New empty top layer.
        t.add_layer("top");
        let s0 = t.get_layer_shape_annotations(0);
        let s1 = t.get_layer_shape_annotations(1);
        assert!(
            s0.contains("\"kind\":0"),
            "base layer should carry the shape: {s0}"
        );
        assert_eq!(s1, "[]", "top layer should have no shapes");
    }

    #[test]
    fn translate_active_layer_shifts_pixels_and_records_one_step() {
        let mut t = ImageHorseTool::new(4, 4);
        // Paint a single opaque red pixel at (1,1) on the background layer.
        {
            let buf = &mut t.layers[t.active].buf.data;
            let i = ((4 + 1) * 4) as usize;
            buf[i] = 255;
            buf[i + 3] = 255;
        }
        let undo_before = t.undo_count();
        t.translate_active_layer(1, 2); // → should land at (2,3)
        let buf = &t.layers[t.active].buf.data;
        let src = ((4 + 1) * 4) as usize;
        let dst = ((3 * 4 + 2) * 4) as usize;
        assert_eq!(buf[src + 3], 0, "original pixel cleared (now transparent)");
        assert_eq!(buf[dst], 255, "red moved to the shifted position");
        assert_eq!(buf[dst + 3], 255, "alpha moved with it");
        assert_eq!(
            t.undo_count(),
            undo_before + 1,
            "one Move Layer history step"
        );
    }

    #[test]
    fn crop_offsets_text_and_shape_annotations() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [10, 20, 30, 255]));
        t.add_text_annotation(
            "hi", 12.0, 255, 255, 255, false, 15, 12, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
        );
        t.add_shape_annotation(
            1, 5.0, 5.0, 8.0, 8.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
        );
        // Crop a 10x10 rect starting at (5,5) — annotations must shift by
        // (-5,-5) to stay anchored to the same photo content, matching the
        // Move tool / resize_canvas offset pattern.
        t.crop(5, 5, 10, 10);
        let layer = &t.layers[t.active];
        assert_eq!(
            layer.text_annotations[0].x, 10,
            "text.x follows the crop origin"
        );
        assert_eq!(
            layer.text_annotations[0].y, 7,
            "text.y follows the crop origin"
        );
        let shape = &layer.shape_annotations[0];
        assert_eq!(
            (shape.x0, shape.y0, shape.x1, shape.y1),
            (0.0, 0.0, 3.0, 3.0)
        );
    }

    #[test]
    fn translate_active_layer_zero_delta_is_a_noop() {
        let mut t = ImageHorseTool::new(4, 4);
        let undo_before = t.undo_count();
        t.set_move_preview(3, 3);
        t.translate_active_layer(0, 0); // clears preview, records nothing
        assert_eq!(t.undo_count(), undo_before, "zero move adds no history");
        assert!(t.move_preview.is_none(), "preview cleared");
    }

    #[test]
    fn paste_preview_renders_live_without_touching_the_layer_buffer() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [0, 0, 0, 255]));
        t.begin_paste_preview(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0, 2, 2);
        // The stored layer buffer is untouched — get_image_data() recomposites
        // straight from `layers`, bypassing the preview entirely.
        assert_eq!(px(&t, 0, 0), [0, 0, 0, 255], "layer buffer not baked yet");
        // recomposite() is what JS calls before each blit — it overlays the
        // live preview onto composite_cache without touching `layers`.
        t.recomposite();
        let i = 0usize; // (0,0) in the flattened composite
        assert_eq!(
            &t.composite_cache[i..i + 4],
            &[255u8, 255, 255, 255][..],
            "recomposite() renders the pending placement"
        );
        assert_eq!(
            t.layers[t.active].buf.data[0..4],
            [0, 0, 0, 255],
            "layer buffer still untouched after recomposite"
        );
    }

    #[test]
    fn commit_paste_preview_bakes_active_layer_and_records_one_step() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [0, 0, 0, 255]));
        // Placement preview doesn't touch the layer buffer yet.
        t.begin_paste_preview(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0, 2, 2);
        assert_eq!(
            px(&t, 0, 0),
            [0, 0, 0, 255],
            "preview is render-only, not baked"
        );
        let undo_before = t.undo_count();
        // Resize the placement to 4x4 (upscaling the 2x2 source) before commit.
        t.set_paste_preview_rect(0, 0, 4, 4);
        t.commit_paste_preview(0); // nearest, so the corners stay pure white
        assert_eq!(
            px(&t, 0, 0),
            [255, 255, 255, 255],
            "baked at the resized rect"
        );
        assert_eq!(px(&t, 3, 3), [255, 255, 255, 255]);
        assert_eq!(t.undo_count(), undo_before + 1, "one Paste history step");
        assert!(t.paste_preview.is_none(), "preview cleared after commit");
    }

    #[test]
    fn cancel_paste_preview_discards_without_history() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [0, 0, 0, 255]));
        t.begin_paste_preview(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0, 2, 2);
        let undo_before = t.undo_count();
        t.cancel_paste_preview();
        assert!(t.paste_preview.is_none());
        assert_eq!(t.undo_count(), undo_before, "cancel adds no history");
        assert_eq!(px(&t, 0, 0), [0, 0, 0, 255], "layer buffer untouched");
    }

    // 20x20 so a shrunk dest rect (10x10) stays above `PASTE_MIN_SIZE` (10)
    // while still leaving pixels outside it to prove the original isn't
    // doubled/left stale there.
    #[test]
    fn layer_resize_preview_hides_original_without_touching_the_buffer() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [10, 20, 30, 255]));
        t.begin_layer_resize_preview();
        assert_eq!(
            px(&t, 0, 0),
            [10, 20, 30, 255],
            "layer buffer untouched before recomposite"
        );
        t.set_paste_preview_rect(0, 0, 10, 10);
        t.recomposite();
        // Check `composite_cache` directly (what `recomposite` actually
        // renders) — `get_image_data()`/`px()` recomposite straight from
        // `layers`, bypassing `paste_preview` entirely, so they'd show the
        // stored (untouched) buffer either way and couldn't catch a doubling
        // bug here.
        assert_eq!(
            &t.composite_cache[0..4],
            &[10u8, 20, 30, 255][..],
            "preview itself renders inside the shrunk rect"
        );
        let corner = ((19 * 20 + 19) * 4) as usize;
        assert_eq!(
            &t.composite_cache[corner..corner + 4],
            &[0u8, 0, 0, 0][..],
            "original hidden (not doubled) outside the shrunk preview rect"
        );
        assert_eq!(
            t.layers[t.active].buf.data[0..4],
            [10, 20, 30, 255],
            "layer buffer still untouched after recomposite"
        );
    }

    #[test]
    fn commit_layer_resize_preview_replaces_buffer_and_records_one_step() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [10, 20, 30, 255]));
        t.begin_layer_resize_preview();
        let undo_before = t.undo_count();
        // Shrink the layer's own content down to the top-left 10x10 quadrant.
        t.set_paste_preview_rect(0, 0, 10, 10);
        t.commit_paste_preview(0); // nearest
        assert_eq!(
            px(&t, 0, 0),
            [10, 20, 30, 255],
            "content kept in the shrunk rect"
        );
        assert_eq!(
            px(&t, 19, 19),
            [0, 0, 0, 0],
            "rest of the layer is now transparent, not the stale original"
        );
        assert_eq!(
            t.undo_count(),
            undo_before + 1,
            "one Resize Layer history step"
        );
        assert!(t.paste_preview.is_none(), "preview cleared after commit");
    }

    #[test]
    fn cancel_layer_resize_preview_leaves_original_content_intact() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [10, 20, 30, 255]));
        t.begin_layer_resize_preview();
        t.set_paste_preview_rect(0, 0, 10, 10);
        t.cancel_paste_preview();
        assert!(t.paste_preview.is_none());
        assert_eq!(
            px(&t, 19, 19),
            [10, 20, 30, 255],
            "cancel restores the original full-size content (buffer was never touched)"
        );
    }

    #[test]
    fn set_paste_preview_rect_is_noop_without_begin() {
        let mut t = ImageHorseTool::new(4, 4);
        assert!(!t.has_paste_preview());
        t.set_paste_preview_rect(1, 1, 3, 3); // no preview to update — safe no-op
        assert!(!t.has_paste_preview());
    }

    #[test]
    fn restore_text_annotation_attaches_to_active_layer() {
        let mut t = ImageHorseTool::new(32, 32);
        t.begin_layer_restore();
        t.push_restored_layer(
            &solid(32, 32, [255, 255, 255, 255]),
            32,
            32,
            "bg",
            true,
            1.0,
        );
        t.restore_text_annotation(
            "hi", 16.0, 0, 0, 0, false, 2, 2, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
            // shadow params (box, text, r, g, b, a, dx, dy, blur)
            false, false, 0, 0, 0, 0, 0, 0, 0,
        );
        t.finish_layer_restore(0);
        let json = t.get_layer_text_annotations(0);
        assert!(json.contains("\"text\":\"hi\""), "got {json}");
        // No history pushed by the restore path.
        assert_eq!(t.undo_count(), 0);
    }
}

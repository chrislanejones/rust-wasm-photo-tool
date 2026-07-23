//! Selection tool: magic-wand flood fill, select-all, and the marching-ants
//! overlay. Split out of `lib.rs`; behaviour is unchanged.

use crate::ImageHorseTool;
use wasm_bindgen::prelude::*;

/// Build a canvas-sized RGBA overlay from a selection mask — the selection
/// *marker*. Rather than a flat translucent fill (which buried the pixels under
/// it), this traces a crisp marching-ants–style outline around the selection
/// boundary and leaves only a faint interior tint, so you can still see what
/// you've selected. The whole marker is generated here in Rust; the JS overlay
/// just blits this RGBA and CSS-scales it onto the canvas.
///
/// Boundary = a selected pixel that touches a non-selected 4-neighbour (or the
/// image edge). Boundary pixels alternate black/white in a short diagonal dash
/// so the ants stay legible over any image, light or dark.
pub(crate) fn selection_overlay_rgba(mask: &[bool], w: usize, h: usize) -> Vec<u8> {
    const FILL: [u8; 4] = [64, 140, 255, 38]; // faint translucent-blue interior
    const DASH_PX: usize = 4; // dash period (image px) for the ant pattern
    let mut out = vec![0u8; w * h * 4];
    if w == 0 || h == 0 {
        return out;
    }
    let sel = |x: usize, y: usize| mask[y * w + x];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if !mask[i] {
                continue;
            }
            let boundary = x == 0
                || y == 0
                || x + 1 == w
                || y + 1 == h
                || !sel(x - 1, y)
                || !sel(x + 1, y)
                || !sel(x, y - 1)
                || !sel(x, y + 1);
            let px = if boundary {
                if ((x + y) / DASH_PX).is_multiple_of(2) {
                    [255, 255, 255, 255]
                } else {
                    [0, 0, 0, 255]
                }
            } else {
                FILL
            };
            out[i * 4..i * 4 + 4].copy_from_slice(&px);
        }
    }
    out
}
/// 4-connected flood fill from `start` over `buf`, taking every pixel within
/// `tol` (per channel) of the seed colour. When `edges` is `Some((map, wall))`
/// the fill also refuses to cross a pixel whose edge strength exceeds `wall` —
/// the seed itself is exempt, so clicking directly on an outline still selects
/// something instead of nothing.
///
/// ONE implementation for both wands. They differ by a single `Option`, and a
/// copy-pasted second flood fill is both ~8 KB of duplicated wasm and the kind
/// of thing that gets fixed in one place and not the other.
fn flood_select(
    buf: &[u8],
    w: usize,
    h: usize,
    start: usize,
    tol: i32,
    edges: Option<(&[u8], u8)>,
) -> Vec<bool> {
    let t = [
        buf[start * 4],
        buf[start * 4 + 1],
        buf[start * 4 + 2],
        buf[start * 4 + 3],
    ];
    let mut mask = vec![false; w * h];
    let mut stack = vec![start];
    while let Some(i) = stack.pop() {
        if mask[i] {
            continue;
        }
        if let Some((map, wall)) = edges {
            if i != start && map[i] > wall {
                continue;
            }
        }
        let c = &buf[i * 4..i * 4 + 4];
        if (c[0] as i32 - t[0] as i32).abs() > tol
            || (c[1] as i32 - t[1] as i32).abs() > tol
            || (c[2] as i32 - t[2] as i32).abs() > tol
            || (c[3] as i32 - t[3] as i32).abs() > tol
        {
            continue;
        }
        mask[i] = true;
        let (cx, cy) = (i % w, i / w);
        if cx > 0 {
            stack.push(i - 1);
        }
        if cx + 1 < w {
            stack.push(i + 1);
        }
        if cy > 0 {
            stack.push(i - w);
        }
        if cy + 1 < h {
            stack.push(i + w);
        }
    }
    mask
}

/// 4-connected flood from `seeds`, bounded to `bounds`, spreading through any
/// pixel `open()` accepts. Writes reachability into `reach` (a full `w*h`
/// plane the caller owns) and reuses the caller's `stack` — so a per-dab caller
/// on the brush's hot path allocates **nothing** after the first stroke.
///
/// Deliberately NOT folded into `flood_select` above. That one is colour-keyed
/// (seed colour + tolerance over RGBA); both new consumers need "flood the
/// complement of a boundary set", which has no colour term at all. It *can* be
/// faked — pass `tol = 255` and the boundary as the edge map — but that routes
/// the shipped wands' fill through a path it never actually runs, to save
/// twenty lines. This shares the pattern, not the punning. Used by the lasso's
/// interior fill (loop as barrier, flood from the border, invert) and by the
/// Smart Brush's containment (strong edges as barrier, flood from the dab
/// centre).
///
/// `bounds` is inclusive `(x0, y0, x1, y1)`. The caller must have cleared
/// `reach` over that region first — clearing only the bounded window is the
/// point, since zeroing a full-image plane per dab would cost more than the
/// fill itself.
pub(crate) fn flood_barrier_into(
    reach: &mut [bool],
    w: usize,
    seeds: &[usize],
    bounds: (usize, usize, usize, usize),
    stack: &mut Vec<usize>,
    open: impl Fn(usize) -> bool,
) {
    let (x0, y0, x1, y1) = bounds;
    stack.clear();
    for &s in seeds {
        if s < reach.len() && !reach[s] && open(s) {
            reach[s] = true;
            stack.push(s);
        }
    }
    while let Some(i) = stack.pop() {
        let (cx, cy) = (i % w, i / w);
        let visit = |n: usize, reach: &mut [bool], stack: &mut Vec<usize>| {
            if !reach[n] && open(n) {
                reach[n] = true;
                stack.push(n);
            }
        };
        if cx > x0 {
            visit(i - 1, reach, stack);
        }
        if cx < x1 {
            visit(i + 1, reach, stack);
        }
        if cy > y0 {
            visit(i - w, reach, stack);
        }
        if cy < y1 {
            visit(i + w, reach, stack);
        }
    }
}

impl ImageHorseTool {
    /// Validate a canvas click and turn it into a composite-buffer pixel index.
    /// `None` when the image is empty, the click is out of bounds, or the
    /// composite cache is short — the three guards every selection entry point
    /// needs before it can trust `buf[i * 4]`.
    fn seed_index(&self, x: f64, y: f64) -> Option<usize> {
        let (w, h) = (self.width as usize, self.height as usize);
        if w == 0 || h == 0 || self.composite_cache.len() < w * h * 4 {
            return None;
        }
        let (fx, fy) = (x.round(), y.round());
        if fx < 0.0 || fy < 0.0 || fx >= w as f64 || fy >= h as f64 {
            return None;
        }
        Some(fy as usize * w + fx as usize)
    }

    // ── Boolean-selection combine core (private; not wasm-exported) ─────────
    // One implementation over real `&[bool]` slices; the wasm exports
    // (`selection_union`/`selection_subtract`) convert their `&[u8]` argument
    // and call these, and `apply_produced_selection` calls them directly with
    // the bool mask a producer already built.

    /// Collapse an all-false selection to `None` (the canonical "no
    /// selection"); a non-empty selection is left untouched.
    fn normalize_selection(&mut self) {
        if self
            .selection
            .as_ref()
            .is_some_and(|m| !m.iter().any(|&b| b))
        {
            self.selection = None;
        }
    }

    /// OR `mask` into the current selection. No selection → the mask becomes
    /// it. No-ops on a length mismatch. Returns whether anything is selected.
    fn union_bools(&mut self, mask: &[bool]) -> bool {
        if mask.len() != (self.width * self.height) as usize {
            return self.has_selection();
        }
        match &mut self.selection {
            Some(cur) => {
                for (c, &m) in cur.iter_mut().zip(mask) {
                    *c |= m;
                }
            }
            None => self.selection = Some(mask.to_vec()),
        }
        self.normalize_selection();
        self.has_selection()
    }

    /// Clear every selected pixel `mask` covers; normalise an empty result to
    /// `None`. No-ops on a length mismatch. Returns whether anything remains.
    fn subtract_bools(&mut self, mask: &[bool]) -> bool {
        if mask.len() != (self.width * self.height) as usize {
            return self.has_selection();
        }
        if let Some(cur) = &mut self.selection {
            for (c, &m) in cur.iter_mut().zip(mask) {
                if m {
                    *c = false;
                }
            }
        }
        self.normalize_selection();
        self.has_selection()
    }

    /// Store a freshly-produced tool mask per the current combine mode and
    /// return the resulting selection overlay RGBA (the SAME shape every
    /// producer returns). Replace (0) is the historical behaviour; add (1) /
    /// subtract (2) route through the union/subtract core so the Shift/Alt
    /// modifiers compose. `mask` is already canvas-sized.
    fn apply_produced_selection(&mut self, mask: Vec<bool>) -> Vec<u8> {
        match self.selection_combine {
            1 => {
                self.union_bools(&mask);
            }
            2 => {
                self.subtract_bools(&mask);
            }
            _ => {
                self.selection = Some(mask);
                self.normalize_selection();
            }
        }
        self.selection_overlay()
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Magic-wand select: 4-connected flood fill from (x,y) over the composite,
    /// taking every pixel whose colour is within `tolerance` (per channel) of the
    /// clicked pixel. Stores the mask; returns a canvas-sized RGBA overlay for the
    /// JS selection layer to draw. Empty Vec if the click is out of bounds.
    pub fn magic_wand_select(&mut self, x: f64, y: f64, tolerance: u32) -> Vec<u8> {
        let (w, h) = (self.width as usize, self.height as usize);
        let Some(start) = self.seed_index(x, y) else {
            return Vec::new();
        };
        let mask = flood_select(&self.composite_cache, w, h, start, tolerance as i32, None);
        self.apply_produced_selection(mask)
    }

    /// Edge-aware magic wand. Same 4-connected flood fill as `magic_wand_select`,
    /// but it also refuses to cross a pixel whose Sobel edge strength exceeds
    /// `edge_threshold` (0..=255) — so a fill started inside an object stops at
    /// the object's outline instead of leaking through a soft gradient into the
    /// background, which is exactly where the plain tolerance wand fails.
    ///
    /// Lower threshold = more walls = tighter selection. The edge map comes from
    /// the shared core in `edges.rs` — the same one the magnetic lasso and Smart
    /// Brush will walk, so "what counts as an edge" stays one definition.
    ///
    /// The seed pixel itself is exempt: clicking directly on an outline should
    /// still select *something* rather than silently returning nothing.
    pub fn magic_wand_select_edges(
        &mut self,
        x: f64,
        y: f64,
        tolerance: u32,
        edge_threshold: u32,
    ) -> Vec<u8> {
        let (w, h) = (self.width as usize, self.height as usize);
        let Some(start) = self.seed_index(x, y) else {
            return Vec::new();
        };
        let edges = crate::edges::sobel_magnitude(&self.composite_cache, w, h);
        let mask = flood_select(
            &self.composite_cache,
            w,
            h,
            start,
            tolerance as i32,
            Some((&edges, edge_threshold.min(255) as u8)),
        );
        self.apply_produced_selection(mask)
    }

    /// Color-range select (Photoshop's Select → Color Range). Takes EVERY pixel
    /// within `tolerance` of the clicked colour, anywhere in the image — not
    /// just the connected blob the wand would reach. That's the whole point:
    /// one click grabs all the sky, or every instance of a logo colour, without
    /// shift-clicking each island.
    pub fn color_range_select(&mut self, x: f64, y: f64, tolerance: u32) -> Vec<u8> {
        let (w, h) = (self.width as usize, self.height as usize);
        let Some(start) = self.seed_index(x, y) else {
            return Vec::new();
        };
        let buf = &self.composite_cache;
        let t = [
            buf[start * 4] as i32,
            buf[start * 4 + 1] as i32,
            buf[start * 4 + 2] as i32,
            buf[start * 4 + 3] as i32,
        ];
        let tol = tolerance as i32;
        let mut mask = vec![false; w * h];
        for (i, m) in mask.iter_mut().enumerate() {
            let c = &buf[i * 4..i * 4 + 4];
            *m = (c[0] as i32 - t[0]).abs() <= tol
                && (c[1] as i32 - t[1]).abs() <= tol
                && (c[2] as i32 - t[2]).abs() <= tol
                && (c[3] as i32 - t[3]).abs() <= tol;
        }
        self.apply_produced_selection(mask)
    }

    /// Select the whole canvas (Alt+A). Returns the overlay RGBA.
    pub fn select_all(&mut self) -> Vec<u8> {
        let (w, h) = (self.width as usize, self.height as usize);
        let mask = vec![true; w * h];
        let overlay = selection_overlay_rgba(&mask, w, h);
        self.selection = Some(mask);
        overlay
    }

    /// The current selection as an RGBA overlay (empty if nothing is selected) —
    /// lets JS re-draw the overlay (e.g. after an undo) without re-selecting.
    pub fn selection_overlay(&self) -> Vec<u8> {
        match &self.selection {
            Some(m) => selection_overlay_rgba(m, self.width as usize, self.height as usize),
            None => Vec::new(),
        }
    }

    pub fn has_selection(&self) -> bool {
        self.selection
            .as_ref()
            .is_some_and(|m| m.iter().any(|&b| b))
    }

    /// Deselect (Alt+D). No history.
    pub fn clear_selection(&mut self) {
        self.selection = None;
    }

    /// Set how the NEXT tool-produced selection combines with the current one:
    /// 0 = replace (default), 1 = add (union), 2 = subtract. Clamped to 0..=2.
    /// JS sets this from the Shift/Alt modifier when the `ih_selection_bool`
    /// flag is on; it stays 0 otherwise, so behaviour is unchanged.
    pub fn set_selection_combine(&mut self, mode: u8) {
        self.selection_combine = mode.min(2);
    }

    /// OR `mask` into the current selection (boolean add). With no current
    /// selection, the mask BECOMES the selection. An all-false result is
    /// normalised to `None` ("no selection"). No-ops (returns the current
    /// state, no panic across the wasm boundary) when `mask` isn't
    /// canvas-sized. Returns whether anything is selected afterwards.
    ///
    /// The mask is `&[u8]` (non-zero = selected), not `&[bool]` — wasm-bindgen
    /// has no ABI for a `bool` slice, and JS passes a `Uint8Array` anyway.
    pub fn selection_union(&mut self, mask: &[u8]) -> bool {
        let bools: Vec<bool> = mask.iter().map(|&m| m != 0).collect();
        self.union_bools(&bools)
    }

    /// Clear (deselect) every pixel of the current selection that `mask`
    /// covers. When nothing remains selected the selection becomes `None` —
    /// so it reads as "no selection" (what `delete_selection`,
    /// `remove_object`, `selection_to_new_layer` and `has_selection` all
    /// expect), NOT a `Some(all-false)` zero-area selection. No-ops on a
    /// length mismatch. Returns whether anything remains selected.
    ///
    /// `mask` is `&[u8]` (non-zero = covered) — see `selection_union`.
    pub fn selection_subtract(&mut self, mask: &[u8]) -> bool {
        let bools: Vec<bool> = mask.iter().map(|&m| m != 0).collect();
        self.subtract_bools(&bools)
    }

    /// Delete the selected pixels (make them transparent) on the active layer,
    /// then deselect. Snaps history. Returns true if something was selected.
    pub fn delete_selection(&mut self) -> bool {
        let Some(mask) = self.selection.take() else {
            return false;
        };
        if !mask.iter().any(|&b| b) {
            return false;
        }
        self.snap("Delete Selection");
        let data = &mut self.layers[self.active].buf.data;
        for (i, &sel) in mask.iter().enumerate() {
            let p = i * 4;
            if sel && p + 3 < data.len() {
                data[p] = 0;
                data[p + 1] = 0;
                data[p + 2] = 0;
                data[p + 3] = 0;
            }
        }
        self.recomposite();
        true
    }

    /// Place the selected pixels on a NEW layer directly above the active one
    /// (Photoshop's Layer Via Copy / Layer Via Cut — Ctrl+J / Ctrl+Shift+J).
    /// Source pixels come from the ACTIVE layer only, matching the "edits
    /// always land on the active layer" rule `delete_selection` follows.
    ///
    /// `cut = false`: the source layer is left intact. `cut = true`: the
    /// selected pixels are additionally cleared (made transparent) on the
    /// source layer, exactly as `delete_selection` would clear them.
    ///
    /// One history step for the whole operation — the layer insertion reuses
    /// `add_layer`'s id/insert-above-active core via the snap-free
    /// `insert_layer_above_active`, so there is no second "Add Layer" entry.
    /// Deselects after (like `delete_selection`) so no stale mask hangs over
    /// the moved pixels. Returns the new layer id, or 0 when nothing is
    /// selected / the mask is all-false (no history, no mutation).
    pub fn selection_to_new_layer(&mut self, cut: bool) -> u32 {
        // Guard without mutating: `delete_selection`'s take-first shape would
        // drop an all-false selection on the way out; this must be a pure
        // no-op when it returns 0.
        match &self.selection {
            Some(m) if m.iter().any(|&b| b) => {}
            _ => return 0,
        }
        let Some(mask) = self.selection.take() else {
            return 0; // unreachable — the match above proved Some
        };
        self.snap(if cut {
            "Selection to Layer (Cut)"
        } else {
            "Selection to Layer"
        });
        let src_idx = self.active;

        // Bulk-copy the whole source layer, then keep only the selection.
        // A temp Vec sidesteps holding &mut to two layers at once.
        let mut new_data = self.layers[src_idx].buf.data.clone();
        crate::simd::color::mask_clear_rgba(&mut new_data, &mask, false);

        if cut {
            crate::simd::color::mask_clear_rgba(&mut self.layers[src_idx].buf.data, &mask, true);
        }

        let id = self.insert_layer_above_active("");
        self.layers[self.active].buf.data = new_data;
        self.recomposite();
        id
    }

    /// Remove Object (PatchMatch, feature `patchmatch`): reconstructs the
    /// selected region from the surrounding image and writes the result into
    /// the active layer, then deselects. Snaps history like every other
    /// selection action, but deliberately does NOT record an op-log entry —
    /// this kernel's random init/search makes it effectively nondeterministic
    /// in real use (a fresh seed every call — see `patchmatch_seed_counter`),
    /// so recording it as a replayable `Op` would sign up for a replay-parity
    /// contract it can't honestly keep. Same pattern as `rotate_90_cw` /
    /// `resize_canvas` / `set_artboard_border`: the op-log's own sync check
    /// (`oplog_engine_in_sync`) catches the resulting mismatch on the next
    /// op-log undo/redo attempt and falls back to snapshot undo, safely and
    /// silently — never a wrong replay.
    ///
    /// Source patches are matched against the full visible composite (so a
    /// removal can draw on context from every layer), but the reconstructed
    /// pixels are written into the ACTIVE layer only — the same "edits always
    /// land on the active layer" rule `delete_selection` follows just above.
    ///
    /// Returns false (no history pushed, nothing mutated) when nothing is
    /// selected, the image is empty, or the composite cache is stale/short —
    /// the same guard shape `seed_index` uses for every other selection entry
    /// point.
    #[cfg(feature = "patchmatch")]
    pub fn remove_object(&mut self) -> bool {
        let Some(mask) = self.selection.take() else {
            return false;
        };
        if !mask.iter().any(|&b| b) {
            return false;
        }
        let (w, h) = (self.width as usize, self.height as usize);
        if w == 0 || h == 0 || self.composite_cache.len() < w * h * 4 {
            return false;
        }
        self.snap("Remove Object");
        let seed = self.patchmatch_seed_counter;
        self.patchmatch_seed_counter = self.patchmatch_seed_counter.wrapping_add(1);
        let filled = crate::patchmatch::inpaint(&self.composite_cache, w, h, &mask, seed);
        let data = &mut self.layers[self.active].buf.data;
        for (i, &sel) in mask.iter().enumerate() {
            let p = i * 4;
            if sel && p + 3 < data.len() && p + 3 < filled.len() {
                data[p] = filled[p];
                data[p + 1] = filled[p + 1];
                data[p + 2] = filled[p + 2];
                data[p + 3] = filled[p + 3];
            }
        }
        self.recomposite();
        true
    }

    // ── Magnetic lasso (live-wire) ──────────────────────────────────────────
    // The stub shipped in v7.23 said "the path-finding kernel is the remaining
    // piece". This is that piece, wired up. The kernels are in `livewire.rs`;
    // everything here is session bookkeeping, and it ends exactly where the
    // wands end — `self.selection = Some(Vec<bool>)` plus the same overlay RGBA.
    // Nothing downstream (Delete, Deselect, the overlay blit) learns that a
    // lasso produced this mask.

    /// Start a lasso session at the first anchor. Computes the edge cost map
    /// ONCE for the whole session (a Sobel pass per mouse-move would be
    /// unusable, and a fixed map means the ground doesn't shift under the wire
    /// while you draw). Returns false if the click is out of bounds or the
    /// image is empty — no panic across the boundary.
    pub fn lasso_begin(&mut self, x: f64, y: f64) -> bool {
        let (w, h) = (self.width as usize, self.height as usize);
        if self.seed_index(x, y).is_none() {
            return false;
        }
        let anchor = (x.round() as u32, y.round() as u32);
        let mag = crate::edges::sobel_magnitude(&self.composite_cache, w, h);
        self.lasso = Some(crate::livewire::LassoState {
            cost: crate::edges::edge_cost_map(&mag),
            w,
            h,
            anchors: vec![anchor],
            path: vec![anchor],
        });
        true
    }

    /// The live wire: the minimum-cost path from the last anchor to the cursor,
    /// as flat `[x0, y0, x1, y1, …]` pairs for the JS overlay to draw. Does not
    /// mutate the session — this is a *preview*, called on every mouse-move.
    /// Empty when no lasso is running.
    pub fn lasso_path_to(&self, x: f64, y: f64) -> Vec<i32> {
        let Some(l) = &self.lasso else {
            return Vec::new();
        };
        let Some(&from) = l.anchors.last() else {
            return Vec::new();
        };
        let to = Self::clamp_to_image(x, y, l.w, l.h);
        crate::livewire::flatten(&crate::livewire::min_cost_path(&l.cost, l.w, l.h, from, to))
    }

    /// Commit the live wire: freeze the path from the last anchor to (x,y) into
    /// the committed polyline and drop a new anchor there. Returns the new
    /// anchor count (0 = no session).
    pub fn lasso_commit(&mut self, x: f64, y: f64) -> u32 {
        let Some(l) = &mut self.lasso else {
            return 0;
        };
        let Some(&from) = l.anchors.last() else {
            return 0;
        };
        let to = Self::clamp_to_image(x, y, l.w, l.h);
        let seg = crate::livewire::min_cost_path(&l.cost, l.w, l.h, from, to);
        // `seg[0]` is the previous anchor, already the tail of `path`.
        l.path.extend_from_slice(&seg[1..]);
        l.anchors.push(to);
        l.anchors.len() as u32
    }

    /// The committed path so far, as flat `[x, y, …]` pairs — lets JS redraw
    /// the frozen part of the lasso (after a re-render) without re-walking it.
    pub fn lasso_committed_path(&self) -> Vec<i32> {
        match &self.lasso {
            Some(l) => crate::livewire::flatten(&l.path),
            None => Vec::new(),
        }
    }

    /// Is a lasso session in progress?
    pub fn lasso_active(&self) -> bool {
        self.lasso.is_some()
    }

    /// Close the loop: live-wire from the last anchor back to the first, fill
    /// the enclosed region, and store it as THE selection. Returns the same
    /// canvas-sized overlay RGBA every other selection tool returns (empty if
    /// there's no session, or fewer than 3 anchors — two anchors enclose no
    /// area, and silently selecting nothing is worse than selecting nothing
    /// loudly).
    pub fn lasso_close(&mut self) -> Vec<u8> {
        let Some(l) = self.lasso.take() else {
            return Vec::new();
        };
        // Destructured rather than indexed: three anchors or it isn't a loop,
        // and this way the endpoints come out of the pattern match instead of
        // an `unwrap` that a future edit could turn into a panic across the
        // wasm boundary.
        let ([first, ..], [.., last]) = (&l.anchors[..], &l.anchors[..]) else {
            return Vec::new();
        };
        if l.anchors.len() < 3 {
            return Vec::new();
        }
        let (first, last) = (*first, *last);
        let (w, h) = (l.w, l.h);
        // The closing segment: last anchor → first anchor, wired like any other.
        let mut loop_px = l.path;
        let closing = crate::livewire::min_cost_path(&l.cost, w, h, last, first);
        // Drop both shared endpoints: `loop_px` already ends at the last anchor,
        // and the loop's start IS the first anchor.
        if closing.len() > 2 {
            loop_px.extend_from_slice(&closing[1..closing.len() - 1]);
        }

        let mask = crate::livewire::mask_from_loop(&loop_px, w, h);
        self.apply_produced_selection(mask)
    }

    /// Abandon the lasso session (Esc). Drops the cost map; leaves any existing
    /// selection alone.
    pub fn lasso_cancel(&mut self) {
        self.lasso = None;
    }
}

impl ImageHorseTool {
    /// Clamp a canvas coord into the image. The lasso tracks the cursor
    /// continuously, and a cursor that leaves the canvas must pin to the border
    /// rather than return nothing (which would freeze the wire) or index out of
    /// bounds (which would panic across the wasm boundary).
    fn clamp_to_image(x: f64, y: f64, w: usize, h: usize) -> (u32, u32) {
        let cx = x.round().clamp(0.0, w.saturating_sub(1) as f64);
        let cy = y.round().clamp(0.0, h.saturating_sub(1) as f64);
        (cx as u32, cy as u32)
    }
}
// Session-level coverage for the `#[wasm_bindgen]` lasso methods above. The
// kernel (`livewire.rs`) has its own thorough unit tests, but nothing
// previously drove `lasso_begin`/`lasso_path_to`/`lasso_commit`/`lasso_close`/
// `lasso_cancel` as the JS click handler actually calls them — the session
// bookkeeping in THIS file was untested. These are that coverage.
#[cfg(test)]
mod lasso_session_tests {
    use crate::ImageHorseTool;

    const CX: f64 = 40.0;
    const CY: f64 = 40.0;
    const R: f64 = 25.0;

    fn disc(w: u32, h: u32) -> Vec<u8> {
        let mut v = vec![0u8; (w * h * 4) as usize];
        for y in 0..h {
            for x in 0..w {
                let dx = x as f64 - CX;
                let dy = y as f64 - CY;
                let inside = (dx * dx + dy * dy).sqrt() <= R;
                let c: [u8; 4] = if inside {
                    [20, 20, 20, 255]
                } else {
                    [230, 230, 230, 255]
                };
                let i = ((y * w + x) * 4) as usize;
                v[i..i + 4].copy_from_slice(&c);
            }
        }
        v
    }

    fn solid(w: u32, h: u32, c: [u8; 4]) -> Vec<u8> {
        let mut v = vec![0u8; (w * h * 4) as usize];
        for px in v.chunks_exact_mut(4) {
            px.copy_from_slice(&c);
        }
        v
    }

    /// The exact sequence `handleSelectionClick`/`handleLassoMove`/
    /// `handleLassoClose` drive: begin, a move-preview, three more committed
    /// anchors, then a double-click close (which — because a real double-click
    /// fires TWO `click` events before `dblclick` — commits one real anchor at
    /// the close point plus one duplicate before closing). Ends by feeding the
    /// resulting selection into `delete_selection`, the very next thing a real
    /// session does.
    #[test]
    fn full_session_click_sequence_selects_the_disc() {
        let (w, h) = (80u32, 80u32);
        let mut t = ImageHorseTool::new(w, h);
        t.load_image(&disc(w, h));
        t.recomposite();

        assert!(!t.lasso_active(), "no session before begin");

        // Click 1: begin, loose anchor above the disc.
        assert!(t.lasso_begin(40.0, 12.0));
        assert!(t.lasso_active());

        // Mouse-move preview toward the next anchor — must not mutate state.
        let preview = t.lasso_path_to(68.0, 40.0);
        assert!(!preview.is_empty(), "preview wire must draw something");

        // Click 2, 3, 4: commit three more loose anchors around the disc.
        assert_eq!(t.lasso_commit(68.0, 40.0), 2);
        assert_eq!(t.lasso_commit(40.0, 68.0), 3);
        assert_eq!(t.lasso_commit(12.0, 40.0), 4);

        let committed = t.lasso_committed_path();
        assert!(!committed.is_empty(), "committed path must be non-empty");

        // Double-click to close: browsers fire click(anchor5) + click(anchor5
        // dup) + dblclick, so simulate that exactly like the JS handler does.
        assert_eq!(t.lasso_commit(40.0, 12.0), 5); // closing click #1 (real)
        assert_eq!(t.lasso_commit(40.0, 12.0), 6); // closing click #2 (dup)
        let overlay = t.lasso_close();

        assert!(!t.lasso_active(), "session must end on close");
        assert!(
            !overlay.is_empty(),
            "lasso_close must return a real overlay"
        );
        assert_eq!(overlay.len(), (w * h * 4) as usize);

        // The overlay marks alpha>0 wherever selected. Disc centre selected,
        // background corner not.
        let alpha_at = |x: u32, y: u32| overlay[((y * w + x) * 4 + 3) as usize];
        assert!(alpha_at(40, 40) > 0, "disc centre must be selected");
        assert_eq!(alpha_at(2, 2), 0, "background corner must not be selected");
        assert_eq!(
            alpha_at(77, 77),
            0,
            "background corner must not be selected"
        );

        // And delete_selection (the very next thing a real session feeds into)
        // must actually erase the selected disc, not silently no-op.
        assert!(t.delete_selection());
        let data = t.get_image_data();
        let center_alpha = data[((40 * w + 40) * 4 + 3) as usize];
        assert_eq!(
            center_alpha, 0,
            "deleting the lasso selection must erase the disc centre"
        );
    }

    #[test]
    fn cancel_drops_the_session_without_touching_any_existing_selection() {
        let (w, h) = (80u32, 80u32);
        let mut t = ImageHorseTool::new(w, h);
        t.load_image(&disc(w, h));
        t.recomposite();

        // An existing plain selection from the wand.
        let wand_mask = t.magic_wand_select(40.0, 40.0, 20);
        assert!(!wand_mask.is_empty());

        t.lasso_begin(10.0, 10.0);
        t.lasso_commit(20.0, 10.0);
        assert!(t.lasso_active());
        t.lasso_cancel();
        assert!(!t.lasso_active(), "Esc must end the session");

        // The wand selection from before the lasso session must be untouched.
        assert!(
            t.delete_selection(),
            "the pre-existing wand selection must survive an Esc-cancelled lasso"
        );
    }

    /// Degenerate close: begin, then immediately double-click. `anchors` ends
    /// up `[begin, dblclick-real, dblclick-dup]` — length 3, which clears the
    /// `< 3` gate in `lasso_close` even though there are really only two
    /// distinct positions. It must not panic and must not return a
    /// mis-sized/garbage overlay; a thin-to-empty selection is the honest
    /// result of two points enclosing no real area.
    #[test]
    fn a_two_point_close_degrades_safely_instead_of_selecting_garbage() {
        let (w, h) = (80u32, 80u32);
        let mut t = ImageHorseTool::new(w, h);
        t.load_image(&disc(w, h));
        t.recomposite();

        t.lasso_begin(10.0, 10.0);
        t.lasso_commit(60.0, 60.0); // closing click #1 (real)
        t.lasso_commit(60.0, 60.0); // closing click #2 (dup, same pixel)
        let overlay = t.lasso_close();

        assert_eq!(
            overlay.len(),
            (w * h * 4) as usize,
            "overlay stays canvas-sized"
        );
        let selected: u32 = overlay.chunks_exact(4).map(|p| (p[3] > 0) as u32).sum();
        let disc_area = (std::f64::consts::PI * R * R) as u32;
        assert!(
            selected < disc_area / 4,
            "two real points enclose no real area — {selected}px is not a sane disc selection"
        );
    }

    /// Regression: a lasso session left open mid-loop used to survive
    /// `load_image`/`load_image_artboard` — the cost map and anchors kept
    /// referencing the OLD document's dimensions, so `lasso_active()` still
    /// read true on the new one and a later commit/close would read past
    /// the new document's actual size.
    #[test]
    fn load_image_clears_any_lasso_session_left_open_from_the_previous_document() {
        let mut t = ImageHorseTool::new(80, 80);
        t.load_image(&solid(80, 80, [10, 10, 10, 255]));
        t.recomposite();

        t.lasso_begin(10.0, 10.0);
        t.lasso_commit(60.0, 10.0);
        assert!(t.lasso_active(), "session open on document #1");

        // Same-size reload — isolates "does load_image reset session state"
        // from the separate `Layer::load` dimension-matching precondition.
        t.load_image(&solid(80, 80, [200, 200, 200, 255]));
        assert!(
            !t.lasso_active(),
            "a fresh load_image must not inherit the previous document's lasso session"
        );
    }

    #[test]
    fn load_image_artboard_clears_any_lasso_session_left_open_from_the_previous_document() {
        let mut t = ImageHorseTool::new(80, 80);
        t.load_image(&solid(80, 80, [10, 10, 10, 255]));
        t.recomposite();

        t.lasso_begin(10.0, 10.0);
        t.lasso_commit(60.0, 10.0);
        assert!(t.lasso_active());

        t.load_image_artboard(
            &solid(40, 40, [200, 200, 200, 255]),
            40,
            40,
            4,
            255,
            255,
            255,
            255,
        );
        assert!(
            !t.lasso_active(),
            "load_image_artboard must not inherit the previous document's lasso session"
        );
    }
}

/// Regression coverage for the `oplog_restore` path specifically: it is the
/// ONE load path that can reuse a live `ImageHorseTool` across a document
/// swap (a gallery switch reuses the engine; `oplog_restore` replaces the
/// document wholesale) rather than constructing a fresh tool — see
/// `useCloneStamp.ts`'s `restoreFromOplog`. Gated on `tiles` like the rest of
/// the op-log surface (ADR-017): it does not exist in a bare `cargo test`.
#[cfg(all(test, feature = "tiles"))]
mod lasso_oplog_restore_tests {
    use crate::ImageHorseTool;

    fn solid(w: u32, h: u32, c: [u8; 4]) -> Vec<u8> {
        let mut v = vec![0u8; (w * h * 4) as usize];
        for px in v.chunks_exact_mut(4) {
            px.copy_from_slice(&c);
        }
        v
    }

    #[test]
    fn oplog_restore_clears_any_lasso_session_left_open_from_the_previous_document() {
        let mut t = ImageHorseTool::new(80, 80);
        t.load_image(&solid(80, 80, [10, 10, 10, 255]));
        t.recomposite();

        t.lasso_begin(10.0, 10.0);
        t.lasso_commit(60.0, 10.0);
        assert!(
            t.lasso_active(),
            "session open on the document being replaced"
        );

        // A differently-sized document restored into the SAME live tool, the
        // way a gallery switch reuses the engine.
        let restored = t.oplog_restore(&solid(40, 40, [50, 50, 50, 255]), 40, 40, &[], &[], 0);
        assert!(
            restored,
            "restore itself must succeed for this test to mean anything"
        );
        assert!(
            !t.lasso_active(),
            "oplog_restore must not inherit the previous document's lasso session"
        );
    }
}

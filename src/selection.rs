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
        let overlay = selection_overlay_rgba(&mask, w, h);
        self.selection = Some(mask);
        overlay
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
        let overlay = selection_overlay_rgba(&mask, w, h);
        self.selection = Some(mask);
        overlay
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
        let overlay = selection_overlay_rgba(&mask, w, h);
        self.selection = Some(mask);
        overlay
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
        let overlay = selection_overlay_rgba(&mask, w, h);
        self.selection = Some(mask);
        overlay
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

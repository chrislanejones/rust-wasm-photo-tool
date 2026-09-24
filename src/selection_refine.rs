//! Selection refine: the Refine section's five operations, all integer and
//! deterministic, so no float or GPU drift can ever make two machines disagree
//! about which pixels are selected.
//!
//! | Op              | How                                              |
//! |-----------------|--------------------------------------------------|
//! | Remove islands  | connected components; drop selected ones < N px  |
//! | Fill holes      | the same on the UNselected plane (invert → drop → invert) |
//! | Smooth          | morphological open, then close, radius r         |
//! | Expand/Contract | dilate / erode by a signed radius                |
//! | Feather         | integer box blur, two passes → a u8 mask plane   |
//!
//! The first four act on the selection itself, which is `Vec<bool>`. Feather
//! cannot: a soft edge is not a bool. It produces the grayscale plane a layer
//! mask is made from (`add_layer_mask_from`), which is where a soft edge means
//! something.
//!
//! Connected components are NOT a second flood fill. They run on
//! `selection::flood_barrier_into`, the flood core the lasso and the Smart
//! Brush already share: its `open` closure is called exactly once for each
//! pixel it newly reaches, so it doubles as the member list of a component.
//!
//! The structuring element is a square (Chebyshev radius). Each dilation is a
//! separable running-count pass, O(pixels) whatever the radius. Pixels outside
//! the image count as neither selected nor unselected for the window — a
//! selection that touches the edge keeps touching it after an erode.

use std::cell::RefCell;

use crate::selection::{flood_barrier_into, selection_overlay_rgba};
use crate::ImageHorseTool;
use wasm_bindgen::prelude::*;

/// The largest radius or size any op accepts. Bounds the work a slider can ask
/// for, and keeps `usize` window arithmetic far from overflow.
const MAX_RADIUS: u32 = 64;
const MAX_AREA: u32 = 1_000_000;

/// The four ops that act on the selection, in the order they run: remove
/// islands, fill holes, smooth, expand. Zero is "off" for each.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(crate) struct Refine {
    pub islands: u32,
    pub holes: u32,
    pub smooth: u32,
    pub expand: i32,
}

impl Refine {
    fn clamped(self) -> Self {
        let r = MAX_RADIUS as i32;
        Self {
            islands: self.islands.min(MAX_AREA),
            holes: self.holes.min(MAX_AREA),
            smooth: self.smooth.min(MAX_RADIUS),
            expand: self.expand.clamp(-r, r),
        }
    }
}

/// Flip every 4-connected component of `target` pixels smaller than `min` to
/// the other value. `target = true` removes islands; `false` fills holes.
pub(crate) fn drop_small_components(mask: &mut [bool], w: usize, h: usize, target: bool, min: u32) {
    let n = w * h;
    if min == 0 || n == 0 || mask.len() < n {
        return;
    }
    let mut reach = vec![false; n];
    let mut stack = Vec::new();
    let members = RefCell::new(Vec::new());
    for s in 0..n {
        if reach[s] || mask[s] != target {
            continue;
        }
        members.borrow_mut().clear();
        {
            let plane: &[bool] = mask;
            flood_barrier_into(&mut reach, w, &[s], (0, 0, w - 1, h - 1), &mut stack, |i| {
                let open = plane[i] == target;
                if open {
                    members.borrow_mut().push(i);
                }
                open
            });
        }
        let m = members.borrow();
        if (m.len() as u64) < min as u64 {
            for &i in m.iter() {
                mask[i] = !target;
            }
        }
    }
}

/// True where any pixel within Chebyshev radius `r` is true. Separable: a
/// running count along rows, then along columns.
pub(crate) fn dilate(mask: &[bool], w: usize, h: usize, r: usize) -> Vec<bool> {
    if r == 0 || w == 0 || h == 0 {
        return mask.to_vec();
    }
    let mut rows = vec![false; w * h];
    let mut prefix = vec![0u32; w.max(h) + 1];
    for y in 0..h {
        let row = &mask[y * w..(y + 1) * w];
        for x in 0..w {
            prefix[x + 1] = prefix[x] + row[x] as u32;
        }
        for x in 0..w {
            let lo = x.saturating_sub(r);
            let hi = (x + r + 1).min(w);
            rows[y * w + x] = prefix[hi] > prefix[lo];
        }
    }
    let mut out = vec![false; w * h];
    for x in 0..w {
        for y in 0..h {
            prefix[y + 1] = prefix[y] + rows[y * w + x] as u32;
        }
        for y in 0..h {
            let lo = y.saturating_sub(r);
            let hi = (y + r + 1).min(h);
            out[y * w + x] = prefix[hi] > prefix[lo];
        }
    }
    out
}

/// True where every pixel within radius `r` (inside the image) is true.
pub(crate) fn erode(mask: &[bool], w: usize, h: usize, r: usize) -> Vec<bool> {
    let inv: Vec<bool> = mask.iter().map(|&b| !b).collect();
    dilate(&inv, w, h, r).into_iter().map(|b| !b).collect()
}

/// Run the four selection ops in order and return the refined plane.
pub(crate) fn refine_mask(mask: &[bool], w: usize, h: usize, p: Refine) -> Vec<bool> {
    let p = p.clamped();
    let mut m = mask.to_vec();
    drop_small_components(&mut m, w, h, true, p.islands);
    drop_small_components(&mut m, w, h, false, p.holes);
    if p.smooth > 0 {
        let r = p.smooth as usize;
        // Open (erode, dilate) takes off spurs; close (dilate, erode) fills notches.
        m = dilate(&erode(&m, w, h, r), w, h, r);
        m = erode(&dilate(&m, w, h, r), w, h, r);
    }
    if p.expand > 0 {
        m = dilate(&m, w, h, p.expand as usize);
    } else if p.expand < 0 {
        m = erode(&m, w, h, p.expand.unsigned_abs() as usize);
    }
    m
}

/// One integer box-blur pass of radius `r` over a u8 plane, separable, with the
/// window clamped at the edges and rounded to nearest.
fn box_pass(src: &[u8], w: usize, h: usize, r: usize) -> Vec<u8> {
    let mut tmp = vec![0u8; w * h];
    let mut prefix = vec![0u32; w.max(h) + 1];
    for y in 0..h {
        for x in 0..w {
            prefix[x + 1] = prefix[x] + src[y * w + x] as u32;
        }
        for x in 0..w {
            let lo = x.saturating_sub(r);
            let hi = (x + r + 1).min(w);
            let cnt = (hi - lo) as u32;
            tmp[y * w + x] = ((prefix[hi] - prefix[lo] + cnt / 2) / cnt) as u8;
        }
    }
    let mut out = vec![0u8; w * h];
    for x in 0..w {
        for y in 0..h {
            prefix[y + 1] = prefix[y] + tmp[y * w + x] as u32;
        }
        for y in 0..h {
            let lo = y.saturating_sub(r);
            let hi = (y + r + 1).min(h);
            let cnt = (hi - lo) as u32;
            out[y * w + x] = ((prefix[hi] - prefix[lo] + cnt / 2) / cnt) as u8;
        }
    }
    out
}

/// The selection as a grayscale mask plane: 255 selected, 0 not, softened by
/// two integer box-blur passes of radius `feather` (0 = hard edge). `invert`
/// swaps the two, for "Hide selection".
pub(crate) fn mask_plane(mask: &[bool], w: usize, h: usize, feather: u32, invert: bool) -> Vec<u8> {
    let on = if invert { 0u8 } else { 255 };
    let mut plane: Vec<u8> = mask
        .iter()
        .map(|&b| if b { on } else { 255 - on })
        .collect();
    let r = feather.min(MAX_RADIUS) as usize;
    if r > 0 && w > 0 && h > 0 {
        plane = box_pass(&plane, w, h, r);
        plane = box_pass(&plane, w, h, r);
    }
    plane
}

impl ImageHorseTool {
    fn refined_selection(&self, p: Refine) -> Option<Vec<bool>> {
        let (w, h) = (self.width as usize, self.height as usize);
        let cur = self.selection.as_ref()?;
        Some(refine_mask(cur, w, h, p))
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Preview the Refine sliders on a COPY: returns the overlay the refined
    /// selection would draw, and keeps that copy only so
    /// `selection_refine_preview_coverage` can report what it costs. The
    /// selection and the history are untouched. A refine that selects nothing
    /// returns a full-size TRANSPARENT overlay, not an empty one — the canvas
    /// overlay skips a short buffer without clearing, and would leave the old
    /// ants on screen. Empty only when nothing is selected to refine.
    pub fn selection_refine_preview(
        &mut self,
        islands: u32,
        holes: u32,
        smooth: u32,
        expand: i32,
    ) -> Vec<u8> {
        let p = Refine {
            islands,
            holes,
            smooth,
            expand,
        };
        self.refine_preview = self.refined_selection(p);
        match &self.refine_preview {
            Some(m) => selection_overlay_rgba(m, self.width as usize, self.height as usize),
            None => Vec::new(),
        }
    }

    /// `[selected, total]` of the last preview — the readout while a slider is
    /// moving. `[0, total]` when there is no preview.
    pub fn selection_refine_preview_coverage(&self) -> Vec<u32> {
        let (sel, total) = crate::selection::mask_coverage(
            self.refine_preview.as_deref(),
            self.width,
            self.height,
        );
        vec![sel, total]
    }

    /// Drop the preview copy (the panel closed, or the selection changed).
    pub fn selection_refine_cancel(&mut self) {
        self.refine_preview = None;
    }

    /// Apply the Refine ops to the selection: ONE undo step ("Refine
    /// Selection"), a selection-only snapshot like every other selection
    /// change — deliberately not an op-log record (ADR-068). Recomputed from
    /// the parameters, never taken from the preview copy, so a stale preview
    /// cannot be committed. Returns the overlay; no step when nothing changes.
    pub fn selection_refine_apply(
        &mut self,
        islands: u32,
        holes: u32,
        smooth: u32,
        expand: i32,
    ) -> Vec<u8> {
        self.refine_preview = None;
        let p = Refine {
            islands,
            holes,
            smooth,
            expand,
        };
        if let Some(next) = self.refined_selection(p) {
            let next = if next.iter().any(|&b| b) {
                Some(next)
            } else {
                None
            };
            if next != self.selection {
                self.snap_selection("Refine Selection");
                self.selection = next;
            }
        }
        self.selection_overlay()
    }

    /// Add a mask to layer `id`, filled from `source`: 0 reveal all (white),
    /// 1 hide all (black), 2 reveal the selection, 3 hide the selection.
    /// `feather` softens the selection's edge (sources 2 and 3 only). One undo
    /// step. False if the layer is missing or already masked, or a selection
    /// source was asked for with nothing selected.
    pub fn add_layer_mask_from(&mut self, id: u32, source: u8, feather: u32) -> bool {
        let (w, h) = (self.width as usize, self.height as usize);
        let n = w * h;
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if self.layers[idx].mask.as_ref().is_some_and(|m| m.len() == n) {
            return false;
        }
        let plane = match source {
            0 => vec![255u8; n],
            1 => vec![0u8; n],
            2 | 3 => match &self.selection {
                Some(sel) if sel.len() == n && sel.iter().any(|&b| b) => {
                    mask_plane(sel, w, h, feather, source == 3)
                }
                _ => return false,
            },
            _ => return false,
        };
        self.snap("Add Mask");
        let hides_anything = plane.iter().any(|&v| v != 255);
        self.layers[idx].mask = Some(plane);
        if hides_anything {
            self.recomposite();
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A plane from rows of `#` (selected) and `.` — the expected output of a
    /// test is written the same way, so it reads as a picture.
    fn plane(rows: &[&str]) -> (Vec<bool>, usize, usize) {
        let h = rows.len();
        let w = rows[0].len();
        let m = rows
            .iter()
            .flat_map(|r| r.bytes().map(|b| b == b'#'))
            .collect();
        (m, w, h)
    }

    fn picture(m: &[bool], w: usize) -> Vec<String> {
        m.chunks(w)
            .map(|r| r.iter().map(|&b| if b { '#' } else { '.' }).collect())
            .collect()
    }

    #[test]
    fn dilate_grows_a_pixel_into_a_square() {
        let (m, w, h) = plane(&[".....", ".....", "..#..", ".....", "....."]);
        let out = dilate(&m, w, h, 1);
        assert_eq!(
            picture(&out, w),
            [".....", ".###.", ".###.", ".###.", "....."]
        );
    }

    #[test]
    fn erode_keeps_only_the_core_and_keeps_an_edge_touching_the_border() {
        let (m, w, h) = plane(&["###..", "###..", "###..", ".....", "....."]);
        let out = erode(&m, w, h, 1);
        // Outside the image counts for nothing, so the corner block keeps the
        // pixels that touch the edge and loses only its inner rim.
        assert_eq!(
            picture(&out, w),
            ["##...", "##...", ".....", ".....", "....."]
        );
    }

    #[test]
    fn mask_plane_is_255_and_0_with_no_feather() {
        let (m, w, h) = plane(&["#.", ".#"]);
        assert_eq!(mask_plane(&m, w, h, 0, false), vec![255, 0, 0, 255]);
        assert_eq!(mask_plane(&m, w, h, 0, true), vec![0, 255, 255, 0]);
    }

    #[test]
    fn feather_is_two_integer_box_passes() {
        // One row, radius 1. Pass 1 over [0,0,255,0,0] gives window means
        // (0, 85, 85, 85, 0) — the clamped end windows have 2 samples, the
        // rest 3, rounded to nearest. Pass 2 over that gives the literal below.
        let (m, w, h) = plane(&["..#.."]);
        assert_eq!(mask_plane(&m, w, h, 1, false), vec![43, 57, 85, 57, 43]);
    }

    #[test]
    fn feather_is_symmetric_and_deterministic() {
        let (m, w, h) = plane(&[".......", "..###..", "..###..", "..###..", "......."]);
        let a = mask_plane(&m, w, h, 2, false);
        assert_eq!(a, mask_plane(&m, w, h, 2, false));
        for y in 0..h {
            for x in 0..w {
                assert_eq!(a[y * w + x], a[y * w + (w - 1 - x)], "mirror x at {x},{y}");
                assert_eq!(a[y * w + x], a[(h - 1 - y) * w + x], "mirror y at {x},{y}");
            }
        }
    }
}

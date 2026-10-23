//! Screenshot comparison (Night 10-23): find what changed between two
//! photos, and pin each change with a box and a numbered pin in ONE step.
//!
//! The diff is measured on 4 × 4 blocks first: a block counts as changed when
//! the AVERAGE of some channel moved by more than `tolerance`. Averaging is
//! what makes the default ignore JPEG ringing and anti-aliasing (both swing
//! single pixels and cancel over a block) while a one-pixel text stroke still
//! moves a block by a quarter of its contrast. Changed blocks are dilated by
//! `merge_px` so the parts of one change (a label's letters) join, labeled
//! into connected components, and each component's box is then fitted to the
//! changed PIXELS inside it, so a box hugs the change rather than the grid.
//!
//! The tint is a view: `compare_photo` hands the mask to the page and keeps
//! nothing. `mark_regions` is the only call here that edits the document, and
//! it adds ordinary rectangles and pins under one `snap` — on the op log they
//! are plain adds grouped by ADR-088's gesture marker. No format change.
use crate::ImageHorseTool;
use wasm_bindgen::prelude::*;

const BLOCK: u32 = 4;

/// One RGBA image (or a window of one) to compare: `px` rows of `stride`
/// pixels, the compared area starting at (`x`, `y`).
pub struct View<'a> {
    pub px: &'a [u8],
    pub stride: u32,
    pub x: u32,
    pub y: u32,
}

impl View<'_> {
    #[inline]
    fn at(&self, x: u32, y: u32) -> usize {
        (((self.y + y) * self.stride + self.x + x) * 4) as usize
    }
}

/// One change: its box (in the compared area's pixels) and how many pixels
/// in it changed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Region {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
    pub px: u32,
}

/// What `diff_regions` found. `mask` is one byte per pixel of the `w` × `h`
/// area, 1 where a pixel is part of a kept change.
pub struct Diff {
    pub w: u32,
    pub h: u32,
    pub mask: Vec<u8>,
    pub regions: Vec<Region>,
}

/// The largest channel difference between two pixels.
#[inline]
fn px_diff(a: &[u8], b: &[u8]) -> u8 {
    let mut d = 0;
    for c in 0..4 {
        d = d.max(a[c].abs_diff(b[c]));
    }
    d
}

/// Compare the `w` × `h` area of `a` and `b`. A block changes when one of its
/// channel averages moves by more than `tolerance`; a pixel inside a changed
/// block is tinted when it moved by more than `tolerance` itself. Changes
/// closer than `merge_px` join; a change of fewer than `min_area` changed
/// pixels is dropped as a speck. Regions come in reading order (top to
/// bottom, then left to right).
pub fn diff_regions(
    a: &View,
    b: &View,
    w: u32,
    h: u32,
    tolerance: u8,
    merge_px: u32,
    min_area: u32,
) -> Diff {
    let (gw, gh) = (w.div_ceil(BLOCK), h.div_ceil(BLOCK));
    let cells = (gw * gh) as usize;
    let mut mask = vec![0u8; (w * h) as usize];
    if cells == 0 {
        return Diff {
            w,
            h,
            mask,
            regions: Vec::new(),
        };
    }

    // 1. Per-block channel sums, a row of blocks at a time.
    let mut changed = vec![false; cells];
    let mut sums = vec![[0i32; 4]; gw as usize];
    for by in 0..gh {
        sums.iter_mut().for_each(|s| *s = [0; 4]);
        let (y0, y1) = (by * BLOCK, ((by + 1) * BLOCK).min(h));
        for y in y0..y1 {
            let (ia, ib, n) = (a.at(0, y), b.at(0, y), w as usize * 4);
            let rows = a.px[ia..ia + n]
                .chunks_exact(4)
                .zip(b.px[ib..ib + n].chunks_exact(4));
            for (x, (pa, pb)) in rows.enumerate() {
                let s = &mut sums[x / BLOCK as usize];
                for ((s, &va), &vb) in s.iter_mut().zip(pa).zip(pb) {
                    *s += va as i32 - vb as i32;
                }
            }
        }
        for bx in 0..gw {
            let n = ((((bx + 1) * BLOCK).min(w) - bx * BLOCK) * (y1 - y0)) as i32;
            let worst = sums[bx as usize].iter().map(|s| s.abs()).max().unwrap_or(0);
            changed[(by * gw + bx) as usize] = worst > tolerance as i32 * n;
        }
    }

    // 2. Dilate by `merge_px` (in blocks, rounded up), rows then columns.
    let r = merge_px.div_ceil(BLOCK) as i64;
    let grown = dilate(&changed, gw as usize, gh as usize, r);

    // 3. Connected components of the dilated grid (4-neighbors).
    let mut label = vec![0u32; cells];
    let mut stack: Vec<usize> = Vec::new();
    let mut n_labels = 0u32;
    for start in 0..cells {
        if !grown[start] || label[start] != 0 {
            continue;
        }
        n_labels += 1;
        label[start] = n_labels;
        stack.push(start);
        while let Some(i) = stack.pop() {
            let (cx, cy) = (i % gw as usize, i / gw as usize);
            let mut visit = |j: usize| {
                if grown[j] && label[j] == 0 {
                    label[j] = n_labels;
                    stack.push(j);
                }
            };
            if cx > 0 {
                visit(i - 1);
            }
            if cx + 1 < gw as usize {
                visit(i + 1);
            }
            if cy > 0 {
                visit(i - gw as usize);
            }
            if cy + 1 < gh as usize {
                visit(i + gw as usize);
            }
        }
    }

    // 4. Fit each component's box to its changed pixels. Only blocks that
    //    changed BEFORE dilation count (the halo is for joining, not size),
    //    plus the ring of blocks around them: a change that covers only an
    //    edge of a block leaves that block's average under the tolerance,
    //    and without the ring a 30 px box measures 28. A changed block with
    //    no single pixel over the tolerance (a soft, spread-out change)
    //    counts whole.
    let mut owner = vec![0u32; cells];
    for (i, &is_changed) in changed.iter().enumerate() {
        if is_changed {
            owner[i] = label[i];
        }
    }
    for (i, &is_changed) in changed.iter().enumerate() {
        if !is_changed {
            continue;
        }
        let (bx, by) = ((i as u32 % gw) as i64, (i as u32 / gw) as i64);
        for ny in by - 1..=by + 1 {
            for nx in bx - 1..=bx + 1 {
                if nx >= 0 && ny >= 0 && nx < gw as i64 && ny < gh as i64 {
                    let j = (ny * gw as i64 + nx) as usize;
                    if owner[j] == 0 {
                        owner[j] = label[i];
                    }
                }
            }
        }
    }
    let block = |j: usize| {
        let (x0, y0) = ((j as u32 % gw) * BLOCK, (j as u32 / gw) * BLOCK);
        (x0, y0, (x0 + BLOCK).min(w), (y0 + BLOCK).min(h))
    };
    let mut boxes = vec![(u32::MAX, u32::MAX, 0u32, 0u32, 0u32); n_labels as usize];
    let mut whole = vec![false; cells];
    for j in 0..cells {
        if owner[j] == 0 {
            continue;
        }
        let bb = &mut boxes[(owner[j] - 1) as usize];
        let (x0, y0, x1, y1) = block(j);
        let mut any = false;
        for y in y0..y1 {
            for x in x0..x1 {
                let (ia, ib) = (a.at(x, y), b.at(x, y));
                if px_diff(&a.px[ia..ia + 4], &b.px[ib..ib + 4]) > tolerance {
                    any = true;
                    *bb = (
                        bb.0.min(x),
                        bb.1.min(y),
                        bb.2.max(x + 1),
                        bb.3.max(y + 1),
                        bb.4 + 1,
                    );
                }
            }
        }
        if changed[j] && !any {
            whole[j] = true;
            *bb = (
                bb.0.min(x0),
                bb.1.min(y0),
                bb.2.max(x1),
                bb.3.max(y1),
                bb.4 + (x1 - x0) * (y1 - y0),
            );
        }
    }

    // 5. Keep the changes big enough to matter; tint their pixels.
    let keep: Vec<bool> = boxes.iter().map(|b| b.4 > 0 && b.4 >= min_area).collect();
    for j in 0..cells {
        if owner[j] == 0 || !keep[(owner[j] - 1) as usize] {
            continue;
        }
        let (x0, y0, x1, y1) = block(j);
        for y in y0..y1 {
            for x in x0..x1 {
                let (ia, ib) = (a.at(x, y), b.at(x, y));
                if whole[j] || px_diff(&a.px[ia..ia + 4], &b.px[ib..ib + 4]) > tolerance {
                    mask[(y * w + x) as usize] = 1;
                }
            }
        }
    }
    let mut regions: Vec<Region> = boxes
        .iter()
        .zip(&keep)
        .filter(|(_, &k)| k)
        .map(|(b, _)| Region {
            x: b.0,
            y: b.1,
            w: b.2 - b.0,
            h: b.3 - b.1,
            px: b.4,
        })
        .collect();
    // Reading order. Insertion sort: a handful of regions, and smaller in the
    // binary than the std sorts (see `duplicate_annotations`).
    for i in 1..regions.len() {
        let mut j = i;
        while j > 0 && (regions[j].y, regions[j].x) < (regions[j - 1].y, regions[j - 1].x) {
            regions.swap(j, j - 1);
            j -= 1;
        }
    }
    Diff {
        w,
        h,
        mask,
        regions,
    }
}

/// Square dilation of a `gw` × `gh` grid by `r` cells, as two running-count
/// passes (rows, then columns), so the cost does not grow with `r`.
fn dilate(src: &[bool], gw: usize, gh: usize, r: i64) -> Vec<bool> {
    if r <= 0 {
        return src.to_vec();
    }
    let pass = |src: &[bool], len: usize, lines: usize, at: &dyn Fn(usize, usize) -> usize| {
        let mut out = vec![false; src.len()];
        for l in 0..lines {
            // Count of set cells in the window [i - r, i + r].
            let mut count = 0i64;
            for i in 0..(r as usize).min(len) {
                count += src[at(l, i)] as i64;
            }
            for i in 0..len {
                let add = i + r as usize;
                if add < len {
                    count += src[at(l, add)] as i64;
                }
                if i as i64 > r {
                    count -= src[at(l, i - r as usize - 1)] as i64;
                }
                out[at(l, i)] = count > 0;
            }
        }
        out
    };
    let rows = pass(src, gw, gh, &|l, i| l * gw + i);
    pass(&rows, gh, gw, &|l, i| i * gw + l)
}

/// The diff packed for the page: `[w, h, n, (x, y, w, h, px) × n, mask…]`,
/// the mask one BIT per pixel (32 to a word, row-major, low bit first) so a
/// 2880 × 1800 mask crosses the worker boundary as 650 KB, not 5 MB.
fn pack(d: &Diff, dx: u32, dy: u32) -> Vec<u32> {
    let mut out = Vec::with_capacity(3 + d.regions.len() * 5 + d.mask.len().div_ceil(32));
    out.extend([d.w, d.h, d.regions.len() as u32]);
    for r in &d.regions {
        out.extend([r.x + dx, r.y + dy, r.w, r.h, r.px]);
    }
    for chunk in d.mask.chunks(32) {
        let mut word = 0u32;
        for (i, &m) in chunk.iter().enumerate() {
            word |= (m as u32 & 1) << i;
        }
        out.push(word);
    }
    out
}

/// Compare two same-size RGBA buffers. The engine-free form, for the Rust
/// tests: the same packing as `compare_photo`, regions in `a`'s pixels. Not
/// a wasm export — the page and the bench call `compare_photo`.
pub fn diff_rgba(
    a: &[u8],
    b: &[u8],
    w: u32,
    h: u32,
    tolerance: u8,
    merge_px: u32,
    min_area: u32,
) -> Vec<u32> {
    if a.len() < (w * h * 4) as usize || b.len() < (w * h * 4) as usize {
        return vec![0, 0, 0];
    }
    let (va, vb) = (
        View {
            px: a,
            stride: w,
            x: 0,
            y: 0,
        },
        View {
            px: b,
            stride: w,
            x: 0,
            y: 0,
        },
    );
    pack(
        &diff_regions(&va, &vb, w, h, tolerance, merge_px, min_area),
        0,
        0,
    )
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Compare photo A (`a`, RGBA, `aw` × `ah`) with the open document's
    /// PHOTO — its bottom content layer inside `photo_bounds`, so annotations
    /// already on it never count as changes. Photos of different sizes are
    /// compared over the area they share, anchored top-left. Returns
    /// [`pack`]'s layout with region boxes in DOCUMENT pixels (ready for
    /// `mark_regions`) and the mask over the shared area, which starts at the
    /// photo's top-left: `[w, h, n, …]`. Pushes nothing.
    pub fn compare_photo(
        &self,
        a: &[u8],
        aw: u32,
        ah: u32,
        tolerance: u8,
        merge_px: u32,
        min_area: u32,
    ) -> Vec<u32> {
        let b = self.photo_bounds();
        let Some(photo) = self.layers.iter().find(|l| !l.is_canvas()) else {
            return vec![0, 0, 0];
        };
        let (w, h) = (aw.min(b[2]), ah.min(b[3]));
        if a.len() < (aw * ah * 4) as usize
            || photo.buf.data.len() < (self.width * self.height * 4) as usize
        {
            return vec![0, 0, 0];
        }
        let va = View {
            px: a,
            stride: aw,
            x: 0,
            y: 0,
        };
        let vb = View {
            px: &photo.buf.data,
            stride: self.width,
            x: b[0],
            y: b[1],
        };
        pack(
            &diff_regions(&va, &vb, w, h, tolerance, merge_px, min_area),
            b[0],
            b[1],
        )
    }

    /// Mark each region (`regions`: x, y, w, h quads in document pixels) with
    /// an unfilled rectangle `pad` px outside it and a numbered pin of
    /// diameter `pin` on its top-left corner, the pins continuing the active
    /// layer's sequence in the order given. ONE "Mark Changes" step. Returns
    /// the new ids, rectangle then pin per region; empty, pushing nothing,
    /// when there is no whole region.
    pub fn mark_regions(
        &mut self,
        regions: &[u32],
        color_hex: &str,
        stroke_width: f64,
        pad: f64,
        pin: f64,
    ) -> Vec<u32> {
        let quads: Vec<&[u32]> = regions
            .chunks_exact(4)
            .filter(|q| q[2] > 0 && q[3] > 0)
            .collect();
        if quads.is_empty() {
            return Vec::new();
        }
        let last_pin = self.layers[self.active]
            .shape_annotations
            .iter()
            .filter(|s| s.kind == 5)
            .map(|s| s.number)
            .max()
            .unwrap_or(0);
        self.snap("Mark Changes");
        let c = crate::drawing::parse_hex_color(color_hex);
        let (dw, dh) = (self.width as f64, self.height as f64);
        let mut ids = Vec::with_capacity(quads.len() * 2);
        let mut next = self.next_shape_id;
        let shapes = &mut self.layers[self.active].shape_annotations;
        for (i, q) in quads.iter().enumerate() {
            let x0 = (q[0] as f64 - pad).max(0.0);
            let y0 = (q[1] as f64 - pad).max(0.0);
            let x1 = ((q[0] + q[2]) as f64 + pad).min(dw);
            let y1 = ((q[1] + q[3]) as f64 + pad).min(dh);
            let (rect_id, pin_id) = (next, next.wrapping_add(1).max(1));
            next = pin_id.wrapping_add(1).max(1);
            shapes.push(crate::annotations::ShapeAnnotation {
                id: rect_id,
                kind: 0,
                x0,
                y0,
                x1,
                y1,
                r: c[0],
                g: c[1],
                b: c[2],
                stroke_width,
                ..Default::default()
            });
            // The pin sits on the box's corner, kept whole inside the photo.
            let half = pin / 2.0;
            let px = x0.clamp(half, (dw - half).max(half));
            let py = y0.clamp(half, (dh - half).max(half));
            shapes.push(crate::annotations::ShapeAnnotation {
                id: pin_id,
                kind: 5,
                x0: px - half,
                y0: py - half,
                x1: px + half,
                y1: py + half,
                r: c[0],
                g: c[1],
                b: c[2],
                number: last_pin + 1 + i as u32,
                ..Default::default()
            });
            ids.extend([rect_id, pin_id]);
        }
        self.next_shape_id = next;
        self.recomposite();
        ids
    }
}

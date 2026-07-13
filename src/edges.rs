//! Edge detection — the shared core behind the edge-aware selection tools.
//!
//! Built ONCE here and consumed by everything that needs to know "where does
//! this object stop": the edge-aware magic wand (shipped), and — per the
//! tool-arc plan — the magnetic lasso and the Smart Brush, which both walk or
//! snap to exactly these edges. Keep it that way: a second gradient
//! implementation elsewhere is how the two features drift apart.
//!
//! Sobel over perceptual luminance, not per-channel RGB. A red/green boundary
//! at equal luminance is a real edge to a human and a non-edge to a naive
//! luma-only operator, so the magnitude below is the max of the luma gradient
//! and the per-channel gradients — cheap, and it doesn't miss chroma edges.

/// Rec. 601 luma, the same weighting the histogram uses.
#[inline]
fn luma(r: u8, g: u8, b: u8) -> i32 {
    (299 * r as i32 + 587 * g as i32 + 114 * b as i32) / 1000
}

/// Sobel gradient magnitude per pixel, 0..=255 (0 = flat, 255 = hard edge).
///
/// `buf` is straight RGBA, `w * h * 4` bytes. Border pixels get 0 — a 3×3
/// kernel has no valid neighbourhood there, and treating the image frame as an
/// edge would wall in every flood fill that starts near it.
pub(crate) fn sobel_magnitude(buf: &[u8], w: usize, h: usize) -> Vec<u8> {
    let mut out = vec![0u8; w * h];
    if w < 3 || h < 3 || buf.len() < w * h * 4 {
        return out;
    }

    // Per-pixel channel fetch: luma + the three channels, so a chroma-only
    // boundary still registers.
    let at = |x: usize, y: usize| -> [i32; 4] {
        let i = (y * w + x) * 4;
        let (r, g, b) = (buf[i], buf[i + 1], buf[i + 2]);
        [luma(r, g, b), r as i32, g as i32, b as i32]
    };

    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let (tl, t, tr) = (at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1));
            let (l, r) = (at(x - 1, y), at(x + 1, y));
            let (bl, b, br) = (at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1));

            let mut mag = 0i32;
            for c in 0..4 {
                // Sobel Gx / Gy.
                let gx = (tr[c] + 2 * r[c] + br[c]) - (tl[c] + 2 * l[c] + bl[c]);
                let gy = (bl[c] + 2 * b[c] + br[c]) - (tl[c] + 2 * t[c] + tr[c]);
                // |G| ≈ |gx| + |gy| — the L1 approximation. A hypot here would
                // cost a sqrt per channel per pixel for a difference no one can
                // see once it's thresholded.
                let g = gx.abs() + gy.abs();
                if g > mag {
                    mag = g;
                }
            }
            // The L1 magnitude of a max-contrast edge is 4 * 255; scale to 0..255.
            out[y * w + x] = (mag / 4).min(255) as u8;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build an RGBA buffer from a per-pixel color function.
    fn rgba(w: usize, h: usize, f: impl Fn(usize, usize) -> [u8; 4]) -> Vec<u8> {
        let mut v = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                v[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&f(x, y));
            }
        }
        v
    }

    #[test]
    fn flat_image_has_no_edges() {
        let buf = rgba(8, 8, |_, _| [120, 130, 140, 255]);
        let e = sobel_magnitude(&buf, 8, 8);
        assert!(e.iter().all(|&m| m == 0), "a flat field must be edge-free");
    }

    #[test]
    fn vertical_split_fires_on_the_seam_only() {
        // Left half black, right half white — one hard edge down the middle.
        let (w, h) = (9, 5);
        let buf = rgba(w, h, |x, _| {
            if x < 4 {
                [0, 0, 0, 255]
            } else {
                [255, 255, 255, 255]
            }
        });
        let e = sobel_magnitude(&buf, w, h);
        // The seam (columns adjacent to the transition) is hot...
        assert!(e[2 * w + 3] > 200, "seam should be a strong edge");
        assert!(e[2 * w + 4] > 200, "seam should be a strong edge");
        // ...and the flat interior is not.
        assert_eq!(e[2 * w + 1], 0, "flat interior must stay cold");
        assert_eq!(e[2 * w + 7], 0, "flat interior must stay cold");
    }

    #[test]
    fn chroma_edge_at_equal_luma_is_still_an_edge() {
        // Red vs green chosen so a luma-only operator would see almost nothing;
        // the per-channel term must still catch it. This is the whole reason
        // the magnitude is a max over luma + channels.
        let (w, h) = (7, 5);
        let buf = rgba(w, h, |x, _| {
            if x < 3 {
                [255, 0, 0, 255]
            } else {
                [0, 255, 0, 255]
            }
        });
        let e = sobel_magnitude(&buf, w, h);
        assert!(
            e[2 * w + 3] > 100,
            "a red/green boundary is an edge to a human, so it must be one here"
        );
    }

    #[test]
    fn degenerate_sizes_do_not_panic() {
        assert_eq!(sobel_magnitude(&[], 0, 0).len(), 0);
        let tiny = rgba(2, 2, |_, _| [10, 20, 30, 255]);
        assert_eq!(sobel_magnitude(&tiny, 2, 2), vec![0; 4]); // too small for 3x3
    }
}

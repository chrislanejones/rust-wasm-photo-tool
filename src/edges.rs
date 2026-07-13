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

// ── Edge cost map ───────────────────────────────────────────────────────────
// The shared primitive both edge-aware *path/region* tools stand on. The
// magnitude above answers "is this pixel an edge?"; the cost map below answers
// "how expensive is it to travel through this pixel?" — and it is the SAME
// answer, inverted, so the magnetic lasso's shortest path and the Smart Brush's
// containment boundary can never disagree about where an object stops.
//
//   strong edge → LOW cost  (the lasso's path finder falls into edges and
//                            follows them; they are the cheap road)
//   flat region → HIGH cost (crossing open space is expensive, so a loose
//                            anchor still snaps to the nearby outline)
//
// Pure function of `sobel_magnitude`'s output. No second gradient pass — that
// is the whole point of building it here.

/// Cost of the cheapest possible pixel (a maximal edge). Not zero: a
/// zero-cost pixel would let the path finder wander along an edge for free,
/// and ties between "hug the edge" and "take a 400px detour along the edge"
/// would be decided by heap order rather than by distance.
pub(crate) const COST_MIN: u16 = 1;
/// Cost of a perfectly flat pixel — the full 8-bit magnitude range above the
/// cheapest one.
pub(crate) const COST_MAX: u16 = COST_MIN + 255;

/// Below this peak magnitude an image has no edges worth following — it's flat
/// or pure sensor noise. Normalizing against a peak of 3 would amplify that
/// noise into a fake road network for the lasso to follow.
const NOISE_FLOOR: u8 = 8;

/// Turn a Sobel magnitude map into a travel-cost map: **low cost along strong
/// edges, high cost in flat regions**. One `u16` per pixel, row-major, same
/// dimensions as the input. Range `COST_MIN..=COST_MAX`.
///
/// The magnitude is **normalized against the image's own peak** before it is
/// inverted. Without that, a soft low-contrast photo whose strongest edge only
/// reaches magnitude ~80 would produce costs in 176..=256 — a 1.45× spread,
/// far too flat for a path finder to prefer the edge over a shortcut across
/// open space. Against its own peak, that same photo gets the full 1..=256
/// spread and the lasso snaps as crisply as it does on a hard-edged graphic.
///
/// Integer-only (no floats): the map must be **byte-stable** — the same image
/// must produce the same path on every run and every platform, or the selection
/// kernel is flaky and undebuggable.
///
/// An image with no real edges (peak below [`NOISE_FLOOR`]) gets a uniform
/// `COST_MAX` map, so a path across it degenerates to a straight line instead
/// of chasing noise.
pub(crate) fn edge_cost_map(mag: &[u8]) -> Vec<u16> {
    let peak = mag.iter().copied().max().unwrap_or(0);
    if peak < NOISE_FLOOR {
        return vec![COST_MAX; mag.len()];
    }
    let peak = peak as u32;
    mag.iter()
        .map(|&m| {
            // Normalize to 0..=255 against the peak, then invert.
            let norm = (m as u32 * 255 / peak).min(255) as u16;
            COST_MAX - norm
        })
        .collect()
}

/// Is this pixel a wall, at the given `strength` (0..=255)? A pixel counts as a
/// strong edge when its *normalized* magnitude clears `strength` — expressed on
/// the cost map so there is exactly one place that decides "this is a boundary".
///
/// Higher `strength` = fewer walls (only the very hardest edges contain a
/// brush stroke); lower = more walls, tighter containment.
///
/// The `allow` is temporary: the Smart Brush is this function's only non-test
/// consumer and it lands in the next commit.
#[inline]
#[allow(dead_code)]
pub(crate) fn is_wall(cost: u16, strength: u8) -> bool {
    // cost = COST_MAX - norm  ⇒  norm = COST_MAX - cost
    COST_MAX.saturating_sub(cost) >= strength as u16
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

    // ── Edge cost map (Task A) ──────────────────────────────────────────────

    /// A black|white vertical split: hard edge down the seam at x = 3/4.
    fn split_fixture(w: usize, h: usize) -> Vec<u8> {
        rgba(w, h, |x, _| {
            if x < 4 {
                [0, 0, 0, 255]
            } else {
                [255, 255, 255, 255]
            }
        })
    }

    #[test]
    fn cost_is_minimal_on_the_edge_and_maximal_in_flat_areas() {
        let (w, h) = (9, 5);
        let cost = edge_cost_map(&sobel_magnitude(&split_fixture(w, h), w, h));

        // On the seam: the cheapest road in the image.
        assert_eq!(cost[2 * w + 3], COST_MIN, "the seam must be the cheap road");
        assert_eq!(cost[2 * w + 4], COST_MIN, "the seam must be the cheap road");
        // Flat interior, both sides: the most expensive terrain there is.
        assert_eq!(cost[2 * w + 1], COST_MAX, "flat black is expensive");
        assert_eq!(cost[2 * w + 7], COST_MAX, "flat white is expensive");
        // And the ordering that the path finder actually relies on.
        assert!(
            cost[2 * w + 3] < cost[2 * w + 1],
            "travelling along the edge must beat crossing open space"
        );
    }

    #[test]
    fn cost_map_is_deterministic() {
        let (w, h) = (9, 5);
        let mag = sobel_magnitude(&split_fixture(w, h), w, h);
        assert_eq!(
            edge_cost_map(&mag),
            edge_cost_map(&mag),
            "same input must give a byte-identical map — a flaky cost map is a flaky selection"
        );
    }

    #[test]
    fn soft_edges_are_normalized_against_the_image_peak() {
        // A gentle 40-level step: the strongest edge here is nowhere near 255.
        // Un-normalized, every cost would sit near COST_MAX and the path finder
        // could not tell the edge from the background. Normalized, the seam is
        // still the cheapest pixel in the image.
        let (w, h) = (9, 5);
        let buf = rgba(w, h, |x, _| {
            if x < 4 {
                [100, 100, 100, 255]
            } else {
                [140, 140, 140, 255]
            }
        });
        let mag = sobel_magnitude(&buf, w, h);
        let peak = *mag.iter().max().unwrap();
        assert!(peak < 100, "fixture must be a SOFT edge (peak {peak})");

        let cost = edge_cost_map(&mag);
        assert_eq!(cost[2 * w + 3], COST_MIN, "a soft edge is still THE edge");
        assert_eq!(cost[2 * w + 1], COST_MAX);
    }

    #[test]
    fn a_flat_image_gets_a_uniform_map_instead_of_chasing_noise() {
        let mag = sobel_magnitude(&rgba(8, 8, |_, _| [120, 130, 140, 255]), 8, 8);
        let cost = edge_cost_map(&mag);
        assert!(
            cost.iter().all(|&c| c == COST_MAX),
            "no edges ⇒ uniform cost ⇒ a path across it is a straight line"
        );
    }

    #[test]
    fn cost_map_stays_in_range_and_matches_input_length() {
        let (w, h) = (9, 5);
        let mag = sobel_magnitude(&split_fixture(w, h), w, h);
        let cost = edge_cost_map(&mag);
        assert_eq!(cost.len(), mag.len());
        assert!(cost.iter().all(|&c| (COST_MIN..=COST_MAX).contains(&c)));
        assert_eq!(edge_cost_map(&[]).len(), 0, "empty input must not panic");
    }

    #[test]
    fn is_wall_reads_the_cost_map_the_way_the_brush_expects() {
        // Strong edge (cheap) is a wall; flat (expensive) never is.
        assert!(is_wall(COST_MIN, 200), "a maximal edge walls in a stroke");
        assert!(
            !is_wall(COST_MAX, 200),
            "flat ground never contains a stroke"
        );
        // Higher strength = fewer walls.
        let mid = COST_MAX - 128; // normalized magnitude 128
        assert!(is_wall(mid, 100), "128 clears a strength of 100");
        assert!(!is_wall(mid, 200), "128 does not clear a strength of 200");
    }
}

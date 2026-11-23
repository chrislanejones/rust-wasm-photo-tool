//! Find duplicates (ticket 232): a photo's fingerprint, read from its
//! gallery thumbnail.
//!
//! Two numbers per photo:
//!
//! - a 64-bit **difference hash** (dHash). The thumbnail is averaged down to
//!   a 9 × 8 grid of gray (luma) cells, and each bit says whether a cell is
//!   darker than the cell to its right (by more than one level, so noise on
//!   a flat sky cannot pick bits): 8 comparisons per row, 8 rows. It
//!   records where the picture gets brighter or darker, not how bright it is,
//!   so a resize, a JPEG re-save or a 1-px crop leaves almost every bit alone.
//!   Two photos "look the same" when few bits differ; the gallery counts
//!   them and owns the threshold (app/src/lib/duplicates.ts).
//! - the **average color**. A dHash cannot tell a black frame from a white
//!   one (no edges, every bit 0), and it ignores color outright, so the
//!   gallery also wants the two averages close.
//!
//! The grid is a BOX average, not a sample: every pixel of the thumbnail lands
//! in exactly one cell. Sampling 72 points would let sensor noise pick bits;
//! averaging thousands of pixels per cell cancels it.
//!
//! Transparent pixels are composited over white first, so the RGB hidden under
//! alpha 0 (often garbage) does not decide anything.
//!
//! **Turns and flips (11-23-2026).** A copy turned a quarter or flipped left to
//! right has a different hash: every comparison now runs along a different
//! line of the picture. So the hash is also taken of the picture in each of
//! its 8 orientations (4 turns, each also mirrored), read straight off the
//! source pixels with the coordinates remapped. Orientation `k`'s hash is
//! EXACTLY the hash of the picture turned that way (pinned by a test that
//! turns the pixels for real), so a turned copy's straight hash lands on one
//! of the original's eight. The gallery matches on the closest.
//!
//! Pure: the cell sums live on the stack, the only allocations are four
//! small lookup tables (one byte per row and per column) and the result, and
//! nothing is kept between calls.
//! The gallery caches the result per photo (in memory, never IndexedDB).
use wasm_bindgen::prelude::*;

/// Grid width: 9 cells give 8 left/right comparisons per row.
const GRID_W: usize = 9;
/// Grid height: 8 rows of 8 comparisons = 64 bits.
const GRID_H: usize = 8;
/// How much brighter (in luma levels of 255, scaled x256 like the sums) the
/// right cell must be for its bit to be 1. A plain `left < right` lets NOISE
/// pick every bit where the picture is flat side to side (a sky, a wall):
/// measured on a noisy synthetic scene, 17 of 64 bits flipped between two
/// noise seeds of the same picture. One level is ~4 standard deviations of a
/// cell's averaged noise there, and still far below any edge a person sees.
const MARGIN_X256: u64 = 256;

/// One photo's fingerprint, as the TEST ORACLE computes it (see `fingerprint`).
#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fingerprint {
    /// Bit 63 is row 0, column 0; bit 0 is row 7, column 7. A bit is 1 when
    /// that cell is darker than its right-hand neighbor (by `MARGIN_X256`).
    pub hash: u64,
    /// Average R, G, B (alpha composited over white), rounded.
    pub color: [u8; 3],
}

/// RGB with alpha composited over white.
#[inline]
fn over_white(r: u8, g: u8, b: u8, a: u8) -> (u32, u32, u32) {
    if a == 255 {
        return (r as u32, g as u32, b as u32);
    }
    let a = a as u32;
    let mix = |c: u8| (c as u32 * a + 255 * (255 - a) + 127) / 255;
    (mix(r), mix(g), mix(b))
}

/// The 8 orientations: 0 as stored, 1–3 a quarter, half and three-quarter
/// turn clockwise, 4–7 the same four mirrored left to right first.
pub const ORIENTATIONS: usize = 8;

/// Size of the picture after orientation `k`.
#[inline]
fn oriented_size(k: usize, w: usize, h: usize) -> (usize, usize) {
    if k % 2 == 1 {
        (h, w)
    } else {
        (w, h)
    }
}

/// The source pixel behind pixel (`x`, `y`) of the picture in orientation
/// `k` (`w` × `h` is the SOURCE size). Mirroring happens first, then the turn.
#[inline]
fn source_of(k: usize, x: usize, y: usize, w: usize, h: usize) -> (usize, usize) {
    // Undo the turn: (x, y) in the turned picture → (u, v) in the mirrored one.
    let (u, v) = match k % 4 {
        0 => (x, y),
        1 => (y, h - 1 - x),         // quarter clockwise: turned is h wide
        2 => (w - 1 - x, h - 1 - y), // half
        _ => (w - 1 - y, x),         // three-quarter clockwise
    };
    if k >= 4 {
        (w - 1 - u, v)
    } else {
        (u, v)
    }
}

/// Composited RGB of source pixel (`x`, `y`).
#[inline]
fn rgb_at(px: &[u8], w: usize, x: usize, y: usize) -> (u32, u32, u32) {
    let i = (y * w + x) * 4;
    over_white(px[i], px[i + 1], px[i + 2], px[i + 3])
}

#[inline]
fn luma(r: u32, g: u32, b: u32) -> u64 {
    (77 * r + 150 * g + 29 * b) as u64
}

/// The dHash of the picture as stored. `px` must hold `w * h` RGBA pixels
/// (checked by the callers). The 8-orientation pass in `fingerprint_turns`
/// is a separate walk on purpose: the test that pins it compares against
/// THIS function run on pixels that were turned for real.
#[cfg(test)]
fn straight_hash(px: &[u8], w: usize, h: usize) -> u64 {
    // Per cell: summed luma (BT.601, x256) and pixel count.
    let mut sum = [0u64; GRID_W * GRID_H];
    let mut count = [0u64; GRID_W * GRID_H];
    for y in 0..h {
        let cy = y * GRID_H / h;
        let row = &px[y * w * 4..(y + 1) * w * 4];
        for (x, p) in row.chunks_exact(4).enumerate() {
            let (r, g, b) = over_white(p[0], p[1], p[2], p[3]);
            let cell = cy * GRID_W + x * GRID_W / w;
            sum[cell] += luma(r, g, b);
            count[cell] += 1;
        }
    }

    // An image narrower than 9 or shorter than 8 px leaves cells empty;
    // `finish` fills each from the pixel at its center so every comparison
    // has two sides, then compares right against left by more than MARGIN, as
    // cross-multiplied sums so cells of different sizes (w is rarely a
    // multiple of 9) need no division and no rounding:
    //   sum_r / count_r - sum_l / count_l > MARGIN
    finish(px, w, h, 0, &mut (sum, count))
}

/// The checked size, or `None` when the buffer is shorter than `w * h * 4`
/// or the image is empty.
fn checked(px: &[u8], w: u32, h: u32) -> Option<(usize, usize)> {
    let (w, h) = (w as usize, h as usize);
    let n = w.checked_mul(h)?;
    if n == 0 || px.len() < n.checked_mul(4)? {
        return None;
    }
    Some((w, h))
}

/// Average R, G, B (alpha over white), rounded. Orientation does not move it.
#[cfg(test)]
fn average_color(px: &[u8], w: usize, h: usize) -> [u8; 3] {
    let (mut sr, mut sg, mut sb) = (0u64, 0u64, 0u64);
    for p in px[..w * h * 4].chunks_exact(4) {
        let (r, g, b) = over_white(p[0], p[1], p[2], p[3]);
        sr += r as u64;
        sg += g as u64;
        sb += b as u64;
    }
    let n = (w * h) as u64;
    let avg = |s: u64| ((s + n / 2) / n) as u8;
    [avg(sr), avg(sg), avg(sb)]
}

/// The fingerprint of a `w` × `h` RGBA image as stored. `None` when the
/// buffer is shorter than `w * h * 4` or the image is empty, never a panic.
///
/// TEST-ONLY since 11-23-2026: it is the straight, obvious walk, kept as the
/// ORACLE. `fingerprint_turns` (what the engine ships) must give exactly its
/// answer on pixels that were really turned, for every orientation.
#[cfg(test)]
pub fn fingerprint(px: &[u8], w: u32, h: u32) -> Option<Fingerprint> {
    let (w, h) = checked(px, w, h)?;
    Some(Fingerprint {
        hash: straight_hash(px, w, h),
        color: average_color(px, w, h),
    })
}

/// Cell sums and pixel counts of one 9 × 8 grid.
type Grid = ([u64; GRID_W * GRID_H], [u64; GRID_W * GRID_H]);

/// Fill a tiny picture's empty cells (see `straight_hash`) and hash the grid.
fn finish(px: &[u8], w: usize, h: usize, k: usize, grid: &mut Grid) -> u64 {
    let (ow, oh) = oriented_size(k, w, h);
    let (sum, count) = grid;
    for cy in 0..GRID_H {
        for cx in 0..GRID_W {
            let cell = cy * GRID_W + cx;
            if count[cell] == 0 {
                let x = ((2 * cx + 1) * ow / (2 * GRID_W)).min(ow - 1);
                let y = ((2 * cy + 1) * oh / (2 * GRID_H)).min(oh - 1);
                let (sx, sy) = source_of(k, x, y, w, h);
                let (r, g, b) = rgb_at(px, w, sx, sy);
                sum[cell] = luma(r, g, b);
                count[cell] = 1;
            }
        }
    }
    let mut hash = 0u64;
    for cy in 0..GRID_H {
        for cx in 0..GRID_W - 1 {
            let l = cy * GRID_W + cx;
            let r = l + 1;
            hash <<= 1;
            let margin = MARGIN_X256 * count[l] * count[r];
            if sum[r] * count[l] > sum[l] * count[r] + margin {
                hash |= 1;
            }
        }
    }
    hash
}

/// The hash in all 8 orientations (index as `ORIENTATIONS` documents; 0 is
/// `fingerprint`'s), and the average color. `None` as for `fingerprint`.
///
/// ONE pass over the pixels in memory order, each pixel's luma computed once
/// and added to its cell in all 8 grids. Where a source pixel lands in a
/// turned picture is a lookup: every turned coordinate is one of x, w-1-x,
/// y, h-1-y, so four small tables of cell numbers (over x and over y) cover
/// all 8. Eight separate remapped walks cost ~10× the straight hash (200
/// thumbnails: 222 ms against 22); this pass is the same answer, pinned by
/// `each_orientation_is_exactly_the_hash_of_the_picture_turned_that_way`.
pub fn fingerprint_turns(px: &[u8], w: u32, h: u32) -> Option<([u64; ORIENTATIONS], [u8; 3])> {
    let (w, h) = checked(px, w, h)?;
    // Cell column (of 9) / row (of 8) for a coordinate i along a side of
    // length w (the `a` tables) or h (the `b` tables).
    let a9: Vec<u8> = (0..w).map(|i| (i * GRID_W / w) as u8).collect();
    let a8: Vec<u8> = (0..w).map(|i| (i * GRID_H / w) as u8).collect();
    let b9: Vec<u8> = (0..h).map(|i| (i * GRID_W / h) as u8).collect();
    let b8: Vec<u8> = (0..h).map(|i| (i * GRID_H / h) as u8).collect();

    let mut grids: [Grid; ORIENTATIONS] =
        [([0; GRID_W * GRID_H], [0; GRID_W * GRID_H]); ORIENTATIONS];
    let (mut sr, mut sg, mut sb) = (0u64, 0u64, 0u64);
    for y in 0..h {
        let ry = h - 1 - y;
        let row = &px[y * w * 4..(y + 1) * w * 4];
        for (x, p) in row.chunks_exact(4).enumerate() {
            let (r, g, b) = over_white(p[0], p[1], p[2], p[3]);
            sr += r as u64;
            sg += g as u64;
            sb += b as u64;
            let l = luma(r, g, b);
            let rx = w - 1 - x;
            // k and k + 4 differ only in the mirror: u = x, or u = w-1-x.
            for (m, (u, ru)) in [(x, rx), (rx, x)].into_iter().enumerate() {
                // (row, column) of each turn, from the forward map of `source_of`:
                //   0: (v, u)   1: (u, h-1-v)   2: (h-1-v, w-1-u)   3: (w-1-u, v)
                let cells = [
                    b8[y] as usize * GRID_W + a9[u] as usize,
                    a8[u] as usize * GRID_W + b9[ry] as usize,
                    b8[ry] as usize * GRID_W + a9[ru] as usize,
                    a8[ru] as usize * GRID_W + b9[y] as usize,
                ];
                for (t, cell) in cells.into_iter().enumerate() {
                    let g = &mut grids[m * 4 + t];
                    g.0[cell] += l;
                    g.1[cell] += 1;
                }
            }
        }
    }

    let mut hashes = [0u64; ORIENTATIONS];
    for (k, (slot, grid)) in hashes.iter_mut().zip(grids.iter_mut()).enumerate() {
        *slot = finish(px, w, h, k, grid);
    }
    let n = (w * h) as u64;
    let avg = |s: u64| ((s + n / 2) / n) as u8;
    Some((hashes, [avg(sr), avg(sg), avg(sb)]))
}

/// `photoFingerprint(rgba, w, h)` → a `Uint32Array` of 17 numbers (a u64
/// would cross the boundary as a BigInt):
///
/// ```text
/// [hashHigh, hashLow, 0xRRGGBB,  hi1, lo1, … hi7, lo7]
/// ```
///
/// The first three are the photo as stored, unchanged since #473; the 14
/// after them are orientations 1–7 (11-23-2026). Empty when the buffer does
/// not hold a `w` × `h` image.
#[wasm_bindgen]
pub fn photo_fingerprint(px: &[u8], w: u32, h: u32) -> Vec<u32> {
    match fingerprint_turns(px, w, h) {
        Some((hashes, c)) => {
            let mut out = Vec::with_capacity(3 + 2 * (ORIENTATIONS - 1));
            out.push((hashes[0] >> 32) as u32);
            out.push(hashes[0] as u32);
            out.push(((c[0] as u32) << 16) | ((c[1] as u32) << 8) | (c[2] as u32));
            for h in &hashes[1..] {
                out.push((h >> 32) as u32);
                out.push(*h as u32);
            }
            out
        }
        None => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// How many of the 64 bits differ. The gallery's copy of this is
    /// `hashDistance` in app/src/lib/duplicates.ts, next to its threshold.
    fn hamming(a: u64, b: u64) -> u32 {
        (a ^ b).count_ones()
    }

    /// A deterministic "photo": a sky-to-ground gradient, a sun disc and a
    /// hill, sampled from continuous coordinates so the SAME scene can be
    /// drawn at any size. `dx` pans the camera (fraction of the width), `sun`
    /// moves the subject, `seed` adds sensor noise (0 = none).
    fn scene(w: u32, h: u32, dx: f32, sun: f32, seed: u32) -> Vec<u8> {
        let mut out = Vec::with_capacity((w * h * 4) as usize);
        let mut s = seed.wrapping_mul(2654435761).wrapping_add(1);
        for y in 0..h {
            for x in 0..w {
                let u = (x as f32 + 0.5) / w as f32 + dx;
                let v = (y as f32 + 0.5) / h as f32;
                let mut c = [60.0 + 120.0 * v, 110.0 + 80.0 * v, 220.0 - 90.0 * v];
                let hill = 0.62 + 0.12 * (u * 5.0).sin();
                if v > hill {
                    c = [70.0, 130.0 + 40.0 * u, 50.0];
                }
                let (sx, sy) = (0.3 + sun, 0.28);
                if (u - sx).powi(2) + ((v - sy) * h as f32 / w as f32).powi(2) < 0.01 {
                    c = [250.0, 220.0, 120.0];
                }
                for ch in c.iter_mut() {
                    if seed != 0 {
                        s ^= s << 13;
                        s ^= s >> 17;
                        s ^= s << 5;
                        *ch += (s % 21) as f32 - 10.0;
                    }
                }
                out.extend(c.iter().map(|&v| v.clamp(0.0, 255.0) as u8));
                out.push(255);
            }
        }
        out
    }

    fn fp(px: &[u8], w: u32, h: u32) -> Fingerprint {
        match fingerprint(px, w, h) {
            Some(f) => f,
            None => panic!("no fingerprint for {w}x{h}"), // allow: rust-panic
        }
    }

    #[test]
    fn a_left_to_right_ramp_sets_every_bit_and_its_mirror_none() {
        // Brighter to the right: every cell is darker than its right side.
        let (w, h) = (90u32, 40u32);
        let ramp: Vec<u8> = (0..w * h)
            .flat_map(|i| {
                let v = ((i % w) * 255 / (w - 1)) as u8;
                [v, v, v, 255]
            })
            .collect();
        assert_eq!(fp(&ramp, w, h).hash, u64::MAX);
        let mirror: Vec<u8> = (0..w * h)
            .flat_map(|i| {
                let v = 255 - ((i % w) * 255 / (w - 1)) as u8;
                [v, v, v, 255]
            })
            .collect();
        assert_eq!(fp(&mirror, w, h).hash, 0);
    }

    #[test]
    fn the_same_scene_at_three_sizes_is_within_a_few_bits() {
        let big = fp(&scene(1024, 768, 0.0, 0.0, 0), 1024, 768);
        let mid = fp(&scene(256, 192, 0.0, 0.0, 0), 256, 192);
        let small = fp(&scene(96, 72, 0.0, 0.0, 0), 96, 72);
        assert!(
            hamming(big.hash, mid.hash) <= 3,
            "{}",
            hamming(big.hash, mid.hash)
        );
        assert!(
            hamming(big.hash, small.hash) <= 3,
            "{}",
            hamming(big.hash, small.hash)
        );
        for ch in 0..3 {
            assert!((big.color[ch] as i32 - small.color[ch] as i32).abs() <= 2);
        }
    }

    #[test]
    fn sensor_noise_moves_almost_nothing() {
        let clean = fp(&scene(256, 192, 0.0, 0.0, 0), 256, 192);
        let noisy = fp(&scene(256, 192, 0.0, 0.0, 7), 256, 192);
        assert!(
            hamming(clean.hash, noisy.hash) <= 2,
            "{}",
            hamming(clean.hash, noisy.hash)
        );
    }

    #[test]
    fn a_reframed_shot_of_the_same_scene_is_far() {
        let a = fp(&scene(256, 192, 0.0, 0.0, 3), 256, 192);
        let b = fp(&scene(256, 192, 0.35, 0.0, 4), 256, 192);
        assert!(hamming(a.hash, b.hash) > 10, "{}", hamming(a.hash, b.hash));
    }

    #[test]
    fn average_color_is_alpha_composited_over_white() {
        // Fully transparent red reads as white; opaque red reads as red.
        let clear = [255u8, 0, 0, 0].repeat(16 * 16);
        assert_eq!(fp(&clear, 16, 16).color, [255, 255, 255]);
        let red = [255u8, 0, 0, 255].repeat(16 * 16);
        assert_eq!(fp(&red, 16, 16).color, [255, 0, 0]);
        // A flat frame has no edges at all.
        assert_eq!(fp(&red, 16, 16).hash, 0);
    }

    #[test]
    fn tiny_and_bad_inputs_never_panic() {
        assert_eq!(fingerprint(&[], 0, 0), None);
        assert_eq!(fingerprint(&[0; 15], 2, 2), None);
        assert_eq!(fingerprint(&[0; 16], 2, 2).map(|f| f.hash), Some(0));
        assert_eq!(fingerprint(&[0; 4], u32::MAX, u32::MAX), None);
        // 3 × 1 is smaller than the grid; every cell still has a value.
        let px = [0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255];
        assert!(fingerprint(&px, 3, 1).is_some());
    }

    #[test]
    fn the_wasm_surface_packs_hash_color_and_the_seven_turns() {
        let px = [10u8, 20, 30, 255].repeat(9 * 8);
        let mut want = vec![0, 0, 0x0a141e];
        want.extend([0u32; 14]);
        assert_eq!(photo_fingerprint(&px, 9, 8), want);
        assert!(photo_fingerprint(&px, 10, 8).is_empty());
        // A real picture: the first three are `fingerprint`'s, unchanged.
        let s = scene(64, 48, 0.0, 0.0, 2);
        let f = fp(&s, 64, 48);
        let out = photo_fingerprint(&s, 64, 48);
        assert_eq!(out.len(), 17);
        assert_eq!(((out[0] as u64) << 32) | out[1] as u64, f.hash);
    }

    /// Turn (and mirror) the pixels FOR REAL, the way a phone or an editor
    /// would write a turned copy: the slow, obvious version of `source_of`.
    fn orient(px: &[u8], w: usize, h: usize, k: usize) -> (Vec<u8>, usize, usize) {
        let get = |x: usize, y: usize| &px[(y * w + x) * 4..(y * w + x) * 4 + 4];
        // Mirror first…
        let mut m = Vec::with_capacity(px.len());
        for y in 0..h {
            for x in 0..w {
                m.extend_from_slice(get(if k >= 4 { w - 1 - x } else { x }, y));
            }
        }
        // …then a quarter turn clockwise, k % 4 times.
        let (mut cur, mut cw, mut ch) = (m, w, h);
        for _ in 0..k % 4 {
            let mut t = vec![0u8; cur.len()];
            // Clockwise: source (x, y) lands at (ch - 1 - y, x) in a ch-wide picture.
            for y in 0..ch {
                for x in 0..cw {
                    let (tx, ty) = (ch - 1 - y, x);
                    let d = (ty * ch + tx) * 4;
                    let s = (y * cw + x) * 4;
                    t[d..d + 4].copy_from_slice(&cur[s..s + 4]);
                }
            }
            cur = t;
            std::mem::swap(&mut cw, &mut ch);
        }
        (cur, cw, ch)
    }

    #[test]
    fn each_orientation_is_exactly_the_hash_of_the_picture_turned_that_way() {
        // Odd sizes, so a wrong swap of w and h cannot hide.
        for (w, h) in [(64usize, 48usize), (37, 23), (5, 3)] {
            let px = scene(w as u32, h as u32, 0.1, 0.05, 9);
            let Some((turns, color)) = fingerprint_turns(&px, w as u32, h as u32) else {
                panic!("no turns for {w}x{h}"); // allow: rust-panic
            };
            for (k, &turn) in turns.iter().enumerate() {
                let (t, tw, th) = orient(&px, w, h, k);
                let real = fp(&t, tw as u32, th as u32);
                assert_eq!(turn, real.hash, "orientation {k} at {w}x{h}");
                assert_eq!(color, real.color);
            }
        }
    }

    #[test]
    fn the_eight_orientations_of_a_real_scene_all_differ() {
        // Otherwise matching on the closest would be matching on one hash.
        let px = scene(256, 192, 0.0, 0.0, 3);
        let Some((turns, _)) = fingerprint_turns(&px, 256, 192) else {
            panic!("no turns"); // allow: rust-panic
        };
        for a in 0..ORIENTATIONS {
            for b in a + 1..ORIENTATIONS {
                assert!(
                    hamming(turns[a], turns[b]) > 6,
                    "{a} vs {b}: {}",
                    hamming(turns[a], turns[b])
                );
            }
        }
    }

    #[test]
    fn hamming_counts_differing_bits() {
        assert_eq!(hamming(0, 0), 0);
        assert_eq!(hamming(0, u64::MAX), 64);
        assert_eq!(hamming(0b1010, 0b0110), 2);
    }
}

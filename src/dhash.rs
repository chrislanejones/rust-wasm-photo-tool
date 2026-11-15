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
//! Pure: the 72 cell sums live on the stack, the only allocation is the
//! three-number result, and nothing is kept between calls.
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

/// One photo's fingerprint.
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

/// The fingerprint of a `w` × `h` RGBA image. `None` when the buffer is
/// shorter than `w * h * 4` or the image is empty, never a panic.
pub fn fingerprint(px: &[u8], w: u32, h: u32) -> Option<Fingerprint> {
    let (w, h) = (w as usize, h as usize);
    let n = w.checked_mul(h)?;
    if n == 0 || px.len() < n.checked_mul(4)? {
        return None;
    }

    // Per cell: summed luma (BT.601, x256) and pixel count.
    let mut luma = [0u64; GRID_W * GRID_H];
    let mut count = [0u64; GRID_W * GRID_H];
    let (mut sr, mut sg, mut sb) = (0u64, 0u64, 0u64);
    for y in 0..h {
        let cy = y * GRID_H / h;
        let row = &px[y * w * 4..(y + 1) * w * 4];
        for (x, p) in row.chunks_exact(4).enumerate() {
            let (r, g, b) = over_white(p[0], p[1], p[2], p[3]);
            sr += r as u64;
            sg += g as u64;
            sb += b as u64;
            let cell = cy * GRID_W + x * GRID_W / w;
            luma[cell] += (77 * r + 150 * g + 29 * b) as u64;
            count[cell] += 1;
        }
    }

    // An image narrower than 9 or shorter than 8 px leaves cells empty. Fill
    // each from the pixel at its center so every comparison has two sides.
    for cy in 0..GRID_H {
        for cx in 0..GRID_W {
            let cell = cy * GRID_W + cx;
            if count[cell] == 0 {
                let x = ((2 * cx + 1) * w / (2 * GRID_W)).min(w - 1);
                let y = ((2 * cy + 1) * h / (2 * GRID_H)).min(h - 1);
                let i = (y * w + x) * 4;
                let (r, g, b) = over_white(px[i], px[i + 1], px[i + 2], px[i + 3]);
                luma[cell] = (77 * r + 150 * g + 29 * b) as u64;
                count[cell] = 1;
            }
        }
    }

    // right brighter than left by more than MARGIN, compared as
    // cross-multiplied sums so cells of different sizes (w is rarely a
    // multiple of 9) need no division and no rounding:
    //   luma_r / count_r - luma_l / count_l > MARGIN
    let mut hash = 0u64;
    for cy in 0..GRID_H {
        for cx in 0..GRID_W - 1 {
            let l = cy * GRID_W + cx;
            let r = l + 1;
            hash <<= 1;
            let margin = MARGIN_X256 * count[l] * count[r];
            if luma[r] * count[l] > luma[l] * count[r] + margin {
                hash |= 1;
            }
        }
    }

    let n = n as u64;
    let avg = |s: u64| ((s + n / 2) / n) as u8;
    Some(Fingerprint {
        hash,
        color: [avg(sr), avg(sg), avg(sb)],
    })
}

/// `photoFingerprint(rgba, w, h)` → `[hashHigh, hashLow, 0xRRGGBB]` as a
/// `Uint32Array` (a u64 would cross the boundary as a BigInt). Empty when the
/// buffer does not hold a `w` × `h` image.
#[wasm_bindgen]
pub fn photo_fingerprint(px: &[u8], w: u32, h: u32) -> Vec<u32> {
    match fingerprint(px, w, h) {
        Some(f) => vec![
            (f.hash >> 32) as u32,
            f.hash as u32,
            ((f.color[0] as u32) << 16) | ((f.color[1] as u32) << 8) | (f.color[2] as u32),
        ],
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
    fn the_wasm_surface_packs_hash_and_color() {
        let px = [10u8, 20, 30, 255].repeat(9 * 8);
        assert_eq!(photo_fingerprint(&px, 9, 8), vec![0, 0, 0x0a141e]);
        assert!(photo_fingerprint(&px, 10, 8).is_empty());
    }

    #[test]
    fn hamming_counts_differing_bits() {
        assert_eq!(hamming(0, 0), 0);
        assert_eq!(hamming(0, u64::MAX), 64);
        assert_eq!(hamming(0b1010, 0b0110), 2);
    }
}

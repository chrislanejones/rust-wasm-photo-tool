//! Enhance › Adjustments › Auto (ticket 239): one press gives a starting point
//! read off the photo's own histogram.
//!
//! It only COMPUTES. `auto_tone` returns four slider values in the panel's
//! units, and the panel commits them like any slider release
//! (`adjust_commit`), so Auto is an ordinary Adjustments session (ADR-091):
//! one undo step, one recorded `Op::Adjustments`, no new op.
//!
//! What it aims for, on the luma histogram:
//! - 0.5% of pixels clipped at each end: the 0.5% point lands on 0 and the
//!   99.5% point on 255;
//! - the median on a neutral middle gray (128), as far as the sliders reach;
//! - Saturation, Sharpen and Blur untouched (they are not returned).
//!
//! The sliders do not compose into a simple curve: Brightness clamps BEFORE
//! Contrast, Shadows adds its full amount at black, and each slider has its
//! own range. So the pick is a small search over the real slider values,
//! scored with `tone_gray`, a copy of `adjust_in_place`'s math for a gray
//! pixel. A test pins that copy to the engine on a full gray ramp.
use wasm_bindgen::prelude::*;

use crate::adjust::{Adjust, BRIGHTNESS_FULL_SCALE};
use crate::ImageHorseTool;

/// Per-channel histogram of an RGBA buffer: `[0,256)` R, `[256,512)` G,
/// `[512,768)` B, `[768,1024)` luma. Fully transparent pixels are skipped.
/// Integer Rec.601-ish luma `(R*3 + G*6 + B) / 10`. The one histogram the
/// engine has: `calculate_histogram` runs it over the composite.
pub(crate) fn histogram_bins(px: &[u8]) -> Vec<u32> {
    let mut bins = vec![0u32; 256 * 4];
    for p in px.chunks_exact(4) {
        if p[3] == 0 {
            continue;
        }
        let (r, g, b) = (p[0] as usize, p[1] as usize, p[2] as usize);
        let luma = ((r * 3 + g * 6 + b) / 10).min(255);
        bins[r] += 1;
        bins[256 + g] += 1;
        bins[512 + b] += 1;
        bins[768 + luma] += 1;
    }
    bins
}

/// The four values Auto picks, in the panel's own units (src/adjust.rs).
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct AutoTone {
    pub brightness: f64,
    pub contrast: f64,
    pub shadows: f64,
    pub highlights: f64,
}

impl AutoTone {
    pub(crate) const IDENTITY: AutoTone = AutoTone {
        brightness: 0.0,
        contrast: 100.0,
        shadows: 0.0,
        highlights: 0.0,
    };
}

/// Share of pixels clipped at each end.
const CLIP: f64 = 0.005;
/// Where the median is aimed.
const MID_GRAY: f64 = 128.0;
/// How much the median counts against the two end points (each 1.0).
const MID_WEIGHT: f64 = 0.25;
/// Cost of clipping MORE than the 0.5% at an end, per percentage point.
const OVERCLIP_PER_PCT: f64 = 8.0;
/// Pull toward leaving a slider alone: a slider moved its whole span costs
/// about as much as a 3-level miss. It keeps an already-good photo still.
const STAY_PUT: f64 = 10.0;

/// `adjust_in_place`'s tone steps (Brightness, Contrast, Shadows,
/// Highlights, in that order) for ONE gray pixel, copied from the scalar
/// filters in `simd/color.rs` with every clamp and rounding they have.
/// Saturation is left out: Auto never moves it, and it keeps gray gray.
pub(crate) fn tone_gray(v: u8, a: &Adjust) -> u8 {
    let mut v = v as f64;
    if a.brightness != 0.0 {
        let d = ((a.brightness / 100.0 * BRIGHTNESS_FULL_SCALE).clamp(-1.0, 1.0) * 255.0).round();
        v = (v + d).clamp(0.0, 255.0);
    }
    if a.contrast != 100.0 {
        let f = (a.contrast / 100.0).clamp(0.0, 4.0);
        v = (((v / 255.0 - 0.5) * f + 0.5).clamp(0.0, 1.0) * 255.0).round();
    }
    // BT.601 luminance of a gray pixel, written as the filters write it.
    let lum = |v: f64| (0.299 * v + 0.587 * v + 0.114 * v) / 255.0;
    if a.shadows != 0.0 {
        let l = lum(v);
        v = (v + a.shadows.clamp(-255.0, 255.0) * (1.0 - l) * (1.0 - l))
            .round()
            .clamp(0.0, 255.0);
    }
    if a.highlights != 0.0 {
        let l = lum(v);
        v = (v - a.highlights.clamp(-255.0, 255.0) * l * l)
            .round()
            .clamp(0.0, 255.0);
    }
    v as u8
}

/// The luma histogram as cumulative counts, and its three points.
struct Shape {
    /// `cum[v]` = pixels at level `v` or darker.
    cum: [u64; 256],
    lo: u8,
    mid: u8,
    hi: u8,
}

impl Shape {
    fn new(luma: &[u32]) -> Option<Shape> {
        let mut cum = [0u64; 256];
        let mut run = 0u64;
        for (v, c) in cum.iter_mut().enumerate() {
            run += luma.get(v).copied().unwrap_or(0) as u64;
            *c = run;
        }
        if run == 0 {
            return None;
        }
        let at = |frac: f64| {
            let want = ((frac * run as f64).ceil() as u64).max(1);
            cum.iter().position(|&c| c >= want).unwrap_or(255) as u8
        };
        Some(Shape {
            cum,
            lo: at(CLIP),
            mid: at(0.5),
            hi: at(1.0 - CLIP),
        })
    }

    fn total(&self) -> f64 {
        self.cum[255] as f64
    }

    /// Share of pixels at level `v` or darker.
    fn below(&self, v: u8) -> f64 {
        self.cum[v as usize] as f64 / self.total()
    }
}

/// Slider values as integers, the way the panel shows them.
#[derive(Clone, Copy, PartialEq)]
struct Knobs([i32; 4]);

/// Brightness, Contrast, Shadows, Highlights: identity, min, max.
const KNOB_RANGE: [(i32, i32, i32); 4] = [
    (0, -100, 100),
    (100, 10, 300),
    (0, -100, 100),
    (0, -100, 100),
];

impl Knobs {
    fn adjust(self) -> Adjust {
        let [b, c, s, h] = self.0.map(f64::from);
        Adjust::new(b, c, 100.0, s, h, 0.0, 0.0)
    }

    fn nudged(self, i: usize, by: i32) -> Knobs {
        let mut k = self.0;
        let (_, lo, hi) = KNOB_RANGE[i];
        k[i] = (k[i] + by).clamp(lo, hi);
        Knobs(k)
    }
}

/// How far `k` is from the aim: squared level misses at the three points,
/// plus clipping beyond the 0.5%, plus a small pull toward leaving it alone.
fn cost(s: &Shape, k: Knobs) -> f64 {
    let a = k.adjust();
    let at = |v: u8| tone_gray(v, &a) as f64;
    let miss_lo = at(s.lo);
    let miss_hi = 255.0 - at(s.hi);
    let miss_mid = at(s.mid) - MID_GRAY;
    // The output is monotone in the input, so the pixels that land on 0 are
    // exactly the levels up to the last one that maps there.
    let last_black = (0..=255u8).take_while(|&v| at(v) <= 0.0).last();
    let first_white = (0..=255u8).rev().take_while(|&v| at(v) >= 255.0).last();
    let clipped_lo = last_black.map_or(0.0, |v| s.below(v));
    let clipped_hi = first_white.map_or(0.0, |v| 1.0 - if v == 0 { 0.0 } else { s.below(v - 1) });
    // What the 0.5% points already allow: everything at or past them.
    let allowed_lo = s.below(s.lo);
    let allowed_hi = 1.0 - if s.hi == 0 { 0.0 } else { s.below(s.hi - 1) };
    let over =
        |got: f64, allowed: f64| ((got - allowed).max(0.0) * 100.0 * OVERCLIP_PER_PCT).powi(2);
    let stay: f64 =
        k.0.iter()
            .zip(KNOB_RANGE)
            .map(|(&v, (id, lo, hi))| ((v - id) as f64 / (hi - lo) as f64).powi(2))
            .sum();
    miss_lo * miss_lo
        + miss_hi * miss_hi
        + MID_WEIGHT * miss_mid * miss_mid
        + over(clipped_lo, allowed_lo)
        + over(clipped_hi, allowed_hi)
        + STAY_PUT * stay
}

/// Walk each free slider by `step` while the cost drops, then by each smaller step.
fn descend(s: &Shape, mut k: Knobs, free: &[usize], steps: &[i32]) -> (Knobs, f64) {
    let mut best = cost(s, k);
    for &step in steps {
        for _ in 0..64 {
            let mut moved = false;
            for &i in free {
                for by in [step, -step] {
                    let n = k.nudged(i, by);
                    if n == k {
                        continue;
                    }
                    let c = cost(s, n);
                    if c < best - 1e-9 {
                        (k, best, moved) = (n, c, true);
                    }
                }
            }
            if !moved {
                break;
            }
        }
    }
    (k, best)
}

/// Pick the four values for a 256-bin luma histogram. Deterministic: a grid
/// over Shadows × Highlights (step 20), the best Brightness/Contrast for each,
/// then one polish of all four. A blank or single-tone photo gets identity.
pub(crate) fn pick(luma: &[u32]) -> AutoTone {
    let Some(s) = Shape::new(luma) else {
        return AutoTone::IDENTITY;
    };
    if s.hi <= s.lo {
        return AutoTone::IDENTITY;
    }
    // The straight stretch that puts lo on 0 and hi on 255, as the start.
    let f = 255.0 / (s.hi - s.lo) as f64;
    let shift = 127.5 - (s.lo as f64 + s.hi as f64) / 2.0;
    let start_b = (shift / (BRIGHTNESS_FULL_SCALE * 255.0) * 100.0).round() as i32;
    let start_c = (f * 100.0).round() as i32;
    let coarse = [16, 4, 1];
    let identity = Knobs([0, 100, 0, 0]);
    let mut best = (identity, cost(&s, identity));
    for sh in (-100..=100).step_by(20) {
        for hl in (-100..=100).step_by(20) {
            let k = Knobs([0, 100, sh, hl])
                .nudged(0, start_b)
                .nudged(1, start_c - 100);
            let got = descend(&s, k, &[0, 1], &coarse);
            if got.1 < best.1 {
                best = got;
            }
        }
    }
    let (k, _) = descend(&s, best.0, &[0, 1, 2, 3], &[8, 4, 2, 1]);
    let [b, c, sh, hl] = k.0.map(f64::from);
    AutoTone {
        brightness: b,
        contrast: c,
        shadows: sh,
        highlights: hl,
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Enhance › Adjustments › Auto: `[brightness, contrast, shadows,
    /// highlights]` in the panel's units, read from the histogram of the
    /// Adjustments session's untouched copy when one is open (so a second
    /// press picks the same values), otherwise of the active layer. Changes
    /// nothing and records nothing; empty when there is no layer.
    pub fn auto_tone(&self) -> Vec<f64> {
        let px: &[u8] = match &self.tonal_preview {
            Some(p) if self.tonal_preview_is_current() => &p.base,
            _ => match self.layers.get(self.active) {
                Some(l) => &l.buf.data,
                None => return Vec::new(),
            },
        };
        let bins = histogram_bins(px);
        let a = pick(&bins[768..]);
        vec![a.brightness, a.contrast, a.shadows, a.highlights]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A tiny deterministic noise source (xorshift32), so fixtures never
    /// depend on a photo or on a random seed.
    struct Noise(u32);
    impl Noise {
        fn next(&mut self) -> f64 {
            let mut x = self.0;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            self.0 = x;
            (x as f64 / u32::MAX as f64) * 2.0 - 1.0
        }
    }

    /// A `w × h` "photo": a diagonal tone ramp shaped by `gamma`, from `lo`
    /// to `hi`, with soft texture, ±4 noise and a faint warm tint. The e2e
    /// spec (`e2e/auto-tone.spec.ts`) builds the same two fixtures.
    fn fixture(w: u32, h: u32, lo: f64, hi: f64, gamma: f64) -> Vec<u8> {
        let mut n = Noise(0x2391_5eed);
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for y in 0..h {
            for x in 0..w {
                let t = (x as f64 + y as f64) / (w + h - 2) as f64;
                let texture = 10.0 * ((x as f64) / 7.0).sin() * ((y as f64) / 11.0).cos();
                let g = lo + (hi - lo) * t.powf(gamma) + texture + 4.0 * n.next();
                let c = |k: f64| (g * k).round().clamp(0.0, 255.0) as u8;
                v.extend_from_slice(&[c(1.04), c(1.0), c(0.92), 255]);
            }
        }
        v
    }

    /// Dark: luma about 10..125, most of it in the bottom third.
    fn dark() -> Vec<u8> {
        fixture(128, 96, 14.0, 120.0, 1.8)
    }

    /// Already good: nearly the full range, median near middle gray.
    fn good() -> Vec<u8> {
        fixture(128, 96, -12.0, 266.0, 1.0)
    }

    #[derive(Debug, Clone, Copy)]
    struct Points {
        lo: usize,
        mid: usize,
        hi: usize,
        mean: f64,
        /// Share of pixels with luma 0, and with luma 255.
        black: f64,
        white: f64,
    }

    fn points(px: &[u8]) -> Points {
        let bins = histogram_bins(px);
        let luma = &bins[768..];
        let total: u64 = luma.iter().map(|&c| c as u64).sum();
        let at = |frac: f64| {
            let want = (frac * total as f64).ceil().max(1.0) as u64;
            let mut cum = 0u64;
            for (v, &c) in luma.iter().enumerate() {
                cum += c as u64;
                if cum >= want {
                    return v;
                }
            }
            255
        };
        let sum: u64 = luma
            .iter()
            .enumerate()
            .map(|(v, &c)| v as u64 * c as u64)
            .sum();
        Points {
            lo: at(0.005),
            mid: at(0.5),
            hi: at(0.995),
            mean: sum as f64 / total as f64,
            black: luma[0] as f64 / total as f64,
            white: luma[255] as f64 / total as f64,
        }
    }

    /// Press Auto the way the panel does: begin a session, read the values,
    /// commit them as one release.
    fn press_auto(t: &mut ImageHorseTool) -> AutoTone {
        assert!(t.tonal_preview_begin());
        let v = t.auto_tone();
        assert_eq!(v.len(), 4);
        let a = AutoTone {
            brightness: v[0],
            contrast: v[1],
            shadows: v[2],
            highlights: v[3],
        };
        t.adjust_commit(
            a.brightness,
            a.contrast,
            100.0,
            a.shadows,
            a.highlights,
            0.0,
            0.0,
        );
        a
    }

    fn loaded(px: &[u8]) -> ImageHorseTool {
        let mut t = ImageHorseTool::new(128, 96);
        t.load_image(px);
        t
    }

    /// `tone_gray` is a COPY of the filters, so it is checked against them:
    /// every gray level, through the real `adjust_in_place`, for a spread of
    /// settings across each slider's range.
    #[test]
    fn the_gray_model_matches_the_engine_on_every_level() {
        let ramp: Vec<u8> = (0..=255u8).flat_map(|v| [v, v, v, 255]).collect();
        for b in [-100.0, -37.0, 0.0, 41.0, 100.0] {
            for c in [10.0, 64.0, 100.0, 173.0, 300.0] {
                for (s, h) in [
                    (0.0, 0.0),
                    (-100.0, 0.0),
                    (55.0, -20.0),
                    (0.0, -100.0),
                    (-30.0, 100.0),
                ] {
                    let a = Adjust::new(b, c, 100.0, s, h, 0.0, 0.0);
                    let mut px = ramp.clone();
                    crate::adjust::adjust_in_place(&mut px, 256, 1, &a);
                    for v in 0..=255u8 {
                        let got = px[v as usize * 4];
                        assert_eq!(tone_gray(v, &a), got, "level {v} with {a:?}");
                    }
                }
            }
        }
    }

    #[test]
    fn a_blank_or_flat_photo_gets_identity() {
        assert_eq!(pick(&[0u32; 256]), AutoTone::IDENTITY);
        let mut flat = [0u32; 256];
        flat[90] = 1000;
        assert_eq!(pick(&flat), AutoTone::IDENTITY);
    }

    #[test]
    fn a_second_press_picks_the_same_values() {
        let mut t = loaded(&dark());
        let first = press_auto(&mut t);
        // The session's untouched copy is what is read, not the preview.
        let again = t.auto_tone();
        assert_eq!(
            again,
            vec![
                first.brightness,
                first.contrast,
                first.shadows,
                first.highlights
            ]
        );
    }

    #[test]
    fn auto_is_one_undo_step_and_undo_restores_the_photo() {
        let px = dark();
        let mut t = loaded(&px);
        let original = t.get_image_data();
        let before = t.undo_count();
        press_auto(&mut t);
        assert_eq!(t.undo_count(), before + 1, "one press, one step");
        assert_ne!(t.get_image_data(), original);
        t.undo();
        assert_eq!(t.get_image_data(), original);
    }

    /// The day-log table: `cargo test --lib auto_tone::tests::print_day_log -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn print_day_log() {
        for (name, px) in [("dark", dark()), ("good", good())] {
            let before = points(&px);
            let mut t = loaded(&px);
            let a = press_auto(&mut t);
            let after = points(&t.get_image_data());
            println!("{name}: before {before:?}\n{name}: after  {after:?}\n{name}: picked {a:?}");
        }
    }

    #[test]
    fn a_dark_photo_comes_out_brighter_and_wider() {
        let px = dark();
        let before = points(&px);
        let mut t = loaded(&px);
        let a = press_auto(&mut t);
        let after = points(&t.get_image_data());
        assert!(
            after.mean >= before.mean + 30.0,
            "mean {:.1} -> {:.1} with {a:?}",
            before.mean,
            after.mean
        );
        assert!(
            after.mid as f64 >= before.mid as f64 + 30.0,
            "median {} -> {} with {a:?}",
            before.mid,
            after.mid
        );
        let (w0, w1) = (before.hi - before.lo, after.hi - after.lo);
        assert!(
            w1 >= w0 + 80,
            "0.5%..99.5% spread {w0} -> {w1} ({before:?} -> {after:?}) with {a:?}"
        );
        assert!(after.lo <= 6, "black point lands near 0: {after:?}");
        assert!(after.hi >= 245, "white point lands near 255: {after:?}");
        // Clip about 0.5% at each end, not a slab of the photo.
        assert!(after.black <= 0.015, "clipped to black: {after:?}");
        assert!(after.white <= 0.015, "clipped to white: {after:?}");
    }

    /// The bound: on an already-good photo, each of the 0.5%, 50% and 99.5%
    /// points and the mean moves by at most 8 levels of 255.
    #[test]
    fn an_already_good_photo_moves_only_a_little() {
        let px = good();
        let before = points(&px);
        let mut t = loaded(&px);
        let a = press_auto(&mut t);
        let after = points(&t.get_image_data());
        let d = |x: f64, y: f64| (x - y).abs();
        for (name, x, y) in [
            ("0.5%", before.lo as f64, after.lo as f64),
            ("50%", before.mid as f64, after.mid as f64),
            ("99.5%", before.hi as f64, after.hi as f64),
            ("mean", before.mean, after.mean),
        ] {
            assert!(
                d(x, y) <= 8.0,
                "{name} moved {x:.1} -> {y:.1} ({before:?} -> {after:?}) with {a:?}"
            );
        }
    }
}

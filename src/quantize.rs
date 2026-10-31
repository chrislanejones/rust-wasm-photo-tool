/// Color reduction for "Compress" on a PNG (10-27-2026).
///
/// PNG is lossless, so a Quality slider has nothing to turn — and a downscale
/// makes a PNG BIGGER when the source is flat art: Lanczos blends the hard
/// edges of a 66-color logo into 2,197 colors, which no lossless layout stores
/// cheaply (900×900 upload 28,477 B → 450×450 RGBA 43,496 B). Reducing to a
/// palette is what TinyPNG does, and `codec::export_png` then writes the
/// result as an indexed PNG on its own.
///
/// Median cut over a 5-bit-per-channel histogram, no dithering: dither noise
/// costs bytes, and the cases this exists for are logos and line art. Opaque
/// and fully transparent pixels stay exactly opaque and exactly transparent,
/// so an opaque image can still be written as RGB.
use crate::core::ImageBuffer;
use wasm_bindgen::prelude::*;

/// Colors kept at `quality` (0..=100): 256 at 75 and above — the default —
/// then halving every 25 points, with a floor of 32. Integer steps, not
/// `powf`: float `pow` pulls libm into the binary.
pub fn max_colors_for_quality(quality: u32) -> usize {
    32 << (quality.min(75) / 25)
}

/// Encode `pixels` (RGBA8, `width × height`) as a PNG of at most
/// `max_colors_for_quality(quality)` colors. Quality 100 is lossless.
///
/// Never bigger than the lossless encode: a smooth synthetic gradient is
/// 471 B lossless and 4,532 B as a palette (the reduction breaks the linear
/// runs PNG's filters predict), so both are encoded and the smaller is kept.
#[wasm_bindgen]
pub fn encode_png_pixels_quality(pixels: &[u8], width: u32, height: u32, quality: u32) -> Vec<u8> {
    let encode = |data: Vec<u8>| {
        crate::codec::export_png(&ImageBuffer {
            width,
            height,
            data,
        })
    };
    let lossless = encode(pixels.to_vec());
    if quality >= 100 {
        return lossless;
    }
    let reduced = encode(quantize(pixels, max_colors_for_quality(quality)));
    if reduced.len() < lossless.len() {
        reduced
    } else {
        lossless
    }
}

const BITS: u32 = 5;
const LEVELS: usize = 1 << BITS;

/// Alpha gets its own buckets at both ends so 0 and 255 never share one with
/// a partial value — a box of only-255 pixels then averages to exactly 255.
fn alpha_bucket(a: u8) -> usize {
    match a {
        0 => 0,
        255 => LEVELS - 1,
        _ => 1 + (a as usize - 1) * (LEVELS - 2) / 254,
    }
}

fn bucket_of(p: &[u8]) -> usize {
    let c = |v: u8| (v >> (8 - BITS)) as usize;
    (((c(p[0]) * LEVELS + c(p[1])) * LEVELS + c(p[2])) * LEVELS) + alpha_bucket(p[3])
}

fn channel(key: usize, ch: usize) -> usize {
    (key >> (BITS as usize * (3 - ch))) & (LEVELS - 1)
}

/// Reduce `pixels` to at most `max_colors` RGBA colors. Pixels that already
/// fit are returned unchanged.
pub fn quantize(pixels: &[u8], max_colors: usize) -> Vec<u8> {
    let max_colors = max_colors.clamp(4, 256);
    if crate::codec::small_palette(pixels).is_some_and(|p| p.len() <= max_colors) {
        return pixels.to_vec();
    }

    let mut hist = vec![0u32; LEVELS.pow(4)];
    for p in pixels.chunks_exact(4) {
        let b = bucket_of(p);
        hist[b] = hist[b].saturating_add(1);
    }
    // Transparent, partly transparent and opaque pixels start in separate
    // boxes and never share one: a box mixing 255 with 128 averages to a
    // translucent color for pixels that were solid.
    let class = |key: usize| match key & (LEVELS - 1) {
        0 => 0,
        a if a == LEVELS - 1 => 2,
        _ => 1,
    };
    let mut cells: Vec<(usize, u32)> = Vec::new();
    let mut boxes: Vec<(usize, usize)> = Vec::new();
    for want in 0..3 {
        let start = cells.len();
        for (k, &n) in hist.iter().enumerate() {
            if n > 0 && class(k) == want {
                cells.push((k, n));
            }
        }
        if cells.len() > start {
            boxes.push((start, cells.len()));
        }
    }

    // Boxes are ranges of `cells`. Split the box with the largest
    // population × widest channel range at its weighted median.
    while boxes.len() < max_colors {
        let mut pick: Option<(usize, usize, u64)> = None;
        for (i, &(s, e)) in boxes.iter().enumerate() {
            if e - s < 2 {
                continue;
            }
            let (ch, range) = widest_channel(&cells[s..e]);
            let pop: u64 = cells[s..e].iter().map(|c| c.1 as u64).sum();
            let score = pop * range as u64;
            if score > 0 && pick.is_none_or(|(_, _, best)| score > best) {
                pick = Some((i, ch, score));
            }
        }
        let Some((i, ch, _)) = pick else { break };
        let (s, e) = boxes[i];
        let slice = &mut cells[s..e];
        order_by_channel(slice, ch);
        let half: u64 = slice.iter().map(|c| c.1 as u64).sum::<u64>() / 2;
        let mut acc = 0u64;
        let mut cut = 1;
        for (j, c) in slice.iter().enumerate() {
            acc += c.1 as u64;
            if acc >= half {
                cut = (j + 1).clamp(1, slice.len() - 1);
                break;
            }
        }
        boxes[i] = (s, s + cut);
        boxes.push((s + cut, e));
    }

    // Bucket → box, then each box's color is the mean of its real pixels.
    let mut box_of = vec![0u16; LEVELS.pow(4)];
    for (b, &(s, e)) in boxes.iter().enumerate() {
        for c in &cells[s..e] {
            box_of[c.0] = b as u16;
        }
    }
    let mut sums = vec![[0u64; 5]; boxes.len()];
    for p in pixels.chunks_exact(4) {
        let s = &mut sums[box_of[bucket_of(p)] as usize];
        for ch in 0..4 {
            s[ch] += p[ch] as u64;
        }
        s[4] += 1;
    }
    let palette: Vec<[u8; 4]> = sums
        .iter()
        .map(|s| {
            let n = s[4].max(1);
            let a = ((s[3] + n / 2) / n) as u8;
            if a == 0 {
                // Invisible: one shared color compresses best.
                return [0, 0, 0, 0];
            }
            let m = |v: u64| ((v + n / 2) / n) as u8;
            [m(s[0]), m(s[1]), m(s[2]), a]
        })
        .collect();

    let mut out = Vec::with_capacity(pixels.len());
    for p in pixels.chunks_exact(4) {
        out.extend_from_slice(&palette[box_of[bucket_of(p)] as usize]);
    }
    out
}

fn widest_channel(cells: &[(usize, u32)]) -> (usize, usize) {
    let mut best = (0, 0);
    for ch in 0..4 {
        let (lo, hi) = cells.iter().fold((usize::MAX, 0), |(lo, hi), c| {
            let v = channel(c.0, ch);
            (lo.min(v), hi.max(v))
        });
        let range = hi.saturating_sub(lo);
        if range > best.1 {
            best = (ch, range);
        }
    }
    best
}

/// Order `cells` by one channel's 5-bit value: a 32-bin counting pass, not
/// a generic sort, which would add another sort instantiation to the binary.
fn order_by_channel(cells: &mut [(usize, u32)], ch: usize) {
    let mut bins: Vec<Vec<(usize, u32)>> = vec![Vec::new(); LEVELS];
    for &c in cells.iter() {
        bins[channel(c.0, ch)].push(c);
    }
    for (slot, c) in cells.iter_mut().zip(bins.into_iter().flatten()) {
        *slot = c;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gradient(w: u32, h: u32, alpha: impl Fn(u32, u32) -> u8) -> Vec<u8> {
        (0..h)
            .flat_map(|y| (0..w).map(move |x| (x, y)))
            .flat_map(|(x, y)| {
                [
                    (x * 255 / w) as u8,
                    (y * 255 / h) as u8,
                    ((x + y) % 256) as u8,
                    alpha(x, y),
                ]
            })
            .collect()
    }

    fn distinct_colors(px: &[u8]) -> usize {
        let mut v: Vec<u32> = px
            .chunks_exact(4)
            .map(|p| u32::from_be_bytes([p[0], p[1], p[2], p[3]]))
            .collect();
        v.sort_unstable();
        v.dedup();
        v.len()
    }

    #[test]
    fn caps_the_color_count() {
        let px = gradient(128, 128, |_, _| 255);
        assert!(distinct_colors(&px) > 256);
        for max in [256, 64, 32] {
            assert!(distinct_colors(&quantize(&px, max)) <= max);
        }
    }

    #[test]
    fn opaque_stays_opaque_and_transparent_stays_transparent() {
        let px = gradient(128, 128, |x, _| match x % 3 {
            0 => 0,
            1 => 255,
            _ => 128,
        });
        let q = quantize(&px, 64);
        for (a, b) in px.chunks_exact(4).zip(q.chunks_exact(4)) {
            if a[3] == 255 {
                assert_eq!(b[3], 255);
            }
            if a[3] == 0 {
                assert_eq!(b[3], 0);
            }
            if a[3] != 0 {
                assert_ne!(b[3], 0, "a visible pixel must not vanish");
            }
        }
    }

    #[test]
    fn few_colors_are_untouched() {
        let px: Vec<u8> = (0..1000u32)
            .flat_map(|i| [(i % 7) as u8 * 30, 0, 0, 255])
            .collect();
        assert_eq!(quantize(&px, 32), px);
    }

    #[test]
    fn quality_100_is_lossless_and_lower_is_smaller() {
        // Noise: thousands of colors no lossless layout can predict.
        let (w, h) = (160u32, 120u32);
        let mut seed = 12345u32;
        let px: Vec<u8> = (0..w * h * 4)
            .map(|i| {
                seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12_345);
                if i % 4 == 3 {
                    255
                } else {
                    (seed >> 16) as u8
                }
            })
            .collect();
        let lossless = encode_png_pixels_quality(&px, w, h, 100);
        let (back, _, _) = crate::codec::decode_png(&lossless).expect("valid PNG"); // allow: rust-panic
        assert_eq!(back, px);
        assert!(encode_png_pixels_quality(&px, w, h, 75).len() < lossless.len());
    }

    #[test]
    fn never_bigger_than_lossless() {
        // The smooth gradient that a palette makes 10x bigger.
        let (w, h) = (160, 120);
        let px = gradient(w, h, |x, y| if (x / 8 + y / 8) % 2 == 0 { 255 } else { 90 });
        let lossless = encode_png_pixels_quality(&px, w, h, 100);
        assert!(encode_png_pixels_quality(&px, w, h, 10).len() <= lossless.len());
    }

    #[test]
    fn colors_follow_quality() {
        assert_eq!(max_colors_for_quality(100), 256);
        assert_eq!(max_colors_for_quality(75), 256);
        assert_eq!(max_colors_for_quality(50), 128);
        assert_eq!(max_colors_for_quality(25), 64);
        assert_eq!(max_colors_for_quality(0), 32);
    }
}

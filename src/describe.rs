// ===== FILE: src/describe.rs =====
//! Local, offline content description — the engine behind Batch → **AI Rename**.
//!
//! Given an RGBA buffer this returns a handful of descriptive tags (dominant
//! colour, tone, what kind of image it is, a coarse subject guess) which the
//! panel turns into a filename. It runs entirely in the engine: no network, no
//! account, no per-image cost, so it works in demo mode like every other local
//! tool.
//!
//! **What this is and is not.** This is image *description*, not object
//! recognition. It measures real properties of the pixels — hue distribution,
//! luma mean/variance, local gradient energy, palette diversity, skin/foliage/
//! sky ratios — and names the image from them. It will tell you an image is a
//! `dark-blue-portrait` or a `bright-white-screenshot`. It will never tell you
//! it is a golden retriever. A caption model is the only thing that does that,
//! and it does not run offline; keeping the honest boundary here is deliberate.
//!
//! Cost is bounded by sampling: the grid is capped at ~160×160 samples, so a
//! 6000×4000 photo costs the same as a 640×480 one. Nothing here is on the
//! flush path — it is called once per photo when the user presses Rename.

/// The 12 hue buckets, 30° apart. Index `i` is CENTRED on `i * 30°` and spans
/// `±15°`, so the entries must line up with the primaries at their centres:
/// 0 red, 60 yellow, 120 green, 180 cyan, 240 blue, 300 magenta. (An earlier
/// draft slipped "gold" in at index 2 and shifted everything after it by one
/// bin — pure blue came out "sky" and foliage came out "lime". Adding a name
/// here without removing one silently rotates the whole wheel.) Names are
/// picked to read well *in a filename*: "sky" over "azure".
const HUE_NAMES: [&str; 12] = [
    "red", "orange", "yellow", "lime", "green", "teal", "cyan", "sky", "blue", "purple", "magenta",
    "pink",
];

/// Everything the analyser concluded about one image. Empty `&'static str`
/// means "no strong signal" and is omitted from the slug (and emitted as `""`
/// in the JSON, so the panel can decide for itself).
pub(crate) struct Description {
    /// `photo` | `graphic` | `screenshot`
    pub kind: &'static str,
    /// `portrait` | `nature` | `sky` | `screenshot` | `graphic` | `""`
    pub subject: &'static str,
    /// `dark` | `bright` | `""`
    pub tone: &'static str,
    /// `high` | `soft` | `normal`
    pub contrast: &'static str,
    /// `mono` | `muted` | `vivid` | `""`
    pub palette: &'static str,
    /// A hue name, or `white` / `grey` / `black` when there is no usable hue.
    pub color: &'static str,
    /// `panorama` | `landscape` | `portrait` | `square`
    pub orientation: &'static str,
    /// `busy` | `smooth` | `""`
    pub detail: &'static str,
    /// Whether a meaningful share of the image is not fully opaque.
    pub transparent: bool,
    /// Two or three of the above, joined with `-` — the default filename.
    pub slug: String,
}

impl Description {
    /// The answer for a buffer we cannot read (zero-sized, or short).
    fn unknown() -> Self {
        Description {
            kind: "image",
            subject: "",
            tone: "",
            contrast: "normal",
            palette: "",
            color: "grey",
            orientation: "square",
            detail: "",
            transparent: false,
            slug: String::from("image"),
        }
    }

    /// Manual JSON — same hand-rolled convention as `annotations_to_json`, and
    /// it keeps this module free of the serde dependency that is gated behind
    /// the `tiles` feature.
    pub(crate) fn to_json(&self) -> String {
        format!(
            "{{\"kind\":\"{}\",\"subject\":\"{}\",\"tone\":\"{}\",\"contrast\":\"{}\",\
             \"palette\":\"{}\",\"color\":\"{}\",\"orientation\":\"{}\",\"detail\":\"{}\",\
             \"transparent\":{},\"slug\":\"{}\"}}",
            self.kind,
            self.subject,
            self.tone,
            self.contrast,
            self.palette,
            self.color,
            self.orientation,
            self.detail,
            self.transparent,
            self.slug,
        )
    }
}

/// Hue (0..360), saturation (0..1), value (0..1) from one RGB triple.
fn rgb_to_hsv(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let rf = r as f32 / 255.0;
    let gf = g as f32 / 255.0;
    let bf = b as f32 / 255.0;
    let max = rf.max(gf).max(bf);
    let min = rf.min(gf).min(bf);
    let d = max - min;

    let hue = if d < 1e-6 {
        0.0
    } else if max <= rf {
        60.0 * (((gf - bf) / d) % 6.0)
    } else if max <= gf {
        60.0 * ((bf - rf) / d + 2.0)
    } else {
        60.0 * ((rf - gf) / d + 4.0)
    };
    let hue = if hue < 0.0 { hue + 360.0 } else { hue };
    let sat = if max < 1e-6 { 0.0 } else { d / max };
    (hue, sat, max)
}

/// Raw tallies from the sampling pass, before any of them mean anything.
/// `Default` is hand-written rather than derived: `[u64; 64]` is past the
/// 32-element array size std implements `Default` for.
struct Tally {
    n: u32,
    lum_sum: f64,
    lum_sq: f64,
    sat_sum: f64,
    hue_hist: [f64; 12],
    edge_sum: f64,
    edge_n: u32,
    flat_n: u32,
    skin: u32,
    green: u32,
    sky: u32,
    sky_n: u32,
    near_white: u32,
    translucent: u32,
    /// 4096-entry "have I seen this colour" bitset (4 bits per channel), so
    /// palette diversity costs no allocation.
    palette_bits: [u64; 64],
    palette_count: u32,
}

impl Default for Tally {
    fn default() -> Self {
        Tally {
            n: 0,
            lum_sum: 0.0,
            lum_sq: 0.0,
            sat_sum: 0.0,
            hue_hist: [0.0; 12],
            edge_sum: 0.0,
            edge_n: 0,
            flat_n: 0,
            skin: 0,
            green: 0,
            sky: 0,
            sky_n: 0,
            near_white: 0,
            translucent: 0,
            palette_bits: [0; 64],
            palette_count: 0,
        }
    }
}

/// Walk a capped sample grid and fill in the tallies.
fn tally(pixels: &[u8], w: usize, h: usize) -> Tally {
    let mut t = Tally::default();
    // ~160 samples per axis, whatever the source resolution.
    let step_x = (w / 160).max(1);
    let step_y = (h / 160).max(1);
    // "Sky" is only meaningful above the horizon, so it is measured over the
    // top third rather than the whole frame.
    let sky_rows = (h / 3).max(1);

    let mut y = 0;
    while y < h {
        let row = y * w;
        let mut x = 0;
        while x < w {
            let i = (row + x) * 4;
            let (r, g, b, a) = (pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
            t.n += 1;

            if a < 250 {
                t.translucent += 1;
            }

            let (hue, sat, val) = rgb_to_hsv(r, g, b);
            let lum = (0.2126 * r as f64 + 0.7152 * g as f64 + 0.0722 * b as f64) / 255.0;
            t.lum_sum += lum;
            t.lum_sq += lum * lum;
            t.sat_sum += sat as f64;

            // Only pixels with a real hue vote, weighted by how saturated they
            // are — otherwise a wash of near-grey outvotes the actual subject.
            if sat > 0.18 && val > 0.12 && val < 0.98 {
                let bin = (((hue + 15.0) / 30.0) as usize) % 12;
                t.hue_hist[bin] += sat as f64;
            }
            if lum > 0.93 {
                t.near_white += 1;
            }

            let bucket = ((r as usize >> 4) << 8) | ((g as usize >> 4) << 4) | (b as usize >> 4);
            let bit = 1u64 << (bucket & 63);
            if t.palette_bits[bucket >> 6] & bit == 0 {
                t.palette_bits[bucket >> 6] |= bit;
                t.palette_count += 1;
            }

            // Kovac's skin-tone rule — cheap, and good enough to separate
            // "there are people in this" from "there are not".
            let spread = r.max(g).max(b) - r.min(g).min(b);
            if r > 95 && g > 40 && b > 20 && spread > 15 && r.abs_diff(g) > 15 && r > g && r > b {
                t.skin += 1;
            }
            if g as i16 - r as i16 > 12 && g as i16 - b as i16 > 12 {
                t.green += 1;
            }
            if y < sky_rows {
                t.sky_n += 1;
                if b as i16 - r as i16 > 12 && b as i16 - g as i16 > 4 && lum > 0.35 {
                    t.sky += 1;
                }
            }

            // Detail is measured against the TRUE adjacent pixel, not the next
            // sample — sampling the gradient at grid spacing would measure
            // large-scale variation and call every photo smooth.
            if x + 1 < w {
                let j = i + 4;
                let d = r.abs_diff(pixels[j]) as u32
                    + g.abs_diff(pixels[j + 1]) as u32
                    + b.abs_diff(pixels[j + 2]) as u32;
                t.edge_sum += d as f64;
                t.edge_n += 1;
                if d <= 6 {
                    t.flat_n += 1;
                }
            }
            x += step_x;
        }
        y += step_y;
    }
    t
}

/// Describe one RGBA image.
pub(crate) fn describe(pixels: &[u8], w: u32, h: u32) -> Description {
    let (wu, hu) = (w as usize, h as usize);
    if wu == 0 || hu == 0 || pixels.len() < wu * hu * 4 {
        return Description::unknown();
    }
    let t = tally(pixels, wu, hu);
    if t.n == 0 {
        return Description::unknown();
    }

    let nf = t.n as f64;
    let mean_lum = t.lum_sum / nf;
    let sd = (t.lum_sq / nf - mean_lum * mean_lum).max(0.0).sqrt();
    let mean_sat = t.sat_sum / nf;
    let edge = if t.edge_n > 0 {
        t.edge_sum / t.edge_n as f64
    } else {
        0.0
    };
    let flat = if t.edge_n > 0 {
        t.flat_n as f64 / t.edge_n as f64
    } else {
        0.0
    };
    // Fraction of the *achievable* buckets, so a 16×16 icon and a 24MP photo
    // are judged on the same scale.
    let diversity = t.palette_count as f64 / (t.n.min(4096) as f64);
    let skin_frac = t.skin as f64 / nf;
    let green_frac = t.green as f64 / nf;
    let sky_frac = if t.sky_n > 0 {
        t.sky as f64 / t.sky_n as f64
    } else {
        0.0
    };
    let white_frac = t.near_white as f64 / nf;
    let transparent = t.translucent as f64 / nf > 0.02;

    // Flat neighbours + a tiny palette is the signature of something drawn
    // rather than captured; mostly-white on top of that reads as a screenshot.
    let kind = if flat > 0.88 && diversity < 0.08 {
        if white_frac > 0.30 {
            "screenshot"
        } else {
            "graphic"
        }
    } else {
        "photo"
    };

    let tone = if mean_lum < 0.22 {
        "dark"
    } else if mean_lum > 0.72 {
        "bright"
    } else {
        ""
    };
    let contrast = if sd > 0.28 {
        "high"
    } else if sd < 0.10 {
        "soft"
    } else {
        "normal"
    };
    let palette = if mean_sat < 0.10 {
        "mono"
    } else if mean_sat > 0.50 {
        "vivid"
    } else if mean_sat < 0.25 {
        "muted"
    } else {
        ""
    };

    let best_hue =
        t.hue_hist.iter().enumerate().fold(
            (0usize, 0.0f64),
            |acc, (i, &v)| {
                if v > acc.1 {
                    (i, v)
                } else {
                    acc
                }
            },
        );
    let color = if mean_sat < 0.10 || best_hue.1 <= 0.0 {
        if mean_lum > 0.75 {
            "white"
        } else if mean_lum < 0.20 {
            "black"
        } else {
            "grey"
        }
    } else {
        HUE_NAMES[best_hue.0]
    };

    let aspect = wu as f64 / hu as f64;
    let orientation = if aspect > 2.2 {
        "panorama"
    } else if aspect > 1.15 {
        "landscape"
    } else if aspect < 0.87 {
        "portrait"
    } else {
        "square"
    };

    let detail = if edge > 42.0 {
        "busy"
    } else if edge < 8.0 {
        "smooth"
    } else {
        ""
    };

    // Subject, most confident signal first.
    //
    // The skin test carries two extra conditions, both earned against real
    // photos: Kovac's rule fires on ANY warm mid-tone, so a beige wall, sunlit
    // stone or a wooden interior reads as "skin" just as happily as a face
    // does. `kind == "photo"` drops flat graphics, and `detail != "smooth"`
    // drops the large flat warm expanses that are the common false positive —
    // a face has edges in it, a stucco wall does not. The threshold is a
    // sixth of the frame; below that it is a warm background, not a subject.
    let subject = if kind == "photo" && skin_frac > 0.18 && detail != "smooth" {
        "portrait"
    } else if green_frac > 0.32 {
        "nature"
    } else if sky_frac > 0.45 {
        "sky"
    } else if kind != "photo" {
        kind
    } else {
        ""
    };

    // Slug: at most three words, most distinctive last, empties skipped.
    let mut parts: Vec<&str> = Vec::with_capacity(3);
    if transparent {
        parts.push("cutout");
    }
    if !tone.is_empty() {
        parts.push(tone);
    }
    parts.push(color);
    // `subject == color` is reachable — a blue sky scores the "sky" hue bin AND
    // the sky subject — and "sky-sky" is a silly filename.
    if !subject.is_empty() && subject != color {
        parts.push(subject);
    } else if !detail.is_empty() {
        parts.push(detail);
    }
    while parts.len() > 3 {
        parts.remove(1); // drop tone before colour/subject
    }

    Description {
        kind,
        subject,
        tone,
        contrast,
        palette,
        color,
        orientation,
        detail,
        transparent,
        slug: parts.join("-"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fill an RGBA buffer with one colour.
    fn solid(w: u32, h: u32, r: u8, g: u8, b: u8, a: u8) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&[r, g, b, a]);
        }
        v
    }

    /// Deterministic pseudo-noise, so "photo" detection has something with
    /// real high-frequency detail and a wide palette to chew on.
    fn noise(w: u32, h: u32) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        let mut s: u32 = 0x1234_5678;
        for _ in 0..(w * h) {
            s = s.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let r = (s >> 16) as u8;
            s = s.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let g = (s >> 16) as u8;
            s = s.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let b = (s >> 16) as u8;
            v.extend_from_slice(&[r, g, b, 255]);
        }
        v
    }

    #[test]
    fn empty_and_short_buffers_are_unknown() {
        assert_eq!(describe(&[], 0, 0).slug, "image");
        // Claims 10×10 but carries four pixels — must not index out of bounds.
        assert_eq!(describe(&[0; 16], 10, 10).slug, "image");
    }

    #[test]
    fn solid_red_is_a_flat_red_graphic() {
        let d = describe(&solid(200, 200, 220, 30, 30, 255), 200, 200);
        assert_eq!(d.color, "red");
        assert_eq!(d.kind, "graphic");
        assert_eq!(d.detail, "smooth");
        assert_eq!(d.orientation, "square");
        assert!(!d.transparent);
    }

    #[test]
    fn solid_blue_is_blue() {
        let d = describe(&solid(64, 64, 30, 60, 210, 255), 64, 64);
        assert_eq!(d.color, "blue");
    }

    #[test]
    fn a_white_page_reads_as_a_screenshot() {
        let d = describe(&solid(300, 200, 250, 250, 250, 255), 300, 200);
        assert_eq!(d.kind, "screenshot");
        assert_eq!(d.subject, "screenshot");
        assert_eq!(d.tone, "bright");
        assert_eq!(d.color, "white");
    }

    #[test]
    fn a_black_frame_is_dark_and_mono() {
        let d = describe(&solid(120, 120, 8, 8, 8, 255), 120, 120);
        assert_eq!(d.tone, "dark");
        assert_eq!(d.palette, "mono");
        assert_eq!(d.color, "black");
    }

    #[test]
    fn noise_is_a_busy_photo() {
        let d = describe(&noise(256, 256), 256, 256);
        assert_eq!(d.kind, "photo");
        assert_eq!(d.detail, "busy");
    }

    #[test]
    fn transparency_is_reported_and_leads_the_slug() {
        let d = describe(&solid(100, 100, 40, 180, 90, 0), 100, 100);
        assert!(d.transparent);
        assert!(d.slug.starts_with("cutout-"), "slug was {}", d.slug);
    }

    #[test]
    fn orientation_follows_the_aspect_ratio() {
        assert_eq!(
            describe(&solid(400, 100, 90, 90, 90, 255), 400, 100).orientation,
            "panorama"
        );
        assert_eq!(
            describe(&solid(300, 200, 90, 90, 90, 255), 300, 200).orientation,
            "landscape"
        );
        assert_eq!(
            describe(&solid(200, 300, 90, 90, 90, 255), 200, 300).orientation,
            "portrait"
        );
        assert_eq!(
            describe(&solid(200, 200, 90, 90, 90, 255), 200, 200).orientation,
            "square"
        );
    }

    /// A large, flat, warm expanse — a stucco wall, sunlit stone, a wooden
    /// interior. Kovac's skin rule fires on every pixel of this, and before the
    /// `kind`/`detail` guards it came back "portrait". Found against real
    /// photos: a white car in front of a beige wall was named
    /// `orange-portrait`. Warm background is not a subject.
    #[test]
    fn a_flat_warm_wall_is_not_a_portrait() {
        // Squarely inside Kovac's rule: r>95, g>40, b>20, r>g>b, spread>15.
        let beige = describe(&solid(300, 300, 210, 180, 150, 255), 300, 300);
        assert_ne!(
            beige.subject, "portrait",
            "beige wall slugged as {}",
            beige.slug
        );
        let wood = describe(&solid(300, 300, 150, 100, 60, 255), 300, 300);
        assert_ne!(wood.subject, "portrait", "wood slugged as {}", wood.slug);
    }

    #[test]
    fn greenery_is_called_nature() {
        let d = describe(&solid(200, 200, 40, 150, 50, 255), 200, 200);
        assert_eq!(d.subject, "nature");
        assert_eq!(d.color, "green");
    }

    #[test]
    fn the_slug_never_exceeds_three_words() {
        for px in [
            solid(200, 200, 220, 30, 30, 128),
            solid(200, 200, 12, 12, 12, 100),
            noise(128, 128),
        ] {
            let w = if px.len() == 128 * 128 * 4 { 128 } else { 200 };
            let d = describe(&px, w, w);
            assert!(d.slug.split('-').count() <= 3, "slug was {}", d.slug);
            assert!(!d.slug.is_empty());
        }
    }

    #[test]
    fn json_round_trips_the_fields() {
        let d = describe(&solid(200, 200, 220, 30, 30, 255), 200, 200);
        let json = d.to_json();
        assert!(json.starts_with('{') && json.ends_with('}'));
        assert!(json.contains("\"color\":\"red\""));
        assert!(json.contains("\"transparent\":false"));
        assert!(json.contains(&format!("\"slug\":\"{}\"", d.slug)));
    }
}

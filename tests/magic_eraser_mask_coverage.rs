//! The fair test the Magic Eraser has never had.
//!
//! Every previous hands-on attempt brushed an X-stroke across an object —
//! masking roughly a fifth of it. That is worst-case input, not a verdict on
//! the kernel: the unmasked remainder of the object stays a VALID SOURCE
//! PATCH, so PatchMatch dutifully copies the object back into the hole. The
//! "carpet"/"soup" look follows from the mask, not from the fill.
//!
//! This isolates mask coverage as the only variable. One scene, one kernel,
//! one seed; three masks at increasing coverage. Because the scene is
//! synthesised, the object-free background is KNOWN, so fill quality is
//! measured as error against ground truth instead of judged by adjective.
//!
//! Set `MAGIC_ERASER_DUMP_DIR=/some/path` to also write PNGs to look at.
//!
//! Exercises `patchmatch`-gated engine methods, so the whole file compiles
//! away without the feature — `cargo test --features patchmatch`.
#![cfg(feature = "patchmatch")]

use stamp_tool::{patchmatch, ImageHorseTool};

const W: usize = 320;
const H: usize = 200;
const SEED: u64 = 42;

// ── scene ───────────────────────────────────────────────────────────────────

/// Deterministic value noise in 0.0..1.0 — no `rand`, matching the crate's own
/// no-new-dependency stance for patchmatch.
fn hash01(x: i64, y: i64, salt: u64) -> f64 {
    let mut v = (x as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15)
        ^ (y as u64).wrapping_mul(0xBF58_476D_1CE4_E5B9)
        ^ salt.wrapping_mul(0x94D0_49BB_1331_11EB);
    v ^= v >> 30;
    v = v.wrapping_mul(0xBF58_476D_1CE4_E5B9);
    v ^= v >> 27;
    v = v.wrapping_mul(0x94D0_49BB_1331_11EB);
    v ^= v >> 31;
    (v >> 11) as f64 / (1u64 << 53) as f64
}

/// Smoothly-interpolated noise — gives the background real low-frequency
/// texture, so a fill cannot pass just by averaging a flat colour.
fn smooth_noise(x: usize, y: usize, cell: usize, salt: u64) -> f64 {
    let (fx, fy) = (x as f64 / cell as f64, y as f64 / cell as f64);
    let (x0, y0) = (fx.floor() as i64, fy.floor() as i64);
    let (tx, ty) = (fx - x0 as f64, fy - y0 as f64);
    let (sx, sy) = (tx * tx * (3.0 - 2.0 * tx), ty * ty * (3.0 - 2.0 * ty));
    let n00 = hash01(x0, y0, salt);
    let n10 = hash01(x0 + 1, y0, salt);
    let n01 = hash01(x0, y0 + 1, salt);
    let n11 = hash01(x0 + 1, y0 + 1, salt);
    let a = n00 + (n10 - n00) * sx;
    let b = n01 + (n11 - n01) * sx;
    a + (b - a) * sy
}

/// The clean plate: a sunset gradient with cloud banding and fine grain. This
/// is the ground truth a perfect removal would reconstruct.
fn background() -> Vec<u8> {
    let mut v = vec![0u8; W * H * 4];
    for y in 0..H {
        let t = y as f64 / (H - 1) as f64;
        for x in 0..W {
            let cloud = smooth_noise(x, y, 48, 7) * 26.0 - 13.0;
            let grain = smooth_noise(x, y, 3, 19) * 6.0 - 3.0;
            let r = (198.0 + 44.0 * t + cloud + grain).clamp(0.0, 255.0) as u8;
            let g = (138.0 + 26.0 * t + cloud * 0.7 + grain).clamp(0.0, 255.0) as u8;
            let b = (182.0 - 58.0 * t + cloud * 0.4 + grain).clamp(0.0, 255.0) as u8;
            let i = (y * W + x) * 4;
            v[i..i + 4].copy_from_slice(&[r, g, b, 255]);
        }
    }
    v
}

/// A compact dark object against that sky — a utility pole with a crossarm and
/// two guy wires. Deliberately thin-limbed and high-contrast: the shape that
/// makes an under-sized mask fail loudly. Returns (image_with_object, footprint).
fn scene_with_object() -> (Vec<u8>, Vec<bool>) {
    let mut img = background();
    let mut foot = vec![false; W * H];
    let mut ink = |x: i64, y: i64| {
        if x >= 0 && y >= 0 && (x as usize) < W && (y as usize) < H {
            let i = y as usize * W + x as usize;
            foot[i] = true;
            img[i * 4..i * 4 + 4].copy_from_slice(&[34, 30, 38, 255]);
        }
    };
    let (cx, top, bot) = (160i64, 40i64, 168i64);
    for y in top..bot {
        for dx in -3..=3 {
            ink(cx + dx, y);
        }
    }
    for arm_y in [58i64, 78] {
        for x in cx - 46..=cx + 46 {
            for dy in -2..=2 {
                ink(x, arm_y + dy);
            }
        }
    }
    for (sx, sy) in [(cx - 46, 58i64), (cx + 46, 58)] {
        for step in 0..90 {
            let t = step as f64 / 89.0;
            let x = sx as f64 + (cx - sx) as f64 * t * 0.35;
            let y = sy as f64 + (bot - sy) as f64 * t;
            ink(x.round() as i64, y.round() as i64);
            ink(x.round() as i64 + 1, y.round() as i64);
        }
    }
    (img, foot)
}

// ── masks ───────────────────────────────────────────────────────────────────

fn dilate(src: &[bool], radius: i64) -> Vec<bool> {
    let mut out = vec![false; W * H];
    for y in 0..H as i64 {
        for x in 0..W as i64 {
            if !src[y as usize * W + x as usize] {
                continue;
            }
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    if dx * dx + dy * dy > radius * radius {
                        continue;
                    }
                    let (nx, ny) = (x + dx, y + dy);
                    if nx >= 0 && ny >= 0 && (nx as usize) < W && (ny as usize) < H {
                        out[ny as usize * W + nx as usize] = true;
                    }
                }
            }
        }
    }
    out
}

/// The X-stroke every hands-on attempt used: two diagonal swipes across the
/// object with a fat brush. Covers a fraction of it and nothing else.
fn x_stroke_mask(foot: &[bool]) -> Vec<bool> {
    let mut m = vec![false; W * H];
    let brush = 9i64;
    let mut stamp = |px: f64, py: f64| {
        for dy in -brush..=brush {
            for dx in -brush..=brush {
                if dx * dx + dy * dy > brush * brush {
                    continue;
                }
                let (nx, ny) = (px as i64 + dx, py as i64 + dy);
                if nx >= 0 && ny >= 0 && (nx as usize) < W && (ny as usize) < H {
                    m[ny as usize * W + nx as usize] = true;
                }
            }
        }
    };
    for step in 0..=120 {
        let t = step as f64 / 120.0;
        stamp(120.0 + 80.0 * t, 50.0 + 110.0 * t);
        stamp(200.0 - 80.0 * t, 50.0 + 110.0 * t);
    }
    // An X-stroke is drawn freehand over the object, so it is not clipped to
    // the footprint — it spills onto sky too. Keep that honest.
    let _ = foot;
    m
}

fn coverage(mask: &[bool], foot: &[bool]) -> f64 {
    let total = foot.iter().filter(|&&b| b).count();
    let hit = foot.iter().zip(mask).filter(|(&f, &m)| f && m).count();
    hit as f64 / total.max(1) as f64
}

// ── measurement ─────────────────────────────────────────────────────────────

struct Score {
    mean_err: f64,
    p99_err: u8,
    leftover: usize,
    leftover_pct: f64,
}

/// Error is measured over the object's TRUE footprint — the region the user
/// wanted gone — against the known clean plate. Measuring only inside the mask
/// would flatter an undersized mask by ignoring the object it left behind.
fn score(out: &[u8], truth: &[u8], foot: &[bool]) -> Score {
    let mut errs: Vec<u8> = Vec::new();
    let mut leftover = 0usize;
    let mut total = 0usize;
    for (i, &f) in foot.iter().enumerate() {
        if !f {
            continue;
        }
        total += 1;
        let p = i * 4;
        let e = (0..3)
            .map(|c| (out[p + c] as i32 - truth[p + c] as i32).unsigned_abs() as u8)
            .max()
            .unwrap_or(0);
        errs.push(e);
        // "Still the object": dark and desaturated the way the pole is, while
        // the sky at every point is bright.
        if out[p] < 90 && out[p + 1] < 90 && out[p + 2] < 110 {
            leftover += 1;
        }
    }
    errs.sort_unstable();
    let mean = errs.iter().map(|&e| e as f64).sum::<f64>() / errs.len().max(1) as f64;
    let p99 = errs[(errs.len() as f64 * 0.99) as usize % errs.len().max(1)];
    Score {
        mean_err: mean,
        p99_err: p99,
        leftover,
        leftover_pct: leftover as f64 / total.max(1) as f64 * 100.0,
    }
}

fn dump(name: &str, rgba: &[u8]) {
    let Ok(dir) = std::env::var("MAGIC_ERASER_DUMP_DIR") else {
        return;
    };
    let mut t = ImageHorseTool::new(W as u32, H as u32);
    t.load_image(rgba);
    let _ = std::fs::create_dir_all(&dir);
    let path = format!("{dir}/{name}.png");
    match std::fs::write(&path, t.export_png()) {
        Ok(_) => println!("[dump] {path}"),
        Err(e) => println!("[dump] FAILED {path}: {e}"),
    }
}

/// Paint a mask over the scene in flat magenta, so the coverage being tested is
/// visible rather than described.
fn overlay(base: &[u8], mask: &[bool]) -> Vec<u8> {
    let mut v = base.to_vec();
    for (i, &m) in mask.iter().enumerate() {
        if m {
            v[i * 4] = 255;
            v[i * 4 + 1] = 0;
            v[i * 4 + 2] = 200;
        }
    }
    v
}

// ── the experiment ──────────────────────────────────────────────────────────

#[test]
fn generous_mask_beats_the_x_stroke_that_every_hands_on_test_used() {
    let truth = background();
    let (image, foot) = scene_with_object();
    dump("00-truth-clean-plate", &truth);
    dump("01-scene-with-object", &image);

    let cases: Vec<(&str, Vec<bool>)> = vec![
        ("x-stroke (what was always tested)", x_stroke_mask(&foot)),
        ("exact footprint, no margin", foot.clone()),
        ("generous: footprint + 6px margin", dilate(&foot, 6)),
        ("generous: footprint + 12px margin", dilate(&foot, 12)),
    ];

    let mut results = Vec::new();
    for (n, (label, mask)) in cases.iter().enumerate() {
        let cov = coverage(mask, &foot) * 100.0;
        let out = patchmatch::inpaint(&image, W, H, mask, SEED);
        let s = score(&out, &truth, &foot);
        println!(
            "\n[{label}]\n  object covered by mask : {cov:5.1}%\n  mean error vs truth    : {:5.1}/255\n  p99 error vs truth     : {:5}/255\n  object pixels left     : {} ({:.1}%)",
            s.mean_err, s.p99_err, s.leftover, s.leftover_pct
        );
        dump(&format!("{:02}-mask-{}", n + 2, n), &overlay(&image, mask));
        dump(&format!("{:02}-result-{}", n + 6, n), &out);
        results.push((label.to_string(), cov, s));
    }

    let x = &results[0].2;
    let generous = &results[2].2;

    assert!(
        generous.mean_err < x.mean_err,
        "a generous mask should reconstruct the sky better than an X-stroke \
         (generous {:.1} vs x-stroke {:.1})",
        generous.mean_err,
        x.mean_err
    );
    assert!(
        generous.leftover_pct < 1.0,
        "a generous mask still left {:.1}% of the object standing — that is a \
         real kernel/coverage failure, not a mask artefact",
        generous.leftover_pct
    );
}

/// Same generous coverage, but driven through the exact call sequence
/// `useMagicEraserTool.ts` performs, to prove the session path does not
/// degrade what the kernel achieves.
#[test]
fn session_path_preserves_the_generous_mask_result() {
    let truth = background();
    let (image, foot) = scene_with_object();

    let mut t = ImageHorseTool::new(W as u32, H as u32);
    t.load_image(&image);
    t.recomposite();

    // Scrub the whole object the way a real user clearing a pole would: a fat
    // brush, overlapping passes, covering the shape and spilling onto sky.
    t.magic_eraser_brush_down(160.0, 38.0, 34.0, 1.0, "off");
    let mut y = 38.0;
    while y <= 172.0 {
        t.magic_eraser_brush_move(160.0, y);
        y += 4.0;
    }
    for arm_y in [58.0f64, 78.0] {
        let mut x = 110.0;
        while x <= 210.0 {
            t.magic_eraser_brush_move(x, arm_y);
            x += 4.0;
        }
    }
    for t_step in 0..=40 {
        let f = t_step as f64 / 40.0;
        t.magic_eraser_brush_move(114.0 + 30.0 * f, 58.0 + 110.0 * f);
        t.magic_eraser_brush_move(206.0 - 30.0 * f, 58.0 + 110.0 * f);
    }

    assert!(t.magic_eraser_brush_up(), "the scrub marked nothing");
    assert!(t.remove_object(), "remove_object refused to run");

    let png = t.export_png();
    let out = stamp_tool::decode_png_to_rgba(&png)
        .expect("engine's own PNG should decode")
        .rgba;
    let s = score(&out, &truth, &foot);
    println!(
        "\n[session path, generous scrub]\n  mean error vs truth : {:5.1}/255\n  p99 error vs truth  : {:5}/255\n  object pixels left  : {} ({:.1}%)",
        s.mean_err, s.p99_err, s.leftover, s.leftover_pct
    );
    dump("10-session-generous-scrub", &out);

    assert!(
        s.leftover_pct < 1.0,
        "session path left {:.1}% of the object standing",
        s.leftover_pct
    );
}

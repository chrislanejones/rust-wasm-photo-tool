//! Deterministic, in-code RGBA fixtures for the replay-parity test suite.
//!
//! Every fixture is generated at test-run time from a small formula below —
//! there are no binary blobs to review or keep in sync. Each fixture also
//! knows how to express its own pixels as a sequence of `Op::FillRegion` ops
//! ([`Fixture::load_ops`]) that reconstruct them exactly when applied, in
//! order, to a blank canvas of the same size.
//!
//! That reconstruction is how the parity harness "seeds" an `OpLog` with a
//! starting image without any new engine API: the log records the load ops
//! like any other edit, so its real keyframe/replay machinery decides where
//! the nearest keyframe lands — see SESSION_LOG.md, DECISION: seeded input.

// This module is shared across several independent integration-test
// binaries (each `tests/*.rs` top-level file is its own crate) via
// `mod fixtures;`. Not every binary uses every field/helper, so per-binary
// dead-code analysis will flag some as unused even though other binaries do
// use them. Same rationale as any shared `tests/common` module.
#![allow(dead_code)]

use stamp_tool::ops::{Op, Rect, Rgba};

/// A named, deterministic test image plus its op-log reconstruction.
pub struct Fixture {
    pub name: &'static str,
    pub width: u32,
    pub height: u32,
    /// Flat RGBA, row-major, `width * height * 4` bytes.
    pub pixels: Vec<u8>,
}

impl Fixture {
    /// `Op::FillRegion` ops that reconstruct `self.pixels` exactly when
    /// applied in order to a blank `width`x`height` canvas. Generated
    /// generically from `pixels` (row run-length encode + vertical merge of
    /// identical row patterns) — never hand-authored per fixture, so this
    /// can't drift from the pixels it claims to reproduce.
    pub fn load_ops(&self) -> Vec<Op> {
        flat_to_fill_ops(&self.pixels, self.width, self.height)
    }
}

/// Every fixture used by the replay-parity suite, by name:
/// - `solid_64`     — 64x64, one flat colour.
/// - `gradient_128` — 128x128, a top-to-bottom colour ramp (128 bands).
/// - `edge_96x64`   — 96x64 non-square, sharp vertical edge at the midline.
/// - `pixel_1x1`    — the degenerate 1x1 canvas.
///
/// Panics on an unknown name — this is test infrastructure, not a runtime
/// API; an unknown fixture name is a typo in a test, not user input.
pub fn fixture(name: &str) -> Fixture {
    match name {
        "solid_64" => solid("solid_64", 64, 64, [180, 90, 40, 255]),
        "gradient_128" => gradient("gradient_128", 128, 128),
        "edge_96x64" => sharp_edge("edge_96x64", 96, 64),
        "pixel_1x1" => solid("pixel_1x1", 1, 1, [10, 20, 30, 255]),
        other => panic!("unknown fixture: {other}"),
    }
}

/// Every fixture name `fixture()` recognises, for tests that want to sweep
/// all of them.
pub const ALL_FIXTURES: &[&str] = &["solid_64", "gradient_128", "edge_96x64", "pixel_1x1"];

fn solid(name: &'static str, w: u32, h: u32, rgba: [u8; 4]) -> Fixture {
    let mut pixels = Vec::with_capacity((w as usize) * (h as usize) * 4);
    for _ in 0..(w as usize) * (h as usize) {
        pixels.extend_from_slice(&rgba);
    }
    Fixture {
        name,
        width: w,
        height: h,
        pixels,
    }
}

/// Top-to-bottom colour ramp: one flat colour per row, red rising and green
/// falling with `y`. Deliberately banded (constant per row) rather than a
/// continuous per-pixel gradient, so it stays cheap to reconstruct via
/// [`Fixture::load_ops`] (one `FillRegion` per row) while still exercising
/// non-uniform pixel content for Levels/Crop.
fn gradient(name: &'static str, w: u32, h: u32) -> Fixture {
    let mut pixels = Vec::with_capacity((w as usize) * (h as usize) * 4);
    let denom = h.saturating_sub(1).max(1) as f32;
    for y in 0..h {
        let t = y as f32 / denom;
        let row = [
            (t * 255.0).round() as u8,
            (255.0 - t * 255.0).round() as u8,
            96u8,
            255u8,
        ];
        for _ in 0..w {
            pixels.extend_from_slice(&row);
        }
    }
    Fixture {
        name,
        width: w,
        height: h,
        pixels,
    }
}

/// Solid black left half, solid white right half — a sharp edge at the
/// midline that does not land on a tile boundary for a non-square canvas.
fn sharp_edge(name: &'static str, w: u32, h: u32) -> Fixture {
    let mid = w / 2;
    let mut pixels = Vec::with_capacity((w as usize) * (h as usize) * 4);
    for _y in 0..h {
        for x in 0..w {
            let rgba = if x < mid {
                [0u8, 0, 0, 255]
            } else {
                [255u8, 255, 255, 255]
            };
            pixels.extend_from_slice(&rgba);
        }
    }
    Fixture {
        name,
        width: w,
        height: h,
        pixels,
    }
}

/// Read pixel `(x, y)` out of a flat RGBA buffer of width `w`.
fn pixel_at(pixels: &[u8], w: u32, x: u32, y: u32) -> [u8; 4] {
    let i = ((y * w + x) as usize) * 4;
    [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
}

/// Row-wise run-length encode `pixels` into horizontal runs of constant
/// colour, then merge vertically-consecutive rows that share the exact same
/// run pattern into a single taller `FillRegion` per run. General-purpose
/// and exact for any input — not tuned to any one fixture's shape.
fn flat_to_fill_ops(pixels: &[u8], w: u32, h: u32) -> Vec<Op> {
    if w == 0 || h == 0 {
        return Vec::new();
    }

    type Run = (u32, u32, [u8; 4]); // (start_x, len, colour)

    let mut rows: Vec<Vec<Run>> = Vec::with_capacity(h as usize);
    for y in 0..h {
        let mut runs = Vec::new();
        let mut x = 0u32;
        while x < w {
            let c = pixel_at(pixels, w, x, y);
            let mut len = 1u32;
            while x + len < w && pixel_at(pixels, w, x + len, y) == c {
                len += 1;
            }
            runs.push((x, len, c));
            x += len;
        }
        rows.push(runs);
    }

    let mut ops = Vec::new();
    let mut y = 0u32;
    while y < h {
        let pattern = &rows[y as usize];
        let mut y_end = y + 1;
        while y_end < h && rows[y_end as usize] == *pattern {
            y_end += 1;
        }
        for &(rx, rlen, c) in pattern {
            ops.push(Op::FillRegion {
                rect: Rect {
                    x: rx as i32,
                    y: y as i32,
                    w: rlen,
                    h: y_end - y,
                },
                color: Rgba {
                    r: c[0],
                    g: c[1],
                    b: c[2],
                    a: c[3],
                },
            });
        }
        y = y_end;
    }
    ops
}

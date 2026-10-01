//! Criterion baseline for SHAPE rasterization on the composite path.
//!
//! Run with:  `cargo bench --bench shapes`
//!
//! `render_shape_into` runs for every live shape on every `recomposite()` —
//! i.e. every frame the canvas flushes — so `drawing.rs` is a hot path, and
//! until this file no bench covered it (`tiles.rs` is the tile bridge and
//! op-log replay; `blur_threads.rs` is the blur kernel).
//!
//! Drives the PUBLIC surface only (`add_shape_annotation` + `recomposite`),
//! so it measures exactly what a flush pays and compiles against any build of
//! the crate, featureless included. The canvas is deliberately small (512×384)
//! so the per-layer buffer copy `render_layer` makes does not drown the shape
//! work being measured.
//!
//! Two groups:
//! * `shapes_unrotated_recomposite_10` — ten kind × style combinations that
//!   existed before rotation, through the pre-rotation entry point. This is
//!   the before/after comparison: rotation must cost these nothing.
//! * `shapes_rotated_30deg_recomposite_10` — the same ten at 30°, through the
//!   rotated-outline route (outlines) and the rotated-warp route (the filled
//!   rect, the gradient circle).

use criterion::{criterion_group, criterion_main, Criterion};
use stamp_tool::ImageHorseTool;

const W: u32 = 512;
const H: u32 = 384;

/// One shape per (kind, fill, sloppiness) combination the Shapes panel can
/// produce, laid out on a grid so none of them clip.
const SET: [(u8, u8, u8); 10] = [
    (0, 0, 0),  // rect, outline
    (0, 1, 0),  // rect, solid fill
    (0, 0, 60), // rect, sketchy
    (1, 0, 0),  // circle
    (1, 2, 0),  // circle, gradient
    (2, 0, 0),  // line
    (2, 0, 60), // line, sketchy
    (8, 0, 0),  // diamond
    (9, 0, 0),  // star
    (9, 0, 60), // star, sketchy
];

fn tool_with_shapes(rotation_deg: f64) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![200u8; (W * H * 4) as usize]);
    for (i, &(kind, fill, slop)) in SET.iter().enumerate() {
        let col = (i % 5) as f64;
        let row = (i / 5) as f64;
        let x0 = 20.0 + col * 98.0;
        let y0 = 30.0 + row * 170.0;
        if rotation_deg == 0.0 {
            // The pre-rotation entry point, exactly as every existing caller
            // uses it — so this group compiles and means the same thing on a
            // tree that predates rotation.
            t.add_shape_annotation(
                kind,
                x0,
                y0,
                x0 + 80.0,
                y0 + 120.0,
                "#d03030",
                4.0,
                0,
                fill,
                "#3050d0",
                "#30d050",
                45,
                0,
                slop,
            );
        } else {
            t.add_shape_annotation_full(
                kind,
                x0,
                y0,
                x0 + 80.0,
                y0 + 120.0,
                "#d03030",
                4.0,
                0,
                fill,
                "#3050d0",
                "#30d050",
                45,
                0,
                slop,
                0,
                rotation_deg,
            );
        }
    }
    t
}

fn bench_shapes(c: &mut Criterion) {
    let mut flat = tool_with_shapes(0.0);
    c.bench_function("shapes_unrotated_recomposite_10", |b| {
        b.iter(|| flat.recomposite());
    });

    let mut rotated = tool_with_shapes(30.0);
    c.bench_function("shapes_rotated_30deg_recomposite_10", |b| {
        b.iter(|| rotated.recomposite());
    });

    // The two routes a rotated shape can take, apart: outline points turned
    // in place (cheap), versus the resampling warp a rotated FILL goes through
    // (a shape-sized tile, rendered then resampled, per shape per composite).
    let mut outlines = tool_with_one(0, 0, 30.0);
    c.bench_function("shape_rotated_outline_rect_recomposite_1", |b| {
        b.iter(|| outlines.recomposite());
    });
    let mut filled = tool_with_one(0, 1, 30.0);
    c.bench_function("shape_rotated_filled_rect_recomposite_1", |b| {
        b.iter(|| filled.recomposite());
    });
    let mut filled_flat = tool_with_one(0, 1, 0.0);
    c.bench_function("shape_unrotated_filled_rect_recomposite_1", |b| {
        b.iter(|| filled_flat.recomposite());
    });
}

/// One 80×120 rect, stroke 4, for the per-route comparison above.
fn tool_with_one(kind: u8, fill: u8, rotation_deg: f64) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![200u8; (W * H * 4) as usize]);
    t.add_shape_annotation_full(
        kind,
        200.0,
        100.0,
        280.0,
        220.0,
        "#d03030",
        4.0,
        0,
        fill,
        "#3050d0",
        "#30d050",
        45,
        0,
        0,
        0,
        rotation_deg,
    );
    t
}

criterion_group!(benches, bench_shapes);
criterion_main!(benches);

//! Scalar vs. rayon-parallel PatchMatch inpaint, on the NATIVE target
//! (`cargo bench --features patchmatch,threads`).
//!
//! Same framing as `benches/blur_threads.rs`: rayon on native uses real OS
//! threads, a legitimate proxy for "does the anti-diagonal wavefront actually
//! buy wall-clock time" — which is the day-2 question. Both legs run the SAME
//! per-pixel functions (`best_match_for_pixel`, the vote arithmetic); this
//! bench measures the scheduling win only, and the byte-identity contract is
//! re-asserted at bench scale before any timing is trusted. What it cannot
//! tell us: in-browser numbers — a wasm32+atomics build behind COOP/COEP
//! headers is a separate, later decision (see ADR-011/ADR-018), and Web
//! Worker pools will land somewhere below these native ratios.
//!
//! Scenario: centered square hole covering ~20% of the image (the brief's
//! "remove an object this big" shape) at 256², 512², 1024², seed 42.

use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

use stamp_tool::patchmatch::{inpaint, inpaint_parallel};

/// Deterministic pseudo-random RGBA buffer (xorshift64) — the same fixture
/// idiom as `benches/tiles.rs` / `benches/blur_threads.rs`, deliberately
/// independent of the kernel's own SplitMix64.
fn make_buffer(w: usize, h: usize) -> Vec<u8> {
    let n = w * h * 4;
    let mut out = Vec::with_capacity(n);
    let mut s: u64 = 0x1234_5678_9abc_def0;
    for _ in 0..n {
        s ^= s >> 12;
        s ^= s << 25;
        s ^= s >> 27;
        out.push((s.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 33) as u8);
    }
    out
}

/// Centered square hole sized to ~20% of the image area. Returns the mask
/// and the exact masked-pixel count (reported so the SESSION_LOG numbers are
/// reproducible).
fn make_mask(w: usize, h: usize) -> (Vec<bool>, usize) {
    let side = (((w * h) as f64 * 0.2).sqrt().round() as usize).min(w.min(h));
    let (x0, y0) = ((w - side) / 2, (h - side) / 2);
    let mut mask = vec![false; w * h];
    for y in y0..y0 + side {
        for x in x0..x0 + side {
            mask[y * w + x] = true;
        }
    }
    let count = side * side;
    (mask, count)
}

fn bench_size(c: &mut Criterion, dim: usize) {
    let data = make_buffer(dim, dim);
    let (mask, masked) = make_mask(dim, dim);
    eprintln!(
        "patchmatch bench {dim}x{dim}: {masked} masked px ({:.1}% of image)",
        100.0 * masked as f64 / (dim * dim) as f64
    );

    // Byte-identity sanity at bench scale FIRST — a silent divergence would
    // invalidate the whole comparison (same guard as blur_threads.rs).
    let scalar_out = inpaint(&data, dim, dim, &mask, 42);
    let parallel_out = inpaint_parallel(&data, dim, dim, &mask, 42);
    assert_eq!(
        scalar_out, parallel_out,
        "scalar/parallel diverged at {dim}x{dim} — bench numbers would be meaningless"
    );

    let mut group = c.benchmark_group(format!("patchmatch_{dim}x{dim}_20pct"));
    // The scalar leg at 1024² runs seconds per iteration; criterion's default
    // 100 samples would take an hour. 10 is criterion's own minimum.
    group.sample_size(10);
    group.bench_function("scalar", |b| {
        b.iter(|| inpaint(black_box(&data), dim, dim, &mask, 42));
    });
    group.bench_function("rayon_parallel", |b| {
        b.iter(|| inpaint_parallel(black_box(&data), dim, dim, &mask, 42));
    });
    group.finish();
}

fn bench_patchmatch(c: &mut Criterion) {
    eprintln!(
        "patchmatch_nnf bench: rayon global thread pool = {} threads (logical cores available)",
        rayon::current_num_threads()
    );
    bench_size(c, 256);
    bench_size(c, 512);
    bench_size(c, 1024);
}

criterion_group!(benches, bench_patchmatch);
criterion_main!(benches);

//! Scalar-sequential vs. rayon-parallel two-pass Gaussian blur, on the NATIVE
//! target (`cargo bench --features threads`).
//!
//! ## What this can tell us
//!
//! Rayon on native uses real OS threads via `std::thread` — a legitimate proxy
//! for "does splitting the row loop across a thread pool actually help", which
//! is exactly the question `blur_horizontal_parallel`/`blur_vertical_parallel`
//! (src/simd/blur.rs) exist to answer. Both passes here call the *same*
//! per-row function the sequential path calls (see that file's module doc) —
//! this bench is purely about the threading win, not a different algorithm.
//!
//! ## What this CANNOT tell us (and isn't trying to)
//!
//! The crate's actual SIMD acceleration (`src/simd/blur.rs`'s `simd` module)
//! is explicit WebAssembly SIMD128 (`core::arch::wasm32`) — that module
//! literally does not exist for any non-`wasm32` target, so there is no
//! "SIMD" leg to benchmark here at all; on native this bench is exercising
//! the `scalar` row functions both with and without rayon. A genuine
//! "scalar vs SIMD vs SIMD+rayon" three-way comparison can only be measured
//! in-browser, on a wasm32 build — that's what Task D's gated microbench hook
//! (`bench_blur_threaded`, `--features threads`) exists to capture once a
//! nightly/atomics wasm build + COOP/COEP headers exist (a separate, later
//! decision). See SESSION_LOG.md on `feat/rayon-parallel-blur` for the full
//! reasoning and the historical in-browser SIMD numbers that DO exist (resize
//! filters only — blur was never separately microbenched even in-browser).

use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

use stamp_tool::filters::build_gaussian_kernel;
use stamp_tool::simd::blur::{
    blur_horizontal, blur_horizontal_parallel, blur_vertical, blur_vertical_parallel,
};

const RADIUS: u32 = 8;

/// Deterministic pseudo-random RGBA buffer (xorshift64) — same style used by
/// `benches/tiles.rs`, kept independent of any code under test.
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

fn bench_size(c: &mut Criterion, dim: usize) {
    let w = dim;
    let h = dim;
    let len = w * h * 4;
    let data = make_buffer(w, h);
    let kernel = build_gaussian_kernel(RADIUS);
    let kr = RADIUS as i32;

    let mut group = c.benchmark_group(format!("blur_{dim}x{dim}_r{RADIUS}"));
    // Full-size two-pass blur is expensive at 4096²; keep the sample count
    // (and therefore wall-clock bench time) sane rather than criterion's
    // default 100.
    group.sample_size(20);

    let mut h_pass = vec![0u8; len];
    let mut out = vec![0u8; len];
    group.bench_function("sequential", |b| {
        b.iter(|| {
            blur_horizontal(black_box(&data), &mut h_pass, w, h, kr, &kernel);
            blur_vertical(black_box(&h_pass), &mut out, w, h, kr, &kernel);
        });
    });

    let mut h_pass_p = vec![0u8; len];
    let mut out_p = vec![0u8; len];
    group.bench_function("rayon_parallel", |b| {
        b.iter(|| {
            blur_horizontal_parallel(black_box(&data), &mut h_pass_p, w, h, kr, &kernel);
            blur_vertical_parallel(black_box(&h_pass_p), &mut out_p, w, h, kr, &kernel);
        });
    });

    group.finish();

    // Sanity: both passes must still agree at bench scale, not just in the
    // small-size unit tests — a silent divergence here would invalidate the
    // whole comparison.
    assert_eq!(out, out_p, "sequential/parallel diverged at {w}x{h}");
}

fn bench_blur(c: &mut Criterion) {
    eprintln!(
        "blur_threads bench: rayon global thread pool = {} threads (logical cores available)",
        rayon::current_num_threads()
    );
    bench_size(c, 2048);
    bench_size(c, 4096);
}

criterion_group!(benches, bench_blur);
criterion_main!(benches);

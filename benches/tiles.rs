//! Criterion baselines for the tile engine core.
//!
//! Run with:  `cargo bench --features tiles`
//!
//! Covers the flat-buffer bridge (`blit_from_flat` / `blit_to_flat` at
//! 2048×2048) and op-log replay of 200 mixed ops with vs. without keyframes.

use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

use stamp_tool::ops::{Brush, LevelsParams, Op, OpLog, Rect, Rgba};
use stamp_tool::tiles::TileBuffer;

const DIM: u32 = 2048;

/// Deterministic pseudo-random flat RGBA buffer.
fn make_flat(w: u32, h: u32) -> Vec<u8> {
    let n = (w as usize) * (h as usize) * 4;
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

fn build_mixed_log(n: usize) -> OpLog {
    let mut log = OpLog::new(DIM, DIM);
    for i in 0..n {
        let op = match i % 3 {
            0 => Op::FillRegion {
                rect: Rect {
                    x: (i * 7 % 1800) as i32,
                    y: (i * 13 % 1800) as i32,
                    w: 128,
                    h: 128,
                },
                color: Rgba {
                    r: i as u8,
                    g: 100,
                    b: 50,
                    a: 255,
                },
            },
            1 => Op::Levels(LevelsParams {
                black: 8,
                white: 240,
                gamma: 1.05,
            }),
            _ => Op::Stroke {
                points: vec![(i as f32, i as f32), (i as f32 + 1.0, i as f32 + 2.0)],
                brush: Brush {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 255,
                    size: 4.0,
                    hardness: 1.0,
                    opacity: 1.0,
                },
            },
        };
        log.append(op);
    }
    log
}

fn bench_blit(c: &mut Criterion) {
    let flat = make_flat(DIM, DIM);

    c.bench_function("blit_from_flat_2048", |b| {
        let mut tb = TileBuffer::new(0, 0);
        b.iter(|| {
            tb.blit_from_flat(black_box(&flat), DIM, DIM);
        });
    });

    let mut src = TileBuffer::new(0, 0);
    src.blit_from_flat(&flat, DIM, DIM);
    let mut dst = vec![0u8; flat.len()];
    c.bench_function("blit_to_flat_2048", |b| {
        b.iter(|| {
            src.blit_to_flat(black_box(&mut dst));
        });
    });
}

fn bench_replay(c: &mut Criterion) {
    let log = build_mixed_log(200);

    c.bench_function("replay_200_ops_keyframed", |b| {
        let mut out = TileBuffer::new(0, 0);
        b.iter(|| {
            log.replay(black_box(&mut out));
        });
    });

    c.bench_function("replay_200_ops_full", |b| {
        let mut out = TileBuffer::new(0, 0);
        b.iter(|| {
            log.replay_full(black_box(&mut out));
        });
    });
}

criterion_group!(benches, bench_blit, bench_replay);
criterion_main!(benches);

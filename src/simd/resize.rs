//! Explicit WebAssembly SIMD128 acceleration for `transform::resize_bilinear`.
//!
//! Per output pixel the four source samples (p00/p10/p01/p11) each map onto the
//! four lanes of an `f32x4` (one lane per RGBA channel), so the separable
//! two-axis lerp becomes three vector multiply-adds instead of 4×3 scalar ones.
//! The lane math is the SAME f32 operations in the SAME order as the scalar
//! path, so the result is **bit-identical**; and because the output is a convex
//! combination of inputs in [0,255] it is non-negative and ≤255, so the store's
//! `trunc(x + 0.5)` + saturating narrow matches the scalar `.round().clamp()`.
//!
//! Falls back to the scalar implementation when SIMD128 is unavailable (native
//! `cargo test`), so callers invoke it unconditionally.

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn resize_bilinear(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    unsafe { simd::resize_bilinear(data, old_w, old_h, new_w, new_h) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn resize_bilinear(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    scalar::resize_bilinear(data, old_w, old_h, new_w, new_h)
}

/// Separable filtered-resize horizontal pass (u8 rows → f32 intermediate, no
/// rounding between passes). `windows[tx] = (start, weights)` are the precomputed
/// per-output-column source-window start + normalized kernel weights. Shared by
/// `transform::resize_lanczos3` / `resize_catmull_rom`.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn sep_horizontal(data: &[u8], ow: usize, oh: usize, nw: usize, windows: &[(usize, Vec<f32>)]) -> Vec<f32> {
    unsafe { simd::sep_horizontal(data, ow, oh, nw, windows) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn sep_horizontal(data: &[u8], ow: usize, oh: usize, nw: usize, windows: &[(usize, Vec<f32>)]) -> Vec<f32> {
    scalar::sep_horizontal(data, ow, oh, nw, windows)
}

/// Separable filtered-resize vertical pass (f32 intermediate → u8 output, with
/// the [0,255] round+clamp). `windows[ty] = (start, weights)` per output row.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn sep_vertical(mid: &[f32], nw: usize, nh: usize, windows: &[(usize, Vec<f32>)]) -> Vec<u8> {
    unsafe { simd::sep_vertical(mid, nw, nh, windows) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn sep_vertical(mid: &[f32], nw: usize, nh: usize, windows: &[(usize, Vec<f32>)]) -> Vec<u8> {
    scalar::sep_vertical(mid, nw, nh, windows)
}

// ── Scalar reference (native builds + correctness baseline) ───────────────────

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
mod scalar {
    pub fn resize_bilinear(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
        let nw = new_w.max(1);
        let nh = new_h.max(1);
        let mut out = vec![0u8; (nw * nh * 4) as usize];
        let sx = old_w as f32 / nw as f32;
        let sy = old_h as f32 / nh as f32;

        for ty in 0..nh {
            for tx in 0..nw {
                let fx = (tx as f32 + 0.5) * sx - 0.5;
                let fy = (ty as f32 + 0.5) * sy - 0.5;

                let x0 = fx.floor() as i32;
                let y0 = fy.floor() as i32;
                let frac_x = fx - fx.floor();
                let frac_y = fy - fy.floor();

                let sample = |xi: i32, yi: i32| -> [f32; 4] {
                    let xi = xi.clamp(0, old_w as i32 - 1) as usize;
                    let yi = yi.clamp(0, old_h as i32 - 1) as usize;
                    let idx = (yi * old_w as usize + xi) * 4;
                    [
                        data[idx] as f32,
                        data[idx + 1] as f32,
                        data[idx + 2] as f32,
                        data[idx + 3] as f32,
                    ]
                };

                let p00 = sample(x0, y0);
                let p10 = sample(x0 + 1, y0);
                let p01 = sample(x0, y0 + 1);
                let p11 = sample(x0 + 1, y0 + 1);

                let di = ((ty * nw + tx) * 4) as usize;
                for c in 0..4 {
                    let top = p00[c] + (p10[c] - p00[c]) * frac_x;
                    let bot = p01[c] + (p11[c] - p01[c]) * frac_x;
                    let val = top + (bot - top) * frac_y;
                    out[di + c] = val.round().clamp(0.0, 255.0) as u8;
                }
            }
        }
        out
    }

    pub fn sep_horizontal(data: &[u8], ow: usize, oh: usize, nw: usize, windows: &[(usize, Vec<f32>)]) -> Vec<f32> {
        let mut mid = vec![0f32; oh * nw * 4];
        for y in 0..oh {
            let row = &data[y * ow * 4..(y + 1) * ow * 4];
            let out_row = &mut mid[y * nw * 4..(y + 1) * nw * 4];
            for (tx, (start, weights)) in windows.iter().enumerate() {
                let mut acc = [0f32; 4];
                for (k, &w) in weights.iter().enumerate() {
                    let si = (start + k) * 4;
                    acc[0] += row[si] as f32 * w;
                    acc[1] += row[si + 1] as f32 * w;
                    acc[2] += row[si + 2] as f32 * w;
                    acc[3] += row[si + 3] as f32 * w;
                }
                out_row[tx * 4..tx * 4 + 4].copy_from_slice(&acc);
            }
        }
        mid
    }

    pub fn sep_vertical(mid: &[f32], nw: usize, nh: usize, windows: &[(usize, Vec<f32>)]) -> Vec<u8> {
        let mut out = vec![0u8; nh * nw * 4];
        for (ty, (start, weights)) in windows.iter().enumerate() {
            for tx in 0..nw {
                let mut acc = [0f32; 4];
                for (k, &w) in weights.iter().enumerate() {
                    let si = ((start + k) * nw + tx) * 4;
                    acc[0] += mid[si] * w;
                    acc[1] += mid[si + 1] * w;
                    acc[2] += mid[si + 2] * w;
                    acc[3] += mid[si + 3] * w;
                }
                let di = (ty * nw + tx) * 4;
                for c in 0..4 {
                    out[di + c] = acc[c].round().clamp(0.0, 255.0) as u8;
                }
            }
        }
        out
    }
}

// ── Explicit SIMD128 implementation (wasm) ────────────────────────────────────

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
mod simd {
    use super::super::pixel::{load_px, store_px};
    use core::arch::wasm32::*;

    pub unsafe fn resize_bilinear(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
        let nw = new_w.max(1);
        let nh = new_h.max(1);
        let mut out = vec![0u8; (nw * nh * 4) as usize];
        let sx = old_w as f32 / nw as f32;
        let sy = old_h as f32 / nh as f32;
        let max_x = old_w as i32 - 1;
        let max_y = old_h as i32 - 1;
        let oldw = old_w as usize;

        for ty in 0..nh {
            for tx in 0..nw {
                let fx = (tx as f32 + 0.5) * sx - 0.5;
                let fy = (ty as f32 + 0.5) * sy - 0.5;
                let x0 = fx.floor() as i32;
                let y0 = fy.floor() as i32;
                let frac_x = fx - fx.floor();
                let frac_y = fy - fy.floor();

                let idx = |xi: i32, yi: i32| -> usize {
                    let xi = xi.clamp(0, max_x) as usize;
                    let yi = yi.clamp(0, max_y) as usize;
                    (yi * oldw + xi) * 4
                };
                let p00 = load_px(data, idx(x0, y0));
                let p10 = load_px(data, idx(x0 + 1, y0));
                let p01 = load_px(data, idx(x0, y0 + 1));
                let p11 = load_px(data, idx(x0 + 1, y0 + 1));

                let fxv = f32x4_splat(frac_x);
                let fyv = f32x4_splat(frac_y);
                // top = p00 + (p10 - p00)*fx ; bot = p01 + (p11 - p01)*fx
                let top = f32x4_add(p00, f32x4_mul(f32x4_sub(p10, p00), fxv));
                let bot = f32x4_add(p01, f32x4_mul(f32x4_sub(p11, p01), fxv));
                // val = top + (bot - top)*fy
                let val = f32x4_add(top, f32x4_mul(f32x4_sub(bot, top), fyv));

                store_px(&mut out, ((ty * nw + tx) * 4) as usize, val);
            }
        }
        out
    }

    pub unsafe fn sep_horizontal(data: &[u8], ow: usize, oh: usize, nw: usize, windows: &[(usize, Vec<f32>)]) -> Vec<f32> {
        let mut mid = vec![0f32; oh * nw * 4];
        for y in 0..oh {
            let row = &data[y * ow * 4..(y + 1) * ow * 4];
            let out_row = &mut mid[y * nw * 4..(y + 1) * nw * 4];
            for (tx, (start, weights)) in windows.iter().enumerate() {
                let mut acc = f32x4_splat(0.0);
                for (k, &w) in weights.iter().enumerate() {
                    let si = (start + k) * 4;
                    acc = f32x4_add(acc, f32x4_mul(load_px(row, si), f32x4_splat(w)));
                }
                // f32 intermediate — store the raw accumulator, no rounding.
                v128_store(out_row.as_mut_ptr().add(tx * 4) as *mut v128, acc);
            }
        }
        mid
    }

    pub unsafe fn sep_vertical(mid: &[f32], nw: usize, nh: usize, windows: &[(usize, Vec<f32>)]) -> Vec<u8> {
        let mut out = vec![0u8; nh * nw * 4];
        for (ty, (start, weights)) in windows.iter().enumerate() {
            for tx in 0..nw {
                let mut acc = f32x4_splat(0.0);
                for (k, &w) in weights.iter().enumerate() {
                    let si = ((start + k) * nw + tx) * 4;
                    let px = v128_load(mid.as_ptr().add(si) as *const v128);
                    acc = f32x4_add(acc, f32x4_mul(px, f32x4_splat(w)));
                }
                store_px(&mut out, (ty * nw + tx) * 4, acc);
            }
        }
        out
    }
}

//! Shared SIMD128 per-pixel load/store helpers, used by the blur, resize, and
//! contrast kernels so the widen-to-f32 / round-clamp-narrow sequence lives in
//! one place. Only compiled for the SIMD target (the `mod pixel;` declaration in
//! `mod.rs` is cfg-gated to match).

use core::arch::wasm32::*;

/// Load one RGBA pixel (4 bytes at `byte_idx`) as an `f32x4` of [r, g, b, a].
/// `v128_load32_zero` reads exactly 4 bytes, so the access is in-bounds for any
/// pixel index; wasm permits the unaligned load.
#[inline(always)]
pub(crate) unsafe fn load_px(buf: &[u8], byte_idx: usize) -> v128 {
    let raw = v128_load32_zero(buf.as_ptr().add(byte_idx) as *const u32);
    let u16s = u16x8_extend_low_u8x16(raw);
    let u32s = u32x4_extend_low_u16x8(u16s);
    f32x4_convert_u32x4(u32s)
}

/// Round (half-up — valid because lanes are non-negative), clamp to 0..=255 via
/// saturating narrows, and store the 4 bytes at `byte_idx`. For lanes that may
/// have gone negative (e.g. Lanczos ringing) the saturating narrow clamps to 0,
/// matching the scalar `.round().clamp(0.0, 255.0)`.
#[inline(always)]
pub(crate) unsafe fn store_px(buf: &mut [u8], byte_idx: usize, acc: v128) {
    let rounded = f32x4_add(acc, f32x4_splat(0.5));
    let i32s = i32x4_trunc_sat_f32x4(rounded);
    let i16s = i16x8_narrow_i32x4(i32s, i32s);
    let u8s = u8x16_narrow_i16x8(i16s, i16s);
    v128_store32_lane::<0>(u8s, buf.as_mut_ptr().add(byte_idx) as *mut u32);
}

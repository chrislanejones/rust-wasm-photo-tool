//! Explicit WebAssembly SIMD128 kernels for the hot pixel-pushing paths, each
//! with a bit-identical scalar fallback so callers (and native `cargo test`)
//! invoke them unconditionally. Dispatched at compile time via
//! `#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]`.
//!
//! - [`blur`]   — separable Gaussian blur passes (`filters::gaussian_blur_region`).
//! - [`color`]  — brightness, contrast, pixelate cell-sums, mask invert.
//! - [`resize`] — bilinear + the separable filtered-resize passes (lanczos/catmull).

pub mod blur;
pub mod color;
pub mod resize;

// Shared per-pixel load/store intrinsics (SIMD target only).
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
mod pixel;

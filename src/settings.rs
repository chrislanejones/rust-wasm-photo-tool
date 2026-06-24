//! User-tunable engine settings: defaults and allowed ranges for runtime knobs
//! that the JS side persists (localStorage) and applies into the WASM engine.
//!
//! This module owns the *policy* — defaults, bounds, and clamping. The live
//! values live where they're enforced (e.g. `History::max_history`); a home for
//! future engine settings.

/// Undo-history depth: default and the inclusive range the General settings
/// slider exposes.
pub const DEFAULT_MAX_HISTORY: usize = 50;
pub const MIN_MAX_HISTORY: usize = 50;
pub const MAX_MAX_HISTORY: usize = 1000;

/// Hard ceiling on total undo-history bytes, independent of the step count.
/// Each snapshot is a deep copy of the whole layer stack (width·height·4 per
/// layer), so a step-count cap alone lets a large or multi-layer canvas balloon
/// to multiple GB (e.g. 50 × 48 MB ≈ 2.4 GB). This bounds the undo stack in
/// bytes regardless of image size; the oldest snapshots are evicted first once
/// the budget is exceeded, and at least one snapshot is always retained so undo
/// still works even on an image larger than the budget.
pub const DEFAULT_MAX_HISTORY_BYTES: usize = 512 * 1024 * 1024; // 512 MB

/// Clamp a requested undo depth into the allowed range.
pub fn clamp_max_history(n: usize) -> usize {
    n.clamp(MIN_MAX_HISTORY, MAX_MAX_HISTORY)
}

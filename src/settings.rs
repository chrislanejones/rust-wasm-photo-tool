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

/// Clamp a requested undo depth into the allowed range.
pub fn clamp_max_history(n: usize) -> usize {
    n.clamp(MIN_MAX_HISTORY, MAX_MAX_HISTORY)
}

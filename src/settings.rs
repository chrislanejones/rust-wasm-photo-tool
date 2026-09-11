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

// ── Account tiers ───────────────────────────────────────────────────────────
// Moved out of lib.rs: this module already owns "policy — defaults, bounds and
// clamping", and a per-tier gallery cap is exactly that. lib.rs is under a line
// ratchet that may only go down, so policy constants belong out here.

use wasm_bindgen::prelude::*;

/// Maximum number of gallery photos allowed for a given account tier.
///
/// Single source of truth for the gallery cap, shared by the upload gate
/// (`handleAddPhotos`) and the gallery UI on the JS side.
///
/// - `"demo"`     — anonymous / not signed in → **12**
/// - `"loggedIn"` — free account             → **24**
/// - `"paid"`     — Pro (coming soon)         → **100**
///
/// Unknown tiers fall back to the most restrictive demo limit.
#[wasm_bindgen]
pub fn photo_limit(tier: &str) -> u32 {
    match tier {
        "loggedIn" => 24,
        "paid" => 100,
        _ => 12,
    }
}

/// The undo history's BYTE budget, for the JS side.
///
/// Exported because the degradation warning has to be concrete: on a 24 MP
/// photo a snapshot is ~96 MB, so this cap is what decides that snapshot undo
/// gives about five steps instead of fifty (ADR-052). JS estimates the depth
/// from the live document size and this number; hardcoding 512 MB there would
/// be a second copy of a value that already lives here.
#[wasm_bindgen]
pub fn history_max_bytes() -> f64 {
    DEFAULT_MAX_HISTORY_BYTES as f64
}

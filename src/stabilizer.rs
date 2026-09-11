//! Trailing-tip ("lazy mouse") stroke smoothing.
//!
//! A leash of `leash` px trails behind the cursor: the drawn tip only moves
//! once the cursor has pulled further than the leash, and then only far enough
//! to sit exactly `leash` behind it. Small hand tremors never clear the leash,
//! so they never reach the canvas.
//!
//! EXTRACTED, NOT REWRITTEN. The math here is lifted verbatim out of
//! `paint.rs`'s `paint_stab_to` / `paint_stab_flush` — the same
//! `k = 1 - leash/dist` step and the same 0.001 flush epsilon — so paint's
//! output is byte-identical across the move. `tests/replay_parity.rs` and
//! `src/ops_engine_parity.rs` are the proof: both replay recorded strokes and
//! compare pixels, and neither was touched.
//!
//! It exists as its own type so the blur and clone-stamp engines can USE the
//! leash rather than grow a second and third copy of it
//! (`docs/Stroke-Stabilizer-Multi-Tool-Plan.md` §2). It owns no pixels: it
//! turns a raw pointer path into the shorter, smoother path the caller should
//! actually draw, and the caller decides what to draw with it.

use wasm_bindgen::prelude::*;

/// Leash length in px for each UI level. THE one table — `leash_for` in
/// `paint.rs` is gone, and `stabilizer_leash` exports this to JS so the pen
/// overlay cannot invent a fourth copy of the numbers.
pub fn leash_for_level(level: &str) -> f64 {
    match level {
        "low" => 12.0,
        "med" => 22.0,
        "high" => 36.0,
        _ => 0.0,
    }
}

/// Stroke-stabilizer leash length in px for a UI level ("off" / "low" /
/// "med" / "high"); 0 means off.
///
/// EXPORTED RATHER THAN PORTED, the `gaussian_kernel` precedent: a constant
/// two languages must agree on crosses the boundary instead of being written
/// down twice. The pen is a JS Bézier overlay with no dabs to lag, so when it
/// gains stabilization it needs this number on the JS side — and a second
/// copy of the table would be a copy free to drift.
///
/// One call per drag start, not per pointer move, so it costs nothing.
///
/// Lives HERE rather than in lib.rs beside `photo_limit`: `librs-lines` is a
/// ratchet that may only go down, and a new export there would have pushed it
/// up by 16.
#[wasm_bindgen]
pub fn stabilizer_leash(level: &str) -> f64 {
    leash_for_level(level)
}

/// One segment of the path the caller should draw: `(from, to)`.
pub type Segment = ((f64, f64), (f64, f64));

#[derive(Clone, Copy, Default)]
pub struct Stabilizer {
    leash: f64,
    tip: Option<(f64, f64)>,
}

impl Stabilizer {
    pub fn for_level(level: &str) -> Self {
        Self {
            leash: leash_for_level(level),
            tip: None,
        }
    }

    /// Off means a zero leash, and every caller branches on this rather than
    /// calling `advance` with leash 0 — a zero leash would make `advance`
    /// return a segment for every pixel of pointer movement, which is the
    /// unstabilized path taking a slower route to the same place.
    pub fn is_on(&self) -> bool {
        self.leash > 0.0
    }

    /// Anchor the tip at the press point.
    pub fn begin(&mut self, x: f64, y: f64) {
        self.tip = Some((x, y));
    }

    /// Advance the tip toward the cursor. `None` means the cursor is still
    /// inside the leash and nothing should be drawn.
    pub fn advance(&mut self, raw_x: f64, raw_y: f64) -> Option<Segment> {
        let (tx, ty) = match self.tip {
            Some(t) => t,
            None => {
                // First move of a stroke that never got a `begin` — anchor
                // here and draw nothing, exactly as paint_stab_to did.
                self.tip = Some((raw_x, raw_y));
                return None;
            }
        };
        let dx = raw_x - tx;
        let dy = raw_y - ty;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist > self.leash && dist > 0.0 {
            let k = 1.0 - self.leash / dist; // fraction of the gap to close
            let nx = tx + dx * k;
            let ny = ty + dy * k;
            self.tip = Some((nx, ny));
            Some(((tx, ty), (nx, ny)))
        } else {
            None
        }
    }

    /// Catch up to the true cursor and clear. `Some` when there was slack
    /// left to draw — without this the stroke would stop a leash-length short
    /// of where the user let go.
    pub fn flush(&mut self, raw_x: f64, raw_y: f64) -> Option<Segment> {
        let seg = match self.tip {
            Some((tx, ty)) if (tx - raw_x).abs() > 0.001 || (ty - raw_y).abs() > 0.001 => {
                Some(((tx, ty), (raw_x, raw_y)))
            }
            _ => None,
        };
        self.tip = None;
        seg
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_match_the_table_the_ui_offers() {
        assert_eq!(leash_for_level("low"), 12.0);
        assert_eq!(leash_for_level("med"), 22.0);
        assert_eq!(leash_for_level("high"), 36.0);
        assert_eq!(leash_for_level("off"), 0.0);
        assert_eq!(leash_for_level("nonsense"), 0.0, "unknown reads as off");
    }

    #[test]
    fn a_move_inside_the_leash_draws_nothing() {
        let mut s = Stabilizer::for_level("med"); // 22
        s.begin(100.0, 100.0);
        assert!(s.advance(110.0, 100.0).is_none(), "10 < 22, still slack");
        assert!(s.advance(121.0, 100.0).is_none(), "21 < 22");
    }

    #[test]
    fn a_pull_past_the_leash_draws_exactly_the_overshoot() {
        let mut s = Stabilizer::for_level("med"); // 22
        s.begin(100.0, 100.0);
        let ((fx, fy), (tx, ty)) = s.advance(150.0, 100.0).expect("50 > 22"); // allow: rust-panic
        assert_eq!((fx, fy), (100.0, 100.0));
        // Tip ends exactly `leash` behind the cursor: 150 - 22 = 128.
        assert!((tx - 128.0).abs() < 1e-9, "tip at {tx}, want 128");
        assert_eq!(ty, 100.0);
    }

    #[test]
    fn the_tip_always_trails_by_exactly_the_leash_however_far_it_is_pulled() {
        for dist in [23.0_f64, 40.0, 137.5, 1000.0] {
            let mut s = Stabilizer::for_level("med");
            s.begin(0.0, 0.0);
            let (_, (tx, _)) = s.advance(dist, 0.0).expect("past the leash"); // allow: rust-panic
            assert!(
                ((dist - tx) - 22.0).abs() < 1e-9,
                "pulled {dist}: gap {} want 22",
                dist - tx
            );
        }
    }

    #[test]
    fn flush_lands_on_the_true_cursor() {
        let mut s = Stabilizer::for_level("high");
        s.begin(0.0, 0.0);
        let (_, (tx, ty)) = s.flush(10.0, 5.0).expect("slack to close"); // allow: rust-panic
        assert_eq!((tx, ty), (10.0, 5.0), "flush must reach the real cursor");
        assert!(
            s.flush(10.0, 5.0).is_none(),
            "flush clears the tip, so a second flush draws nothing"
        );
    }

    #[test]
    fn flush_on_an_already_caught_up_tip_draws_nothing() {
        let mut s = Stabilizer::for_level("high");
        s.begin(4.0, 4.0);
        // Within the 0.001 epsilon lifted from paint_stab_flush.
        assert!(s.flush(4.0005, 4.0005).is_none());
    }

    #[test]
    fn a_first_move_with_no_begin_anchors_instead_of_drawing() {
        let mut s = Stabilizer::for_level("low");
        assert!(s.advance(70.0, 70.0).is_none(), "nothing to draw from yet");
        // …and it anchored there, so the NEXT pull draws from that point.
        let ((fx, fy), _) = s.advance(200.0, 70.0).expect("now past the leash"); // allow: rust-panic
        assert_eq!((fx, fy), (70.0, 70.0));
    }

    #[test]
    fn off_is_off() {
        assert!(!Stabilizer::for_level("off").is_on());
        assert!(Stabilizer::for_level("low").is_on());
    }
}

//! Copy look: the tonal edits in the open photo's history, in the order they
//! were applied, so the gallery can paste them onto other photos.
//!
//! READ FROM THE OP LOG, NOT FROM THE PANELS. The Adjustments sliders hold their
//! values only while a session is open, and Presets and Levels keep nothing
//! after Apply. The log is the one place that still knows what was done to the
//! photo, after a switch or a reload too. Only ops up to the cursor count: an
//! undone Levels is not part of the look.
//!
//! THREE KINDS, ONE ORDER. Presets (`Op::TonalStack`), Levels (`Op::Levels`)
//! and Adjustments (`Op::Adjustments`) are kept in history order, because the
//! filters do not commute: a Preset then Levels is a different picture from
//! Levels then the Preset. An Adjustments session (one `new_session` op, then
//! every later release on the same base) is ONE step carrying its last values,
//! since each release recomputes from the session's base (ADR-091). A session
//! that ends on the identity (a Reset) is left out. Every other op (crops,
//! paint, text, shapes) is skipped: those are per photo in size or place.
//!
//! THE WIRE. A flat `Float64Array`: a kind code, then that kind's values, in
//! the same argument order as the call that applies it.
//!   1 = Preset: brightness, contrast, saturation, shadows, highlights (preset_apply)
//!   2 = Levels: black, white, gamma (levels_apply)
//!   3 = Adjustments: brightness, contrast, saturation, shadows, highlights,
//!       sharpen, blur (adjust_apply)
//!
//! Built only with the `tiles` feature (the op log's), like every `oplog_*`
//! export; the app calls it as optional.
use wasm_bindgen::prelude::*;

use crate::ImageHorseTool;

pub(crate) const LOOK_PRESET: f64 = 1.0;
pub(crate) const LOOK_LEVELS: f64 = 2.0;
pub(crate) const LOOK_ADJUST: f64 = 3.0;

/// One tonal step of a look, in its apply call's argument order.
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum LookStep {
    Preset([f64; 5]),
    Levels([f64; 3]),
    Adjust([f64; 7]),
}

impl LookStep {
    fn push_wire(&self, out: &mut Vec<f64>) {
        match self {
            LookStep::Preset(v) => {
                out.push(LOOK_PRESET);
                out.extend_from_slice(v);
            }
            LookStep::Levels(v) => {
                out.push(LOOK_LEVELS);
                out.extend_from_slice(v);
            }
            LookStep::Adjust(v) => {
                out.push(LOOK_ADJUST);
                out.extend_from_slice(v);
            }
        }
    }
}

/// The panel's identity: Contrast and Saturation are 100 (as-is), the rest 0.
fn adjust_is_identity(v: &[f64; 7]) -> bool {
    *v == [0.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0]
}

/// The look in `ops`, history order, Adjustments sessions collapsed.
pub(crate) fn look_of(ops: &[crate::ops::Op]) -> Vec<LookStep> {
    use crate::ops::Op;
    let mut steps: Vec<LookStep> = Vec::new();
    // Index into `steps` of the Adjustments session still open, if any.
    let mut session: Option<usize> = None;
    for op in ops {
        match op {
            Op::Adjustments {
                new_session,
                brightness,
                contrast,
                saturation,
                shadows,
                highlights,
                sharpen,
                blur,
            } => {
                let v = [
                    *brightness,
                    *contrast,
                    *saturation,
                    *shadows,
                    *highlights,
                    *sharpen,
                    *blur,
                ];
                match session {
                    Some(i) if !*new_session => steps[i] = LookStep::Adjust(v),
                    _ => {
                        steps.push(LookStep::Adjust(v));
                        session = Some(steps.len() - 1);
                    }
                }
            }
            // A joined edit does not end a session or start a step.
            Op::SameGesture => {}
            Op::TonalStack {
                brightness,
                contrast,
                highlights,
                shadows,
                saturation,
            } => {
                session = None;
                steps.push(LookStep::Preset([
                    *brightness,
                    *contrast,
                    *saturation,
                    *shadows,
                    *highlights,
                ]));
            }
            Op::Levels(p) => {
                session = None;
                steps.push(LookStep::Levels([
                    f64::from(p.black),
                    f64::from(p.white),
                    f64::from(p.gamma),
                ]));
            }
            _ => session = None,
        }
    }
    steps.retain(|s| !matches!(s, LookStep::Adjust(v) if adjust_is_identity(v)));
    steps
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// The open photo's look (see the module docs for the wire format). Empty
    /// when the photo has no tonal edits, or when no op log is recording.
    pub fn oplog_look(&self) -> Vec<f64> {
        // A broken or out-of-scope log no longer describes the document (a
        // snapshot undo, an unrecorded edit): its ops are not this photo's
        // look, so there is nothing to copy.
        if !self.oplog_active() {
            return Vec::new();
        }
        let Some(log) = self.oplog.as_ref() else {
            return Vec::new();
        };
        let applied = &log.ops()[..log.cursor().min(log.len())];
        let mut out = Vec::new();
        for step in look_of(applied) {
            step.push_wire(&mut out);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ops::{LevelsParams, Op};

    fn adj(new_session: bool, brightness: f64) -> Op {
        Op::Adjustments {
            new_session,
            brightness,
            contrast: 100.0,
            saturation: 100.0,
            shadows: 0.0,
            highlights: 0.0,
            sharpen: 0.0,
            blur: 0.0,
        }
    }

    fn preset() -> Op {
        Op::TonalStack {
            brightness: 0.1,
            contrast: 1.2,
            highlights: -12.0,
            shadows: 8.0,
            saturation: 1.3,
        }
    }

    fn levels() -> Op {
        Op::Levels(LevelsParams {
            black: 20,
            white: 230,
            gamma: 1.25,
        })
    }

    #[test]
    fn a_session_is_one_step_with_its_last_values() {
        let look = look_of(&[adj(true, 10.0), adj(false, 25.0), adj(false, 40.0)]);
        assert_eq!(
            look,
            vec![LookStep::Adjust([40.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0])]
        );
    }

    #[test]
    fn steps_keep_history_order_and_the_preset_is_in_apply_argument_order() {
        let look = look_of(&[preset(), levels(), adj(true, 40.0)]);
        assert_eq!(
            look,
            vec![
                // Wire order on the op is b, c, highlights, shadows, saturation;
                // preset_apply takes b, c, saturation, shadows, highlights.
                LookStep::Preset([0.1, 1.2, 1.3, 8.0, -12.0]),
                LookStep::Levels([20.0, 230.0, 1.25]),
                LookStep::Adjust([40.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0]),
            ]
        );
    }

    #[test]
    fn another_op_ends_the_session_and_a_new_session_is_a_new_step() {
        let look = look_of(&[adj(true, 10.0), levels(), adj(true, 30.0)]);
        assert_eq!(look.len(), 3);
        assert!(matches!(look[2], LookStep::Adjust(v) if v[0] == 30.0));
    }

    #[test]
    fn a_session_reset_to_identity_is_left_out() {
        let look = look_of(&[adj(true, 10.0), adj(false, 0.0), levels()]);
        assert_eq!(look, vec![LookStep::Levels([20.0, 230.0, 1.25])]);
    }

    #[test]
    fn non_tonal_ops_are_skipped() {
        assert!(look_of(&[]).is_empty());
        assert!(look_of(&[Op::SameGesture]).is_empty());
        // A text's alignment is per text, not part of a photo's look
        // (ADR-104): Copy look never carries it to another photo.
        assert!(look_of(&[Op::TextAlign { id: 1, align: 1 }]).is_empty());
    }

    /// What `applyLookAsOneStep` (app/src/lib/look.ts) sends, on a real
    /// engine: three tonal kinds joined by `continue_step` are ONE undo step,
    /// the log records them and replays them byte for byte, undo puts the
    /// photo back, and the look read back is the look that was pasted.
    #[test]
    fn a_pasted_look_is_one_undo_step_that_the_log_replays() {
        let (w, h) = (32u32, 24u32);
        let px: Vec<u8> = (0..w * h)
            .flat_map(|i| {
                let v = (i * 7 % 251) as u8;
                [v, v / 2, 255 - v, 255]
            })
            .collect();
        let mut t = ImageHorseTool::new(w, h);
        // Undo through the log, as the app runs it (tilesFlush, ih_oplog_undo).
        t.set_oplog_undo(true);
        t.load_image(&px);
        let before = t.get_image_data();

        assert!(t.preset_apply(0.1, 1.2, 1.3, 8.0, -12.0));
        t.continue_step();
        assert!(t.levels_apply(20, 230, 1.25));
        t.continue_step();
        assert!(t.tonal_preview_begin());
        assert!(t.adjust_apply(40.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));

        assert_eq!(t.undo_count(), 1, "three kinds, one undo step");
        assert!(!t.oplog_is_broken());
        let after = t.get_image_data();
        assert_ne!(before, after, "the look changed the pixels");

        t.recomposite();
        let replay = match t.oplog.as_ref() {
            Some(log) => log.live_document().composite_flat(),
            None => Vec::new(),
        };
        assert_eq!(
            t.composite_cache, replay,
            "the log replays the paste byte for byte"
        );

        let wire = t.oplog_look();
        assert_eq!(
            wire,
            vec![
                LOOK_PRESET,
                0.1,
                1.2,
                1.3,
                8.0,
                -12.0,
                LOOK_LEVELS,
                20.0,
                230.0,
                1.25,
                LOOK_ADJUST,
                40.0,
                100.0,
                100.0,
                0.0,
                0.0,
                0.0,
                0.0,
            ],
            "the look reads back what was pasted, in order"
        );

        assert!(t.undo());
        assert_eq!(t.get_image_data(), before, "one undo puts the photo back");
        assert!(
            t.oplog_look().is_empty(),
            "an undone look is not part of the look"
        );
    }

    /// A snapshot undo marks a recorded log broken: it no longer describes
    /// the document, so the look it would read back is stale. Nothing to copy.
    #[test]
    fn a_broken_log_has_no_look() {
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image(&[128u8; 8 * 8 * 4]);
        assert!(t.levels_apply(20, 230, 1.25));
        assert!(!t.oplog_look().is_empty());
        assert!(t.undo(), "snapshot undo (op-log undo left off)");
        assert!(t.oplog_is_broken());
        assert!(t.oplog_look().is_empty());
    }

    #[test]
    fn the_wire_is_kind_then_values() {
        let mut out = Vec::new();
        for s in look_of(&[levels(), adj(true, 5.0)]) {
            s.push_wire(&mut out);
        }
        assert_eq!(
            out,
            vec![
                LOOK_LEVELS,
                20.0,
                230.0,
                1.25,
                LOOK_ADJUST,
                5.0,
                100.0,
                100.0,
                0.0,
                0.0,
                0.0,
                0.0
            ]
        );
    }
}

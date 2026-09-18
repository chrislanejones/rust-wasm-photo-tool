//! Color presets: one named stack of the tonal filters the engine already has.
//!
//! A PRESET IS NOT A NEW OPERATION. Each one is a set of values for five
//! filters in `filters` — the same functions the Adjustments sliders call — so
//! a preset adds no pixel math, no `Op` variant and nothing for the op log to
//! version. What it adds is ONE undo step: the Quick Adjust grid it grew out of
//! called `adjust_brightness` and then `adjust_contrast`, each snapshotting, so
//! one click cost two undos and neither half meant anything alone.
//!
//! ORDER IS PART OF THE DEFINITION. Tone first, color last: brightness and
//! contrast set the overall curve, highlights and shadows recover its ends, and
//! saturation acts on the tones that result. The same five numbers in another
//! order give different pixels, so the order lives here, once, and the preview
//! and the commit go through the same function.
//!
//! THE FIVE COMPONENTS ARE NOT IN THE SAME UNITS. They are passed to the
//! filters untouched — a preset is its filters, not a new scale on top of them
//! — so each one is in whatever the filter it feeds already takes:
//!
//! | component  | identity | range the filter clamps to        |
//! |------------|----------|-----------------------------------|
//! | brightness | `0.0`    | fraction, `-1.0 ..= 1.0`          |
//! | contrast   | `1.0`    | factor, `0.0 ..= 4.0`             |
//! | saturation | `1.0`    | factor, `0` = gray, `1` = as-is   |
//! | shadows    | `0.0`    | **absolute 8-bit, `-255 ..= 255`**|
//! | highlights | `0.0`    | **absolute 8-bit, `-255 ..= 255`**|
//!
//! Shadows and highlights are the ones that bite: `0.1` there is a tenth of one
//! level out of 255, so it rounds away to nothing and the component silently
//! contributes zero. The sliders pass their raw 0..100 position, and a preset
//! should use that same scale. (Highlights' sign is inverted relative to
//! Shadows: positive RECOVERS, i.e. darkens, blown highlights.)
//!
//! SHARPEN IS DELIBERATELY NOT IN THE STACK. It is a convolution with two
//! full-buffer scratch allocations, it is not color, and a hover preview would
//! pay for it on every pass.
use wasm_bindgen::prelude::*;

use crate::ImageHorseTool;

/// Below this, a component is its own identity and is skipped.
const EPS: f64 = 1e-6;

/// The five color filters a preset can set. Identity is
/// `brightness 0, contrast 1, saturation 1, shadows 0, highlights 0`.
pub(crate) struct PresetStack {
    pub(crate) brightness: f64,
    pub(crate) contrast: f64,
    pub(crate) saturation: f64,
    pub(crate) shadows: f64,
    pub(crate) highlights: f64,
}

impl PresetStack {
    /// A stack that changes nothing must not cost an undo step.
    pub(crate) fn is_identity(&self) -> bool {
        self.brightness.abs() < EPS
            && (self.contrast - 1.0).abs() < EPS
            && (self.saturation - 1.0).abs() < EPS
            && self.shadows.abs() < EPS
            && self.highlights.abs() < EPS
    }
}

/// Apply the stack to `data` in the documented order. Each component is skipped
/// at its identity value, so a preset that only moves contrast makes ONE pass
/// over the buffer rather than five.
pub(crate) fn apply_stack(data: &mut [u8], s: &PresetStack) {
    if s.brightness.abs() >= EPS {
        crate::filters::adjust_brightness(data, s.brightness);
    }
    if (s.contrast - 1.0).abs() >= EPS {
        crate::filters::adjust_contrast(data, s.contrast);
    }
    if s.highlights.abs() >= EPS {
        crate::filters::adjust_highlights(data, s.highlights);
    }
    if s.shadows.abs() >= EPS {
        crate::filters::adjust_shadows(data, s.shadows);
    }
    if (s.saturation - 1.0).abs() >= EPS {
        crate::filters::adjust_saturation(data, s.saturation);
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Recompute the previewed layer from the untouched copy with this preset
    /// applied. Never touches history, so hovering is never an undo step.
    /// `false` means there is no live preview — never begun, or dropped because
    /// history moved — and the caller should begin a new one.
    pub fn preset_preview_set(
        &mut self,
        brightness: f64,
        contrast: f64,
        saturation: f64,
        shadows: f64,
        highlights: f64,
    ) -> bool {
        if !self.tonal_preview_is_current() {
            self.tonal_preview = None;
            return false;
        }
        let stack = PresetStack {
            brightness,
            contrast,
            saturation,
            shadows,
            highlights,
        };
        if let Some(p) = &self.tonal_preview {
            if let Some(layer) = self.layers.get_mut(p.layer) {
                // From the copy every time, so hovering A then B shows B, not
                // B on top of A.
                layer.buf.data.copy_from_slice(&p.base);
                apply_stack(&mut layer.buf.data, &stack);
                return true;
            }
        }
        false
    }

    /// Commit a preset to the active layer as ONE undo step. An open preview is
    /// put back first, so the stack applies to the untouched pixels exactly
    /// once rather than on top of what the hover already drew. Returns whether
    /// pixels changed (the caller should flush).
    pub fn preset_apply(
        &mut self,
        brightness: f64,
        contrast: f64,
        saturation: f64,
        shadows: f64,
        highlights: f64,
    ) -> bool {
        let restored = self.tonal_preview_cancel();
        let stack = PresetStack {
            brightness,
            contrast,
            saturation,
            shadows,
            highlights,
        };
        if stack.is_identity() || self.layers.get(self.active).is_none() {
            return restored;
        }
        self.snap("Preset");
        if let Some(layer) = self.layers.get_mut(self.active) {
            apply_stack(&mut layer.buf.data, &stack);
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Colored pixels well off the mid-point. Mid-gray is exactly the WRONG
    /// fixture here: it is the fixed point of contrast (which pivots on 128)
    /// and of saturation (which cannot desaturate a gray), so both components
    /// would read as no-ops against it.
    fn px(n: usize) -> Vec<u8> {
        [
            40u8, 90, 200, 255, // dark blue-ish
            210, 60, 30, 255, // bright warm
            18, 18, 24, 255, // near-black, for shadows
            238, 232, 210, 255, // near-white, for highlights
        ]
        .repeat(n.div_ceil(4))
    }

    fn identity() -> PresetStack {
        PresetStack {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
            shadows: 0.0,
            highlights: 0.0,
        }
    }

    #[test]
    fn the_identity_stack_is_identity_and_touches_no_pixel() {
        let s = identity();
        assert!(s.is_identity());
        let mut d = px(16);
        let before = d.clone();
        apply_stack(&mut d, &s);
        assert_eq!(d, before, "identity must not move a single channel");
    }

    #[test]
    fn any_single_component_off_identity_is_not_identity() {
        for s in [
            PresetStack {
                brightness: 0.05,
                ..identity()
            },
            PresetStack {
                contrast: 1.2,
                ..identity()
            },
            PresetStack {
                saturation: 0.8,
                ..identity()
            },
            PresetStack {
                shadows: 12.0,
                ..identity()
            },
            PresetStack {
                highlights: 12.0,
                ..identity()
            },
        ] {
            assert!(!s.is_identity(), "one component off identity counts");
            let mut d = px(16);
            let before = d.clone();
            apply_stack(&mut d, &s);
            assert_ne!(d, before, "and it must actually change pixels");
        }
    }

    #[test]
    fn an_identity_component_is_skipped_without_changing_the_result() {
        // Skipping is an optimization, not a behavior change: a stack with
        // three components at identity must equal the two that are not.
        let sparse = PresetStack {
            contrast: 1.4,
            brightness: 0.03,
            ..identity()
        };
        let mut skipped = px(64);
        apply_stack(&mut skipped, &sparse);

        let mut by_hand = px(64);
        crate::filters::adjust_brightness(&mut by_hand, 0.03);
        crate::filters::adjust_contrast(&mut by_hand, 1.4);

        assert_eq!(skipped, by_hand);
    }

    #[test]
    fn a_fully_transparent_pixel_keeps_its_alpha() {
        let mut d = vec![10u8, 20, 30, 0, 200, 210, 220, 255];
        apply_stack(
            &mut d,
            &PresetStack {
                contrast: 1.5,
                saturation: 1.3,
                ..identity()
            },
        );
        assert_eq!(d[3], 0, "alpha is never remapped");
        assert_eq!(d[7], 255);
    }
}

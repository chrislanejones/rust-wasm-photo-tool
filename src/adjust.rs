//! Enhance › Adjustments as a preview SESSION (10-08), on the same
//! `tonal_preview` copy Levels and Presets use.
//!
//! Before this, every slider baked a DELTA into the layer on release:
//! brightness +65 then ↺ applied −65 to pixels the +65 had already clipped,
//! so a four-band test image (40/120/200/240) came back as 40/89/89/89, and
//! only Undo could repair it. There was no preview while dragging, and the
//! brightness scale was the full ±255 per unit (+65 added 166 levels).
//!
//! Now the panel opens a preview over an untouched copy, every move
//! recomputes ALL seven settings from that copy (`adjust_preview_set`), a
//! slider's ↺ is exact because its default is simply not applied, and
//! `adjust_apply` bakes the lot as ONE undo step.
use wasm_bindgen::prelude::*;

use crate::{filters, ImageHorseTool};

/// Brightness ±100 moves every channel by up to a quarter of the range
/// (±64 levels). It was ±255: +65 pushed a 40-gray to 206 and clipped
/// everything lighter to white.
pub(crate) const BRIGHTNESS_FULL_SCALE: f64 = 0.25;

/// The seven Adjustments settings, in the panel's own units.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Adjust {
    /// −100..=100, 0 = none.
    pub brightness: f64,
    /// Percent, 10..=300, 100 = none.
    pub contrast: f64,
    /// Percent, 0..=300, 100 = none.
    pub saturation: f64,
    /// −100..=100, 0 = none.
    pub shadows: f64,
    /// −100..=100, 0 = none.
    pub highlights: f64,
    /// 0..=100, 0 = none.
    pub sharpen: f64,
    /// 0..=100, 0 = none.
    pub blur: f64,
}

impl Adjust {
    pub(crate) fn new(
        brightness: f64,
        contrast: f64,
        saturation: f64,
        shadows: f64,
        highlights: f64,
        sharpen: f64,
        blur: f64,
    ) -> Self {
        let c =
            |v: f64, lo: f64, hi: f64, def: f64| if v.is_finite() { v.clamp(lo, hi) } else { def };
        Self {
            brightness: c(brightness, -100.0, 100.0, 0.0),
            contrast: c(contrast, 10.0, 300.0, 100.0),
            saturation: c(saturation, 0.0, 300.0, 100.0),
            shadows: c(shadows, -100.0, 100.0, 0.0),
            highlights: c(highlights, -100.0, 100.0, 0.0),
            sharpen: c(sharpen, 0.0, 100.0, 0.0),
            blur: c(blur, 0.0, 100.0, 0.0),
        }
    }

    pub(crate) fn is_identity(&self) -> bool {
        self.brightness == 0.0
            && self.contrast == 100.0
            && self.saturation == 100.0
            && self.shadows == 0.0
            && self.highlights == 0.0
            && self.sharpen == 0.0
            && self.blur == 0.0
    }
}

/// Apply `a` to `data` (a `w × h` RGBA layer) in place. Each setting at its
/// default is skipped entirely, so an untouched slider costs nothing and
/// changes no byte. Tone first, then sharpen, then blur.
pub(crate) fn adjust_in_place(data: &mut [u8], w: u32, h: u32, a: &Adjust) {
    if a.brightness != 0.0 {
        filters::adjust_brightness(data, a.brightness / 100.0 * BRIGHTNESS_FULL_SCALE);
    }
    if a.contrast != 100.0 {
        filters::adjust_contrast(data, a.contrast / 100.0);
    }
    if a.saturation != 100.0 {
        filters::adjust_saturation(data, a.saturation / 100.0);
    }
    if a.shadows != 0.0 {
        filters::adjust_shadows(data, a.shadows);
    }
    if a.highlights != 0.0 {
        filters::adjust_highlights(data, a.highlights);
    }
    if a.sharpen > 0.0 {
        // Same mapping the slider used to send: 0..=100 → 0..=2.
        filters::sharpen(data, w, h, a.sharpen / 100.0 * 2.0);
    }
    if a.blur > 0.0 && !data.is_empty() {
        // Same mapping as the old one-shot blur: 0..=100 → kernel radius 1..=30.
        let radius = ((a.blur / 100.0 * 30.0).round() as u32).clamp(1, 30);
        let kernel = filters::build_gaussian_kernel(radius);
        let (wu, hu) = (w as usize, h as usize);
        let mut pass = vec![0u8; data.len()];
        crate::simd::blur::blur_horizontal(data, &mut pass, wu, hu, radius as i32, &kernel);
        crate::simd::blur::blur_vertical(&pass, data, wu, hu, radius as i32, &kernel);
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Recompute the live preview from the untouched copy. `false` when no
    /// current preview exists (the caller re-begins and retries, as Levels
    /// does). Records nothing in History.
    #[allow(clippy::too_many_arguments)]
    pub fn adjust_preview_set(
        &mut self,
        brightness: f64,
        contrast: f64,
        saturation: f64,
        shadows: f64,
        highlights: f64,
        sharpen: f64,
        blur: f64,
    ) -> bool {
        if !self.tonal_preview_is_current() {
            self.tonal_preview = None;
            return false;
        }
        let a = Adjust::new(
            brightness, contrast, saturation, shadows, highlights, sharpen, blur,
        );
        let (w, h) = (self.width, self.height);
        if let Some(p) = &self.tonal_preview {
            if let Some(layer) = self.layers.get_mut(p.layer) {
                if layer.buf.data.len() != p.base.len() {
                    return false;
                }
                layer.buf.data.copy_from_slice(&p.base);
                adjust_in_place(&mut layer.buf.data, w, h, &a);
                return true;
            }
        }
        false
    }

    /// End the preview and bake `a` into the active layer as ONE undo step
    /// ("Adjustments"). At the identity it only ends the preview. Returns
    /// whether the pixels changed.
    #[allow(clippy::too_many_arguments)]
    pub fn adjust_apply(
        &mut self,
        brightness: f64,
        contrast: f64,
        saturation: f64,
        shadows: f64,
        highlights: f64,
        sharpen: f64,
        blur: f64,
    ) -> bool {
        let restored = self.tonal_preview_cancel();
        let a = Adjust::new(
            brightness, contrast, saturation, shadows, highlights, sharpen, blur,
        );
        if a.is_identity() || self.layers.get(self.active).is_none() {
            return restored;
        }
        self.snap("Adjustments");
        let (w, h) = (self.width, self.height);
        adjust_in_place(&mut self.layers[self.active].buf.data, w, h, &a);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Four flat gray bands, 40 / 120 / 200 / 240 — the image the bug was
    /// measured on.
    fn bands(w: u32, h: u32) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _y in 0..h {
            for x in 0..w {
                let g = [40u8, 120, 200, 240][(x * 4 / w) as usize];
                v.extend_from_slice(&[g, g, g, 255]);
            }
        }
        v
    }

    fn tool(w: u32, h: u32) -> ImageHorseTool {
        let mut t = ImageHorseTool::new(w, h);
        t.load_image(&bands(w, h));
        t
    }

    fn band_values(t: &ImageHorseTool, w: u32) -> [u8; 4] {
        let d = t.get_image_data();
        let at = |x: u32| d[(x * 4) as usize];
        [at(w / 8), at(w * 3 / 8), at(w * 5 / 8), at(w * 7 / 8)]
    }

    #[test]
    fn brightness_plus_65_is_a_moderate_lift_not_a_blowout() {
        let (w, h) = (64, 8);
        let mut t = tool(w, h);
        assert!(t.tonal_preview_begin());
        assert!(t.adjust_preview_set(65.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        let b = band_values(&t, w);
        // 0.65 × 0.25 × 255 ≈ 41 levels, not 166.
        assert_eq!(b[0], 81, "40 + 41");
        assert_eq!(b[1], 161, "120 + 41");
        assert!(b[2] < 255, "200 must not clip at +65: {}", b[2]);
    }

    #[test]
    fn reset_to_defaults_returns_the_exact_original_bytes() {
        let (w, h) = (64, 8);
        let mut t = tool(w, h);
        let original = t.get_image_data();
        assert!(t.tonal_preview_begin());
        assert!(t.adjust_preview_set(65.0, 180.0, 40.0, 30.0, -30.0, 50.0, 20.0));
        assert_ne!(t.get_image_data(), original, "the preview moved pixels");
        // Every slider back to its default — the ↺ case. The old delta model
        // turned 120/200/240 into one flat 89 here.
        assert!(t.adjust_preview_set(0.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        assert_eq!(t.get_image_data(), original);
    }

    #[test]
    fn previews_do_not_accumulate() {
        let (w, h) = (64, 8);
        let mut t = tool(w, h);
        assert!(t.tonal_preview_begin());
        assert!(t.adjust_preview_set(40.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        let once = t.get_image_data();
        for _ in 0..5 {
            assert!(t.adjust_preview_set(40.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        }
        assert_eq!(
            t.get_image_data(),
            once,
            "same settings, same pixels, however many moves"
        );
    }

    #[test]
    fn apply_is_one_undo_step_and_undo_restores_the_original() {
        let (w, h) = (64, 8);
        let mut t = tool(w, h);
        let original = t.get_image_data();
        let before = t.undo_count();
        assert!(t.tonal_preview_begin());
        assert!(t.adjust_preview_set(30.0, 120.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        let previewed = t.get_image_data();
        assert_eq!(t.undo_count(), before, "a preview records nothing");
        assert!(t.adjust_apply(30.0, 120.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        assert_eq!(t.undo_count(), before + 1, "Apply is exactly one step");
        assert_eq!(
            t.get_image_data(),
            previewed,
            "Apply bakes what the preview showed"
        );
        t.undo();
        assert_eq!(t.get_image_data(), original);
    }

    #[test]
    fn apply_at_the_identity_only_ends_the_preview() {
        let (w, h) = (64, 8);
        let mut t = tool(w, h);
        let original = t.get_image_data();
        let before = t.undo_count();
        assert!(t.tonal_preview_begin());
        assert!(t.adjust_preview_set(50.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
        t.adjust_apply(0.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0);
        assert_eq!(t.undo_count(), before);
        assert_eq!(
            t.get_image_data(),
            original,
            "the preview is gone, the photo is back"
        );
        assert!(!t.tonal_preview_active());
    }

    #[test]
    fn nonsense_values_clamp_instead_of_panicking() {
        let a = Adjust::new(f64::NAN, 9999.0, -5.0, 1e9, -1e9, f64::INFINITY, -1.0);
        assert_eq!(a.brightness, 0.0);
        assert_eq!(a.contrast, 300.0);
        assert_eq!(a.saturation, 0.0);
        assert_eq!(a.shadows, 100.0);
        assert_eq!(a.highlights, -100.0);
        assert_eq!(
            a.sharpen, 0.0,
            "a non-finite value falls back to the default"
        );
        assert_eq!(a.blur, 0.0);
    }
}

//! Levels: black point, white point and gamma, as a live tool with a preview.
//!
//! ONE REMAP, TWO CALLERS. [`levels_lut`] is what the live tool applies AND
//! what `Op::Levels` replays (`ops.rs` delegates here), so the picture the user
//! committed and the op the log recorded cannot drift apart. Before this file
//! `Op::Levels` had an apply, serialization and tests but no producer (ADR-052):
//! a recorder for a feature the engine did not have.
//!
//! PREVIEW WORKS FROM A COPY. `levels_preview_begin` copies the active layer
//! once. Every slider move recomputes the layer FROM that copy, through a
//! 256-entry LUT on the stack with no allocation per move, so moves never
//! compound. `levels_preview_cancel` puts the copy back; `levels_apply` puts it
//! back, snapshots, applies once and records one `Op::Levels`. A preview never
//! touches history, so it is never an undo step.
//!
//! A STALE COPY MUST NEVER BE WRITTEN BACK. If history changes while a preview
//! is open (undo, redo, another edit, a new image), the layer is no longer the
//! one that was copied, and restoring the copy would erase that change. Undo
//! depth alone cannot see it: undo followed by a new edit lands on the same
//! depth with different pixels. `History::generation` moves on every one of
//! those events, so every write checks it first and the preview drops itself
//! when it has moved.
use wasm_bindgen::prelude::*;

use crate::ImageHorseTool;

/// An open preview: which layer, the history generation it was taken at, and
/// that layer's untouched pixels.
pub(crate) struct LevelsPreview {
    layer: usize,
    generation: u64,
    base: Vec<u8>,
}

/// The 256-entry remap for one channel value: `black` and `white` input points,
/// output `gamma`. The only copy of this math — `Op::Levels` calls it too.
pub(crate) fn levels_lut(black: u8, white: u8, gamma: f32) -> [u8; 256] {
    let lo = black as f32;
    let hi = white as f32;
    let denom = (hi - lo).max(1.0);
    let inv_gamma = 1.0 / gamma.max(0.01);
    let mut lut = [0u8; 256];
    for (v, out) in lut.iter_mut().enumerate() {
        let t = ((v as f32 - lo) / denom).clamp(0.0, 1.0);
        let t = t.powf(inv_gamma);
        *out = (t * 255.0).round().clamp(0.0, 255.0) as u8;
    }
    lut
}

/// (0, 255, 1.0) maps every value to itself, so applying it changes nothing
/// and must not cost an undo step.
fn is_identity(black: u8, white: u8, gamma: f32) -> bool {
    black == 0 && white == 255 && (gamma - 1.0).abs() < 1e-6
}

/// Write `src` remapped through `lut` into `dst`. Fully transparent pixels are
/// copied untouched and alpha is never remapped — the rule `Op::Levels` uses.
fn remap_into(dst: &mut [u8], src: &[u8], lut: &[u8; 256]) {
    for (d, s) in dst.chunks_exact_mut(4).zip(src.chunks_exact(4)) {
        if s[3] == 0 {
            d.copy_from_slice(s);
        } else {
            d[0] = lut[s[0] as usize];
            d[1] = lut[s[1] as usize];
            d[2] = lut[s[2] as usize];
            d[3] = s[3];
        }
    }
}

/// [`remap_into`] with the source and destination being the same buffer.
fn remap_in_place(data: &mut [u8], lut: &[u8; 256]) {
    for px in data.chunks_exact_mut(4) {
        if px[3] != 0 {
            px[0] = lut[px[0] as usize];
            px[1] = lut[px[1] as usize];
            px[2] = lut[px[2] as usize];
        }
    }
}

impl ImageHorseTool {
    /// True when a preview is open AND still describes the live layer: the
    /// history has not moved since the copy was taken, and the layer is the
    /// same size.
    fn levels_preview_is_current(&self) -> bool {
        match &self.levels_preview {
            Some(p) => {
                p.generation == self.hist.generation
                    && self
                        .layers
                        .get(p.layer)
                        .is_some_and(|l| l.buf.data.len() == p.base.len())
            }
            None => false,
        }
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Start a Levels preview on the active layer: one copy of its pixels.
    /// `false` when a preview is already open or there is no active layer.
    pub fn levels_preview_begin(&mut self) -> bool {
        if self.levels_preview.is_some() {
            return false;
        }
        let Some(layer) = self.layers.get(self.active) else {
            return false;
        };
        self.levels_preview = Some(LevelsPreview {
            layer: self.active,
            generation: self.hist.generation,
            base: layer.buf.data.clone(),
        });
        true
    }

    /// Whether a preview is open (it may still be stale; writes check that).
    pub fn levels_preview_active(&self) -> bool {
        self.levels_preview.is_some()
    }

    /// Recompute the previewed layer from the copy. Never touches history.
    /// `false` means there is no live preview — never begun, or dropped because
    /// history moved — and the caller should begin a new one.
    pub fn levels_preview_set(&mut self, black: u8, white: u8, gamma: f32) -> bool {
        if !self.levels_preview_is_current() {
            self.levels_preview = None;
            return false;
        }
        let lut = levels_lut(black, white, gamma);
        if let Some(p) = &self.levels_preview {
            if let Some(layer) = self.layers.get_mut(p.layer) {
                remap_into(&mut layer.buf.data, &p.base, &lut);
                return true;
            }
        }
        false
    }

    /// Close the preview and put the untouched pixels back. `true` when pixels
    /// were restored (the caller should flush). A stale preview is dropped
    /// WITHOUT writing: its copy no longer matches the document.
    pub fn levels_preview_cancel(&mut self) -> bool {
        let current = self.levels_preview_is_current();
        let Some(p) = self.levels_preview.take() else {
            return false;
        };
        if !current {
            return false;
        }
        if let Some(layer) = self.layers.get_mut(p.layer) {
            layer.buf.data.copy_from_slice(&p.base);
            return true;
        }
        false
    }

    /// Commit Levels to the active layer as ONE undo step and ONE recorded
    /// `Op::Levels`. An open preview is put back first, so the remap applies to
    /// the untouched pixels exactly once. The identity (0, 255, 1.0) records
    /// nothing. Returns whether pixels changed (the caller should flush).
    pub fn levels_apply(&mut self, black: u8, white: u8, gamma: f32) -> bool {
        let restored = self.levels_preview_cancel();
        if is_identity(black, white, gamma) || self.layers.get(self.active).is_none() {
            return restored;
        }
        self.snap("Levels");
        let lut = levels_lut(black, white, gamma);
        if let Some(layer) = self.layers.get_mut(self.active) {
            remap_in_place(&mut layer.buf.data, &lut);
        }
        #[cfg(feature = "tiles")]
        self.oplog_record(crate::ops::Op::Levels(crate::ops::LevelsParams {
            black,
            white,
            gamma,
        }));
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_identity_lut_maps_every_value_to_itself() {
        let lut = levels_lut(0, 255, 1.0);
        assert!(lut.iter().enumerate().all(|(v, &o)| o as usize == v));
        assert!(is_identity(0, 255, 1.0));
        assert!(!is_identity(1, 255, 1.0));
        assert!(!is_identity(0, 255, 1.2));
    }

    #[test]
    fn black_and_white_points_clip_and_stretch() {
        let lut = levels_lut(28, 228, 1.0);
        assert_eq!(lut[0], 0, "below black clips to 0");
        assert_eq!(lut[28], 0);
        assert_eq!(lut[228], 255);
        assert_eq!(lut[255], 255, "above white clips to 255");
        assert_eq!(lut[78], 64, "(78-28)/200 = 0.25 -> 63.75 -> 64");
    }

    #[test]
    fn gamma_above_one_brightens_the_midtones() {
        let lut = levels_lut(0, 255, 2.0);
        assert!(
            lut[64] > 64,
            "gamma 2.0 lifts a dark midtone: got {}",
            lut[64]
        );
        assert_eq!(lut[0], 0);
        assert_eq!(lut[255], 255);
    }

    #[test]
    fn transparent_pixels_and_alpha_are_never_remapped() {
        let lut = levels_lut(50, 150, 1.5);
        // An alpha-0 pixel with non-zero colour, and a half-transparent one.
        let src = [10u8, 20, 30, 0, 100, 100, 100, 128];
        let mut dst = [0u8; 8];
        remap_into(&mut dst, &src, &lut);
        assert_eq!(&dst[..4], &src[..4], "alpha-0 pixel copied byte-for-byte");
        assert_eq!(dst[7], 128, "alpha untouched");
        assert_eq!(dst[4], lut[100]);

        let mut in_place = src;
        remap_in_place(&mut in_place, &lut);
        assert_eq!(in_place, dst, "the two remaps agree");
    }
}

//! The shared preview slot: showing a tonal edit on the photo before it costs
//! an undo step.
//!
//! ONE SLOT, NOT ONE PER TOOL. Levels and color presets both preview by
//! recomputing the active layer from an untouched copy of it. Two independent
//! slots could both be open at once, and whichever closed second would put
//! ITS copy back — silently erasing what the other had committed. There is one
//! slot, so a second `begin` while one is open is refused (`false`) rather
//! than quietly shadowing the first.
//!
//! A STALE COPY MUST NEVER BE WRITTEN BACK. If history moves while a preview
//! is open (undo, redo, another edit, a new image), the layer is no longer the
//! one that was copied, and restoring the copy would erase that change. Undo
//! depth alone cannot see it: undo followed by a new edit lands on the same
//! depth with different pixels. `History::generation` moves on every one of
//! those events, so every write checks it first and the preview drops itself
//! when it has moved.
//!
//! Generalised out of `levels.rs` when presets became the second caller
//! (ADR-054 established the mechanism for one tool; this is the same
//! mechanism with the Levels-specific parts left behind in `levels.rs`).
use wasm_bindgen::prelude::*;

use crate::ImageHorseTool;

/// An open preview: which layer, the history generation it was taken at, and
/// that layer's untouched pixels.
pub(crate) struct TonalPreview {
    pub(crate) layer: usize,
    pub(crate) generation: u64,
    pub(crate) base: Vec<u8>,
}

impl ImageHorseTool {
    /// True when a preview is open AND still describes the live layer: the
    /// history has not moved since the copy was taken, and the layer is the
    /// same size.
    pub(crate) fn tonal_preview_is_current(&self) -> bool {
        match &self.tonal_preview {
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
    /// Start a preview on the active layer: one copy of its pixels.
    /// `false` when a preview is already open or there is no active layer.
    pub fn tonal_preview_begin(&mut self) -> bool {
        if self.tonal_preview.is_some() {
            return false;
        }
        let Some(layer) = self.layers.get(self.active) else {
            return false;
        };
        self.tonal_preview = Some(TonalPreview {
            layer: self.active,
            generation: self.hist.generation,
            base: layer.buf.data.clone(),
        });
        true
    }

    /// Whether a preview is open (it may still be stale; writes check that).
    pub fn tonal_preview_active(&self) -> bool {
        self.tonal_preview.is_some()
    }

    /// Close the preview and put the untouched pixels back. `true` when pixels
    /// were restored (the caller should flush). A stale preview is dropped
    /// WITHOUT writing: its copy no longer matches the document.
    pub fn tonal_preview_cancel(&mut self) -> bool {
        let current = self.tonal_preview_is_current();
        let Some(p) = self.tonal_preview.take() else {
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
}

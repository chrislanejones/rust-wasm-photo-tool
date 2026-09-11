/// Undo / redo history system.
///
/// Each snapshot stores a full copy of the **layer stack** (every layer's pixel
/// buffer + annotations), the active layer index, the canvas dimensions, and a
/// label. Storing the whole stack — not just one buffer — is what makes layer
/// structural operations (add / delete / reorder / merge) undoable alongside
/// ordinary per-layer pixel edits.
///
/// Storing dimensions is necessary because some operations (crop, resize,
/// rotate) change the canvas size — without restoring width/height, undo would
/// put the wrong dimensions back and corrupt the display.
use std::collections::VecDeque;

use crate::layer::Layer;
use crate::settings;

pub struct Snapshot {
    pub label: String,
    /// Full layer stack at the time of the snapshot, bottom → top.
    pub layers: Vec<Layer>,
    /// Active layer index within `layers`.
    pub active: usize,
    pub width: u32,
    pub height: u32,
    /// The selection mask at the time of the snapshot — selection changes are
    /// undo steps (each select / add / subtract / deselect), and pixel-step
    /// undo also restores the mask that was live at that moment.
    pub selection: Option<Vec<bool>>,
    /// True when this snapshot was pushed by a selection-only action. Such
    /// steps recorded NO op, so undo/redo must treat them as transparent to
    /// the op log: restore just the mask, never seek the log cursor (see
    /// `ImageHorseTool::undo`). The layer stack in a selection-only snapshot
    /// is identical to the state below it by construction.
    pub selection_only: bool,
    /// Export quality at the time of the snapshot, 1..=100. ADR-031.
    ///
    /// The only non-pixel parameter here that the engine itself never reads —
    /// see `ImageHorseTool::export_quality`. Captured on every snapshot, not
    /// just compress ones, so undoing a brush stroke also restores the quality
    /// that was live when that stroke was made.
    pub export_quality: u8,
}

impl Snapshot {
    /// Approximate heap bytes this snapshot holds. The dominant cost is each
    /// layer's pixel buffer (width·height·4); the annotation vecs are negligible
    /// by comparison, so they're omitted. The selection adds 1 byte/px when
    /// present.
    pub fn bytes(&self) -> usize {
        self.layers.iter().map(|l| l.buf.data.len()).sum::<usize>()
            + self.selection.as_ref().map_or(0, |s| s.len())
    }
}

pub struct History {
    pub undo_stack: VecDeque<Snapshot>,
    pub redo_stack: Vec<Snapshot>,
    /// Live undo depth (user-tunable via settings; defaults to
    /// `settings::DEFAULT_MAX_HISTORY`). Enforced here on push.
    pub max_history: usize,
    /// Hard byte ceiling on the undo stack (defaults to
    /// `settings::DEFAULT_MAX_HISTORY_BYTES`). Enforced alongside `max_history`
    /// on every push so large/multi-layer canvases can't balloon to GBs.
    pub max_bytes: usize,
}

impl History {
    pub fn new() -> Self {
        Self {
            undo_stack: VecDeque::new(),
            redo_stack: Vec::new(),
            max_history: settings::DEFAULT_MAX_HISTORY,
            max_bytes: settings::DEFAULT_MAX_HISTORY_BYTES,
        }
    }

    /// Update the undo depth at runtime (clamped to the allowed range) and trim
    /// the oldest snapshots immediately if the new cap is lower.
    pub fn set_max_history(&mut self, n: usize) {
        self.max_history = settings::clamp_max_history(n);
        self.trim();
    }

    /// Push a pre-built snapshot onto the undo stack. Clears the redo stack.
    pub fn push(&mut self, snap: Snapshot) {
        self.undo_stack.push_back(snap);
        self.trim();
        self.redo_stack.clear();
    }

    /// Push a snapshot WITHOUT clearing the redo stack — used by the clone-stamp
    /// stroke path, which pushes its pre-stroke snapshot directly. Enforces the
    /// same count + byte limits as [`push`](Self::push).
    pub fn push_stroke(&mut self, snap: Snapshot) {
        self.undo_stack.push_back(snap);
        self.trim();
    }

    /// Total bytes currently held by the undo stack.
    fn undo_bytes(&self) -> usize {
        self.undo_stack.iter().map(|s| s.bytes()).sum()
    }

    /// Evict oldest snapshots until the undo stack is within BOTH the step cap
    /// (`max_history`) and the byte budget (`max_bytes`). Always keeps at least
    /// one snapshot, so undo still works even when a single snapshot is larger
    /// than the whole budget.
    fn trim(&mut self) {
        while self.undo_stack.len() > self.max_history {
            self.undo_stack.pop_front();
        }
        let mut total = self.undo_bytes();
        while self.undo_stack.len() > 1 && total > self.max_bytes {
            if let Some(s) = self.undo_stack.pop_front() {
                total -= s.bytes();
            }
        }
    }

    /// Undo: pops the most recent undo snapshot and returns it for the caller
    /// to restore. `current` is the live state; it is pushed onto the redo
    /// stack (re-labelled with the popped snapshot's label so the History panel
    /// reads naturally). Returns `None` when there is nothing to undo.
    pub fn undo(&mut self, current: Snapshot) -> Option<Snapshot> {
        if let Some(snap) = self.undo_stack.pop_back() {
            let mut cur = current;
            cur.label = snap.label.clone();
            // The redo entry stands in for the step being undone, so it keeps
            // the step's kind too — a selection-only step must redo through
            // the selection-only (log-transparent) path.
            cur.selection_only = snap.selection_only;
            self.redo_stack.push(cur);
            Some(snap)
        } else {
            None
        }
    }

    /// Redo: pops the most recent redo snapshot and returns it for restore.
    /// `current` is pushed back onto the undo stack.
    pub fn redo(&mut self, current: Snapshot) -> Option<Snapshot> {
        if let Some(snap) = self.redo_stack.pop() {
            let mut cur = current;
            cur.label = snap.label.clone();
            // Mirror of `undo` — the undo entry keeps the redone step's kind.
            cur.selection_only = snap.selection_only;
            self.undo_stack.push_back(cur);
            Some(snap)
        } else {
            None
        }
    }

    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }

    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    /// Serialise history labels as "type:label|type:label|…" for the JS side.
    pub fn labels(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        for s in &self.undo_stack {
            parts.push(format!("undo:{}", s.label));
        }
        parts.push("current:Current State".to_string());
        for s in self.redo_stack.iter().rev() {
            parts.push(format!("redo:{}", s.label));
        }
        parts.join("|")
    }

    /// Delete a history entry by index without restoring canvas state.
    /// Returns true if the entry existed and was removed.
    pub fn delete_entry(&mut self, index: usize) -> bool {
        if index >= self.undo_stack.len() {
            return false;
        }
        self.undo_stack.remove(index);
        self.redo_stack.clear();
        true
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

// ── History snapshot serialization (for JS-side persistence) ────────────────
//
// Moved out of lib.rs (#45's Rust twin). Twelve wasm-exported methods that do
// ONE job — turn history snapshots into something IndexedDB can hold and back
// again — sitting in a file that is under a line ratchet. They belong next to
// the History they serialize.

use crate::annotations::{annotations_to_json, build_text_annotation};
use crate::layer::composite_layers;
use crate::{codec, ImageBuffer, ImageHorseTool};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl ImageHorseTool {
    // ── History snapshot serialization (for JS-side persistence) ────────────

    pub fn undo_snapshot_count(&self) -> usize {
        self.hist.undo_stack.len()
    }

    pub fn redo_snapshot_count(&self) -> usize {
        self.hist.redo_stack.len()
    }

    pub fn get_undo_snapshot_png(&self, index: usize) -> Vec<u8> {
        match self.hist.undo_stack.get(index) {
            None => Vec::new(),
            Some(snap) => {
                let data = composite_layers(&snap.layers, snap.width, snap.height, None, None);
                let tmp = ImageBuffer {
                    width: snap.width,
                    height: snap.height,
                    data,
                };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_undo_snapshot_label(&self, index: usize) -> String {
        self.hist
            .undo_stack
            .get(index)
            .map(|s| s.label.clone())
            .unwrap_or_default()
    }

    pub fn get_redo_snapshot_png(&self, index: usize) -> Vec<u8> {
        match self.hist.redo_stack.get(index) {
            None => Vec::new(),
            Some(snap) => {
                let data = composite_layers(&snap.layers, snap.width, snap.height, None, None);
                let tmp = ImageBuffer {
                    width: snap.width,
                    height: snap.height,
                    data,
                };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_redo_snapshot_label(&self, index: usize) -> String {
        self.hist
            .redo_stack
            .get(index)
            .map(|s| s.label.clone())
            .unwrap_or_default()
    }

    /// Append a raw-RGBA snapshot to the undo stack (used when restoring a
    /// session). The snapshot is reconstructed as a single Background layer;
    /// annotations start empty — the JS side adds them one by one with
    /// `push_annotation_to_undo_snapshot` after this returns. (Multi-layer
    /// history is not yet persisted; restored snapshots are single-layer.)
    pub fn inject_undo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        let layer = Layer::from_snapshot_pixels(data, w, h);
        self.hist.undo_stack.push_back(Snapshot {
            // Reconstructed from the op log — it rebuilds a document, it does
            // not change a setting, so it carries the live quality (ADR-031).
            export_quality: self.export_quality,
            label: label.to_string(),
            layers: vec![layer],
            active: 0,
            width: w,
            height: h,
            selection: None,
            selection_only: false,
        });
    }

    /// Append a raw-RGBA snapshot to the redo stack (used when restoring a session).
    pub fn inject_redo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        let layer = Layer::from_snapshot_pixels(data, w, h);
        self.hist.redo_stack.push(Snapshot {
            export_quality: self.export_quality,
            label: label.to_string(),
            layers: vec![layer],
            active: 0,
            width: w,
            height: h,
            selection: None,
            selection_only: false,
        });
    }

    /// Per-snapshot annotation state as JSON (active layer's text annotations).
    /// Mirrors `get_text_annotations` so JS can read snapshot overlays with the
    /// same parser. Used by the persistence layer for round-trip saves.
    pub fn get_undo_snapshot_annotations(&self, index: usize) -> String {
        match self
            .hist
            .undo_stack
            .get(index)
            .and_then(|s| s.layers.get(s.active))
        {
            None => String::from("[]"),
            Some(layer) => annotations_to_json(&layer.text_annotations),
        }
    }

    pub fn get_redo_snapshot_annotations(&self, index: usize) -> String {
        match self
            .hist
            .redo_stack
            .get(index)
            .and_then(|s| s.layers.get(s.active))
        {
            None => String::from("[]"),
            Some(layer) => annotations_to_json(&layer.text_annotations),
        }
    }

    /// Push one annotation onto the undo-snapshot at `snap_idx`. The tile is
    /// rebuilt from the config so the persistence layer doesn't have to store
    /// pre-rotated tile bytes. Returns false if the index is out of range.
    pub fn push_annotation_to_undo_snapshot(
        &mut self,
        snap_idx: usize,
        text: &str,
        font_size: f32,
        r: u8,
        g: u8,
        b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u32,
    ) -> bool {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id,
            text,
            // Snapshot pushes carry raw params, not a live annotation; wrapping is
            // re-derived when the snapshot is restored through the normal path.
            0,
            0,                                 // …and so is the box height, for the same reason
            crate::perspective::IDENTITY_QUAD, // …and so is the corner quad
            font_size,
            r,
            g,
            b,
            bold,
            x,
            y,
            rotation_deg,
            background_kind,
            bg_r,
            bg_g,
            bg_b,
            bg_a,
            bg_padding,
            bg_corner_radius,
            bg_tail,
            false,
            false,
            0,
            0,
            0,
            0,
            0,
            0,
            0, // shadow off; set via set_text_shadow
        );
        match self.hist.undo_stack.get_mut(snap_idx) {
            None => false,
            Some(snap) => {
                let a = snap.active;
                match snap.layers.get_mut(a) {
                    Some(layer) => {
                        layer.text_annotations.push(ann);
                        true
                    }
                    None => false,
                }
            }
        }
    }

    pub fn push_annotation_to_redo_snapshot(
        &mut self,
        snap_idx: usize,
        text: &str,
        font_size: f32,
        r: u8,
        g: u8,
        b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u32,
    ) -> bool {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id,
            text,
            // Snapshot pushes carry raw params, not a live annotation; wrapping is
            // re-derived when the snapshot is restored through the normal path.
            0,
            0,                                 // …and so is the box height, for the same reason
            crate::perspective::IDENTITY_QUAD, // …and so is the corner quad
            font_size,
            r,
            g,
            b,
            bold,
            x,
            y,
            rotation_deg,
            background_kind,
            bg_r,
            bg_g,
            bg_b,
            bg_a,
            bg_padding,
            bg_corner_radius,
            bg_tail,
            false,
            false,
            0,
            0,
            0,
            0,
            0,
            0,
            0, // shadow off; set via set_text_shadow
        );
        match self.hist.redo_stack.get_mut(snap_idx) {
            None => false,
            Some(snap) => {
                let a = snap.active;
                match snap.layers.get_mut(a) {
                    Some(layer) => {
                        layer.text_annotations.push(ann);
                        true
                    }
                    None => false,
                }
            }
        }
    }
}

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

use crate::Layer;

pub const MAX_HISTORY: usize = 50;

pub struct Snapshot {
    pub label: String,
    /// Full layer stack at the time of the snapshot, bottom → top.
    pub layers: Vec<Layer>,
    /// Active layer index within `layers`.
    pub active: usize,
    pub width: u32,
    pub height: u32,
}

pub struct History {
    pub undo_stack: VecDeque<Snapshot>,
    pub redo_stack: Vec<Snapshot>,
}

impl History {
    pub fn new() -> Self {
        Self {
            undo_stack: VecDeque::new(),
            redo_stack: Vec::new(),
        }
    }

    /// Push a pre-built snapshot onto the undo stack. Clears the redo stack.
    pub fn push(&mut self, snap: Snapshot) {
        self.undo_stack.push_back(snap);
        if self.undo_stack.len() > MAX_HISTORY {
            self.undo_stack.pop_front();
        }
        self.redo_stack.clear();
    }

    /// Undo: pops the most recent undo snapshot and returns it for the caller
    /// to restore. `current` is the live state; it is pushed onto the redo
    /// stack (re-labelled with the popped snapshot's label so the History panel
    /// reads naturally). Returns `None` when there is nothing to undo.
    pub fn undo(&mut self, current: Snapshot) -> Option<Snapshot> {
        if let Some(snap) = self.undo_stack.pop_back() {
            let mut cur = current;
            cur.label = snap.label.clone();
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

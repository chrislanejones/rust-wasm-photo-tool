/// Undo / redo history system.
///
/// Each snapshot stores a full copy of the pixel buffer + dimensions + the
/// list of live text annotations at the time of the snapshot + a label.
/// Storing dimensions is necessary because some operations (crop, resize,
/// rotate) change the canvas size — without restoring width/height, undo
/// would put the wrong dimensions back and corrupt the display.
///
/// Storing annotations is necessary because text annotations are a
/// non-destructive overlay; undoing a "Brightness" step shouldn't lose
/// whatever text boxes are currently active, and undoing an "Add Text" step
/// must remove the annotation that step introduced.

use crate::TextAnnotation;

pub const MAX_HISTORY: usize = 50;

pub struct Snapshot {
    pub label: String,
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub annotations: Vec<TextAnnotation>,
}

pub struct History {
    pub undo_stack: Vec<Snapshot>,
    pub redo_stack: Vec<Snapshot>,
}

impl History {
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    /// Push current pixel data + dimensions + annotation list as an undo
    /// snapshot. Clears redo stack.
    pub fn push_snapshot(
        &mut self,
        label: &str,
        current_data: &[u8],
        width: u32,
        height: u32,
        annotations: Vec<TextAnnotation>,
    ) {
        self.undo_stack.push(Snapshot {
            label: label.to_string(),
            data: current_data.to_vec(),
            width,
            height,
            annotations,
        });
        if self.undo_stack.len() > MAX_HISTORY {
            self.undo_stack.remove(0);
        }
        self.redo_stack.clear();
    }

    /// Undo: pops from undo stack, pushes current state to redo stack.
    /// Returns (pixel_data, width, height, annotations) to restore, or None.
    pub fn undo(
        &mut self,
        current_data: &[u8],
        current_w: u32,
        current_h: u32,
        current_annotations: Vec<TextAnnotation>,
    ) -> Option<(Vec<u8>, u32, u32, Vec<TextAnnotation>)> {
        if let Some(snap) = self.undo_stack.pop() {
            self.redo_stack.push(Snapshot {
                label: snap.label.clone(),
                data: current_data.to_vec(),
                width: current_w,
                height: current_h,
                annotations: current_annotations,
            });
            Some((snap.data, snap.width, snap.height, snap.annotations))
        } else {
            None
        }
    }

    /// Redo: pops from redo stack, pushes current state to undo stack.
    /// Returns (pixel_data, width, height, annotations) to restore, or None.
    pub fn redo(
        &mut self,
        current_data: &[u8],
        current_w: u32,
        current_h: u32,
        current_annotations: Vec<TextAnnotation>,
    ) -> Option<(Vec<u8>, u32, u32, Vec<TextAnnotation>)> {
        if let Some(snap) = self.redo_stack.pop() {
            self.undo_stack.push(Snapshot {
                label: snap.label.clone(),
                data: current_data.to_vec(),
                width: current_w,
                height: current_h,
                annotations: current_annotations,
            });
            Some((snap.data, snap.width, snap.height, snap.annotations))
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

    /// Jump to a specific history index by repeatedly undoing or redoing.
    /// Returns true if the state changed.
    pub fn jump_to(
        &mut self,
        target_index: usize,
        current_data: &mut Vec<u8>,
        current_w: &mut u32,
        current_h: &mut u32,
        current_annotations: &mut Vec<TextAnnotation>,
    ) -> bool {
        let current = self.undo_stack.len();
        if target_index == current {
            return false;
        }
        if target_index < current {
            for _ in 0..(current - target_index) {
                let anns = std::mem::take(current_annotations);
                if let Some((data, w, h, restored_anns)) =
                    self.undo(current_data, *current_w, *current_h, anns)
                {
                    *current_data = data;
                    *current_w = w;
                    *current_h = h;
                    *current_annotations = restored_anns;
                } else {
                    break;
                }
            }
        } else {
            for _ in 0..(target_index - current) {
                let anns = std::mem::take(current_annotations);
                if let Some((data, w, h, restored_anns)) =
                    self.redo(current_data, *current_w, *current_h, anns)
                {
                    *current_data = data;
                    *current_w = w;
                    *current_h = h;
                    *current_annotations = restored_anns;
                } else {
                    break;
                }
            }
        }
        true
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

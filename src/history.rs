/// Undo / redo history system.
///
/// Each snapshot stores a full copy of the pixel buffer + dimensions + a label.
/// Storing dimensions is necessary because some operations (crop, resize, rotate)
/// change the canvas size — without restoring width/height, undo would put the
/// wrong dimensions back and corrupt the display.

const MAX_HISTORY: usize = 50;

pub struct Snapshot {
    pub label: String,
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
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

    /// Push current pixel data + dimensions as an undo snapshot. Clears redo stack.
    pub fn push_snapshot(&mut self, label: &str, current_data: &[u8], width: u32, height: u32) {
        self.undo_stack.push(Snapshot {
            label: label.to_string(),
            data: current_data.to_vec(),
            width,
            height,
        });
        if self.undo_stack.len() > MAX_HISTORY {
            self.undo_stack.remove(0);
        }
        self.redo_stack.clear();
    }

    /// Undo: pops from undo stack, pushes current state to redo stack.
    /// Returns (pixel_data, width, height) to restore, or None.
    pub fn undo(&mut self, current_data: &[u8], current_w: u32, current_h: u32) -> Option<(Vec<u8>, u32, u32)> {
        if let Some(snap) = self.undo_stack.pop() {
            self.redo_stack.push(Snapshot {
                label: snap.label.clone(),
                data: current_data.to_vec(),
                width: current_w,
                height: current_h,
            });
            Some((snap.data, snap.width, snap.height))
        } else {
            None
        }
    }

    /// Redo: pops from redo stack, pushes current state to undo stack.
    /// Returns (pixel_data, width, height) to restore, or None.
    pub fn redo(&mut self, current_data: &[u8], current_w: u32, current_h: u32) -> Option<(Vec<u8>, u32, u32)> {
        if let Some(snap) = self.redo_stack.pop() {
            self.undo_stack.push(Snapshot {
                label: snap.label.clone(),
                data: current_data.to_vec(),
                width: current_w,
                height: current_h,
            });
            Some((snap.data, snap.width, snap.height))
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
    ) -> bool {
        let current = self.undo_stack.len();
        if target_index == current {
            return false;
        }
        if target_index < current {
            for _ in 0..(current - target_index) {
                if let Some((data, w, h)) = self.undo(current_data, *current_w, *current_h) {
                    *current_data = data;
                    *current_w = w;
                    *current_h = h;
                } else {
                    break;
                }
            }
        } else {
            for _ in 0..(target_index - current) {
                if let Some((data, w, h)) = self.redo(current_data, *current_w, *current_h) {
                    *current_data = data;
                    *current_w = w;
                    *current_h = h;
                } else {
                    break;
                }
            }
        }
        true
    }

    /// Delete a history entry and restore to that point.
    /// Returns (pixel_data, width, height) at that entry, or None.
    pub fn delete_entry(&mut self, index: usize) -> Option<(Vec<u8>, u32, u32)> {
        if index >= self.undo_stack.len() {
            return None;
        }
        let snap = self.undo_stack[index].data.clone();
        let w = self.undo_stack[index].width;
        let h = self.undo_stack[index].height;
        self.undo_stack.truncate(index);
        self.redo_stack.clear();
        Some((snap, w, h))
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

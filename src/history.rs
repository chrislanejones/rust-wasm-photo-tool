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
    /// Identity of the document state this snapshot holds — minted by
    /// [`History`], never by the caller, and carried THROUGH undo/redo so a
    /// state keeps one id however many times it moves between the stacks.
    ///
    /// Depth cannot do this job: after one fork "index 4" names two different
    /// documents (see [`Branch::fork_node`]), and a branch store anchored on
    /// depth would graft a branch onto whichever one is there, silently.
    ///
    /// `0` is the document as it was loaded. Minted whether or not history
    /// forks are on, so turning the Beta on mid-session anchors correctly.
    pub node: u64,
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

/// Ceiling on how many abandoned timelines the store keeps. The byte budget is
/// the real bound; this stops a long session of small edits from turning the
/// panel into a scroll of one-step forks nobody reads.
pub const MAX_BRANCHES: usize = 12;

/// One abandoned forward path: the redo tail that an edit made after an undo
/// used to drop (Beta "history forks", ADR-086). Only ever built while
/// [`History::forks`] is on.
///
/// `fork_node` names the state it hangs off, `steps` are the states along it
/// oldest first (`steps.last()` is the tip), and [`History::take_branch`]
/// grafts it back onto the live timeline, archiving whatever it displaces as
/// a branch of its own, so travel goes both ways.
pub struct Branch {
    /// Stable id for the UI. Never reused within a session.
    pub id: u32,
    /// The tip's label: the last thing done on that timeline.
    pub label: String,
    /// The [`Snapshot::node`] this branch forks from — NOT a depth. It may be
    /// on the live timeline or inside ANOTHER branch's steps (the DAG case,
    /// which `take_branch` walks). A fork in neither is pruned.
    pub fork_node: u64,
    /// The states along this timeline, oldest first.
    pub steps: Vec<Snapshot>,
}

impl Branch {
    /// Heap bytes held, counted exactly as an undo step is — the two share
    /// one budget, so they share one definition of "big".
    pub fn bytes(&self) -> usize {
        self.steps.iter().map(|s| s.bytes()).sum()
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
    /// Moves on EVERY change to the history — push, undo, redo, delete, clear.
    /// Undo depth is not a substitute: undo followed by a new edit lands on the
    /// same depth with different pixels. Anything that holds a copy of the
    /// document across calls (the Levels preview) compares this before writing
    /// the copy back. Never persisted; it only has to be monotonic per session.
    pub generation: u64,
    /// Beta "history forks" (ADR-086). OFF by default, and OFF is master's
    /// behavior exactly: an edit after an undo clears the redo stack. ON, that
    /// tail is archived as a [`Branch`] instead. Set from JS at engine init
    /// and on toggle (`set_history_forks`).
    pub forks: bool,
    /// Abandoned forward paths, oldest first — the order IS the age, which
    /// eviction (oldest out) and the panel (newest first) both read. Always
    /// empty while `forks` is off.
    pub branches: Vec<Branch>,
    /// Source of [`Snapshot::node`] ids. Monotonic, never reused, never
    /// persisted.
    next_node: u64,
    /// The node id of the LIVE document — the one state no snapshot holds.
    /// Undo/redo hand it back and forth with the stacks.
    current_node: u64,
    /// Source of [`Branch::id`]s. Starts at 1 so 0 is never a valid branch.
    next_branch_id: u32,
}

impl History {
    pub fn new() -> Self {
        Self {
            undo_stack: VecDeque::new(),
            redo_stack: Vec::new(),
            max_history: settings::DEFAULT_MAX_HISTORY,
            max_bytes: settings::DEFAULT_MAX_HISTORY_BYTES,
            generation: 0,
            forks: false,
            branches: Vec::new(),
            next_node: 1,
            current_node: 0,
            next_branch_id: 1,
        }
    }

    /// Update the undo depth at runtime (clamped to the allowed range) and trim
    /// the oldest snapshots immediately if the new cap is lower.
    pub fn set_max_history(&mut self, n: usize) {
        self.max_history = settings::clamp_max_history(n);
        self.trim();
    }

    /// Push a pre-built snapshot onto the undo stack. Clears the redo stack —
    /// or, with history forks on, archives it as a [`Branch`] first.
    pub fn push(&mut self, mut snap: Snapshot) {
        self.generation += 1;
        // Archive FIRST: the tail forks from the state this snapshot holds,
        // which is still the live node until the two lines below move it on.
        if self.forks {
            self.abandon_redo_tail();
        }
        snap.node = self.current_node;
        self.current_node = self.mint_node();
        self.undo_stack.push_back(snap);
        self.trim();
        self.redo_stack.clear();
    }

    /// Push a snapshot WITHOUT clearing the redo stack — used by the clone-stamp
    /// stroke path, which pushes its pre-stroke snapshot directly. Enforces the
    /// same count + byte limits as [`push`](Self::push).
    pub fn push_stroke(&mut self, mut snap: Snapshot) {
        self.generation += 1;
        snap.node = self.current_node;
        self.current_node = self.mint_node();
        self.undo_stack.push_back(snap);
        self.trim();
    }

    /// Mint the next node id. The one place `next_node` moves.
    pub fn mint_node(&mut self) -> u64 {
        let n = self.next_node;
        self.next_node += 1;
        n
    }

    /// The live document's node id.
    pub fn current_node(&self) -> u64 {
        self.current_node
    }

    /// Turn history forks on or off. Turning them OFF forgets every branch,
    /// so the memory is given back and nothing the user can no longer reach
    /// stays held.
    pub fn set_forks(&mut self, on: bool) {
        self.forks = on;
        if !on && !self.branches.is_empty() {
            self.branches.clear();
            self.generation += 1;
        }
    }

    /// Leave the redo stack empty. With forks off that is a plain clear —
    /// master's behavior; with them on the tail becomes a [`Branch`] hanging
    /// off the live state.
    ///
    /// Public because the clone-stamp stroke path clears the redo stack at
    /// stroke START (`StampState::begin_stroke`), and a fork it dropped
    /// silently would be the one hole in "nothing is thrown away".
    pub fn abandon_redo_tail(&mut self) {
        if !self.forks {
            self.redo_stack.clear();
            return;
        }
        if self.redo_stack.is_empty() {
            return;
        }
        // `redo_stack` is top-is-next; the branch wants forward order.
        let steps: Vec<Snapshot> = self.redo_stack.drain(..).rev().collect();
        let fork = self.current_node;
        self.archive_branch(fork, steps);
    }

    /// Record `steps` as a branch forking at `fork_node`. Callers hand over
    /// snapshots they are done with — nothing is cloned.
    fn archive_branch(&mut self, fork_node: u64, steps: Vec<Snapshot>) {
        let Some(tip) = steps.last() else {
            return;
        };
        let label = tip.label.clone();
        let id = self.next_branch_id;
        self.next_branch_id += 1;
        self.branches.push(Branch {
            id,
            label,
            fork_node,
            steps,
        });
    }

    /// Total bytes currently held by the undo stack.
    fn undo_bytes(&self) -> usize {
        self.undo_stack.iter().map(|s| s.bytes()).sum()
    }

    /// Evict oldest snapshots until the undo stack is within BOTH the step cap
    /// (`max_history`) and the byte budget (`max_bytes`). Always keeps at least
    /// one snapshot, so undo still works even when a single snapshot is larger
    /// than the whole budget.
    ///
    /// Branches share that same byte budget and are evicted FIRST, oldest
    /// first, before a single undo step goes. So total memory is bounded by
    /// `max_bytes` exactly as before, and undo depth is never shorter because
    /// a branch was kept. With forks off the branch store is empty and this
    /// is master's trim, step for step.
    fn trim(&mut self) {
        while self.undo_stack.len() > self.max_history {
            self.undo_stack.pop_front();
        }
        let mut total = self.undo_bytes();
        if !self.branches.is_empty() {
            let mut branch_total: usize = self.branches.iter().map(|b| b.bytes()).sum();
            while !self.branches.is_empty()
                && (self.branches.len() > MAX_BRANCHES || total + branch_total > self.max_bytes)
            {
                let dropped = self.branches.remove(0);
                branch_total -= dropped.bytes();
            }
        }
        while self.undo_stack.len() > 1 && total > self.max_bytes {
            if let Some(s) = self.undo_stack.pop_front() {
                total -= s.bytes();
            }
        }
        // Both evictions delete nodes, which can orphan a branch whose fork
        // was one of them.
        self.prune_branches();
    }

    /// Every node id on the LIVE timeline: undo stack, live state, redo tail.
    fn timeline_nodes(&self) -> Vec<u64> {
        let mut nodes: Vec<u64> = self.undo_stack.iter().map(|s| s.node).collect();
        nodes.push(self.current_node);
        nodes.extend(self.redo_stack.iter().map(|s| s.node));
        nodes
    }

    /// Where `node` sits on the live timeline, counted forward from the oldest
    /// undo entry (`0`) through the live state (`undo_stack.len()`) and on
    /// into the redo tail. `None` when it is not on this timeline.
    fn timeline_index(&self, node: u64) -> Option<usize> {
        if let Some(i) = self.undo_stack.iter().position(|s| s.node == node) {
            return Some(i);
        }
        if self.current_node == node {
            return Some(self.undo_stack.len());
        }
        // `redo_stack` is top-is-next: element `i` of `len` is `len - i`
        // steps ahead of live.
        let len = self.redo_stack.len();
        self.redo_stack
            .iter()
            .position(|s| s.node == node)
            .map(|i| self.undo_stack.len() + (len - i))
    }

    /// True when `node` is a state on the live timeline.
    pub fn on_timeline(&self, node: u64) -> bool {
        self.timeline_index(node).is_some()
    }

    /// Drop branches whose fork state no longer exists anywhere. Run to a
    /// fixpoint: dropping one can orphan another that forked from inside it.
    fn prune_branches(&mut self) {
        while !self.branches.is_empty() {
            let mut alive = self.timeline_nodes();
            for b in &self.branches {
                alive.extend(b.steps.iter().map(|s| s.node));
            }
            let before = self.branches.len();
            self.branches.retain(|b| alive.contains(&b.fork_node));
            if self.branches.len() == before {
                return;
            }
        }
    }

    /// Undo: pops the most recent undo snapshot and returns it for the caller
    /// to restore. `current` is the live state; it is pushed onto the redo
    /// stack (re-labeled with the popped snapshot's label so the History panel
    /// reads naturally). Returns `None` when there is nothing to undo.
    pub fn undo(&mut self, current: Snapshot) -> Option<Snapshot> {
        if let Some(snap) = self.undo_stack.pop_back() {
            self.generation += 1;
            let mut cur = current;
            cur.label = snap.label.clone();
            // The redo entry stands in for the step being undone, so it keeps
            // the step's kind too — a selection-only step must redo through
            // the selection-only (log-transparent) path.
            cur.selection_only = snap.selection_only;
            // Identity travels WITH the state: the live document becomes a
            // redo entry and keeps its node; the popped snapshot's node
            // becomes the live one.
            cur.node = self.current_node;
            self.current_node = snap.node;
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
            self.generation += 1;
            let mut cur = current;
            cur.label = snap.label.clone();
            // Mirror of `undo` — the undo entry keeps the redone step's kind.
            cur.selection_only = snap.selection_only;
            cur.node = self.current_node;
            self.current_node = snap.node;
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

    /// Serialize history labels as "type:label|type:label|…" for the JS side.
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
        self.generation += 1;
        // With forks on, the tail this deletion abandons is kept like any
        // other fork. Off, this is the plain clear it always was.
        if self.forks {
            self.abandon_redo_tail();
        }
        self.undo_stack.remove(index);
        self.redo_stack.clear();
        self.prune_branches();
        true
    }

    pub fn clear(&mut self) {
        self.generation += 1;
        self.undo_stack.clear();
        self.redo_stack.clear();
        // Clear means clear: a branch off a history that no longer exists is
        // a row that cannot be taken.
        self.branches.clear();
    }

    /// Number of branches currently held.
    pub fn branch_count(&self) -> usize {
        self.branches.len()
    }

    /// Restore an abandoned timeline, landing on its TIP.
    ///
    /// `current` is the caller's snapshot of the live document; the returned
    /// snapshot is the new live document, for the caller to restore. `None`
    /// means the branch is gone or unreachable, and NOTHING changed.
    ///
    /// Splices the branch onto the timeline at its fork and archives whatever
    /// that displaces as a new branch, so taking a branch is reversible by
    /// taking the one it creates. Snapshots are moved, never cloned.
    pub fn take_branch(&mut self, id: u32, current: Snapshot) -> Option<Snapshot> {
        self.take_branch_inner(id, current, 0)
    }

    fn take_branch_inner(&mut self, id: u32, current: Snapshot, depth: usize) -> Option<Snapshot> {
        // Each level materializes (and removes) one branch, so the store's
        // length bounds the walk; this guards a malformed store only.
        if depth > self.branches.len() {
            return None;
        }
        let pos = self.branches.iter().position(|b| b.id == id)?;
        let fork = self.branches[pos].fork_node;

        // ── The DAG walk ──
        // A branch may fork from a state inside ANOTHER branch. Splicing needs
        // the fork on the live timeline, so take the parent first. Resolved
        // before anything moves: a miss here leaves the store untouched.
        let mut live = current;
        if !self.on_timeline(fork) {
            let parent = self
                .branches
                .iter()
                .find(|b| b.id != id && b.steps.iter().any(|s| s.node == fork))
                .map(|b| b.id)?;
            live = self.take_branch_inner(parent, live, depth + 1)?;
        }

        // From here on every exit must hand back the state we are actually
        // in: the recursion above may ALREADY have moved the document to the
        // parent's tip, and `None` would leave the caller holding a live
        // document the stacks no longer describe.
        let Some(pos) = self.branches.iter().position(|b| b.id == id) else {
            // The parent's restore had to trim and this branch fell off the
            // budget. We stand on the parent's tip, and the stacks say so.
            return Some(live);
        };
        let fork_node = self.branches[pos].fork_node;
        // `live` is the document, so its id is the live one.
        live.node = self.current_node;
        // …and it takes the label of the entry below it, exactly as `undo`
        // relabels the live state when it joins a stack — otherwise the way
        // back is archived under the caller's "Current State" placeholder.
        if let Some(below) = self.undo_stack.back() {
            live.label = below.label.clone();
        }
        let Some(at) = self.timeline_index(fork_node) else {
            return Some(live);
        };
        let branch = self.branches.remove(pos);

        // Flatten the live timeline into one forward-ordered vec, by moves.
        let mut timeline: Vec<Snapshot> = self.undo_stack.drain(..).collect();
        timeline.push(live);
        while let Some(s) = self.redo_stack.pop() {
            timeline.push(s);
        }

        // Split at the fork: everything past it is the timeline we are
        // leaving, archived so the trip is reversible; the branch takes its
        // place.
        let abandoned: Vec<Snapshot> = timeline.split_off(at + 1);
        self.archive_branch(fork_node, abandoned);
        timeline.extend(branch.steps);

        // Land on the tip. `timeline[..=at]` survived the split, so there is
        // at least the fork state itself.
        let tip = timeline.pop()?;
        self.current_node = tip.node;
        self.undo_stack = VecDeque::from(timeline);
        self.generation += 1;
        self.trim();
        Some(tip)
    }

    /// Forget one branch. `true` when it existed.
    pub fn delete_branch(&mut self, id: u32) -> bool {
        let Some(pos) = self.branches.iter().position(|b| b.id == id) else {
            return false;
        };
        self.branches.remove(pos);
        self.generation += 1;
        // Deleting a branch can orphan one that forked from inside it.
        self.prune_branches();
        true
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
    // ── Beta: history forks (ADR-086) ───────────────────────────────────────

    /// Turn history forks on or off for this engine. Default OFF, which is
    /// the old behavior exactly. Turning it off forgets every held branch.
    pub fn set_history_forks(&mut self, on: bool) {
        self.hist.set_forks(on);
    }

    /// Is the switch on?
    pub fn history_forks(&self) -> bool {
        self.hist.forks
    }

    /// How many abandoned timelines are held right now.
    pub fn history_branch_count(&self) -> usize {
        self.hist.branch_count()
    }

    /// The branch list for the History panel, newest first:
    /// `[{"id":3,"label":"Crop","steps":4,"bytes":50331648,"nested":false}]`.
    ///
    /// Hand-built JSON like `layers_json`. `nested` is true when the branch
    /// forks off a state inside another branch (taking it takes that parent
    /// first). `"[]"` with no work at all when nothing is held — which is
    /// always, with the Beta off — because this rides on every
    /// `capture_ui_state()`.
    pub fn history_branches_json(&self) -> String {
        if self.hist.branches.is_empty() {
            return String::from("[]");
        }
        let mut parts: Vec<String> = Vec::with_capacity(self.hist.branches.len());
        for b in self.hist.branches.iter().rev() {
            parts.push(format!(
                r#"{{"id":{},"label":"{}","steps":{},"bytes":{},"nested":{}}}"#,
                b.id,
                crate::utils::json_escape(&b.label),
                b.steps.len(),
                b.bytes(),
                !self.hist.on_timeline(b.fork_node)
            ));
        }
        format!("[{}]", parts.join(","))
    }

    /// Travel to an abandoned timeline, landing on its tip. `false` when the
    /// branch is gone, and then nothing moved.
    ///
    /// A snapshot restore, so — exactly like snapshot undo — it marks a live
    /// op log stale: an append-only log cannot describe a jump between
    /// timelines.
    pub fn restore_history_branch(&mut self, id: u32) -> bool {
        let current = self.make_snapshot("Current State");
        match self.hist.take_branch(id, current) {
            Some(snap) => {
                self.restore_snapshot(snap);
                true
            }
            None => false,
        }
    }

    /// Forget one branch. `false` when it was already gone.
    pub fn delete_history_branch(&mut self, id: u32) -> bool {
        self.hist.delete_branch(id)
    }

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
        self.hist.generation += 1;
        // Injected states are states: they get an id like any other.
        let node = self.hist.mint_node();
        self.hist.undo_stack.push_back(Snapshot {
            node,
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
        self.hist.generation += 1;
        let node = self.hist.mint_node();
        self.hist.redo_stack.push(Snapshot {
            node,
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
        font_id: &str,
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
            font_id,
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
        font_id: &str,
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
            font_id,
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

// ── The branch store's arithmetic (Beta history forks, ADR-086) ─────────────
//
// Engine-level behavior lives in `tests/history_branches.rs`; what is here
// needs a budget small enough to overflow on purpose.
#[cfg(test)]
mod branch_budget_tests {
    use super::*;

    /// A snapshot holding `px` bytes of pixels, and nothing else that costs.
    fn snap(label: &str, px: usize) -> Snapshot {
        Snapshot {
            node: 0,
            label: label.to_string(),
            layers: vec![Layer::from_snapshot_pixels(
                &vec![0u8; px],
                px as u32 / 4,
                1,
            )],
            active: 0,
            width: px as u32 / 4,
            height: 1,
            selection: None,
            selection_only: false,
            export_quality: 75,
        }
    }

    /// Wind a history forward `n` steps, then back `back` of them.
    fn wound(forks: bool, n: usize, back: usize, px: usize) -> History {
        let mut h = History::new();
        h.set_forks(forks);
        for i in 0..n {
            h.push(snap(&format!("step {i}"), px));
        }
        for _ in 0..back {
            h.undo(snap("live", px));
        }
        h
    }

    #[test]
    fn forks_are_off_by_default() {
        assert!(!History::new().forks, "the Beta starts OFF");
    }

    #[test]
    fn with_forks_off_an_edit_after_undo_clears_redo_and_keeps_no_branch() {
        let px = 1024;
        let mut h = wound(false, 6, 3, px);
        assert_eq!(h.redo_count(), 3);
        let depth_before = h.undo_count();
        h.push(snap("the edit", px));

        assert_eq!(h.branch_count(), 0, "OFF: nothing is archived");
        assert_eq!(h.redo_count(), 0, "OFF: redo is cleared, as on master");
        assert_eq!(h.undo_count(), depth_before + 1);
        assert_eq!(
            h.labels(),
            "undo:step 0|undo:step 1|undo:step 2|undo:the edit|current:Current State"
        );
    }

    #[test]
    fn with_forks_off_delete_entry_clears_redo_and_keeps_no_branch() {
        let px = 256;
        let mut h = wound(false, 4, 2, px);
        assert!(h.delete_entry(0));
        assert_eq!(h.redo_count(), 0);
        assert_eq!(h.branch_count(), 0);
    }

    #[test]
    fn a_fork_costs_the_undo_stack_nothing() {
        let px = 1024;
        let mut h = wound(true, 6, 3, px);
        let depth_before = h.undo_count();
        h.push(snap("the fork", px));

        assert_eq!(h.branch_count(), 1, "the abandoned tail is archived");
        assert_eq!(h.redo_count(), 0, "and the redo stack is still empty");
        assert_eq!(
            h.undo_count(),
            depth_before + 1,
            "the undo stack grew by exactly the one step pushed"
        );
    }

    #[test]
    fn branches_are_evicted_before_undo_steps() {
        let px = 4096;
        let mut h = wound(true, 6, 3, px);
        // Room for the undo stack after the push (4 steps) and nothing more.
        h.max_bytes = px * 4;
        h.push(snap("the fork", px));

        assert_eq!(h.branch_count(), 0, "the branch does not fit, so it goes");
        assert_eq!(
            h.undo_count(),
            4,
            "and the undo stack keeps every step it would have kept without it"
        );
    }

    #[test]
    fn a_branch_that_fits_beside_the_undo_stack_is_kept() {
        // The other half of the eviction rule: the budget is SHARED, not
        // zero. 4 undo steps + a 3-step branch = 7 copies fit in 7.
        let px = 4096;
        let mut h = wound(true, 6, 3, px);
        h.max_bytes = px * 7;
        h.push(snap("the fork", px));
        assert_eq!(h.branch_count(), 1);
        assert_eq!(h.undo_count(), 4);
    }

    #[test]
    fn the_store_is_capped_at_max_branches() {
        let px = 256;
        let mut h = History::new();
        h.set_forks(true);
        for i in 0..(MAX_BRANCHES + 4) {
            // Each round: two steps forward, one back, one edit — one fork.
            h.push(snap(&format!("a{i}"), px));
            h.push(snap(&format!("b{i}"), px));
            h.undo(snap("live", px));
            h.push(snap(&format!("fork {i}"), px));
        }
        assert_eq!(h.branch_count(), MAX_BRANCHES, "oldest forks fall off");
    }

    #[test]
    fn a_branch_whose_fork_was_trimmed_away_is_dropped() {
        let px = 256;
        let mut h = wound(true, 4, 2, px);
        h.push(snap("the fork", px));
        assert_eq!(h.branch_count(), 1);

        // Squeeze the depth cap until the fork's own state is evicted off the
        // front (set directly — `set_max_history` clamps to the slider range).
        h.max_history = 1;
        h.push(snap("after", px));
        assert_eq!(h.undo_count(), 1);
        assert_eq!(h.branch_count(), 0, "unreachable branches are pruned");
    }

    #[test]
    fn taking_a_branch_that_is_not_there_changes_nothing() {
        let px = 256;
        let mut h = wound(true, 3, 1, px);
        h.push(snap("the fork", px));
        let depth = h.undo_count();

        assert!(h.take_branch(9999, snap("live", px)).is_none());
        assert_eq!(h.undo_count(), depth);
        assert_eq!(h.branch_count(), 1, "and the real branch is still there");
    }

    #[test]
    fn turning_forks_off_forgets_every_branch() {
        let px = 256;
        let mut h = wound(true, 3, 2, px);
        h.push(snap("the fork", px));
        assert_eq!(h.branch_count(), 1);
        h.set_forks(false);
        assert_eq!(h.branch_count(), 0);
        assert!(!h.forks);
    }
}

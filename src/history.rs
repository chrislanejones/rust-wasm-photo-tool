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
    /// Identity of the document state this snapshot holds — minted by
    /// [`History`], never by the caller, and carried THROUGH undo/redo so a
    /// state keeps one id however many times it moves between the stacks.
    ///
    /// Depth cannot do this job: after one fork "index 4" names two different
    /// documents (see [`Branch::fork_node`]), which is exactly the bug a
    /// branch store anchored on depth would ship.
    ///
    /// `0` is the document as it was loaded. Every other value comes from
    /// [`History::mint_node`] — `make_snapshot` stamps the live id on the
    /// copy it builds, `push` and `push_stroke` mint the next one for the
    /// state the edit creates, and the two `inject_*_snapshot` restore paths
    /// mint their own. No caller invents one.
    pub node: u64,
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

/// Ceiling on how many abandoned timelines the store keeps. The byte budget
/// below is the real bound — this is here so a long session of small edits
/// cannot turn the Time Machine list into a scroll of hundreds of one-step
/// forks nobody reads.
pub const MAX_BRANCHES: usize = 12;

/// One abandoned forward path — the redo tail that an edit made after an undo
/// used to drop on the floor (ADR-065).
///
/// A branch is re-enterable, which is the whole point: `fork_node` names the
/// document state it hangs off, `steps` are the states along it in forward
/// order (`steps[0]` one step past the fork, `steps.last()` the tip), and
/// [`History::take_branch`] grafts the whole thing back onto the live timeline
/// — archiving whatever it displaces as a branch of its own, so the move is
/// itself undoable by taking the branch it just made.
pub struct Branch {
    /// Stable id for the UI to name this branch by. Never reused.
    pub id: u32,
    /// The tip's label — the last thing the user did on this timeline, which
    /// is what makes a row recognisable ("Crop", "Blur") in the panel.
    pub label: String,
    /// The [`Snapshot::node`] this branch forks from. NOT a depth: the whole
    /// reason nodes exist is that depth 4 means two different documents once
    /// a second branch is made, and a store anchored on depth would silently
    /// graft a branch onto the wrong state.
    ///
    /// The fork may live on the live timeline or inside ANOTHER branch's
    /// steps — that second case is what makes this a DAG rather than a fan,
    /// and `take_branch` walks it. A fork that is in neither is unreachable
    /// and the branch is pruned ([`History::prune_branches`]).
    pub fork_node: u64,
    /// The states along this timeline, oldest first.
    pub steps: Vec<Snapshot>,
}

impl Branch {
    /// Heap bytes this branch holds, counted exactly as [`Snapshot::bytes`]
    /// counts an undo step — the two share one budget, so they must share one
    /// definition of "big".
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
    /// Abandoned forward paths, oldest first — the store's ORDER is its age, which
    /// is what eviction (oldest out) and the panel (newest at the top) both read
    /// instead of a timestamp nobody else needs (ADR-065). Empty until the user
    /// undoes and then edits; bounded by [`MAX_BRANCHES`] and by `max_bytes`,
    /// which branches share with the undo stack and always lose.
    pub branches: Vec<Branch>,
    /// Source of [`Snapshot::node`] ids. Monotonic, never reused, never
    /// persisted — identity only has to hold within a session, the same
    /// contract `generation` has.
    next_node: u64,
    /// The node id of the LIVE document — the one state no snapshot holds.
    /// Undo/redo hand this back and forth with the stacks so the live state
    /// keeps its identity across history moves.
    current_node: u64,
    /// Source of [`Branch::id`]s. Starts at 1 so 0 is never a valid branch.
    next_branch_id: u32,
    /// Moves on EVERY change to the history — push, undo, redo, delete, clear.
    /// Undo depth is not a substitute: undo followed by a new edit lands on the
    /// same depth with different pixels. Anything that holds a copy of the
    /// document across calls (the Levels preview) compares this before writing
    /// the copy back. Never persisted; it only has to be monotonic per session.
    pub generation: u64,
}

impl History {
    pub fn new() -> Self {
        Self {
            undo_stack: VecDeque::new(),
            redo_stack: Vec::new(),
            max_history: settings::DEFAULT_MAX_HISTORY,
            max_bytes: settings::DEFAULT_MAX_HISTORY_BYTES,
            branches: Vec::new(),
            next_node: 1,
            current_node: 0,
            next_branch_id: 1,
            generation: 0,
        }
    }

    /// Update the undo depth at runtime (clamped to the allowed range) and trim
    /// the oldest snapshots immediately if the new cap is lower.
    pub fn set_max_history(&mut self, n: usize) {
        self.max_history = settings::clamp_max_history(n);
        self.trim();
    }

    /// Push a pre-built snapshot onto the undo stack.
    ///
    /// The redo stack is not cleared so much as **moved**: editing after an
    /// undo forks the history, and the tail that fork abandons is archived as
    /// a [`Branch`] instead of being dropped (ADR-065). That is the only
    /// behavioural change here — the undo stack, its caps and the order of its
    /// eviction are exactly what they were, because branches are evicted
    /// before undo steps and never in place of them.
    pub fn push(&mut self, mut snap: Snapshot) {
        self.generation += 1;
        // Archive FIRST: the tail forks from the state this snapshot holds,
        // which is still the live node until the two lines below move it on.
        self.abandon_redo_tail();
        snap.node = self.current_node;
        self.current_node = self.mint_node();
        self.undo_stack.push_back(snap);
        self.trim();
        // `abandon_redo_tail` drained it; this is the belt to that braces, and
        // keeps the "push clears redo" contract true by inspection.
        self.redo_stack.clear();
    }

    /// Mint the next node id. The one place `next_node` moves.
    pub fn mint_node(&mut self) -> u64 {
        let n = self.next_node;
        self.next_node += 1;
        n
    }

    /// The live document's node id — what a freshly built `Snapshot` is given
    /// when it reaches a stack.
    pub fn current_node(&self) -> u64 {
        self.current_node
    }

    /// Move the redo tail into a [`Branch`] hanging off the live state, and
    /// leave the redo stack empty. A no-op when there is no tail.
    ///
    /// Public because the clone-stamp stroke path clears the redo stack
    /// itself (`StampState::begin_stroke`) and a fork it dropped silently
    /// would be the one hole in "nothing is thrown away".
    pub fn abandon_redo_tail(&mut self) {
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
        if steps.is_empty() {
            return;
        }
        let label = steps
            .last()
            .map(|s| s.label.clone())
            .unwrap_or_else(|| "Branch".to_string());
        let id = self.next_branch_id;
        self.next_branch_id += 1;
        self.branches.push(Branch {
            id,
            label,
            fork_node,
            steps,
        });
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
        // ── Branches are evicted BEFORE undo steps, always ──
        //
        // They share the undo stack's byte budget rather than getting one of
        // their own, and they lose every tie. That is what makes the Time
        // Machine free: total memory is bounded by `max_bytes` exactly as it
        // was before branches existed, undo depth is never shorter because a
        // branch was kept, and the status bar's "Undo NN%" estimate (ADR-052,
        // which divides this same budget by one whole-image copy) stays true.
        //
        // The cost lands where it should: on a 24 MP photo, where one step is
        // ~192 MB, there is no slack and a fork does not survive its own
        // creation. On the small documents where branching is actually usable,
        // there is room for several.
        let mut undo_total = self.undo_bytes();
        let mut branch_total = self.branch_bytes();
        while !self.branches.is_empty()
            && (self.branches.len() > MAX_BRANCHES || undo_total + branch_total > self.max_bytes)
        {
            let dropped = self.branches.remove(0);
            branch_total -= dropped.bytes();
        }
        while self.undo_stack.len() > 1 && undo_total > self.max_bytes {
            if let Some(s) = self.undo_stack.pop_front() {
                undo_total -= s.bytes();
            }
        }
        // Front eviction and branch eviction both delete nodes, which can
        // orphan a branch whose fork was one of them.
        self.prune_branches();
    }

    /// Total bytes held by the branch store.
    fn branch_bytes(&self) -> usize {
        self.branches.iter().map(|b| b.bytes()).sum()
    }

    /// Every node id currently on the LIVE timeline — undo stack, live state,
    /// redo tail.
    fn timeline_nodes(&self) -> Vec<u64> {
        let mut nodes: Vec<u64> = self.undo_stack.iter().map(|s| s.node).collect();
        nodes.push(self.current_node);
        nodes.extend(self.redo_stack.iter().map(|s| s.node));
        nodes
    }

    /// Where `node` sits on the live timeline, counted forward from the
    /// oldest undo entry (`0`) through the live state (`undo_stack.len()`)
    /// and on into the redo tail. `None` when it is not on this timeline.
    ///
    /// Computed from the stacks in place, deliberately: `take_branch` needs
    /// this index BEFORE it flattens them, so that a miss cannot leave the
    /// history half-taken apart.
    fn timeline_index(&self, node: u64) -> Option<usize> {
        if let Some(i) = self.undo_stack.iter().position(|s| s.node == node) {
            return Some(i);
        }
        if self.current_node == node {
            return Some(self.undo_stack.len());
        }
        // `redo_stack` is top-is-next, so forward order is reverse index
        // order: element `i` of `len` is `len - i` steps ahead of live.
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

    /// Drop branches whose fork state no longer exists anywhere — trimmed off
    /// the front of the undo stack, or evicted with the branch that held it.
    ///
    /// Run to a fixpoint: dropping a branch can orphan another that forked
    /// from a state inside it, and one pass would leave that one pointing at
    /// nothing.
    fn prune_branches(&mut self) {
        loop {
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
            // redo entry and keeps its node, the popped snapshot becomes the
            // live document and its node becomes the live one. Minting a
            // fresh id here instead would break every branch anchored above
            // this point the moment the user undid past it.
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
        // The tail this deletion abandons is a fork like any other — keep it
        // rather than let an explicit delete take unrelated states with it.
        self.abandon_redo_tail();
        self.undo_stack.remove(index);
        self.prune_branches();
        true
    }

    pub fn clear(&mut self) {
        self.generation += 1;
        self.undo_stack.clear();
        self.redo_stack.clear();
        // Clear means clear. A Time Machine list that outlived the history it
        // branches from would be a list of rows that cannot be taken.
        self.branches.clear();
    }

    /// Number of branches currently held.
    pub fn branch_count(&self) -> usize {
        self.branches.len()
    }

    /// Restore an abandoned timeline, landing on its TIP — the state the user
    /// was looking at when they left it.
    ///
    /// `current` is the live document (the caller's own snapshot of it); the
    /// returned snapshot is the new live document, for the caller to restore.
    /// `None` means the branch is gone or its fork is unreachable, and
    /// NOTHING has been changed.
    ///
    /// What it does, in one sentence: splice the branch onto the timeline at
    /// its fork, and archive whatever that displaces as a new branch — so
    /// taking a branch is itself reversible by taking the branch it creates,
    /// and no state is ever lost by moving between timelines.
    pub fn take_branch(&mut self, id: u32, current: Snapshot) -> Option<Snapshot> {
        self.take_branch_inner(id, current, 0)
    }

    fn take_branch_inner(&mut self, id: u32, current: Snapshot, depth: usize) -> Option<Snapshot> {
        // Every level materialises (and removes) one branch, so the store's
        // own length bounds the walk. The guard is against a malformed store,
        // not against ordinary nesting.
        if depth > self.branches.len() {
            return None;
        }
        let pos = self.branches.iter().position(|b| b.id == id)?;
        let fork = self.branches[pos].fork_node;

        // ── The DAG walk ──
        // A branch may fork from a state inside ANOTHER branch (undo, edit,
        // undo again, edit again). Splicing needs the fork on the live
        // timeline, so materialise the parent first and come back. Resolved
        // BEFORE anything is removed: a failure here must leave the store
        // exactly as it was.
        let mut live = current;
        if !self.on_timeline(fork) {
            let parent = self
                .branches
                .iter()
                .find(|b| b.id != id && b.steps.iter().any(|s| s.node == fork))
                .map(|b| b.id)?;
            live = self.take_branch_inner(parent, live, depth + 1)?;
        }

        // Everything below must be total, because the recursion above may have
        // ALREADY moved the document to the parent's tip: from here on,
        // returning `None` would leave the caller holding a live document that
        // the stacks no longer describe. So the two lookups that could fail are
        // done first, and each failure returns the state we are actually in.
        let Some(pos) = self.branches.iter().position(|b| b.id == id) else {
            // The parent's restore had to trim, and this branch is what fell
            // off the budget. We are standing on the parent's tip and the
            // stacks say so — hand that back rather than report a failure
            // against a history that has already moved.
            return Some(live);
        };
        let fork_node = self.branches[pos].fork_node;
        // `live` is the document, so its id is the live one — set before the
        // index is taken, because the index may BE the live position.
        live.node = self.current_node;
        // …and it takes the label of the entry below it, exactly as `undo`
        // relabels the live state when it joins a stack. Without this, the
        // timeline the user is LEAVING is archived under the placeholder its
        // caller passed ("Current State"), and the way back reads as a row
        // named after nothing. Caught by the e2e, which travelled and then
        // looked at what the return row was called.
        if let Some(below) = self.undo_stack.back() {
            live.label = below.label.clone();
        }
        let at = self.timeline_index(fork_node)?;
        let branch = self.branches.remove(pos);

        // Flatten the live timeline into one forward-ordered vec. Snapshots
        // are MOVED through this, never cloned — a clone here would be a
        // second copy of every layer buffer on the stack.
        let mut timeline: Vec<Snapshot> = self.undo_stack.drain(..).collect();
        timeline.push(live);
        while let Some(s) = self.redo_stack.pop() {
            timeline.push(s);
        }

        // Split at the fork: everything past it is the timeline we are
        // leaving, which becomes a branch of its own (this is what makes the
        // travel reversible), and the branch's own steps take its place.
        let abandoned: Vec<Snapshot> = timeline.split_off(at + 1);
        self.archive_branch(fork_node, abandoned);
        timeline.extend(branch.steps);

        // Land on the tip. `pop` cannot fail: `timeline[..=at]` survived the
        // split, so there is at least the fork state itself.
        let tip = timeline.pop()?;
        self.current_node = tip.node;
        self.undo_stack = VecDeque::from(timeline);
        self.generation += 1;
        self.prune_branches();
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
    // ── History snapshot serialization (for JS-side persistence) ────────────

    // ── The Time Machine: branches of abandoned history (ADR-065) ──────────

    /// How many abandoned timelines are held right now.
    pub fn history_branch_count(&self) -> usize {
        self.hist.branch_count()
    }

    /// The branch list for the Time Machine panel, newest first.
    ///
    /// `[{"id":3,"label":"Crop","steps":4,"bytes":50331648,"nested":false}]`
    ///
    /// Hand-built JSON, like `layers_json` and the annotation lists — the JS
    /// already `JSON.parse`s those, and a serde surface here would be a second
    /// definition of a format that has exactly one consumer. `nested` is true
    /// when this branch forks from a state that is itself inside another
    /// branch: taking it materialises that parent first, which is worth
    /// telling the user before they click.
    pub fn history_branches_json(&self) -> String {
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
    /// This is a snapshot restore, so — exactly like undo through the snapshot
    /// path — it marks a live op log stale (ADR-052 §`restore_snapshot`): the
    /// log is append-only and cannot describe a jump between timelines. Undo
    /// keeps working on snapshots; undo DEPTH is what the fallback costs.
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

    /// Forget one branch — the panel's X. `false` when it was already gone.
    pub fn delete_history_branch(&mut self, id: u32) -> bool {
        self.hist.delete_branch(id)
    }

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
        // Injected states are states: they get an id like any other, so a
        // branch made later in the session can anchor to one.
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

// ── The branch store's arithmetic ───────────────────────────────────────────
//
// Engine-level branching behaviour lives in `tests/history_branches.rs`; what
// is left here is the part that needs a budget small enough to overflow on
// purpose, which no real document would let a test do quickly.
#[cfg(test)]
mod branch_budget_tests {
    use super::*;
    use crate::layer::Layer;

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
    fn wound(n: usize, back: usize, px: usize) -> History {
        let mut h = History::new();
        for i in 0..n {
            h.push(snap(&format!("step {i}"), px));
        }
        for _ in 0..back {
            let live = snap("live", px);
            h.undo(live);
        }
        h
    }

    #[test]
    fn a_fork_costs_the_undo_stack_nothing() {
        let px = 1024;
        let mut h = wound(6, 3, px);
        let depth_before = h.undo_count();
        h.push(snap("the fork", px));

        assert_eq!(h.branch_count(), 1, "the abandoned tail is archived");
        assert_eq!(
            h.undo_count(),
            depth_before + 1,
            "and the undo stack grew by exactly the one step that was pushed"
        );
    }

    #[test]
    fn branches_are_evicted_before_undo_steps() {
        let px = 4096;
        let mut h = wound(6, 3, px);
        // A budget with room for the undo stack and nothing to spare.
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
    fn the_store_is_capped_at_max_branches() {
        let px = 256;
        let mut h = History::new();
        for i in 0..(MAX_BRANCHES + 4) {
            // Each round: two steps forward, one back, one edit — one fork.
            h.push(snap(&format!("a{i}"), px));
            h.push(snap(&format!("b{i}"), px));
            let live = snap("live", px);
            h.undo(live);
            h.push(snap(&format!("fork {i}"), px));
        }
        assert_eq!(h.branch_count(), MAX_BRANCHES, "oldest forks fall off");
    }

    #[test]
    fn a_branch_whose_fork_was_trimmed_away_is_dropped() {
        let px = 256;
        let mut h = wound(4, 2, px);
        h.push(snap("the fork", px));
        assert_eq!(h.branch_count(), 1);

        // Squeeze the depth cap until the fork's own state is evicted off the
        // front of the undo stack (set directly — `set_max_history` clamps to
        // the 50..1000 the settings slider offers). A branch hanging off a
        // state nobody has any more is a row that cannot be taken.
        h.max_history = 1;
        h.push(snap("after", px));
        assert_eq!(h.undo_count(), 1);
        assert_eq!(h.branch_count(), 0, "unreachable branches are pruned");
    }

    #[test]
    fn taking_a_branch_that_is_not_there_changes_nothing() {
        let px = 256;
        let mut h = wound(3, 1, px);
        h.push(snap("the fork", px));
        let depth = h.undo_count();

        assert!(h.take_branch(9999, snap("live", px)).is_none());
        assert_eq!(h.undo_count(), depth);
        assert_eq!(h.branch_count(), 1, "and the real branch is still there");
    }
}

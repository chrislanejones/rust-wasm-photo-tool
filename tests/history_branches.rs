//! The Time Machine: editing after an undo FORKS the history instead of
//! throwing the redo tail away, and every fork stays re-enterable (ADR-065).
//!
//! The engine-level half of the feature. `src/history.rs`'s own test module
//! covers the budget arithmetic (branches are evicted before undo steps) with
//! hand-built snapshots; these go through the real tool so the wasm surface,
//! the snapshot restore and the label plumbing are exercised together.

use stamp_tool::ImageHorseTool;

const W: u32 = 8;
const H: u32 = 8;

fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    // A mid-grey document, so brightness moves it in either direction without
    // clamping at 0 or 255 and every state below is distinguishable.
    t.load_image(&vec![100u8; (W * H * 4) as usize]);
    t.recomposite();
    t
}

/// Brighten by `n` levels. `adjust_brightness` takes a -1..1 delta scaled by
/// 255, so `n / 255.0` moves every channel by exactly `n`.
fn brighten(t: &mut ImageHorseTool, n: i32) {
    t.adjust_brightness(f64::from(n) / 255.0);
}

/// The red channel of the first pixel — this document's whole identity.
fn red(t: &ImageHorseTool) -> u8 {
    t.get_image_data()[0]
}

/// `[{"id":1,…}]` → the ids, in the order the panel lists them (newest first).
fn branch_ids(t: &ImageHorseTool) -> Vec<u32> {
    let json = t.history_branches_json();
    json.split("\"id\":")
        .skip(1)
        .map(|rest| {
            rest.chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse()
                .expect("branch id is a number")
        })
        .collect()
}

fn labels(t: &ImageHorseTool) -> Vec<String> {
    let json = t.history_branches_json();
    json.split("\"label\":\"")
        .skip(1)
        .map(|rest| rest.split('"').next().unwrap_or_default().to_string())
        .collect()
}

// ── the fork ────────────────────────────────────────────────────────────────

#[test]
fn an_edit_after_an_undo_keeps_the_abandoned_tail_as_a_branch() {
    let mut t = new_tool();
    assert_eq!(t.history_branch_count(), 0, "a fresh document has no forks");

    brighten(&mut t, 10); // 110
    t.adjust_contrast(1.0); // unchanged pixels, one more step
    assert!(t.undo(), "back to 110");
    assert!(t.undo(), "back to 100");
    assert_eq!(red(&t), 100);

    // The edit that forks. Before ADR-065 the two undone steps were dropped
    // here and nothing said so.
    brighten(&mut t, 30);
    assert_eq!(red(&t), 130);
    assert_eq!(t.history_branch_count(), 1, "the abandoned tail is kept");
    assert_eq!(
        labels(&t),
        vec!["Contrast".to_string()],
        "a branch is named by its TIP — the last thing done on that timeline"
    );
    assert_eq!(t.redo_count(), 0, "the redo stack itself is still cleared");
}

#[test]
fn nothing_is_archived_when_there_was_no_tail_to_abandon() {
    let mut t = new_tool();
    brighten(&mut t, 10);
    brighten(&mut t, 10);
    assert_eq!(
        t.history_branch_count(),
        0,
        "editing at the tip of the timeline forks nothing"
    );
}

// ── travel ──────────────────────────────────────────────────────────────────

#[test]
fn taking_a_branch_lands_on_its_tip() {
    let mut t = new_tool();
    brighten(&mut t, 10); // 110
    brighten(&mut t, 5); // 115  ← the tip of the timeline we abandon
    assert!(t.undo());
    assert!(t.undo());
    brighten(&mut t, 30); // 130, on a new timeline

    let id = branch_ids(&t)[0];
    assert!(t.restore_history_branch(id), "the branch is takeable");
    assert_eq!(red(&t), 115, "we are standing on the abandoned tip");
    assert_eq!(t.undo_count(), 2, "with its steps behind us to undo");
}

#[test]
fn taking_a_branch_archives_the_timeline_it_displaced() {
    let mut t = new_tool();
    brighten(&mut t, 10);
    brighten(&mut t, 5); // 115
    assert!(t.undo());
    assert!(t.undo());
    brighten(&mut t, 30); // 130

    let first = branch_ids(&t)[0];
    assert!(t.restore_history_branch(first));
    assert_eq!(
        t.history_branch_count(),
        1,
        "the 130 timeline took the 115 timeline's place in the store"
    );
    assert_ne!(branch_ids(&t)[0], first, "and it is a NEW branch");
}

#[test]
fn travel_is_reversible_which_is_the_whole_promise() {
    let mut t = new_tool();
    brighten(&mut t, 10);
    brighten(&mut t, 5); // 115
    assert!(t.undo());
    assert!(t.undo());
    brighten(&mut t, 30); // 130
    let here = red(&t);

    let away = branch_ids(&t)[0];
    assert!(t.restore_history_branch(away));
    assert_eq!(red(&t), 115);

    let back = branch_ids(&t)[0];
    assert!(
        t.restore_history_branch(back),
        "the way back is a branch too"
    );
    assert_eq!(red(&t), here, "exactly where we left");
    assert_eq!(t.history_branch_count(), 1, "and the 115 timeline is kept");
}

#[test]
fn a_branch_that_forks_from_inside_another_branch_is_still_reachable() {
    // This is the DAG case: fork, then fork again from a state that is no
    // longer on the live timeline. A store anchored on undo DEPTH instead of
    // node identity grafts this one onto the wrong state — silently.
    let mut t = new_tool();
    brighten(&mut t, 10); // 110
    brighten(&mut t, 5); // 115   ← timeline A's tip
    assert!(t.undo()); // 110
    brighten(&mut t, 20); // 130   ← timeline B, forked at 110 (archives A)
    assert!(t.undo()); // 110
    assert!(t.undo()); // 100
    brighten(&mut t, 40); // 140   ← timeline C, forked at 100 (archives B)

    assert_eq!(t.history_branch_count(), 2, "both abandoned timelines kept");
    // A forks at the 110 state, which now lives INSIDE branch B.
    let ids = branch_ids(&t); // newest first: [B, A]
    let a = ids[1];
    assert!(
        t.history_branches_json().contains("\"nested\":true"),
        "the panel is told that one of these forks off another branch"
    );

    assert!(t.restore_history_branch(a), "the nested branch is takeable");
    assert_eq!(red(&t), 115, "and it lands on ITS tip, not on B's");
}

// ── housekeeping ────────────────────────────────────────────────────────────

#[test]
fn the_timeline_you_leave_is_named_after_its_last_edit() {
    // It used to be named "Current State" — the placeholder label
    // `restore_history_branch` builds its snapshot of the live document with.
    // A row named after nothing is a row nobody clicks.
    let mut t = new_tool();
    brighten(&mut t, 10);
    assert!(t.undo());
    t.flip_horizontal(); // the timeline we will leave, last edit "Flip H"

    let away = branch_ids(&t)[0];
    assert!(t.restore_history_branch(away));
    assert_eq!(
        labels(&t),
        vec!["Flip H".to_string()],
        "the way back is named by what was last done on it"
    );
}

#[test]
fn a_branch_can_be_deleted_and_a_missing_one_moves_nothing() {
    let mut t = new_tool();
    brighten(&mut t, 10);
    brighten(&mut t, 5);
    assert!(t.undo());
    assert!(t.undo());
    brighten(&mut t, 30);

    let id = branch_ids(&t)[0];
    assert!(t.delete_history_branch(id));
    assert_eq!(t.history_branch_count(), 0);
    assert!(
        !t.delete_history_branch(id),
        "deleting twice is not an error"
    );

    let before = red(&t);
    assert!(
        !t.restore_history_branch(id),
        "taking a branch that is gone reports failure"
    );
    assert_eq!(red(&t), before, "and leaves the document alone");
}

#[test]
fn clearing_the_history_clears_the_branches_too() {
    let mut t = new_tool();
    brighten(&mut t, 10);
    brighten(&mut t, 5);
    assert!(t.undo());
    assert!(t.undo());
    brighten(&mut t, 30);
    assert_eq!(t.history_branch_count(), 1);

    t.clear_history();
    assert_eq!(
        t.history_branch_count(),
        0,
        "rows that branch off a history that no longer exists cannot be taken"
    );
    assert_eq!(t.history_branches_json(), "[]");
}

#[test]
fn undo_and_redo_are_untouched_by_the_branch_store() {
    // The regression this feature must not become: branching changed `push`,
    // and `push` is every edit in the app.
    let mut t = new_tool();
    brighten(&mut t, 10);
    brighten(&mut t, 10);
    assert_eq!(red(&t), 120);
    assert_eq!(t.undo_count(), 2);

    assert!(t.undo());
    assert_eq!(red(&t), 110);
    assert!(t.undo());
    assert_eq!(red(&t), 100);
    assert!(!t.undo(), "nothing left to undo");

    assert!(t.redo());
    assert_eq!(red(&t), 110);
    assert!(t.redo());
    assert_eq!(red(&t), 120);
    assert!(!t.redo(), "nothing left to redo");
    assert_eq!(t.history_branch_count(), 0, "and no fork was invented");
}

#[test]
fn the_branch_list_is_json_the_panel_can_parse() {
    let mut t = new_tool();
    assert_eq!(t.history_branches_json(), "[]");

    brighten(&mut t, 10);
    t.flip_horizontal();
    assert!(t.undo());
    assert!(t.undo());
    brighten(&mut t, 30);

    let json = t.history_branches_json();
    assert!(json.starts_with('[') && json.ends_with(']'), "{json}");
    assert!(json.contains("\"label\":\"Flip H\""), "{json}");
    assert!(json.contains("\"steps\":2"), "{json}");
    assert!(json.contains("\"nested\":false"), "{json}");
    // One whole-document copy per step (this document is single-layer), and
    // the panel shows what the fork costs.
    let bytes = (W * H * 4) as usize * 2;
    assert!(json.contains(&format!("\"bytes\":{bytes}")), "{json}");
}

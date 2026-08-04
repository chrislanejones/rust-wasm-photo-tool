//! Regression suite for: "draw a square, click it again, change the colour —
//! nothing happens." Seven weeks old, reproduced on production 2026-08-03.
//!
//! The defect was entirely in the React layer (`useDrawingTools`): reselecting
//! a shape snapshots its style, that snapshot outranked the live panel, and a
//! colour-only edit never marked the edit dirty so `commitEdit` took its no-op
//! early exit. The engine call it should have been reaching —
//! `update_shape_annotation` — was already complete and already correct.
//!
//! These tests exist because that is precisely the part nothing covered. The
//! fix makes the panel reach this call; what makes the fix *durable* is proof
//! that arriving here gives you the three things a user will check next:
//!
//!   1. undo puts the old colour back (and costs exactly one step),
//!   2. the new colour lives in the annotation DATA, so a reload restores it
//!      rather than resurrecting the old colour from the op log,
//!   3. the exported artifact shows it — not just the on-screen canvas.
//!
//! If a future refactor introduces a second, thinner recolour path (a
//! `set_shape_color(id, r, g, b)` was proposed and rejected — see ADR-029),
//! these are the guarantees it has to keep.

use stamp_tool::ImageHorseTool;

const W: u32 = 40;
const H: u32 = 40;

const BLUE: [u8; 3] = [0, 0, 255];
const GREEN: [u8; 3] = [0, 255, 0];

fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    t.recomposite();
    t
}

/// Pull a numeric field out of an annotations JSON blob. Same helper shape as
/// `resize_annotation_drift.rs` — the crate ships no JSON parser to tests.
fn num(json: &str, key: &str) -> f64 {
    let at = json
        .find(key)
        .unwrap_or_else(|| panic!("no {key} in {json}"));
    let rest = &json[at + key.len()..];
    let end = rest
        .find(|c: char| c != '-' && c != '.' && !c.is_ascii_digit())
        .unwrap_or(rest.len());
    rest[..end].parse().unwrap()
}

/// The stroke colour currently recorded for the one shape on the canvas.
fn stored_rgb(t: &ImageHorseTool) -> [u8; 3] {
    let j = t.get_shape_annotations();
    [
        num(&j, "\"r\":") as u8,
        num(&j, "\"g\":") as u8,
        num(&j, "\"b\":") as u8,
    ]
}

/// How many pixels of an exact colour the EXPORTED image contains.
/// `render_with_annotations` is the same buffer the download path writes, so
/// this is the artifact, not the preview.
fn exported_pixels(t: &ImageHorseTool, rgb: [u8; 3]) -> usize {
    t.render_with_annotations()
        .chunks_exact(4)
        .filter(|p| p[0] == rgb[0] && p[1] == rgb[1] && p[2] == rgb[2] && p[3] > 0)
        .count()
}

/// A blue outlined rectangle, stroke 4 so it survives pixel sampling.
fn add_blue_rect(t: &mut ImageHorseTool) -> u32 {
    t.add_shape_annotation(
        0, 8.0, 8.0, 32.0, 32.0, "#0000ff", 4.0, 0, 0, "#000000", "#000000", 0, 0,
    )
}

/// Recolour in place, geometry untouched — exactly what a panel colour click
/// produces once the reselected shape's id reaches `commitEdit`.
fn recolour(t: &mut ImageHorseTool, id: u32, hex: &str) -> bool {
    t.update_shape_annotation(
        id, 0, 8.0, 8.0, 32.0, 32.0, hex, 4.0, 0, 0, "#000000", "#000000", 0, 0,
    )
}

// ── 1. it lands in the annotation data (the reload guarantee) ───────────────

#[test]
fn recolour_lands_in_the_annotation_data() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    assert_eq!(stored_rgb(&t), BLUE, "precondition: drawn blue");

    assert!(recolour(&mut t, id, "#00ff00"), "known id must be accepted");

    // Persistence and op-log restore both rebuild from this JSON. A recolour
    // that only repainted pixels would leave this blue and the old colour
    // would come back on reload.
    assert_eq!(
        stored_rgb(&t),
        GREEN,
        "new colour is in the annotation data"
    );
}

#[test]
fn recolour_keeps_the_shape_where_it_was() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    recolour(&mut t, id, "#00ff00");

    let j = t.get_shape_annotations();
    assert_eq!(num(&j, "\"x0\":"), 8.0, "x0 in {j}");
    assert_eq!(num(&j, "\"y0\":"), 8.0, "y0 in {j}");
    assert_eq!(num(&j, "\"x1\":"), 32.0, "x1 in {j}");
    assert_eq!(num(&j, "\"y1\":"), 32.0, "y1 in {j}");
}

#[test]
fn recolouring_an_unknown_id_changes_nothing() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    let depth = t.undo_snapshot_count();

    assert!(!recolour(&mut t, id.wrapping_add(999), "#00ff00"));
    assert_eq!(stored_rgb(&t), BLUE, "the real shape is untouched");
    assert_eq!(
        t.undo_snapshot_count(),
        depth,
        "a rejected recolour must not cost an undo step"
    );
}

// ── 2. undo (the "Ctrl+Z did nothing" guarantee) ────────────────────────────

#[test]
fn recolour_is_one_undo_step_and_restores_the_old_colour() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    let depth = t.undo_snapshot_count();

    recolour(&mut t, id, "#00ff00");
    assert_eq!(
        t.undo_snapshot_count(),
        depth + 1,
        "a recolour is exactly one history step, not zero and not two"
    );

    assert!(t.undo(), "undo must be available after a recolour");
    assert_eq!(stored_rgb(&t), BLUE, "undo puts the original colour back");
}

#[test]
fn undoing_a_recolour_is_redoable() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    recolour(&mut t, id, "#00ff00");
    t.undo();
    assert_eq!(stored_rgb(&t), BLUE);

    assert!(t.redo(), "redo must be available after undoing a recolour");
    assert_eq!(stored_rgb(&t), GREEN, "redo restores the new colour");
}

#[test]
fn a_recolour_is_labelled_in_history() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    recolour(&mut t, id, "#00ff00");

    // The user has to be able to tell what Ctrl+Z is about to take back.
    assert!(
        t.history_labels().contains("Edit Shape"),
        "recolour needs a named history entry, got {}",
        t.history_labels()
    );
}

// ── 3. export (artifact, not canvas) ────────────────────────────────────────

#[test]
fn recolour_shows_in_the_exported_artifact() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);

    let blue_before = exported_pixels(&t, BLUE);
    assert!(blue_before > 0, "precondition: blue stroke is exported");
    assert_eq!(
        exported_pixels(&t, GREEN),
        0,
        "precondition: nothing green yet"
    );

    recolour(&mut t, id, "#00ff00");

    assert_eq!(
        exported_pixels(&t, BLUE),
        0,
        "no blue may survive into the exported file"
    );
    assert_eq!(
        exported_pixels(&t, GREEN),
        blue_before,
        "the exported stroke is the new colour, same pixel count"
    );
}

#[test]
fn undoing_a_recolour_also_reverts_the_exported_artifact() {
    let mut t = new_tool();
    let id = add_blue_rect(&mut t);
    let blue_before = exported_pixels(&t, BLUE);

    recolour(&mut t, id, "#00ff00");
    t.undo();

    assert_eq!(
        exported_pixels(&t, BLUE),
        blue_before,
        "undo must reach the exported artifact, not just the annotation JSON"
    );
    assert_eq!(exported_pixels(&t, GREEN), 0);
}

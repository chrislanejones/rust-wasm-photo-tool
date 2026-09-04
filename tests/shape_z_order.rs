//! Shape z-order: `move_shape_annotation` reorders the active layer's shape
//! list, which IS the draw order (`render_layer` iterates the Vec, layer.rs:217).
//!
//! Backlog #62. The engine primitive did not exist — the whole shape API was
//! add / update / remove / restore / hit-test / count, with no reorder of any
//! kind. #29's "DONE" mark had no code behind it.
//!
//! ADR-044: this deliberately records no op-log entry. See the doc comment on
//! `move_shape_annotation` for why that is safe rather than lossy — the short
//! version is that `oplog_engine_in_sync` compares the composite pixel hash, so
//! a reorder that changes what you see is caught and falls back to snapshot
//! undo, and one that does not change the composite did not matter.
use stamp_tool::ImageHorseTool;

const W: u32 = 40;
const H: u32 = 30;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![10u8; (W * H * 4) as usize]);
    t
}

/// Three shapes, returned bottom-to-top in creation order.
fn three(t: &mut ImageHorseTool) -> (u32, u32, u32) {
    // kind 0 = rectangle; fill_kind 1 = solid, so they actually cover each
    // other — an outline-only shape would leave the composite nearly identical
    // after a reorder and the last test here would pass for the wrong reason.
    let mut add = |x: f64, y: f64, col: &str| {
        t.add_shape_annotation(0, x, y, x + 20.0, y + 20.0, col, 2.0, 0, 1, col, col, 0, 0)
    };
    let a = add(2.0, 2.0, "#ff0000");
    let b = add(6.0, 6.0, "#00ff00");
    let c = add(10.0, 10.0, "#0000ff");
    (a, b, c)
}

/// Shape ids in draw order (bottom → top), read back out of the JSON.
fn order(t: &ImageHorseTool) -> Vec<u32> {
    let json = t.get_shape_annotations();
    let mut ids = Vec::new();
    let mut rest = json.as_str();
    while let Some(i) = rest.find("\"id\":") {
        rest = &rest[i + 5..];
        let end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        ids.push(rest[..end].parse().unwrap());
    }
    ids
}

#[test]
fn creation_order_is_draw_order() {
    let mut t = tool();
    let (a, b, c) = three(&mut t);
    assert_eq!(order(&t), vec![a, b, c]);
}

#[test]
fn send_to_back_and_bring_to_front() {
    let mut t = tool();
    let (a, b, c) = three(&mut t);

    assert!(t.move_shape_annotation(c, 0), "send to back");
    assert_eq!(order(&t), vec![c, a, b]);

    // u32::MAX saturates to the last index — the caller does not need the count.
    assert!(t.move_shape_annotation(c, u32::MAX), "bring to front");
    assert_eq!(order(&t), vec![a, b, c]);
}

#[test]
fn forward_and_backward_are_single_steps() {
    let mut t = tool();
    let (a, b, c) = three(&mut t);

    assert!(t.move_shape_annotation(a, 1), "bring forward");
    assert_eq!(order(&t), vec![b, a, c]);

    assert!(t.move_shape_annotation(a, 0), "send backward");
    assert_eq!(order(&t), vec![a, b, c]);
}

#[test]
fn no_op_moves_are_refused_and_push_no_history() {
    let mut t = tool();
    let (a, _b, c) = three(&mut t);
    let before = t.undo_count();

    assert!(!t.move_shape_annotation(a, 0), "already at the back");
    assert!(
        !t.move_shape_annotation(c, u32::MAX),
        "already at the front"
    );
    assert!(!t.move_shape_annotation(9999, 0), "unknown id");

    assert_eq!(order(&t), vec![a, _b, c], "refused moves changed the order");
    assert_eq!(
        t.undo_count(),
        before,
        "a refused move pushed a history entry — undo would then be a no-op step"
    );
}

#[test]
fn a_real_move_is_undoable() {
    let mut t = tool();
    let (a, b, c) = three(&mut t);

    assert!(t.move_shape_annotation(c, 0));
    assert_eq!(order(&t), vec![c, a, b]);

    t.undo();
    assert_eq!(
        order(&t),
        vec![a, b, c],
        "undo did not restore the draw order"
    );
}

/// The property the whole feature exists for: reordering OVERLAPPING shapes
/// changes the rendered pixels. This is also what makes the no-op-log decision
/// safe — `oplog_engine_in_sync` hashes the composite, so this change is
/// exactly what it detects.
#[test]
fn reordering_overlapping_shapes_changes_the_composite() {
    let mut t = tool();
    let (_a, _b, c) = three(&mut t);
    t.recomposite();
    let before = t.composite_hash_hex();

    assert!(t.move_shape_annotation(c, 0));
    t.recomposite();
    let after = t.composite_hash_hex();

    assert_ne!(
        before, after,
        "moving an overlapping shape to the back left the composite identical — \
         either the shapes are not overlapping or draw order is not Vec order"
    );
}

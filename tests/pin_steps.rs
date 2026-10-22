//! Numbered steps renumber themselves (Night 10-21, §2).
//!
//! Pins (kind 5) were auto-numbered only at the first draw: `dropPin` took
//! the highest number plus one, and from then on every gap was fixed by hand.
//! Three engine calls close that, each ONE history step:
//!
//! - `remove_pin_annotation`: delete a pin and move every pin above it down
//!   one (1, 2, 3, 4 − 2 → 1, 2, 3);
//! - `insert_pin_annotation`: drop a pin numbered N and move every pin at or
//!   above N up one (1, 2, 3 + 2 → 1, 2, 3, 4 with the old 2 and 3 now 3, 4);
//! - `renumber_pins`: close every gap, in the order the pins are numbered.
//!
//! Only pins on the ACTIVE layer move together; a pin on another layer keeps
//! its number. Letters are the same sequence drawn as A, B, C (`label_kind`
//! 1), so they shift exactly like numbers.
//!
//! No op-log format change: a number is a plain `ShapeParams` field, so each
//! renumbered pin records as an ordinary `ShapeEdit`, and the call's single
//! `snap` makes them one gesture (ADR-088).
use stamp_tool::ImageHorseTool;

const W: u32 = 200;
const H: u32 = 120;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![200u8; (W * H * 4) as usize]);
    t
}

/// Every `"<key>":<number>` in the shape JSON, in list order.
fn all(json: &str, key: &str) -> Vec<i64> {
    let mut out = Vec::new();
    let mut rest = json;
    while let Some(i) = rest.find(key) {
        rest = &rest[i + key.len()..];
        let end = rest
            .find(|c: char| c != '-' && !c.is_ascii_digit())
            .unwrap_or(rest.len());
        out.push(rest[..end].parse().unwrap());
    }
    out
}

/// (id, number) for every pin on the active layer, in draw order.
fn pins(t: &ImageHorseTool) -> Vec<(u32, u32)> {
    let json = t.get_shape_annotations();
    let ids = all(&json, "\"id\":");
    let kinds = all(&json, "\"kind\":");
    let numbers = all(&json, "\"number\":");
    ids.iter()
        .zip(kinds.iter().zip(numbers.iter()))
        .filter(|(_, (k, _))| **k == 5)
        .map(|(id, (_, n))| (*id as u32, *n as u32))
        .collect()
}

fn numbers(t: &ImageHorseTool) -> Vec<u32> {
    pins(t).into_iter().map(|(_, n)| n).collect()
}

/// A pin at x, numbered the way `dropPin` numbers it (max + 1).
fn drop(t: &mut ImageHorseTool, x: f64, label_kind: u8) -> u32 {
    let next = numbers(t).into_iter().max().unwrap_or(0) + 1;
    t.add_pin_annotation(x, 10.0, x + 20.0, 30.0, next, "#e03030", label_kind)
}

fn four(t: &mut ImageHorseTool, label_kind: u8) -> [u32; 4] {
    [
        drop(t, 10.0, label_kind),
        drop(t, 40.0, label_kind),
        drop(t, 70.0, label_kind),
        drop(t, 100.0, label_kind),
    ]
}

#[test]
fn deleting_a_pin_closes_the_gap() {
    let mut t = tool();
    let [a, b, c, d] = four(&mut t, 0);
    assert!(t.remove_pin_annotation(b));
    assert_eq!(pins(&t), vec![(a, 1), (c, 2), (d, 3)]);
}

#[test]
fn deleting_the_last_pin_moves_nothing() {
    let mut t = tool();
    let [a, b, c, d] = four(&mut t, 0);
    assert!(t.remove_pin_annotation(d));
    assert_eq!(pins(&t), vec![(a, 1), (b, 2), (c, 3)]);
}

#[test]
fn delete_refuses_a_shape_that_is_not_a_pin() {
    let mut t = tool();
    let [_, b, ..] = four(&mut t, 0);
    let rect = t.add_shape_annotation(
        0, 5.0, 50.0, 40.0, 90.0, "#000000", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    let before = t.undo_count();
    assert!(!t.remove_pin_annotation(rect), "a rectangle is not a step");
    assert!(!t.remove_pin_annotation(9999));
    assert_eq!(t.undo_count(), before, "a refused delete pushes no step");
    assert!(t.remove_pin_annotation(b));
}

#[test]
fn inserting_a_pin_shifts_the_ones_at_and_after_it() {
    let mut t = tool();
    let [a, b, c, d] = four(&mut t, 0);
    let e = t.insert_pin_annotation(130.0, 10.0, 150.0, 30.0, 3, "#e03030", 0);
    assert_eq!(pins(&t), vec![(a, 1), (b, 2), (c, 4), (d, 5), (e, 3)]);
}

#[test]
fn inserting_past_the_end_is_a_plain_drop() {
    let mut t = tool();
    let [a, b, c, d] = four(&mut t, 0);
    let e = t.insert_pin_annotation(130.0, 10.0, 150.0, 30.0, 5, "#e03030", 0);
    assert_eq!(pins(&t), vec![(a, 1), (b, 2), (c, 3), (d, 4), (e, 5)]);
}

#[test]
fn letters_are_the_same_sequence() {
    let mut t = tool();
    let [a, b, c, d] = four(&mut t, 1);
    assert!(t.remove_pin_annotation(a));
    assert_eq!(
        pins(&t),
        vec![(b, 1), (c, 2), (d, 3)],
        "B, C, D become A, B, C"
    );
    let e = t.insert_pin_annotation(130.0, 10.0, 150.0, 30.0, 2, "#e03030", 1);
    assert_eq!(pins(&t), vec![(b, 1), (c, 3), (d, 4), (e, 2)]);
    assert!(all(&t.get_shape_annotations(), "\"label_kind\":")
        .iter()
        .all(|k| *k == 1));
}

#[test]
fn renumber_closes_gaps_in_numbered_order() {
    let mut t = tool();
    // Drawn out of order, with gaps: 7, 2, 5. Numbered order is 2, 5, 7.
    let x = t.add_pin_annotation(10.0, 10.0, 30.0, 30.0, 7, "#e03030", 0);
    let y = t.add_pin_annotation(40.0, 10.0, 60.0, 30.0, 2, "#e03030", 0);
    let z = t.add_pin_annotation(70.0, 10.0, 90.0, 30.0, 5, "#e03030", 0);
    assert_eq!(t.renumber_pins(), 3);
    assert_eq!(pins(&t), vec![(x, 3), (y, 1), (z, 2)]);
}

#[test]
fn renumber_breaks_a_tie_by_draw_order() {
    let mut t = tool();
    let x = t.add_pin_annotation(10.0, 10.0, 30.0, 30.0, 2, "#e03030", 0);
    let y = t.add_pin_annotation(40.0, 10.0, 60.0, 30.0, 2, "#e03030", 0);
    t.renumber_pins();
    assert_eq!(pins(&t), vec![(x, 1), (y, 2)]);
}

#[test]
fn renumber_with_nothing_to_close_pushes_no_step() {
    let mut t = tool();
    four(&mut t, 0);
    let before = t.undo_count();
    assert_eq!(t.renumber_pins(), 0);
    assert_eq!(t.undo_count(), before);
}

#[test]
fn a_pin_on_another_layer_keeps_its_number() {
    let mut t = tool();
    let [a, b, c, _] = four(&mut t, 0);
    let base = t.active_layer_id();
    let other = t.add_layer("Other");
    assert!(t.set_active_layer(other));
    let far = t.add_pin_annotation(10.0, 60.0, 30.0, 80.0, 3, "#3030e0", 0);
    assert!(t.set_active_layer(base));
    assert!(t.remove_pin_annotation(a));
    t.insert_pin_annotation(130.0, 10.0, 150.0, 30.0, 1, "#e03030", 0);
    t.renumber_pins();
    assert!(t.set_active_layer(other));
    assert_eq!(
        pins(&t),
        vec![(far, 3)],
        "other layers are not this sequence"
    );
    assert!(t.set_active_layer(base));
    assert_eq!(numbers(&t).len(), 4);
    let _ = (b, c);
}

/// Each call is one undo step and one redo step, on both undo paths.
fn one_step(oplog: bool, act: impl Fn(&mut ImageHorseTool, [u32; 4])) {
    let mut t = tool();
    t.set_oplog_undo(oplog);
    let ids = four(&mut t, 0);
    t.recomposite();
    let before = pins(&t);
    let steps = t.undo_count();
    act(&mut t, ids);
    t.recomposite();
    let after = pins(&t);
    assert_ne!(after, before);
    assert_eq!(t.undo_count(), steps + 1, "one gesture, one step");
    assert!(t.undo());
    assert_eq!(pins(&t), before, "one Ctrl+Z puts every number back");
    assert!(t.redo());
    assert_eq!(pins(&t), after, "one redo takes the whole change again");
    if oplog {
        assert!(!t.oplog_is_broken(), "{}", t.oplog_status());
    }
}

#[test]
fn delete_is_one_step() {
    for oplog in [false, true] {
        one_step(oplog, |t, [_, b, ..]| assert!(t.remove_pin_annotation(b)));
    }
}

#[test]
fn insert_is_one_step() {
    for oplog in [false, true] {
        one_step(oplog, |t, _| {
            t.insert_pin_annotation(130.0, 10.0, 150.0, 30.0, 2, "#e03030", 0);
        });
    }
}

#[test]
fn renumber_is_one_step() {
    for oplog in [false, true] {
        let mut t = tool();
        t.set_oplog_undo(oplog);
        let [a, ..] = four(&mut t, 0);
        // A gap made the old way: a plain shape delete does not renumber.
        assert!(t.remove_shape_annotation(a));
        t.recomposite();
        let steps = t.undo_count();
        assert_eq!(t.renumber_pins(), 3);
        t.recomposite();
        assert_eq!(numbers(&t), vec![1, 2, 3]);
        assert_eq!(t.undo_count(), steps + 1, "one gesture, one step");
        assert!(t.undo());
        assert_eq!(
            numbers(&t),
            vec![2, 3, 4],
            "one Ctrl+Z puts every number back"
        );
        assert!(t.redo());
        assert_eq!(numbers(&t), vec![1, 2, 3]);
        if oplog {
            assert!(!t.oplog_is_broken(), "{}", t.oplog_status());
        }
    }
}

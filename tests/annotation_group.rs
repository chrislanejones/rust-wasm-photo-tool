//! Multi-select (Night 10-22): move, align, distribute, delete and duplicate
//! several annotations as ONE undo step — on the snapshot path, on the op
//! log, and on the op log after a reload, where only the log's gesture
//! markers (ADR-088) can say where the step began.
use stamp_tool::ImageHorseTool;

const W: u32 = 240;
const H: u32 = 160;

fn tool(oplog: bool) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![200u8; (W * H * 4) as usize]);
    t.set_oplog_undo(oplog);
    t
}

/// Every `"<key>":<number>` in an annotation JSON list, in list order.
fn all(json: &str, key: &str) -> Vec<f64> {
    let needle = format!("\"{key}\":");
    let mut out = Vec::new();
    let mut rest = json;
    while let Some(i) = rest.find(&needle) {
        rest = &rest[i + needle.len()..];
        let end = rest
            .find(|c: char| !(c == '-' || c == '.' || c == 'e' || c.is_ascii_digit()))
            .unwrap_or(rest.len());
        out.push(rest[..end].parse().unwrap());
    }
    out
}

/// (id, x0, y0, x1, y1) per shape, in draw order.
fn shapes(t: &ImageHorseTool) -> Vec<(u32, f64, f64, f64, f64)> {
    let j = t.get_shape_annotations();
    let (id, x0, y0, x1, y1) = (
        all(&j, "id"),
        all(&j, "x0"),
        all(&j, "y0"),
        all(&j, "x1"),
        all(&j, "y1"),
    );
    (0..id.len())
        .map(|i| (id[i] as u32, x0[i], y0[i], x1[i], y1[i]))
        .collect()
}

fn shape(t: &ImageHorseTool, id: u32) -> (f64, f64, f64, f64) {
    let s = shapes(t).into_iter().find(|s| s.0 == id).unwrap();
    (s.1, s.2, s.3, s.4)
}

/// A text's drawn box: (left, top, right, bottom).
fn text_box(t: &ImageHorseTool, id: u32) -> (f64, f64, f64, f64) {
    let j = t.get_text_annotations();
    let ids = all(&j, "id");
    let i = ids.iter().position(|&v| v as u32 == id).unwrap();
    let x = all(&j, "x")[i] + all(&j, "tile_offset_x")[i];
    let y = all(&j, "y")[i] + all(&j, "tile_offset_y")[i];
    (x, y, x + all(&j, "tile_w")[i], y + all(&j, "tile_h")[i])
}

fn pin_numbers(t: &ImageHorseTool) -> Vec<u32> {
    let j = t.get_shape_annotations();
    let (kinds, numbers) = (all(&j, "kind"), all(&j, "number"));
    kinds
        .iter()
        .zip(numbers)
        .filter(|(k, _)| **k == 5.0)
        .map(|(_, n)| n as u32)
        .collect()
}

fn hash(t: &ImageHorseTool) -> u64 {
    let mut h = 0xcbf2_9ce4_8422_2325u64;
    for b in t.render_with_annotations() {
        h = (h ^ b as u64).wrapping_mul(0x0100_0000_01b3);
    }
    h ^ (t.shape_annotation_count() as u64) << 48 ^ (t.text_annotation_count() as u64) << 56
}

fn rect(t: &mut ImageHorseTool, x: f64, y: f64, w: f64, h: f64) -> u32 {
    t.add_shape_annotation(
        0,
        x,
        y,
        x + w,
        y + h,
        "#e02020",
        2.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        0,
        0,
    )
}

fn text(t: &mut ImageHorseTool, x: i32, y: i32) -> u32 {
    t.add_text_annotation(
        "Note", 14.0, 20, 20, 20, false, x, y, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    )
}

fn pin(t: &mut ImageHorseTool, x: f64, n: u32) -> u32 {
    t.insert_pin_annotation(x, 120.0, x + 16.0, 136.0, n, "#e03030", 0)
}

/// Persist the log, open it in a fresh engine (no snapshot stack), the way a
/// reload does.
fn reload(t: &ImageHorseTool) -> ImageHorseTool {
    let total = t.oplog_op_count() as u32;
    let frames = t.oplog_encoded_ops(0, total);
    let px = t.oplog_keyframe_pixels_rgba(0);
    let ann = t.oplog_keyframe_annotations(0);
    let (w, h) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    let mut t2 = ImageHorseTool::new(w, h);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore(&px, w, h, &ann, &frames, total));
    t2
}

/// Run `act` once and check it is ONE step every way it can be undone:
/// snapshot path, op-log path, and op log after a reload. Each check: one
/// undo puts every object back byte-exact, one redo brings the result back.
fn one_step(
    setup: impl Fn(&mut ImageHorseTool) -> Vec<u32>,
    act: impl Fn(&mut ImageHorseTool, &[u32]),
) {
    for oplog in [false, true] {
        let mut t = tool(oplog);
        let ids = setup(&mut t);
        t.recomposite();
        let (before, steps) = (hash(&t), t.undo_count());
        act(&mut t, &ids);
        t.recomposite();
        let after = hash(&t);
        assert_ne!(after, before, "the action changed something");
        assert_eq!(t.undo_count(), steps + 1, "one step (oplog={oplog})");
        if oplog {
            let mut r = reload(&t);
            assert_eq!(hash(&r), after, "the reload opens the result");
            assert!(r.undo());
            assert_eq!(
                hash(&r),
                before,
                "after a reload, one undo takes it all back"
            );
            assert!(r.redo());
            assert_eq!(hash(&r), after, "and one redo brings it back");
            assert!(!r.oplog_is_broken(), "{}", r.oplog_status());
        }
        assert!(t.undo());
        assert_eq!(
            hash(&t),
            before,
            "one undo takes it all back (oplog={oplog})"
        );
        assert!(t.redo());
        assert_eq!(hash(&t), after, "one redo (oplog={oplog})");
        if oplog {
            assert!(!t.oplog_is_broken(), "{}", t.oplog_status());
        }
    }
}

// ── Move ────────────────────────────────────────────────────────────────

fn three(t: &mut ImageHorseTool) -> Vec<u32> {
    vec![
        rect(t, 10.0, 10.0, 40.0, 30.0),
        rect(t, 80.0, 20.0, 30.0, 30.0),
        text(t, 150, 30),
    ]
}

#[test]
fn move_shifts_every_picked_object_by_the_same_delta() {
    let mut t = tool(false);
    let ids = three(&mut t);
    let tb = text_box(&t, ids[2]);
    assert!(t.move_annotations(&ids[..2], &ids[2..], 12.0, -4.0));
    assert_eq!(shape(&t, ids[0]), (22.0, 6.0, 62.0, 36.0));
    assert_eq!(shape(&t, ids[1]), (92.0, 16.0, 122.0, 46.0));
    assert_eq!(
        text_box(&t, ids[2]),
        (tb.0 + 12.0, tb.1 - 4.0, tb.2 + 12.0, tb.3 - 4.0)
    );
}

#[test]
fn move_is_one_step() {
    one_step(three, |t, ids| {
        assert!(t.move_annotations(&ids[..2], &ids[2..], 12.0, -4.0))
    });
}

#[test]
fn a_move_that_moves_nothing_pushes_no_step() {
    let mut t = tool(false);
    let ids = three(&mut t);
    let steps = t.undo_count();
    assert!(!t.move_annotations(&ids[..2], &[], 0.2, 0.0));
    assert!(!t.move_annotations(&[999], &[999], 10.0, 0.0));
    assert_eq!(t.undo_count(), steps);
}

// ── Align ───────────────────────────────────────────────────────────────

/// A shape, a text, a pin and a rect rotated 90° (whose drawn box is its
/// stored box turned on end).
fn mixed(t: &mut ImageHorseTool) -> Vec<u32> {
    let r = rect(t, 30.0, 10.0, 40.0, 20.0);
    let x = text(t, 100, 60);
    let p = pin(t, 60.0, 1);
    let rot = t.add_shape_annotation_full(
        0,
        150.0,
        40.0,
        210.0,
        60.0,
        "#2040e0",
        2.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        0,
        0,
        0,
        90.0,
        &[],
    );
    vec![r, p, rot, x]
}

#[test]
fn align_left_lines_up_every_left_edge_on_the_leftmost() {
    let mut t = tool(false);
    let ids = mixed(&mut t);
    let keys = [0, 1, 2];
    assert!(t.align_annotations(&ids[..3], &keys, &ids[3..], &[3], "left"));
    let lefts = [
        shape(&t, ids[0]).0,
        shape(&t, ids[1]).0,
        // Rotated 90° about its center (180, 50): drawn 20 wide, from 170.
        shape(&t, ids[2]).0 + 20.0,
        text_box(&t, ids[3]).0,
    ];
    assert!(lefts.iter().all(|&l| (l - 30.0).abs() < 1e-9), "{lefts:?}");
}

#[test]
fn align_bottom_and_center_use_the_selection_bounds() {
    let mut t = tool(false);
    let a = rect(&mut t, 10.0, 10.0, 20.0, 20.0);
    let b = rect(&mut t, 100.0, 50.0, 40.0, 60.0);
    assert!(t.align_annotations(&[a, b], &[0, 1], &[], &[], "bottom"));
    assert_eq!(shape(&t, a).3, 110.0);
    assert!(t.align_annotations(&[a, b], &[0, 1], &[], &[], "centerH"));
    // Selection spans 10..140, center 75.
    let (a0, _, a1, _) = shape(&t, a);
    let (b0, _, b1, _) = shape(&t, b);
    assert_eq!(((a0 + a1) / 2.0, (b0 + b1) / 2.0), (75.0, 75.0));
}

#[test]
fn a_group_aligns_as_one_box_and_keeps_its_shape() {
    // A callout's pin, leader and label share one key.
    let mut t = tool(false);
    let p = pin(&mut t, 60.0, 1);
    let leader = t.add_shape_annotation(
        4, 76.0, 128.0, 120.0, 100.0, "#e03030", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    let label = text(&mut t, 120, 90);
    let other = rect(&mut t, 20.0, 10.0, 30.0, 30.0);
    let (p0, l0, x0) = (shape(&t, p), shape(&t, leader), text_box(&t, label));
    assert!(t.align_annotations(&[p, leader, other], &[7, 7, 8], &[label], &[7], "left"));
    // The callout's box started at the pin's left (60); it moved to 20.
    let d = 20.0 - 60.0;
    assert_eq!(shape(&t, p).0, p0.0 + d);
    assert_eq!(shape(&t, leader).0, l0.0 + d);
    assert_eq!(text_box(&t, label).0, x0.0 + d);
    assert_eq!(shape(&t, other).0, 20.0, "the leftmost stays put");
}

#[test]
fn align_is_one_step() {
    one_step(mixed, |t, ids| {
        assert!(t.align_annotations(&ids[..3], &[0, 1, 2], &ids[3..], &[3], "left"))
    });
}

#[test]
fn align_refuses_one_group_an_unknown_edge_and_an_aligned_set() {
    let mut t = tool(false);
    let a = rect(&mut t, 10.0, 10.0, 20.0, 20.0);
    let b = rect(&mut t, 10.0, 50.0, 40.0, 60.0);
    let steps = t.undo_count();
    assert!(
        !t.align_annotations(&[a, b], &[0, 0], &[], &[], "left"),
        "one group"
    );
    assert!(!t.align_annotations(&[a, b], &[0, 1], &[], &[], "sideways"));
    assert!(
        !t.align_annotations(&[a, b], &[0, 1], &[], &[], "left"),
        "already aligned"
    );
    assert_eq!(t.undo_count(), steps);
}

// ── Distribute ──────────────────────────────────────────────────────────

fn five(t: &mut ImageHorseTool) -> Vec<u32> {
    vec![
        rect(t, 0.0, 10.0, 10.0, 10.0),
        rect(t, 20.0, 10.0, 30.0, 10.0),
        rect(t, 70.0, 10.0, 20.0, 10.0),
        rect(t, 95.0, 10.0, 5.0, 10.0),
        rect(t, 190.0, 10.0, 40.0, 10.0),
    ]
}

#[test]
fn distribute_makes_the_gaps_equal_not_the_centers() {
    let mut t = tool(false);
    let ids = five(&mut t);
    assert!(t.distribute_annotations(&ids, &[0, 1, 2, 3, 4], &[], &[], "h"));
    let mut boxes: Vec<_> = ids.iter().map(|&id| shape(&t, id)).collect();
    boxes.sort_by(|a, b| a.0.total_cmp(&b.0));
    let gaps: Vec<f64> = boxes.windows(2).map(|w| w[1].0 - w[0].2).collect();
    // Span 0..230, boxes 105 wide: four gaps of 31.25.
    assert!(gaps.iter().all(|g| (g - 31.25).abs() < 1e-9), "{gaps:?}");
    assert_eq!((boxes[0].0, boxes[4].2), (0.0, 230.0), "the ends stay put");
}

#[test]
fn distribute_vertically_with_a_text() {
    let mut t = tool(false);
    let a = rect(&mut t, 10.0, 0.0, 20.0, 10.0);
    let b = rect(&mut t, 10.0, 15.0, 20.0, 30.0);
    let c = rect(&mut t, 10.0, 140.0, 20.0, 20.0);
    let x = text(&mut t, 60, 60);
    assert!(t.distribute_annotations(&[a, b, c], &[0, 1, 2], &[x], &[3], "v"));
    let mut spans = vec![shape(&t, a), shape(&t, b), shape(&t, c)]
        .into_iter()
        .map(|s| (s.1, s.3))
        .collect::<Vec<_>>();
    let tb = text_box(&t, x);
    spans.push((tb.1, tb.3));
    spans.sort_by(|p, q| p.0.total_cmp(&q.0));
    let gaps: Vec<f64> = spans.windows(2).map(|w| w[1].0 - w[0].1).collect();
    // The text sits on whole pixels, so its two gaps may be off by one.
    assert!(gaps.iter().all(|g| (g - gaps[0]).abs() <= 1.0), "{gaps:?}");
}

#[test]
fn distribute_is_one_step() {
    one_step(five, |t, ids| {
        assert!(t.distribute_annotations(ids, &[0, 1, 2, 3, 4], &[], &[], "h"))
    });
}

#[test]
fn distribute_needs_three() {
    let mut t = tool(false);
    let ids = five(&mut t);
    assert!(!t.distribute_annotations(&ids[..2], &[0, 1], &[], &[], "h"));
    assert!(
        !t.distribute_annotations(&ids, &[0, 0, 0, 1, 1], &[], &[], "h"),
        "two groups"
    );
    assert!(!t.distribute_annotations(&ids, &[0, 1, 2, 3, 4], &[], &[], "diagonal"));
}

// ── Delete ──────────────────────────────────────────────────────────────

fn five_pins(t: &mut ImageHorseTool) -> Vec<u32> {
    (1..=5).map(|n| pin(t, n as f64 * 30.0, n)).collect()
}

#[test]
fn deleting_three_pins_renumbers_once() {
    let mut t = tool(false);
    let ids = five_pins(&mut t);
    assert_eq!(t.remove_annotations(&ids[1..4], &[]), 3);
    assert_eq!(pin_numbers(&t), vec![1, 2]);
    assert!(t.undo());
    assert_eq!(
        pin_numbers(&t),
        vec![1, 2, 3, 4, 5],
        "one undo restores every number"
    );
}

#[test]
fn deleting_pins_out_of_order_keeps_the_rest_in_order() {
    let mut t = tool(false);
    let ids = five_pins(&mut t);
    assert_eq!(t.remove_annotations(&[ids[4], ids[0], ids[2]], &[]), 3);
    assert_eq!(pin_numbers(&t), vec![1, 2], "2 and 4 became 1 and 2");
}

#[test]
fn delete_is_one_step() {
    one_step(five_pins, |t, ids| {
        assert_eq!(t.remove_annotations(&ids[1..4], &[]), 3)
    });
    one_step(three, |t, ids| {
        assert_eq!(t.remove_annotations(&ids[..2], &ids[2..]), 3)
    });
}

#[test]
fn deleting_nothing_pushes_no_step() {
    let mut t = tool(false);
    three(&mut t);
    let steps = t.undo_count();
    assert_eq!(t.remove_annotations(&[999], &[999]), 0);
    assert_eq!(t.undo_count(), steps);
}

// ── Duplicate ───────────────────────────────────────────────────────────

#[test]
fn duplicate_copies_every_object_offset_together() {
    let mut t = tool(false);
    let ids = three(&mut t);
    let tb = text_box(&t, ids[2]);
    let new = t.duplicate_annotations(&ids[..2], &ids[2..], 10.0, 10.0);
    assert_eq!(new.len(), 3);
    assert_eq!(shape(&t, new[0]), (20.0, 20.0, 60.0, 50.0));
    assert_eq!(shape(&t, new[1]), (90.0, 30.0, 120.0, 60.0));
    assert_eq!(text_box(&t, new[2]).0, tb.0 + 10.0);
    assert_eq!(
        (t.shape_annotation_count(), t.text_annotation_count()),
        (4, 2)
    );
}

#[test]
fn duplicated_pins_number_after_the_last() {
    let mut t = tool(false);
    let ids = five_pins(&mut t);
    // Copies land in the order given (4's, then 2's) but are numbered by
    // the originals' order: 2's copy is 6, 4's copy is 7.
    t.duplicate_annotations(&[ids[3], ids[1]], &[], 0.0, 20.0);
    assert_eq!(pin_numbers(&t), vec![1, 2, 3, 4, 5, 7, 6]);
}

#[test]
fn duplicate_is_one_step() {
    one_step(three, |t, ids| {
        assert_eq!(
            t.duplicate_annotations(&ids[..2], &ids[2..], 10.0, 10.0)
                .len(),
            3
        )
    });
}

// ── Connectors ──────────────────────────────────────────────────────────

/// Two boxes and an arrow from the right side of the first to the left side
/// of the second.
fn connected(t: &mut ImageHorseTool) -> Vec<u32> {
    let a = rect(t, 10.0, 40.0, 40.0, 30.0);
    let b = rect(t, 140.0, 40.0, 40.0, 30.0);
    let arrow = t.add_shape_annotation(
        4, 50.0, 55.0, 140.0, 55.0, "#202020", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    vec![a, b, arrow]
}

#[test]
fn both_boxes_picked_the_connector_just_moves() {
    one_step(connected, |t, ids| {
        assert!(t.move_annotations(ids, &[], 0.0, 30.0))
    });
}

#[test]
fn one_box_picked_the_connector_reroutes_in_the_same_step() {
    one_step(connected, |t, ids| {
        assert!(t.move_annotations(&ids[..1], &[], 0.0, 30.0));
        assert!(t.reroute_connector(ids[2], 50.0, 85.0, 140.0, 55.0));
    });
}

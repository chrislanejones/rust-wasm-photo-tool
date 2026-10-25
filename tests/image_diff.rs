//! Screenshot comparison (Night 10-23): `diff_rgba` / `compare_photo` find
//! the changes, `mark_regions` pins them as ONE undo step — on the snapshot
//! path, on the op log, and on the op log after a reload.
use stamp_tool::image_diff::diff_rgba;
use stamp_tool::ImageHorseTool;

const W: u32 = 240;
const H: u32 = 160;

fn gray(w: u32, h: u32, v: u8) -> Vec<u8> {
    let mut px = vec![v; (w * h * 4) as usize];
    px.iter_mut().skip(3).step_by(4).for_each(|a| *a = 255);
    px
}

/// Paint a `w` × `h` box of `v` at (x, y).
fn paint(px: &mut [u8], stride: u32, x: u32, y: u32, w: u32, h: u32, v: u8) {
    for yy in y..y + h {
        for xx in x..x + w {
            let i = ((yy * stride + xx) * 4) as usize;
            px[i..i + 3].fill(v);
        }
    }
}

/// (x, y, w, h, changed px).
type Region = (u32, u32, u32, u32, u32);

/// Each region, and the mask's set-bit count.
fn unpack(d: &[u32]) -> (Vec<Region>, u32) {
    let n = d[2] as usize;
    let regions = (0..n)
        .map(|i| {
            let r = &d[3 + i * 5..8 + i * 5];
            (r[0], r[1], r[2], r[3], r[4])
        })
        .collect();
    let bits = d[3 + n * 5..].iter().map(|w| w.count_ones()).sum();
    (regions, bits)
}

fn diff(a: &[u8], b: &[u8], tol: u8, merge: u32, min_area: u32) -> Vec<Region> {
    unpack(&diff_rgba(a, b, W, H, tol, merge, min_area)).0
}

#[test]
fn identical_images_have_no_changes() {
    let a = gray(W, H, 200);
    let d = diff_rgba(&a, &a, W, H, 24, 16, 24);
    assert_eq!(&d[..3], &[W, H, 0]);
    assert_eq!(unpack(&d).1, 0, "no pixel tinted");
}

#[test]
fn a_box_fits_the_changed_pixels_not_the_block_grid() {
    let a = gray(W, H, 200);
    let mut b = a.clone();
    paint(&mut b, W, 13, 9, 10, 7, 20);
    let d = diff_rgba(&a, &b, W, H, 24, 16, 24);
    let (regions, bits) = unpack(&d);
    assert_eq!(regions, vec![(13, 9, 10, 7, 70)]);
    assert_eq!(bits, 70, "the mask is exactly the changed pixels");
}

#[test]
fn tolerance_ignores_small_shifts_and_catches_big_ones() {
    let a = gray(W, H, 200);
    let mut b = a.clone();
    paint(&mut b, W, 40, 40, 30, 30, 214); // +14: noise-sized
    assert!(diff(&a, &b, 24, 16, 24).is_empty());
    assert_eq!(diff(&a, &b, 10, 16, 24), vec![(40, 40, 30, 30, 900)]);
}

/// Shift every pixel of a `w` × `h` box at (x, y) by (dr, dg, db).
fn shift(px: &mut [u8], stride: u32, x: u32, y: u32, w: u32, h: u32, d: [i16; 3]) {
    for yy in y..y + h {
        for xx in x..x + w {
            let i = ((yy * stride + xx) * 4) as usize;
            for c in 0..3 {
                px[i + c] = (px[i + c] as i16 + d[c]).clamp(0, 255) as u8;
            }
        }
    }
}

// C13 (10-24): JPEG keeps brightness sharp and smears color (4:2:0 chroma),
// so luma is compared at the tolerance and chroma (Cb, Cr) at 1.5 times it.
// Every shift below is on mid gray, so nothing clips.

#[test]
fn a_chroma_smear_under_the_chroma_tolerance_does_not_count() {
    // Blue up 63, red and green down 8: the same brightness (luma +0.04),
    // Cb +35.5. The old RGB test saw a 63 change; at tolerance 28 the
    // chroma limit is 42.
    let a = gray(W, H, 128);
    let mut b = a.clone();
    shift(&mut b, W, 40, 40, 30, 30, [-8, -8, 63]);
    assert!(diff(&a, &b, 28, 16, 24).is_empty());
}

#[test]
fn a_chroma_change_over_the_chroma_tolerance_counts() {
    // Blue up 80, red and green down 10: luma +0.2, Cb +45 > 42.
    let a = gray(W, H, 128);
    let mut b = a.clone();
    shift(&mut b, W, 40, 40, 30, 30, [-10, -10, 80]);
    assert_eq!(diff(&a, &b, 28, 16, 24), vec![(40, 40, 30, 30, 900)]);
}

#[test]
fn a_real_luma_change_counts() {
    // Every channel up 30: luma +30 > 28, no chroma at all.
    let a = gray(W, H, 128);
    let mut b = a.clone();
    shift(&mut b, W, 40, 40, 30, 30, [30, 30, 30]);
    assert_eq!(diff(&a, &b, 28, 16, 24), vec![(40, 40, 30, 30, 900)]);
    // Just under: +27 is under 28.
    let mut c = a.clone();
    shift(&mut c, W, 40, 40, 30, 30, [27, 27, 27]);
    assert!(diff(&a, &c, 28, 16, 24).is_empty());
}

#[test]
fn a_large_hue_change_at_the_same_brightness_still_counts() {
    // Brick red (180, 90, 90) to green (60, 150, 90): luma moves under 1,
    // Cr moves 85. A recolor nobody would call noise.
    let mut a = gray(W, H, 128);
    paint_rgb(&mut a, W, 100, 60, 24, 20, [180, 90, 90]);
    let mut b = gray(W, H, 128);
    paint_rgb(&mut b, W, 100, 60, 24, 20, [60, 150, 90]);
    let (regions, bits) = unpack(&diff_rgba(&a, &b, W, H, 28, 16, 24));
    assert_eq!(regions, vec![(100, 60, 24, 20, 480)]);
    assert_eq!(bits, 480, "every recolored pixel is tinted");
}

/// Paint a `w` × `h` box of one RGB color at (x, y).
fn paint_rgb(px: &mut [u8], stride: u32, x: u32, y: u32, w: u32, h: u32, c: [u8; 3]) {
    for yy in y..y + h {
        for xx in x..x + w {
            let i = ((yy * stride + xx) * 4) as usize;
            px[i..i + 3].copy_from_slice(&c);
        }
    }
}

#[test]
fn a_lone_pixel_of_noise_does_not_move_its_block_average() {
    // Single-pixel swings (JPEG ringing, anti-aliasing) average out over a
    // 4 x 4 block: one pixel off by 120 moves the block by 7.5.
    let a = gray(W, H, 200);
    let mut b = a.clone();
    for (x, y) in [(10, 10), (50, 90), (130, 30), (200, 140)] {
        paint(&mut b, W, x, y, 1, 1, 80);
    }
    assert!(diff(&a, &b, 24, 16, 1).is_empty());
}

#[test]
fn nearby_changes_merge_far_ones_do_not() {
    let a = gray(W, H, 200);
    let mut b = a.clone();
    paint(&mut b, W, 20, 20, 8, 8, 0);
    paint(&mut b, W, 36, 20, 8, 8, 0); // 8 px gap
    paint(&mut b, W, 160, 100, 8, 8, 0); // far away
    let merged = diff(&a, &b, 24, 16, 24);
    assert_eq!(merged.len(), 2);
    assert_eq!(merged[0], (20, 20, 24, 8, 128));
    let apart = diff(&a, &b, 24, 0, 24);
    assert_eq!(apart.len(), 3, "merge 0 keeps every change apart");
}

#[test]
fn specks_under_the_minimum_area_are_dropped_from_list_and_mask() {
    let a = gray(W, H, 200);
    let mut b = a.clone();
    paint(&mut b, W, 100, 100, 3, 3, 0); // 9 px
    paint(&mut b, W, 20, 20, 10, 10, 0); // 100 px
    let d = diff_rgba(&a, &b, W, H, 24, 4, 24);
    let (regions, bits) = unpack(&d);
    assert_eq!(regions, vec![(20, 20, 10, 10, 100)]);
    assert_eq!(bits, 100, "the speck is not tinted either");
    assert_eq!(diff(&a, &b, 24, 4, 1).len(), 2);
}

#[test]
fn regions_come_in_reading_order() {
    let a = gray(W, H, 200);
    let mut b = a.clone();
    paint(&mut b, W, 180, 120, 10, 10, 0);
    paint(&mut b, W, 20, 120, 10, 10, 0);
    paint(&mut b, W, 100, 10, 10, 10, 0);
    let xy: Vec<_> = diff(&a, &b, 24, 4, 24).iter().map(|r| (r.0, r.1)).collect();
    assert_eq!(xy, vec![(100, 10), (20, 120), (180, 120)]);
}

#[test]
fn edges_that_do_not_fill_a_block_still_count() {
    // 238 x 158 is not a multiple of the 4 px block.
    let (w, h) = (238, 158);
    let a = gray(w, h, 200);
    let mut b = a.clone();
    paint(&mut b, w, 230, 150, 8, 8, 0);
    let (regions, _) = unpack(&diff_rgba(&a, &b, w, h, 24, 16, 24));
    assert_eq!(regions, vec![(230, 150, 8, 8, 64)]);
}

#[test]
fn short_buffers_are_refused_not_read_past() {
    let a = gray(W, H, 200);
    assert_eq!(diff_rgba(&a[..100], &a, W, H, 24, 16, 24), vec![0, 0, 0]);
}

// ── compare_photo: against the open document ────────────────────────────

fn tool(oplog: bool) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&gray(W, H, 200));
    t.set_oplog_undo(oplog);
    t
}

#[test]
fn compare_photo_reads_the_photo_not_the_annotations_on_it() {
    let mut t = tool(false);
    t.add_shape_annotation(
        0, 10.0, 10.0, 90.0, 60.0, "#e02020", 6.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    t.add_pin_annotation(100.0, 100.0, 130.0, 130.0, 1, "#e03030", 0);
    t.recomposite();
    let d = t.compare_photo(&gray(W, H, 200), W, H, 24, 16, 24);
    assert_eq!(&d[..3], &[W, H, 0], "last week's callouts are not changes");
}

#[test]
fn compare_photo_finds_a_change_in_document_pixels() {
    let t = tool(false);
    let mut a = gray(W, H, 200);
    paint(&mut a, W, 50, 60, 20, 10, 0);
    let (regions, _) = unpack(&t.compare_photo(&a, W, H, 24, 16, 24));
    assert_eq!(regions, vec![(50, 60, 20, 10, 200)]);
}

#[test]
fn different_sizes_compare_the_top_left_overlap() {
    let t = tool(false);
    // A is wider and shorter than B: the shared area is 240 x 100.
    let (aw, ah) = (300, 100);
    let mut a = gray(aw, ah, 200);
    paint(&mut a, aw, 20, 20, 10, 10, 0); // inside the overlap
    paint(&mut a, aw, 260, 20, 10, 10, 0); // only A has this column
    let d = t.compare_photo(&a, aw, ah, 24, 16, 24);
    assert_eq!(&d[..2], &[240, 100], "the shared area");
    let (regions, _) = unpack(&d);
    assert_eq!(regions, vec![(20, 20, 10, 10, 100)]);
}

#[test]
fn compare_photo_pushes_nothing() {
    let t = tool(true);
    let steps = t.undo_count();
    let mut a = gray(W, H, 200);
    paint(&mut a, W, 50, 60, 20, 10, 0);
    t.compare_photo(&a, W, H, 24, 16, 24);
    assert_eq!(t.undo_count(), steps);
}

// ── mark_regions ───────────────────────────────────────────────────────

fn hash(t: &ImageHorseTool) -> u64 {
    let mut h = 0xcbf2_9ce4_8422_2325u64;
    for b in t.render_with_annotations() {
        h = (h ^ b as u64).wrapping_mul(0x0100_0000_01b3);
    }
    h ^ (t.shape_annotation_count() as u64) << 48
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

fn pin_numbers(t: &ImageHorseTool) -> Vec<u32> {
    let j = t.get_shape_annotations();
    all(&j, "kind")
        .iter()
        .zip(all(&j, "number"))
        .filter(|(k, _)| **k == 5.0)
        .map(|(_, n)| n as u32)
        .collect()
}

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

const THREE: [u32; 12] = [20, 20, 30, 20, 120, 30, 40, 16, 60, 110, 50, 30];

#[test]
fn mark_three_regions_is_one_step_before_and_after_a_reload() {
    for oplog in [false, true] {
        let mut t = tool(oplog);
        t.recomposite();
        let (before, steps) = (hash(&t), t.undo_count());
        let ids = t.mark_regions(&THREE, "#e02020", 3.0, 4.0, 24.0);
        assert_eq!(ids.len(), 6, "a box and a pin per region");
        t.recomposite();
        let after = hash(&t);
        assert_eq!(t.undo_count(), steps + 1, "one step (oplog={oplog})");
        if oplog {
            let mut r = reload(&t);
            assert_eq!(hash(&r), after, "the reload opens the marks");
            assert!(r.undo());
            assert_eq!(hash(&r), before, "after a reload, one undo takes all six");
            assert!(r.redo());
            assert_eq!(hash(&r), after);
            assert!(!r.oplog_is_broken(), "{}", r.oplog_status());
        }
        assert!(t.undo());
        assert_eq!(hash(&t), before, "one undo takes all six (oplog={oplog})");
        assert_eq!(t.shape_annotation_count(), 0);
        assert!(t.redo());
        assert_eq!(hash(&t), after);
    }
}

/// (x0, y0, x1, y1) of each shape, in list order.
fn boxes(t: &ImageHorseTool) -> Vec<(f64, f64, f64, f64)> {
    let j = t.get_shape_annotations();
    let (x0, y0, x1, y1) = (all(&j, "x0"), all(&j, "y0"), all(&j, "x1"), all(&j, "y1"));
    (0..x0.len())
        .map(|i| (x0[i], y0[i], x1[i], y1[i]))
        .collect()
}

#[test]
fn marks_are_a_padded_box_and_a_pin_just_outside_its_corner() {
    // C20 (10-24): the pin sat ON the box's corner, over the first letter of
    // the change. It now sits outside it, up and left by its radius.
    let mut t = tool(false);
    t.mark_regions(&THREE[4..8], "#e02020", 3.0, 4.0, 24.0);
    assert_eq!(all(&t.get_shape_annotations(), "kind"), vec![0.0, 5.0]);
    let b = boxes(&t);
    assert_eq!(b[0], (116.0, 26.0, 164.0, 50.0), "the box, 4 px outside");
    assert_eq!(
        b[1],
        (92.0, 2.0, 116.0, 26.0),
        "the pin ends at the box's corner"
    );
}

#[test]
fn a_pin_at_the_photos_edge_stays_whole_inside_it() {
    let mut t = tool(false);
    // Against the left edge: the pin is pushed right, and stays above.
    t.mark_regions(&[2, 80, 20, 20], "#e02020", 3.0, 4.0, 24.0);
    let b = boxes(&t);
    assert_eq!(b[0], (0.0, 76.0, 26.0, 104.0));
    assert_eq!(
        b[1],
        (0.0, 52.0, 24.0, 76.0),
        "above the box, inside the photo"
    );
    // In the top-left corner there is no room outside: inside the photo wins.
    let mut t = tool(false);
    t.mark_regions(&THREE[..4], "#e02020", 3.0, 4.0, 24.0);
    let b = boxes(&t);
    assert_eq!(b[0], (16.0, 16.0, 54.0, 44.0));
    assert_eq!(b[1], (0.0, 0.0, 24.0, 24.0));
    // A pin wider than the photo, or a size that is not a number: placed,
    // never a panic across the wasm boundary.
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&gray(20, 20, 200));
    t.mark_regions(&[5, 5, 4, 4], "#e02020", 3.0, 2.0, 30.0);
    assert_eq!(boxes(&t)[1], (0.0, 0.0, 30.0, 30.0));
    assert_eq!(
        t.mark_regions(&[5, 5, 4, 4], "#e02020", 3.0, 2.0, f64::NAN)
            .len(),
        2
    );
}

#[test]
fn pins_continue_the_layers_sequence() {
    let mut t = tool(false);
    t.insert_pin_annotation(200.0, 120.0, 216.0, 136.0, 1, "#e03030", 0);
    t.insert_pin_annotation(170.0, 120.0, 186.0, 136.0, 2, "#e03030", 0);
    t.mark_regions(&THREE, "#e02020", 3.0, 4.0, 24.0);
    assert_eq!(pin_numbers(&t), vec![1, 2, 3, 4, 5]);
}

#[test]
fn nothing_to_mark_pushes_nothing() {
    let mut t = tool(false);
    let steps = t.undo_count();
    assert!(t.mark_regions(&[], "#e02020", 3.0, 4.0, 24.0).is_empty());
    assert!(t
        .mark_regions(&[5, 5, 0, 10, 1, 2], "#e02020", 3.0, 4.0, 24.0)
        .is_empty());
    assert_eq!(t.undo_count(), steps);
}

#[test]
fn new_ids_never_collide_with_old_ones() {
    let mut t = tool(false);
    let old = t.add_shape_annotation(
        0, 1.0, 1.0, 9.0, 9.0, "#e02020", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    let ids = t.mark_regions(&THREE, "#e02020", 3.0, 4.0, 24.0);
    assert!(!ids.contains(&old));
    let next = t.add_shape_annotation(
        0, 1.0, 1.0, 9.0, 9.0, "#e02020", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    assert!(!ids.contains(&next) && next != old);
}

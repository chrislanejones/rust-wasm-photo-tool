// Moved out of src/lib.rs verbatim (Track A, docs/AppShell-Refactor-Plan.md):
// the test module lived inside the production file. `use super::*` still
// resolves to the same module, so nothing below changed.

use super::*;

use crate::test_util::solid;

fn px(tool: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
    let data = tool.get_image_data();
    let i = ((y * tool.width + x) * 4) as usize;
    [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

#[test]
fn starts_with_one_background_layer() {
    let t = ImageHorseTool::new(4, 4);
    assert_eq!(t.layer_count(), 1);
    assert_eq!(t.active, 0);
}

#[test]
fn commit_text_kind_zero_paints_no_background() {
    // Transparent canvas, plain text with background_kind = 0 (none): a
    // point just left of the text's left edge (inside where a rect's
    // padding WOULD be) stays untouched.
    let mut t = ImageHorseTool::new(200, 100);
    let dest_x = 50i32;
    let dest_y = 30i32;
    let m = t.measure_text("Hi", 24.0, false, "");
    let raw_h = m[1];
    t.commit_text(
        "Hi", 24.0, 255, 255, 255, false, dest_x, dest_y, 0.0, 0, 0, 0, 0, 0, 5, 0, "",
    );
    let probe = px(&t, (dest_x - 3) as u32, dest_y as u32 + raw_h / 2);
    assert_eq!(
        probe,
        [0, 0, 0, 0],
        "no background kind paints nothing outside the glyphs"
    );
}

#[test]
fn commit_text_kind_one_paints_a_padded_background_rect() {
    // Same call, background_kind = 1 (solid rect), padding 5: the same
    // probe point (inside the padding, left of the text) is now the
    // opaque background color.
    let mut t = ImageHorseTool::new(200, 100);
    let dest_x = 50i32;
    let dest_y = 30i32;
    let m = t.measure_text("Hi", 24.0, false, "");
    let raw_h = m[1];
    t.commit_text(
        "Hi", 24.0, 255, 255, 255, false, dest_x, dest_y, 0.0, 1, 10, 20, 30, 255, 5, 0, "",
    );
    let probe = px(&t, (dest_x - 3) as u32, dest_y as u32 + raw_h / 2);
    assert_eq!(
        probe,
        [10, 20, 30, 255],
        "background rect fills the padding"
    );
}

#[test]
fn commit_text_background_grows_outward_without_shifting_the_text() {
    // The text's own glyph anchor (dest_x, dest_y) must be identical
    // whether or not a background is drawn — the rect grows OUTWARD from
    // the text, never displacing it. Compare the first FULLY-opaque,
    // pure-white pixel scanning rightward from dest_x on the vertical
    // center row: a fully-covered glyph pixel is backdrop-independent
    // (the `over` operator reduces to the source color at alpha=255),
    // so this is immune to the anti-aliased edge blending differently
    // against a transparent vs. a colored background.
    let text_col = |bg_on: bool| -> u32 {
        let mut t = ImageHorseTool::new(200, 100);
        let dest_x = 50i32;
        let dest_y = 30i32;
        let m = t.measure_text("Hi", 24.0, false, "");
        let raw_h = m[1];
        if bg_on {
            t.commit_text(
                "Hi", 24.0, 255, 255, 255, false, dest_x, dest_y, 0.0, 1, 10, 20, 30, 255, 5, 0, "",
            );
        } else {
            t.commit_text(
                "Hi", 24.0, 255, 255, 255, false, dest_x, dest_y, 0.0, 0, 0, 0, 0, 0, 5, 0, "",
            );
        }
        let row = dest_y as u32 + raw_h / 2;
        for x in (dest_x as u32)..(dest_x as u32 + m[0] + 1) {
            if px(&t, x, row) == [255, 255, 255, 255] {
                return x;
            }
        }
        u32::MAX
    };
    let without_bg = text_col(false);
    let with_bg = text_col(true);
    assert_ne!(
        without_bg,
        u32::MAX,
        "found solid glyph ink with no background"
    );
    assert_ne!(with_bg, u32::MAX, "found solid glyph ink with background");
    assert_eq!(
        without_bg, with_bg,
        "background must not shift the text's own pixels"
    );
}

#[test]
fn artboard_load_pads_and_makes_two_layers() {
    // 4×4 red photo, 2px white canvas border → 8×8 document, two layers,
    // photo active. Corner is the white canvas; center is the red photo.
    let mut t = ImageHorseTool::new(8, 8);
    t.load_image_artboard(&solid(4, 4, [255, 0, 0, 255]), 4, 4, 2, 255, 255, 255, 255);
    assert_eq!((t.width, t.height), (8, 8));
    assert_eq!(t.layer_count(), 2);
    assert_eq!(t.active, 1, "photo layer is active");
    assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "corner = canvas");
    assert_eq!(px(&t, 4, 4), [255, 0, 0, 255], "center = photo");
}

#[test]
fn resize_canvas_grows_without_resampling() {
    // 4×4 red photo on a 2px white artboard → 8×8 doc, two layers. Mark a
    // single distinctive pixel on the Photo layer, then grow the canvas to
    // 16×16 centered (no resample). The doc grows, the marked pixel survives
    // byte-for-byte at its shifted location (a resample would blend it with
    // its red neighbours), and the freshly exposed border is the bg fill.
    let mut t = ImageHorseTool::new(8, 8);
    t.load_image_artboard(&solid(4, 4, [255, 0, 0, 255]), 4, 4, 2, 255, 255, 255, 255);
    // Photo layer (index 1) doc-coord (2,2) = photo top-left → unique color.
    let i = ((2 * 8 + 2) * 4) as usize;
    t.layers[1].buf.data[i..i + 4].copy_from_slice(&[1, 2, 3, 255]);

    t.resize_canvas(16, 16, 4, 255, 255, 255, 255);

    assert_eq!((t.width, t.height), (16, 16), "doc grew");
    assert_eq!(t.layer_count(), 2, "layer count unchanged");
    // Center offset = (16-8)/2 = 4, so doc(2,2) → doc(6,6).
    assert_eq!(
        px(&t, 6, 6),
        [1, 2, 3, 255],
        "photo pixel preserved exactly (not resampled)"
    );
    // Photo center red(4,4) → doc(8,8) still pure red.
    assert_eq!(px(&t, 8, 8), [255, 0, 0, 255], "photo center preserved");
    // Freshly exposed corner is the white backing fill.
    assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "new border = bg fill");
}

#[test]
fn resize_canvas_shrinks_and_crops() {
    // Shrink an 8×8 artboard to 4×4 centered: offset = (4-8)/2 = -2, so the
    // photo region (2..6) lands at (0..4) and fills the whole smaller doc.
    let mut t = ImageHorseTool::new(8, 8);
    t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 2, 0, 0, 0, 0);
    t.resize_canvas(4, 4, 4, 0, 0, 0, 0);
    assert_eq!((t.width, t.height), (4, 4), "doc shrank");
    assert_eq!(px(&t, 0, 0), [0, 128, 0, 255], "photo cropped to fill doc");
}

#[test]
fn artboard_transparent_canvas_shows_through_border() {
    // bg_a = 0 → the border is transparent, the photo region opaque.
    let mut t = ImageHorseTool::new(8, 8);
    t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 2, 0, 0, 0, 0);
    assert_eq!(px(&t, 0, 0)[3], 0, "border transparent");
    assert_eq!(px(&t, 4, 4), [0, 128, 0, 255], "photo opaque");
}

#[test]
fn set_artboard_border_is_absolute_and_idempotent() {
    // Simulate a "jumbo" doc: a 4×4 red photo on a 20px artboard → 44×44.
    let mut t = ImageHorseTool::new(44, 44);
    t.load_image_artboard(&solid(4, 4, [255, 0, 0, 255]), 4, 4, 20, 200, 200, 200, 255);
    assert_eq!((t.width, t.height), (44, 44), "jumbo doc");
    // Mark the photo top-left (doc 20,20) with a unique color so we can
    // prove the photo is re-blitted, not resampled.
    let i = ((20 * 44 + 20) * 4) as usize;
    t.layers[1].buf.data[i..i + 4].copy_from_slice(&[1, 2, 3, 255]);

    // Absolute apply: 10px border → the doc snaps to photo(4×4) + 2*10 = 24.
    t.set_artboard_border(10, 255, 255, 255, 255);
    assert_eq!((t.width, t.height), (24, 24), "snaps to photo + 2*pad");
    assert_eq!(t.layer_count(), 2, "still Background + Photo");
    // The marked photo pixel survives byte-for-byte at (10,10) (a resample
    // would have blended it with its red neighbours).
    assert_eq!(px(&t, 10, 10), [1, 2, 3, 255], "photo pixel preserved");
    assert_eq!(px(&t, 13, 13), [255, 0, 0, 255], "photo body preserved");
    assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "border = white backing");

    // IDEMPOTENT: calling again with the same pad changes nothing.
    t.set_artboard_border(10, 255, 255, 255, 255);
    assert_eq!((t.width, t.height), (24, 24), "size unchanged on re-apply");
    assert_eq!(t.layer_count(), 2, "layer count unchanged on re-apply");
    assert_eq!(
        px(&t, 10, 10),
        [1, 2, 3, 255],
        "photo pixel still preserved"
    );
    assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "border still white");
}

#[test]
fn set_artboard_border_grows_backing_for_single_layer_doc() {
    // A plain single-layer photo (load_image) gains a Background + Photo
    // pair when bordered, with the photo centered inside the pad.
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [0, 0, 255, 255]));
    assert_eq!(t.layer_count(), 1, "starts single-layer");

    t.set_artboard_border(10, 255, 255, 255, 255);
    assert_eq!((t.width, t.height), (24, 24), "photo + 2*pad");
    assert_eq!(t.layer_count(), 2, "grew a Background layer");
    assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "corner = backing");
    assert_eq!(px(&t, 11, 11), [0, 0, 255, 255], "photo centered (10,10)");

    // Idempotent on the now-two-layer doc too.
    t.set_artboard_border(10, 255, 255, 255, 255);
    assert_eq!((t.width, t.height), (24, 24), "size stable");
    assert_eq!(t.layer_count(), 2, "no extra Background layers accrue");
}

#[test]
fn add_layer_inserts_above_and_activates() {
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [255, 0, 0, 255]));
    let id = t.add_layer("Layer 2");
    assert_eq!(t.layer_count(), 2);
    assert_eq!(t.active_layer_id(), id);
    assert_eq!(t.active, 1);
    // New layer is transparent → composite still shows the red background.
    assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
}

#[test]
fn upper_opaque_layer_covers_lower() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [255, 0, 0, 255]));
    t.add_layer("top");
    // Paint the top (active) layer solid blue.
    let top = t.active;
    t.layers[top].buf.data = solid(2, 2, [0, 0, 255, 255]);
    assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
}

#[test]
fn shape_solid_fill_paints_interior() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [255, 255, 255, 255]));
    // Rect (4,4)-(16,16), solid blue fill (kind 1), thin black stroke.
    t.add_shape_annotation(
        0, 4.0, 4.0, 16.0, 16.0, "#000000", 1.0, 0, 1, "#0000ff", "#000000", 0, 0, 0,
    );
    let p = px(&t, 10, 10); // interior center
    assert_eq!(
        [p[0], p[1], p[2]],
        [0, 0, 255],
        "interior should be blue fill, got {p:?}"
    );
}

#[test]
fn shape_no_fill_leaves_interior_untouched() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [255, 255, 255, 255]));
    // fill_kind 0 = none → interior stays white.
    t.add_shape_annotation(
        0, 4.0, 4.0, 16.0, 16.0, "#000000", 1.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    assert_eq!(px(&t, 10, 10), [255, 255, 255, 255]);
}

#[test]
fn shape_gradient_fill_varies_across_axis() {
    let mut t = ImageHorseTool::new(40, 40);
    t.load_image(&solid(40, 40, [255, 255, 255, 255]));
    // Horizontal (angle 0) gradient red→green across a wide rect; no stroke
    // bleed in the center band we sample.
    t.add_shape_annotation(
        0, 2.0, 2.0, 38.0, 38.0, "#000000", 1.0, 0, 2, "#ff0000", "#00ff00", 0, 0, 0,
    );
    let left = px(&t, 6, 20);
    let right = px(&t, 34, 20);
    assert!(left[0] > left[1], "left end should be redder, got {left:?}");
    assert!(
        right[1] > right[0],
        "right end should be greener, got {right:?}"
    );
}

/// A cubic control sequence approximating a circle of radius `r` about
/// (cx,cy). The final anchor is offset by `gap` px from the first — the
/// hand-drawn "full circle" case, where the user's last click lands NEAR
/// the start, never exactly on it.
fn circle_path(cx: f64, cy: f64, r: f64, gap: f64) -> Vec<f64> {
    let k = 0.552_284_75 * r; // cubic circle-approximation handle length
    vec![
        cx + r,
        cy, // a0  (E)
        cx + r,
        cy + k, // out0
        cx + k,
        cy + r, // in1
        cx,
        cy + r, // a1  (S)
        cx - k,
        cy + r, // out1
        cx - r,
        cy + k, // in2
        cx - r,
        cy, // a2  (W)
        cx - r,
        cy - k, // out2
        cx - k,
        cy - r, // in3
        cx,
        cy - r, // a3  (N)
        cx + k,
        cy - r, // out3
        cx + r,
        cy - k, // in0'
        cx + r,
        cy + gap, // a0' — near the first anchor, NOT on it
    ]
}

/// The headline pen bug: a hand-drawn closed circle must FILL even though
/// its last anchor misses the first by a couple of px. `fill_polygon`
/// wraps the contour (`(i + 1) % n`), so closure must not be exact.
#[test]
fn bezier_near_closed_circle_fills_interior() {
    let mut t = ImageHorseTool::new(40, 40);
    t.load_image(&solid(40, 40, [255, 255, 255, 255]));
    // 2px short of closure — a realistic hand-drawn loop.
    let pts = circle_path(20.0, 20.0, 12.0, 2.0);
    t.add_bezier_annotation(&pts, "#000000", 1.0, 1, "#0000ff");

    let centre = px(&t, 20, 20);
    assert_eq!(
        [centre[0], centre[1], centre[2]],
        [0, 0, 255],
        "interior of a near-closed circle should be blue fill, got {centre:?}"
    );
    // Well inside, off-center, still filled.
    let inner = px(&t, 20, 14);
    assert_eq!(
        [inner[0], inner[1], inner[2]],
        [0, 0, 255],
        "interior should fill to the edges, got {inner:?}"
    );
    // Outside the contour: untouched white.
    assert_eq!(
        px(&t, 1, 1),
        [255, 255, 255, 255],
        "outside the path must stay unfilled"
    );
    assert_eq!(
        px(&t, 38, 38),
        [255, 255, 255, 255],
        "outside the path must stay unfilled"
    );
}

/// fill_kind 0 on the same geometry leaves the interior alone — proving the
/// fill above came from the fill instruction, not from the stroke.
#[test]
fn bezier_no_fill_leaves_interior_untouched() {
    let mut t = ImageHorseTool::new(40, 40);
    t.load_image(&solid(40, 40, [255, 255, 255, 255]));
    let pts = circle_path(20.0, 20.0, 12.0, 2.0);
    t.add_bezier_annotation(&pts, "#000000", 1.0, 0, "#0000ff");
    assert_eq!(
        px(&t, 20, 20),
        [255, 255, 255, 255],
        "fill_kind 0 → interior stays white"
    );
}

#[test]
fn redact_region_paints_opaque_color() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [255, 255, 255, 255]));
    t.begin_redact_stroke();
    t.redact_region(10.0, 10.0, 5.0, 0, 0, 0);
    assert_eq!(
        px(&t, 10, 10),
        [0, 0, 0, 255],
        "brush center redacted to black"
    );
    assert_eq!(
        px(&t, 0, 0),
        [255, 255, 255, 255],
        "corner outside brush untouched"
    );
}

#[test]
fn pixelate_region_keeps_solid_color() {
    let mut t = ImageHorseTool::new(32, 32);
    t.load_image(&solid(32, 32, [40, 80, 120, 255]));
    t.begin_pixelate_stroke();
    t.pixelate_region(16.0, 16.0, 16.0, 8);
    // Averaging a uniform region leaves the color unchanged.
    assert_eq!(px(&t, 16, 16), [40, 80, 120, 255]);
}

#[test]
fn shape_pixelate_fill_quantizes_into_blocks() {
    let mut t = ImageHorseTool::new(16, 16);
    // Horizontal gray ramp so neighbouring columns differ before pixelating.
    let mut data = Vec::with_capacity(16 * 16 * 4);
    for _y in 0..16 {
        for x in 0..16u32 {
            let v = (x * 17) as u8;
            data.extend_from_slice(&[v, v, v, 255]);
        }
    }
    t.load_image(&data);
    // Whole-image rect, pixelate fill (kind 3), one 16px block → one cell.
    t.add_shape_annotation(
        0, 0.0, 0.0, 15.0, 15.0, "#000000", 0.0, 0, 3, "#000000", "#000000", 0, 16, 0,
    );
    let a = px(&t, 2, 8);
    let b = px(&t, 13, 8);
    assert_eq!(
        a, b,
        "a single mosaic block must be uniform, {a:?} vs {b:?}"
    );
}

#[test]
fn shape_json_includes_fill_block() {
    let mut t = ImageHorseTool::new(16, 16);
    t.load_image(&solid(16, 16, [0, 0, 0, 255]));
    t.add_shape_annotation(
        0, 1.0, 1.0, 10.0, 10.0, "#000000", 1.0, 0, 3, "#000000", "#000000", 0, 24, 0,
    );
    let json = t.get_layer_shape_annotations(0);
    assert!(json.contains("\"fill_block\":24"), "got {json}");
}

#[test]
fn visibility_toggle_hides_layer() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [255, 0, 0, 255]));
    let top = t.add_layer("top");
    let ti = t.active;
    t.layers[ti].buf.data = solid(2, 2, [0, 0, 255, 255]);
    assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
    t.set_layer_visible(top, false);
    assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
}

#[test]
fn opacity_blends_50_percent() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [0, 0, 0, 255]));
    let top = t.add_layer("top");
    let ti = t.active;
    t.layers[ti].buf.data = solid(2, 2, [255, 255, 255, 255]);
    t.set_layer_opacity(top, 0.5);
    let p = px(&t, 0, 0);
    // ~50% white over black ≈ 128 on each channel.
    assert!((p[0] as i32 - 128).abs() <= 2, "got {:?}", p);
    assert_eq!(p[3], 255);
}

#[test]
fn undo_removes_added_layer() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [9, 9, 9, 255]));
    assert_eq!(t.layer_count(), 1);
    t.add_layer("temp");
    assert_eq!(t.layer_count(), 2);
    assert!(t.undo());
    assert_eq!(t.layer_count(), 1);
    assert!(t.redo());
    assert_eq!(t.layer_count(), 2);
}

#[test]
fn cannot_remove_last_layer() {
    let mut t = ImageHorseTool::new(2, 2);
    assert!(!t.remove_layer(t.active_layer_id()));
    assert_eq!(t.layer_count(), 1);
}

#[test]
fn remove_backing_layer_shrinks_canvas_to_content() {
    // A 4×4 photo on a 10px artboard border → 24×24 doc, Background + Photo.
    let mut t = ImageHorseTool::new(24, 24);
    t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 10, 200, 200, 200, 255);
    assert_eq!((t.width, t.height), (24, 24), "jumbo doc with backing");
    assert_eq!(t.layer_count(), 2, "Background + Photo");

    let bg_id = t.layers[0].id;
    assert!(t.remove_layer(bg_id));

    assert_eq!(t.layer_count(), 1, "Background removed");
    assert_eq!(
        (t.width, t.height),
        (4, 4),
        "canvas shrinks back to the photo's tight content — the border must not \
         linger (and reappear in every export) once its fill is gone"
    );
    assert_eq!(px(&t, 0, 0), [0, 128, 0, 255], "photo content preserved");
}

#[test]
fn remove_non_backing_layer_leaves_canvas_size_untouched() {
    // Deleting an ordinary (non-backing) layer must NOT trigger a resize —
    // only removing the bottom "Background" layer of a multi-layer doc does.
    let mut t = ImageHorseTool::new(24, 24);
    t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 10, 200, 200, 200, 255);
    let photo_id = t.layers[1].id;

    assert!(t.remove_layer(photo_id));

    assert_eq!(t.layer_count(), 1, "Photo removed, Background remains");
    assert_eq!((t.width, t.height), (24, 24), "canvas size untouched");
}

#[test]
fn get_image_data_excluding_background_crops_to_the_photo() {
    // A 4×4 photo on a 2px artboard border → 8×8 doc, Background + Photo.
    let mut t = ImageHorseTool::new(8, 8);
    t.load_image_artboard(&solid(4, 4, [0, 128, 0, 255]), 4, 4, 2, 200, 200, 200, 255);

    // The full composite still includes the padded backing fill.
    let full = t.get_image_data();
    assert_eq!(
        &full[0..4],
        &[200, 200, 200, 255][..],
        "full composite includes backing"
    );

    // Excluding the backing crops down to just the 4×4 photo — not the
    // full 8×8 canvas with the fill zeroed out (which would still export
    // at the padded size, a black border baked in on formats without
    // alpha like JPEG).
    assert_eq!(t.export_width_excluding_background(), 4);
    assert_eq!(t.export_height_excluding_background(), 4);
    let excl = t.get_image_data_excluding_background();
    assert_eq!(excl.len(), 4 * 4 * 4, "cropped to the photo's own size");
    for px in excl.chunks_exact(4) {
        assert_eq!(px, [0, 128, 0, 255], "every pixel is the photo, no border");
    }
}

#[test]
fn get_image_data_excluding_background_is_a_noop_without_a_backing_layer() {
    // Single-layer (photo-only) doc: excluding "the backing" has nothing
    // to exclude, so both composites must match exactly.
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [10, 20, 30, 255]));
    assert_eq!(t.get_image_data(), t.get_image_data_excluding_background());
}

#[test]
fn merge_down_combines_layers() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [255, 0, 0, 255]));
    let top = t.add_layer("top");
    let ti = t.active;
    t.layers[ti].buf.data = solid(2, 2, [0, 0, 255, 255]);
    assert!(t.merge_down(top));
    assert_eq!(t.layer_count(), 1);
    assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
}

#[test]
fn flatten_all_collapses_stack() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [255, 0, 0, 255]));
    t.add_layer("a");
    t.add_layer("b");
    assert_eq!(t.layer_count(), 3);
    t.flatten_all();
    assert_eq!(t.layer_count(), 1);
    assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
}

#[test]
fn move_layer_reorders() {
    let mut t = ImageHorseTool::new(2, 2);
    t.load_image(&solid(2, 2, [255, 0, 0, 255])); // bottom red
    let top = t.add_layer("top");
    let ti = t.active;
    t.layers[ti].buf.data = solid(2, 2, [0, 255, 0, 255]); // green on top
    assert_eq!(px(&t, 0, 0), [0, 255, 0, 255]);
    // Move green to the bottom → red now on top.
    t.move_layer(top, 0);
    assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
}

#[test]
fn paste_region_targets_active_layer() {
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [0, 0, 0, 255]));
    t.add_layer("paste-target");
    // Paste a 2x2 white block at (0,0) into the active (transparent) layer.
    t.paste_region(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0);
    assert_eq!(px(&t, 0, 0), [255, 255, 255, 255]);
    // Outside the paste, the black background shows through.
    assert_eq!(px(&t, 3, 3), [0, 0, 0, 255]);
}

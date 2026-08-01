// Regression suite for: "add a shape, then text, then use the resize tool,
// shrink a little, and the vector items move to the side instead of anchoring
// in the same spot."
//
// `resize_with_filter` (the Resize tool's resampling path, reached from
// AppShell `handleApplyCompression` -> `resizeWithFilter`) used to resample
// layer buffers and nothing else. Live text/shape overlays are stored in canvas
// coordinates and belong to no buffer, so they kept their absolute positions
// while the image shrank underneath them — a shape centred on a 200px canvas
// stayed at x=90 on a 100px one, i.e. 90% across a canvas it used to be
// centred on.
//
// `crop` and `resize_canvas` already moved overlays with their layer and have
// their own tests. This covers the sibling that never did. Mask and pen-path
// coverage lives in lib.rs's inline tests, which can reach private fields.

use stamp_tool::ImageHorseTool;

fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
    let mut v = Vec::with_capacity((w * h * 4) as usize);
    for _ in 0..(w * h) {
        v.extend_from_slice(&rgba);
    }
    v
}

/// Pull a numeric field out of an annotations JSON blob.
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

fn tool_200() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(200, 200);
    t.load_image(&solid(200, 200, [255, 255, 255, 255]));
    t
}

#[test]
fn shape_annotations_scale_with_a_resampling_resize() {
    let mut t = tool_200();
    // A rect centred on the canvas.
    t.add_shape_annotation(
        0, 90.0, 90.0, 110.0, 110.0, "#000000", 4.0, 0, 0, "#000000", "#000000", 0, 0,
    );
    t.resize_with_filter(100, 100, 1);

    // 45..55 on a 100px canvas is exactly what 90..110 was on 200px: centred.
    let j = t.get_shape_annotations();
    assert_eq!(num(&j, "\"x0\":"), 45.0, "x0 in {j}");
    assert_eq!(num(&j, "\"y0\":"), 45.0, "y0 in {j}");
    assert_eq!(num(&j, "\"x1\":"), 55.0, "x1 in {j}");
    assert_eq!(num(&j, "\"y1\":"), 55.0, "y1 in {j}");
}

#[test]
fn text_annotations_scale_with_a_resampling_resize() {
    let mut t = tool_200();
    t.add_text_annotation(
        "hi", 20.0, 0, 0, 0, false, 100, 100, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
    );
    t.resize_with_filter(100, 100, 1);

    let j = t.get_text_annotations();
    assert_eq!(num(&j, "\"x\":"), 50.0, "x in {j}");
    assert_eq!(num(&j, "\"y\":"), 50.0, "y in {j}");
    // Font size follows too — text that kept its pixel size would be twice as
    // large relative to the content it annotates.
    assert_eq!(num(&j, "\"font_size\":"), 10.0, "font_size in {j}");
}

#[test]
fn the_cached_text_tile_is_rebuilt_at_the_new_size() {
    let mut t = tool_200();
    t.add_text_annotation(
        "hello", 40.0, 0, 0, 0, false, 20, 20, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
    );
    let before = num(&t.get_text_annotations(), "\"tile_w\":");
    t.resize_with_filter(100, 100, 1);
    let after = num(&t.get_text_annotations(), "\"tile_w\":");

    // A stale tile would render the old glyph bitmap at the new coordinates.
    assert!(
        after < before,
        "tile should shrink with the font: {before} -> {after}"
    );
}

#[test]
fn stroke_width_scales_but_never_vanishes() {
    let mut t = tool_200();
    t.add_shape_annotation(
        0, 10.0, 10.0, 20.0, 20.0, "#000000", 8.0, 0, 0, "#000000", "#000000", 0, 0,
    );
    t.resize_with_filter(100, 100, 1);
    assert_eq!(
        num(&t.get_shape_annotations(), "\"stroke_width\":"),
        4.0,
        "halved"
    );

    // A brutal downscale must still leave something drawable.
    t.resize_with_filter(4, 4, 1);
    let j = t.get_shape_annotations();
    assert!(num(&j, "\"stroke_width\":") >= 0.5, "hairline floor: {j}");
}

#[test]
fn non_uniform_resize_scales_each_axis_independently() {
    let mut t = tool_200();
    t.add_shape_annotation(
        0, 100.0, 100.0, 120.0, 140.0, "#000000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
    );
    // Width halves, height quarters.
    t.resize_with_filter(100, 50, 1);

    let j = t.get_shape_annotations();
    assert_eq!(num(&j, "\"x0\":"), 50.0, "x uses sx=0.5 — {j}");
    assert_eq!(num(&j, "\"y0\":"), 25.0, "y uses sy=0.25 — {j}");
    assert_eq!(num(&j, "\"y1\":"), 35.0, "y1 uses sy=0.25 — {j}");
}

#[test]
fn upscaling_moves_annotations_outward_too() {
    let mut t = tool_200();
    t.add_shape_annotation(
        0, 50.0, 50.0, 60.0, 60.0, "#000000", 1.0, 0, 0, "#000000", "#000000", 0, 0,
    );
    t.resize_with_filter(400, 400, 1);
    let j = t.get_shape_annotations();
    assert_eq!(num(&j, "\"x0\":"), 100.0, "in {j}");
    assert_eq!(num(&j, "\"y1\":"), 120.0, "in {j}");
}

#[test]
fn a_degenerate_resize_is_a_no_op_and_never_divides_by_zero() {
    let mut t = tool_200();
    t.add_shape_annotation(
        0, 10.0, 10.0, 20.0, 20.0, "#000000", 1.0, 0, 0, "#000000", "#000000", 0, 0,
    );
    t.resize_with_filter(0, 50, 1);
    assert_eq!(
        num(&t.get_shape_annotations(), "\"x0\":"),
        10.0,
        "unchanged"
    );
    assert_eq!(t.width(), 200, "canvas untouched");
}

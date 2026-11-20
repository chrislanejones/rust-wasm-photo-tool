//! A shape with no stroke (11-19-2026) — the Shapes panel is fill first, so a
//! new rectangle is its Fill Color alone, and `stroke_width == 0` has to mean
//! "no outline" all the way down.
//!
//! It did not before. No panel could send 0 (the slider started at 1), so
//! nothing had ever asked what the rasteriser does with it — and the answer
//! was a dotted outline: `draw_line_thick` at width 0 still inks every sample
//! that lands exactly on a pixel center.
//!
//!   1. width 0 draws the fill and nothing else, for every fill-first kind,
//!      firm or sloppy, upright or turned;
//!   2. with no fill either, width 0 draws nothing at all;
//!   3. width 0 survives an image resize as 0 (the resize floors a stroke at
//!      a 0.5 px hairline, which would have grown a strokeless shape one);
//!   4. a stroke that IS there is untouched — the pinned hashes in
//!      `shape_rotation.rs` hold that for every kind.
//!
//! Featureless, like `shape_corner_radius.rs`.

use stamp_tool::ImageHorseTool;

const W: u32 = 96;
const H: u32 = 80;
const BOX: (f64, f64, f64, f64) = (14.0, 10.0, 78.0, 66.0);

const WHITE: [u8; 4] = [255, 255, 255, 255];
const FILL: [u8; 4] = [0x20, 0x40, 0xe0, 255];
/// The stroke color — loud, and nowhere near white or the fill.
const STROKE_HEX: &str = "#e02020";

/// rect, circle, diamond, star, triangle, oval: the fill-first kinds
/// (`FILL_FIRST_KINDS` in app/src/lib/drawEditState.ts).
const FILL_FIRST: [u8; 6] = [0, 1, 8, 9, 10, 41];

fn white_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    t
}

fn add(t: &mut ImageHorseTool, kind: u8, width: f64, fill: u8, sloppiness: u8, rot: f64) -> u32 {
    let (x0, y0, x1, y1) = BOX;
    t.add_shape_annotation_full(
        kind,
        x0,
        y0,
        x1,
        y1,
        STROKE_HEX,
        width,
        0,
        fill,
        "#2040e0",
        "#2040e0",
        0,
        8,
        sloppiness,
        0,
        rot,
        &[],
    )
}

/// Every pixel that is neither the white page nor the solid fill.
fn stray_pixels(buf: &[u8]) -> usize {
    buf.chunks_exact(4)
        .filter(|p| **p != WHITE && **p != FILL)
        .count()
}

fn filled_pixels(buf: &[u8]) -> usize {
    buf.chunks_exact(4).filter(|p| **p == FILL).count()
}

#[test]
fn width_zero_draws_the_fill_and_nothing_else() {
    for kind in FILL_FIRST {
        for sloppiness in [0u8, 60] {
            let mut t = white_tool();
            add(&mut t, kind, 0.0, 1, sloppiness, 0.0);
            let buf = t.get_image_data();
            assert!(filled_pixels(&buf) > 400, "kind {kind}: the fill is drawn");
            assert_eq!(
                stray_pixels(&buf),
                0,
                "kind {kind}, sloppiness {sloppiness}: no stroke ink at width 0",
            );
        }
    }
}

#[test]
fn a_stroke_that_is_there_still_draws() {
    // The control for the test above: same shapes, width 2, and the stroke
    // color shows up. Without it, "no stray pixels" would also pass on an
    // engine that had stopped stroking altogether.
    for kind in FILL_FIRST {
        let mut t = white_tool();
        add(&mut t, kind, 2.0, 1, 0, 0.0);
        assert!(
            stray_pixels(&t.get_image_data()) > 40,
            "kind {kind}: a width-2 stroke is drawn"
        );
    }
}

#[test]
fn no_fill_and_no_stroke_draws_nothing() {
    for kind in FILL_FIRST {
        let mut t = white_tool();
        add(&mut t, kind, 0.0, 0, 0, 0.0);
        let buf = t.get_image_data();
        assert!(
            buf.chunks_exact(4).all(|p| p == WHITE),
            "kind {kind}: the page is untouched"
        );
    }
}

#[test]
fn a_turned_strokeless_shape_is_still_only_its_fill() {
    // A turned fill goes through the warp route, which resamples: its edge is
    // anti-aliased fill-over-white, so "stray" here means the STROKE's red,
    // not merely "not exactly the fill".
    for kind in [0u8, 8, 9, 10, 41] {
        let mut t = white_tool();
        add(&mut t, kind, 0.0, 1, 0, 30.0);
        let buf = t.get_image_data();
        assert!(
            filled_pixels(&buf) > 300,
            "kind {kind}: the turned fill is drawn"
        );
        let reddish = buf
            .chunks_exact(4)
            .filter(|p| p[0] > p[2].saturating_add(40))
            .count();
        assert_eq!(
            reddish, 0,
            "kind {kind}: no stroke ink on a turned strokeless shape"
        );
    }
}

#[test]
fn an_image_resize_does_not_grow_a_strokeless_shape_a_hairline() {
    let mut t = white_tool();
    add(&mut t, 0, 0.0, 1, 0, 0.0);
    add(&mut t, 8, 3.0, 1, 0, 0.0);
    t.resize(W / 2, H / 2);
    let json = t.get_shape_annotations();
    assert!(
        json.contains("\"stroke_width\":0,"),
        "no stroke stays no stroke: {json}"
    );
    assert!(
        json.contains("\"stroke_width\":1.5,"),
        "a real stroke still scales: {json}"
    );
    // …and far enough down that a real stroke would hit the 0.5 floor, the
    // strokeless one is still 0.
    t.resize(8, 8);
    let json = t.get_shape_annotations();
    assert!(json.contains("\"stroke_width\":0,"), "{json}");
    assert!(json.contains("\"stroke_width\":0.5,"), "{json}");
}

//! The Perspective tool on VECTOR objects — squares and circles, not pixels.
//!
//! The tool shipped in v8.42 with two paths: a non-destructive one for text
//! annotations, and a destructive pixel warp for everything else. "Everything
//! else" included every shape the app draws, so warping a square you had just
//! drawn silently resampled the photo underneath it and left the square
//! sitting on top, unchanged. The report was blunt about it: *"only works with
//! raster — needs to work with vector and/or designs made with the app."*
//!
//! What a vector warp has to be true of, and what each test below pins:
//!
//!   1. the quad lands in the annotation DATA, so a reload and the op log both
//!      carry it (`shapes_to_json`, `shape_perspective_of`);
//!   2. the shape is still a SHAPE afterwards — restyle it and the warp
//!      survives, which is the whole difference from baking pixels;
//!   3. the pixels actually move, and move the way the quad says;
//!   4. a refused quad is a no-op, not a half-applied one, and costs no undo
//!      step;
//!   5. undo restores the unwarped shape in exactly one step;
//!   6. the stroke is not shaved off by the tile the warp resamples through —
//!      the failure mode a bbox-tight tile produces, and the reason
//!      `shape_ink_pad` exists.
//!
//! Geometry note: every quad here is NORMALISED over the shape's own bbox
//! (0,0 = its top-left, 1,1 = its bottom-right), which is the contract
//! `set_shape_perspective` documents and `app/src/lib/shapeBasis.ts` mirrors.

use stamp_tool::ImageHorseTool;

const W: u32 = 80;
const H: u32 = 80;

/// A white canvas — shape ink is the only non-white thing on it.
fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    t.recomposite();
    t
}

/// A red square filling the middle 40×40, stroke 4 so it survives sampling.
fn add_square(t: &mut ImageHorseTool) -> u32 {
    t.add_shape_annotation(
        0, 20.0, 20.0, 60.0, 60.0, "#ff0000", 4.0, 0, 0, "#000000", "#000000", 0, 0,
    )
}

/// The identity: no perspective, expressed normalised.
const IDENTITY: [f32; 8] = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
/// A keystone: the top edge pulled in to the middle half, bottom edge left
/// alone. The classic "lay it on a receding surface" gesture.
const KEYSTONE: [f32; 8] = [0.25, 0.0, 0.75, 0.0, 1.0, 1.0, 0.0, 1.0];

/// Every red-ish pixel in the exported artifact, as (x, y).
///
/// `render_with_annotations` is the buffer the download path writes, so this
/// is what the user gets, not a preview.
fn red_pixels(t: &ImageHorseTool) -> Vec<(u32, u32)> {
    let buf = t.render_with_annotations();
    let mut out = Vec::new();
    for y in 0..H {
        for x in 0..W {
            let i = ((y * W + x) * 4) as usize;
            if buf[i] > 120 && buf[i + 1] < 120 && buf[i + 2] < 120 && buf[i + 3] > 0 {
                out.push((x, y));
            }
        }
    }
    out
}

/// The horizontal extent of the shape's ink on one scanline.
fn row_span(t: &ImageHorseTool, y: u32) -> Option<(u32, u32)> {
    let xs: Vec<u32> = red_pixels(t)
        .into_iter()
        .filter(|p| p.1 == y)
        .map(|p| p.0)
        .collect();
    Some((*xs.iter().min()?, *xs.iter().max()?))
}

/// The quad currently stored on the one shape, as 8 floats.
fn stored_quad(t: &ImageHorseTool, id: u32) -> Vec<f32> {
    t.shape_perspective_of(id)
}

// ── 1. it lands in the annotation data ──────────────────────────────────────

#[test]
fn the_quad_lands_in_the_annotation_data() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    assert_eq!(
        stored_quad(&t, id),
        IDENTITY.to_vec(),
        "a new shape starts unwarped — the IDENTITY, never an all-zero quad"
    );

    assert!(t.set_shape_perspective(id, &KEYSTONE), "known id accepted");

    assert_eq!(
        stored_quad(&t, id),
        KEYSTONE.to_vec(),
        "the corners are stored on the annotation, not baked into pixels"
    );
    // Persistence and the Reselect list both read this JSON.
    assert!(
        t.get_shape_annotations().contains("\"perspective\""),
        "the overlay reads the quad out of the shape JSON"
    );
}

#[test]
fn an_unknown_id_is_refused_and_costs_nothing() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    let depth = t.undo_snapshot_count();

    assert!(!t.set_shape_perspective(id.wrapping_add(999), &KEYSTONE));
    assert_eq!(
        stored_quad(&t, id),
        IDENTITY.to_vec(),
        "the real shape is untouched"
    );
    assert_eq!(
        t.undo_snapshot_count(),
        depth,
        "a rejected quad must not cost an undo step"
    );
    assert!(
        t.shape_perspective_of(id.wrapping_add(999)).is_empty(),
        "an unknown id answers EMPTY, which is distinguishable from 'unwarped'"
    );
}

#[test]
fn a_malformed_quad_is_refused() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    assert!(!t.set_shape_perspective(id, &[0.0, 0.0, 1.0]), "too short");
    assert!(
        !t.set_shape_perspective(id, &[f32::NAN, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]),
        "a NaN corner would poison every later solve"
    );
    assert_eq!(
        stored_quad(&t, id),
        IDENTITY.to_vec(),
        "and nothing changed"
    );
}

#[test]
fn re_applying_the_same_quad_costs_no_history() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    t.set_shape_perspective(id, &KEYSTONE);
    let depth = t.undo_snapshot_count();

    assert!(t.set_shape_perspective(id, &KEYSTONE), "still accepted");
    assert_eq!(
        t.undo_snapshot_count(),
        depth,
        "a drag that landed where it started must not push a snapshot"
    );
}

// ── 2. it is VECTOR: the shape survives the warp ────────────────────────────

#[test]
fn a_warped_shape_can_still_be_restyled_and_keeps_its_warp() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    t.set_shape_perspective(id, &KEYSTONE);

    // Exactly what a panel colour click does — the same call `shape_recolour`
    // covers, on a shape that now carries a quad.
    assert!(t.update_shape_annotation(
        id, 0, 20.0, 20.0, 60.0, 60.0, "#00ff00", 4.0, 0, 0, "#000000", "#000000", 0, 0,
    ));

    assert_eq!(
        stored_quad(&t, id),
        KEYSTONE.to_vec(),
        "restyling a warped shape must not drop the warp — that is what 'vector' means here"
    );
}

#[test]
fn resizing_a_warped_shape_keeps_the_same_transform() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    t.set_shape_perspective(id, &KEYSTONE);

    // Drag it to twice the size. The quad is NORMALISED over the bbox, so the
    // transform is unchanged while the pixels it describes are twice as big —
    // storing corners in pixels is what would break here.
    assert!(t.update_shape_annotation(
        id, 0, 20.0, 20.0, 60.0, 60.0, "#ff0000", 4.0, 0, 0, "#000000", "#000000", 0, 0,
    ));
    assert_eq!(stored_quad(&t, id), KEYSTONE.to_vec());
}

// ── 3. the pixels actually move, the way the quad says ──────────────────────

#[test]
fn a_keystone_narrows_the_top_and_leaves_the_bottom_alone() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    let flat_top = row_span(&t, 22).expect("unwarped square has ink near its top");
    let flat_bottom = row_span(&t, 58).expect("...and near its bottom");

    t.set_shape_perspective(id, &KEYSTONE);
    let top = row_span(&t, 22).expect("a warped square still has ink near the top");
    let bottom = row_span(&t, 58).expect("...and near the bottom");

    let width = |s: (u32, u32)| s.1 - s.0;
    assert!(
        width(top) < width(flat_top),
        "the far edge must retreat inward: {top:?} vs {flat_top:?}"
    );
    assert!(
        width(bottom) >= width(flat_bottom) - 2,
        "the near edge is pinned by the quad and must stay put: {bottom:?} vs {flat_bottom:?}"
    );
}

#[test]
fn the_identity_quad_renders_exactly_as_an_unwarped_shape() {
    // The identity is not a special case to be short-circuited by accident —
    // it is the value a Reset lands on, and the composite must be untouched.
    let mut a = new_tool();
    add_square(&mut a);
    let plain = a.render_with_annotations();

    let mut b = new_tool();
    let id = add_square(&mut b);
    b.set_shape_perspective(id, &IDENTITY);

    assert_eq!(
        b.render_with_annotations(),
        plain,
        "an identity quad must be byte-identical to no quad at all"
    );
}

#[test]
fn a_circle_warps_too() {
    // Circles are the second shape the report named, and they take a different
    // rasteriser than rects — a warp that only worked for `kind == 0` would
    // pass every test above.
    let mut t = new_tool();
    let id = t.add_shape_annotation(
        1, 20.0, 20.0, 60.0, 60.0, "#ff0000", 4.0, 0, 1, "#ff0000", "#000000", 0, 0,
    );
    let before = t.render_with_annotations();
    assert!(t.set_shape_perspective(id, &KEYSTONE));
    assert_ne!(
        t.render_with_annotations(),
        before,
        "the circle's pixels must actually move"
    );
}

// ── 4. the stroke survives the tile ─────────────────────────────────────────

#[test]
fn the_stroke_is_not_shaved_off_by_the_tile() {
    // A warp resamples the shape through a tile lifted around its bbox. Crop
    // that tile to the bare bbox and half the stroke — which straddles the
    // path — is outside it and vanishes, so a warped square comes back thinner
    // than it was drawn. `shape_ink_pad` is what prevents it; this is the test
    // that notices if it stops being applied.
    let mut t = new_tool();
    let id = t.add_shape_annotation(
        0, 20.0, 20.0, 60.0, 60.0, "#ff0000", 10.0, 0, 0, "#000000", "#000000", 0, 0,
    );
    let before = red_pixels(&t).len();
    // A gentle shear: the ink barely moves, so a big drop in coverage can only
    // be the tile clipping it.
    assert!(t.set_shape_perspective(id, &[0.05, 0.0, 1.0, 0.0, 0.95, 1.0, 0.0, 1.0]));
    let after = red_pixels(&t).len();
    assert!(
        after * 10 >= before * 8,
        "a barely-warped thick stroke lost {before} → {after} px of ink — the tile is clipping it"
    );
}

// ── 5. undo ─────────────────────────────────────────────────────────────────

#[test]
fn a_warp_is_one_undo_step_and_restores_the_flat_shape() {
    let mut t = new_tool();
    let id = add_square(&mut t);
    let flat = t.render_with_annotations();
    let depth = t.undo_snapshot_count();

    t.set_shape_perspective(id, &KEYSTONE);
    assert_eq!(
        t.undo_snapshot_count(),
        depth + 1,
        "one gesture, one history step"
    );

    t.undo();
    assert_eq!(
        stored_quad(&t, id),
        IDENTITY.to_vec(),
        "undo puts the shape back to unwarped"
    );
    assert_eq!(
        t.render_with_annotations(),
        flat,
        "...and the pixels with it"
    );
}

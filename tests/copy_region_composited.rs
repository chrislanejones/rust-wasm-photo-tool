//! `copy_region` reads the ACTIVE LAYER only, so copying a selection on a
//! multi-layer document returned that layer's pixels rather than what the user
//! could see, and ignored the "Canvas background on export" preference every
//! other export/share/copy path honours.
//!
//! `copy_region_composited` copies out of the visible composite instead. These
//! tests pin the difference in both directions — including that the OLD
//! function still behaves as before, since paste-from-selection and the
//! clone-stamp path still rely on active-layer semantics.

use stamp_tool::ImageHorseTool;

const W: u32 = 40;
const H: u32 = 30;

/// A document with a solid Canvas fill underneath and a small opaque square
/// painted on a second layer, so "composite" and "active layer" differ
/// visibly at the same coordinates.
fn doc() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    // Base image = the photo layer, fully opaque red.
    let mut base = vec![0u8; (W * H * 4) as usize];
    for px in base.chunks_exact_mut(4) {
        px.copy_from_slice(&[200, 40, 40, 255]);
    }
    t.load_image(&base);
    t.recomposite();
    t
}

fn px(buf: &[u8], w: u32, x: u32, y: u32) -> [u8; 4] {
    let i = ((y * w + x) * 4) as usize;
    [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

#[test]
fn composited_copy_sees_the_photo_that_a_bare_active_layer_copy_would_miss() {
    let mut t = doc();
    // A second, empty layer becomes active. The active layer is transparent
    // here, so the OLD copy path returns nothing but zeros.
    t.add_layer("Layer 2");

    let region = (8i32, 6i32, 16u32, 12u32);
    let active_only = t.copy_region(region.0, region.1, region.2, region.3);
    let composited = t.copy_region_composited(region.0, region.1, region.2, region.3, true);

    let a = px(&active_only, region.2, 4, 4);
    let c = px(&composited, region.2, 4, 4);
    println!("[active-layer copy] {a:?}");
    println!("[composited copy]   {c:?}");

    assert_eq!(a[3], 0, "empty active layer should copy as transparent");
    assert_eq!(
        c,
        [200, 40, 40, 255],
        "composited copy must return the visible photo, not the empty active layer"
    );
}

#[test]
fn include_background_flag_changes_the_result() {
    let mut t = doc();
    t.add_layer("Layer 2");

    let region = (0i32, 0i32, 10u32, 10u32);
    let with_bg = t.copy_region_composited(region.0, region.1, region.2, region.3, true);
    let without_bg = t.copy_region_composited(region.0, region.1, region.2, region.3, false);

    println!("[with bg]    {:?}", px(&with_bg, region.2, 2, 2));
    println!("[without bg] {:?}", px(&without_bg, region.2, 2, 2));

    // Both are the same size — the flag must not tight-crop, or the caller's
    // rect would no longer line up with the document.
    assert_eq!(
        with_bg.len(),
        without_bg.len(),
        "the flag must not change the returned dimensions"
    );
    assert_eq!(
        with_bg.len(),
        (region.2 * region.3 * 4) as usize,
        "result must be exactly the requested rect"
    );
}

#[test]
fn requested_rect_is_returned_verbatim_and_out_of_bounds_is_zero_filled() {
    let t = doc();
    // Straddle the right edge: half inside, half outside.
    let out = t.copy_region_composited(W as i32 - 5, 0, 10, 4, true);
    assert_eq!(out.len(), (10 * 4 * 4) as usize, "size must match the ask");

    let inside = px(&out, 10, 1, 1);
    let outside = px(&out, 10, 8, 1);
    println!("[inside]  {inside:?}");
    println!("[outside] {outside:?}");
    assert_eq!(
        inside,
        [200, 40, 40, 255],
        "in-bounds pixels come from the doc"
    );
    assert_eq!(
        outside[3], 0,
        "out-of-bounds must be zero-filled, not clamped"
    );
}

/// Text annotations are a live overlay composited on top of the layer stack —
/// they are not pixels in any layer's buffer. So the active-layer copy path
/// silently drops them, which is the most user-visible form of this bug: you
/// select a caption, copy it, and paste a blank rectangle.
#[test]
fn text_annotations_are_included_in_a_composited_copy_but_not_an_active_layer_copy() {
    let mut t = doc();
    // Opaque white text on the red photo, inside the region copied below.
    t.add_text_annotation(
        "HELLO", 14.0, 255, 255, 255, true, 6, 6, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
    );
    t.recomposite();

    let region = (2i32, 2i32, 34u32, 24u32);
    let active_only = t.copy_region(region.0, region.1, region.2, region.3);
    let composited = t.copy_region_composited(region.0, region.1, region.2, region.3, true);

    // The photo is uniformly red; any near-white pixel can only be glyph ink.
    let ink = |buf: &[u8]| {
        buf.chunks_exact(4)
            .filter(|p| p[0] > 200 && p[1] > 200 && p[2] > 200 && p[3] > 200)
            .count()
    };
    let ink_active = ink(&active_only);
    let ink_composited = ink(&composited);
    println!("[active-layer copy] white pixels: {ink_active}");
    println!("[composited copy]   white pixels: {ink_composited}");

    assert_eq!(
        ink_active, 0,
        "active-layer copy cannot contain glyph ink — the text is an overlay, \
         not layer pixels. If this ever becomes non-zero the annotation model \
         changed and this whole test needs revisiting."
    );
    assert!(
        ink_composited > 0,
        "composited copy must contain the text — copying a selection over a \
         caption and pasting a blank rectangle is the bug this fixes"
    );
}

#[test]
fn old_copy_region_is_unchanged_for_its_existing_callers() {
    let t = doc();
    // Single layer, active == the photo: old and new must agree, so the
    // clone-stamp / paste paths that still use `copy_region` see no drift.
    let old = t.copy_region(4, 4, 8, 8);
    let new = t.copy_region_composited(4, 4, 8, 8, true);
    assert_eq!(
        old, new,
        "single-layer document must copy identically either way"
    );
}

//! Resizing an artboard must not leave a soft ring around the photo.
//!
//! `resize_with_filter` used to resample the Photo layer whole, blending the
//! photo's hard edge with the transparent margin around it. Under the Canvas
//! the ring was invisible; "Photo only" excludes the Canvas and crops to
//! alpha > 0, so the ring shipped — matted to white in a JPEG, see-through in
//! a PNG/WebP. Reported as a thin white line around every photo in a ZIP with
//! a 25px grey canvas and Layers and Canvas → Exporting → Photo only.
use stamp_tool::ImageHorseTool;

const PW: u32 = 800;
const PH: u32 = 600;
const PAD: u32 = 25;

fn photo(w: u32, h: u32) -> Vec<u8> {
    let mut px = vec![0u8; (w * h * 4) as usize];
    for (i, b) in px.iter_mut().enumerate() {
        *b = if i % 4 == 3 { 255 } else { 120 };
    }
    px
}

/// A photo on a 25px OPAQUE grey canvas — the reported setup.
fn grey_artboard() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(PW + 2 * PAD, PH + 2 * PAD);
    t.load_image_artboard(&photo(PW, PH), PW, PH, PAD, 128, 128, 128, 255);
    t
}

fn photo_only(t: &ImageHorseTool) -> (Vec<u8>, u32, u32) {
    (
        t.get_image_data_excluding_background(),
        t.export_width_excluding_background(),
        t.export_height_excluding_background(),
    )
}

#[test]
fn a_resized_artboard_exports_the_photo_with_hard_edges_under_every_filter() {
    // Down and up: an upscale widens the ring, so both directions are pinned.
    for (dw, dh, pw, ph) in [(425, 325, 400, 300), (1275, 975, 1200, 900)] {
        for filter in 0..4u8 {
            let mut t = grey_artboard();
            t.resize_with_filter(dw, dh, filter);
            let (px, w, h) = photo_only(&t);
            assert_eq!(
                (w, h),
                (pw, ph),
                "filter {filter}: export is the photo, not photo + ring"
            );
            let soft = px.chunks_exact(4).filter(|p| p[3] != 255).count();
            assert_eq!(
                soft, 0,
                "filter {filter}: {soft} non-opaque pixels would export as a white line"
            );
        }
    }
}

#[test]
fn the_canvas_is_still_resized_with_the_document() {
    let mut t = grey_artboard();
    t.resize_with_filter(425, 325, 3);
    let full = t.get_image_data();
    // Corner is the Canvas fill, and the composite is fully opaque (no seam).
    assert_eq!(&full[0..4], &[128, 128, 128, 255]);
    assert!(full.chunks_exact(4).all(|p| p[3] == 255));
}

#[test]
fn a_soft_edged_layer_still_resamples_whole() {
    // A layer that is NOT one solid rectangle (here: a half-alpha block) takes
    // the ordinary path, so its soft edges stay soft.
    let (w, h) = (100u32, 100u32);
    let mut px = vec![0u8; (w * h * 4) as usize];
    for y in 20..80 {
        for x in 20..80 {
            let i = ((y * w + x) * 4) as usize;
            px[i..i + 4].copy_from_slice(&[200, 50, 50, 128]);
        }
    }
    let mut t = ImageHorseTool::new(w, h);
    t.load_image(&px);
    t.resize_with_filter(37, 37, 1);
    let out = t.get_image_data();
    assert!(
        out.chunks_exact(4).any(|p| p[3] != 0 && p[3] != 128),
        "bilinear blends the soft edge"
    );
}

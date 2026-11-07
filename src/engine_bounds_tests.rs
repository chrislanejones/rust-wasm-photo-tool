// Sizes and brush positions the engine has to refuse or ignore, not act on.
//
// A byte length computed in u32 wraps at 4 GiB (65536×65536 wraps to 0), and the
// wasm SIMD resize writes through raw pointers into whatever that allocated. A
// brush whose box lands wholly off the canvas gave a negative extent, which a
// cast to usize turned into an enormous one.
use crate::core::{rgba_len, ImageBuffer};
use crate::filters::{gaussian_blur_region, pixelate_region, redact_region};
use crate::transform;
use crate::ImageHorseTool;

const TOO_BIG: u32 = 65_536;

#[test]
fn rgba_len_refuses_what_the_engine_cannot_address() {
    assert_eq!(rgba_len(16_384, 16_384), Some(1 << 30));
    assert_eq!(rgba_len(0, 5), Some(0));
    assert_eq!(rgba_len(TOO_BIG, TOO_BIG), None);
    assert_eq!(rgba_len(u32::MAX, u32::MAX), None);
    assert_eq!(rgba_len(32_768, 32_768), None);
    assert_eq!(rgba_len(536_870_911, 1), Some(2_147_483_644));
    assert_eq!(rgba_len(536_870_912, 1), None);
}

#[test]
fn an_oversized_buffer_is_empty_and_says_so() {
    let buf = ImageBuffer::new(TOO_BIG, TOO_BIG);
    assert_eq!((buf.width, buf.height, buf.data.len()), (0, 0, 0));
}

#[test]
fn every_resample_kernel_refuses_an_oversized_output() {
    let src = vec![255u8; 16];
    assert!(transform::resize_bilinear(&src, 2, 2, TOO_BIG, TOO_BIG).is_empty());
    assert!(transform::resize_nearest(&src, 2, 2, TOO_BIG, TOO_BIG).is_empty());
    assert!(transform::resize_catmull_rom(&src, 2, 2, TOO_BIG, TOO_BIG).is_empty());
    assert!(transform::resize_lanczos3(&src, 2, 2, TOO_BIG, TOO_BIG).is_empty());
}

#[test]
fn the_size_limit_still_resizes() {
    let src = vec![255u8; 16];
    assert_eq!(transform::resize_bilinear(&src, 2, 2, 4, 4).len(), 64);
    assert_eq!(transform::resize_lanczos3(&src, 2, 2, 4, 4).len(), 64);
}

#[test]
fn an_oversized_resize_leaves_the_document_and_history_alone() {
    let mut tool = ImageHorseTool::new(4, 4);
    let undo = tool.undo_count();
    tool.resize_with_filter(TOO_BIG, TOO_BIG, 3);
    assert_eq!((tool.width(), tool.height()), (4, 4));
    assert_eq!(tool.undo_count(), undo);
}

#[test]
fn an_oversized_canvas_resize_leaves_the_document_and_history_alone() {
    let mut tool = ImageHorseTool::new(4, 4);
    let undo = tool.undo_count();
    tool.resize_canvas(TOO_BIG, TOO_BIG, 0, 0, 0, 0, 255);
    assert_eq!((tool.width(), tool.height()), (4, 4));
    assert_eq!(tool.undo_count(), undo);
}

#[test]
fn a_document_too_big_to_address_is_empty_and_safe_to_read() {
    let tool = ImageHorseTool::new(TOO_BIG, TOO_BIG);
    assert_eq!((tool.width(), tool.height()), (0, 0));
    assert_eq!(tool.get_pixel(0, 0), vec![0, 0, 0, 255]);
}

#[test]
fn an_artboard_too_big_to_address_leaves_the_document_alone() {
    let mut tool = ImageHorseTool::new(4, 4);
    let pixels = vec![255u8; 16];
    for pad in [TOO_BIG, u32::MAX] {
        tool.load_image_artboard(&pixels, 2, 2, pad, 0, 0, 0, 255);
        assert_eq!((tool.width(), tool.height()), (4, 4));
    }
}

#[test]
fn a_paste_whose_length_check_would_wrap_is_refused() {
    let mut data = vec![0u8; 16];
    // 65536×16384×4 wraps a u32 to 0, which an empty buffer used to match.
    transform::paste_region(&mut data, 2, 2, &[], TOO_BIG, 16_384, 0, 0);
    assert!(data.iter().all(|&v| v == 0));
}

#[test]
fn a_paste_preview_keeps_its_last_size_when_asked_for_one_too_big() {
    let mut tool = ImageHorseTool::new(8, 8);
    tool.begin_paste_preview(&[255u8; 16], 2, 2, 0, 0, 2, 2);
    tool.set_paste_preview_rect(1, 1, 40, 40);
    let place = |t: &ImageHorseTool| {
        t.paste_preview
            .as_ref()
            .map(|p| (p.dest_w, p.dest_h, p.dest_x, p.dest_y))
    };
    let before = place(&tool);
    assert!(before.is_some());
    tool.set_paste_preview_rect(0, 0, TOO_BIG, 16_384);
    assert_eq!(place(&tool), before);
}

/// Each of these boxes misses a 10×10 canvas: past every edge, then a corner.
const OFF_CANVAS: [(f64, f64); 5] = [
    (-50.0, 5.0),
    (60.0, 5.0),
    (5.0, -50.0),
    (5.0, 60.0),
    (-50.0, -50.0),
];

#[test]
fn a_blur_wholly_off_the_canvas_changes_nothing() {
    for (cx, cy) in OFF_CANVAS {
        let mut data = vec![7u8; 400];
        let (mut a, mut b) = (Vec::new(), Vec::new());
        let kernel = [1.0f32; 7];
        gaussian_blur_region(&mut data, 10, 10, cx, cy, 5.0, 3, &mut a, &mut b, &kernel);
        assert!(data.iter().all(|&v| v == 7), "at {cx},{cy}");
    }
}

#[test]
fn a_blur_half_off_the_canvas_still_blurs_the_part_on_it() {
    let mut data = vec![0u8; 400];
    data[..200].fill(255);
    let before = data.clone();
    let (mut a, mut b) = (Vec::new(), Vec::new());
    let kernel = [1.0 / 7.0f32; 7];
    gaussian_blur_region(
        &mut data, 10, 10, -1.0, 5.0, 5.0, 3, &mut a, &mut b, &kernel,
    );
    assert_ne!(data, before);
}

#[test]
fn pixelate_and_redact_wholly_off_the_canvas_change_nothing() {
    for (cx, cy) in OFF_CANVAS {
        let mut data = vec![7u8; 400];
        pixelate_region(&mut data, 10, 10, cx, cy, 5.0, 4);
        redact_region(&mut data, 10, 10, cx, cy, 5.0, 1, 2, 3);
        assert!(data.iter().all(|&v| v == 7), "at {cx},{cy}");
    }
}

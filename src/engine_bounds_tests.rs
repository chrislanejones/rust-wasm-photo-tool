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

//! Reads that land in the middle of a layer-stack rebuild must answer
//! "nothing", never panic.
//!
//! A saved photo is rebuilt over many separate worker messages
//! (`begin_layer_restore`, `push_restored_layer` × n, `restore_*_annotation`,
//! `finish_layer_restore`). The UI's own polls share that worker queue, so a
//! `get_text_annotations` can arrive after `begin_layer_restore` has emptied
//! the stack. That indexed `self.layers[self.active]` and panicked, and a
//! panic poisons the wasm instance for the rest of the session — measured as a
//! black canvas, hung photo loads, and an archive saved with the wrong photo
//! during fast photo switching (e2e photo-switch-state §0.2 / §0.7).
use stamp_tool::ImageHorseTool;

fn mid_restore() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&[200u8; 4 * 4 * 4]);
    t.begin_layer_restore();
    t
}

#[test]
fn annotation_reads_answer_empty_mid_restore() {
    let t = mid_restore();
    assert_eq!(t.get_text_annotations(), "[]");
    assert_eq!(t.get_shape_annotations(), "[]");
    assert_eq!(t.text_annotation_count(), 0);
    assert_eq!(t.shape_annotation_count(), 0);
    assert_eq!(t.text_annotation_at(1, 1), -1);
    assert_eq!(t.shape_annotation_at(1.0, 1.0), -1);
    assert!(t.text_perspective_of(1).is_empty());
    assert!(t.shape_perspective_of(1).is_empty());
}

#[test]
fn pixel_reads_answer_empty_mid_restore() {
    let t = mid_restore();
    assert!(t.active_layer_rgba().is_empty());
    assert_eq!(t.get_pixel(1, 1), vec![0, 0, 0, 0]);
    assert!(t.get_pixel_region(1, 1, 1).is_empty());
    // The requested rect comes back zero-filled at its full size, the same
    // contract as an out-of-bounds read.
    assert_eq!(t.copy_region(0, 0, 2, 2), vec![0u8; 2 * 2 * 4]);
}

#[test]
fn the_rebuilt_stack_reads_normally_after_finish() {
    let mut t = mid_restore();
    t.push_restored_layer(&[10u8; 4 * 4 * 4], 4, 4, "Photo", true, 1.0);
    t.finish_layer_restore(0);
    assert_eq!(t.get_pixel(1, 1), vec![10, 10, 10, 10]);
    assert_eq!(t.get_text_annotations(), "[]");
}

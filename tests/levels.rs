//! The Levels tool's preview and commit contract, driven through the public
//! engine API (`levels.rs` owns the math and its unit tests).
//!
//! What a user relies on, each pinned here:
//!   1. dragging a slider and then cancelling leaves the photo exactly as it was
//!   2. a preview is never an undo step, however many times it moves
//!   3. Apply is exactly one undo step, and undo puts every pixel back
//!   4. Apply after a preview remaps the untouched pixels ONCE, not on top of
//!      the preview
//!   5. moves recompute from the copy, so they never compound
//!   6. the identity changes nothing and costs no undo step
//!   7. a preview whose copy has gone stale is dropped, never written back —
//!      the "undo, then a new edit" case lands on the same undo depth with
//!      different pixels, which is why depth alone is not the check
use stamp_tool::ImageHorseTool;

const W: u32 = 64;
const H: u32 = 48;

/// A gradient in all three channels, so a remap visibly changes pixels.
fn tool() -> ImageHorseTool {
    let mut px = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let i = ((y * W + x) * 4) as usize;
            px[i] = (x * 4) as u8;
            px[i + 1] = (y * 5) as u8;
            px[i + 2] = ((x + y) * 2) as u8;
            px[i + 3] = 255;
        }
    }
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&px);
    t
}

/// FNV-1a over the composite, as the other engine integration tests do.
fn hash(t: &mut ImageHorseTool) -> u64 {
    t.recomposite();
    let mut h: u64 = 0xcbf29ce484222325;
    for b in t.get_image_data() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

#[test]
fn preview_then_cancel_restores_every_pixel() {
    let mut t = tool();
    let before = hash(&mut t);
    assert!(t.levels_preview_begin());
    assert!(t.levels_preview_set(40, 200, 1.6));
    assert_ne!(hash(&mut t), before, "the preview changed the picture");
    assert!(t.levels_preview_cancel(), "cancel restored pixels");
    assert_eq!(hash(&mut t), before, "cancel put back every pixel");
    assert!(!t.levels_preview_active());
}

#[test]
fn a_preview_is_never_an_undo_step() {
    let mut t = tool();
    let undos = t.undo_count();
    t.levels_preview_begin();
    t.levels_preview_set(10, 240, 1.2);
    t.levels_preview_set(60, 180, 0.7);
    t.levels_preview_set(0, 255, 1.0);
    assert_eq!(
        t.undo_count(),
        undos,
        "moving the sliders adds no undo steps"
    );
    t.levels_preview_cancel();
    assert_eq!(t.undo_count(), undos, "cancelling adds none either");
}

#[test]
fn apply_is_exactly_one_undo_step_and_undo_restores() {
    let mut t = tool();
    let before = hash(&mut t);
    let undos = t.undo_count();
    assert!(t.levels_apply(30, 220, 0.8));
    assert_eq!(t.undo_count(), undos + 1, "one step");
    assert_ne!(hash(&mut t), before);
    assert!(t.undo());
    assert_eq!(hash(&mut t), before, "undo restores every pixel");
}

#[test]
fn apply_after_a_preview_remaps_the_untouched_pixels_once() {
    let mut previewed = tool();
    previewed.levels_preview_begin();
    previewed.levels_preview_set(30, 220, 0.8);
    assert!(previewed.levels_apply(30, 220, 0.8));

    let mut direct = tool();
    assert!(direct.levels_apply(30, 220, 0.8));

    assert_eq!(
        hash(&mut previewed),
        hash(&mut direct),
        "the preview must not be applied a second time on top of itself"
    );
    assert!(
        !previewed.levels_preview_active(),
        "apply closes the preview"
    );
}

#[test]
fn moves_recompute_from_the_copy_and_never_compound() {
    let mut t = tool();
    let before = hash(&mut t);
    t.levels_preview_begin();
    t.levels_preview_set(50, 200, 1.0);
    t.levels_preview_set(80, 150, 2.0);
    t.levels_preview_set(0, 255, 1.0); // identity, from the copy
    assert_eq!(
        hash(&mut t),
        before,
        "back at the identity means back at the original"
    );
    t.levels_preview_cancel();
}

#[test]
fn the_identity_changes_nothing_and_costs_no_undo_step() {
    let mut t = tool();
    let before = hash(&mut t);
    let undos = t.undo_count();
    assert!(!t.levels_apply(0, 255, 1.0));
    assert_eq!(t.undo_count(), undos);
    assert_eq!(hash(&mut t), before);
}

#[test]
fn a_stale_preview_is_dropped_never_written_back() {
    let mut t = tool();
    assert!(t.levels_apply(20, 235, 1.0)); // step A: undo depth 1

    t.levels_preview_begin(); // copy taken at depth 1
    t.levels_preview_set(80, 180, 1.0);

    // Undo, then a different edit: undo depth is back to 1 with other pixels.
    assert!(t.undo());
    t.adjust_brightness(0.1);
    assert_eq!(t.undo_count(), 1, "same depth as when the copy was taken");
    let after_edit = hash(&mut t);

    assert!(
        !t.levels_preview_set(10, 250, 1.0),
        "stale: nothing to preview"
    );
    assert!(!t.levels_preview_cancel(), "stale: nothing restored");
    assert_eq!(hash(&mut t), after_edit, "the brightness edit survived");
}

#[test]
fn begin_twice_keeps_the_first_copy() {
    let mut t = tool();
    let before = hash(&mut t);
    assert!(t.levels_preview_begin());
    t.levels_preview_set(60, 190, 1.4);
    assert!(!t.levels_preview_begin(), "a second begin is refused");
    assert!(t.levels_preview_cancel());
    assert_eq!(
        hash(&mut t),
        before,
        "the ORIGINAL copy came back, not the preview"
    );
}

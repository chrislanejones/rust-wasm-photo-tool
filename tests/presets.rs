//! The color-preset contract, driven through the public engine API
//! (`presets.rs` owns the stack and its unit tests).
//!
//! What a user relies on, each pinned here:
//!   1. hovering a preset and moving away leaves the photo exactly as it was
//!   2. hovering is never an undo step, however many presets are hovered
//!   3. applying is exactly ONE undo step — the point of the feature, since the
//!      Quick Adjust grid it grew out of cost two — and undo restores
//!   4. applying after a hover works from the untouched pixels ONCE, not on top
//!      of what the hover drew
//!   5. hovering A then B shows B, not B composed over A
//!   6. a preset that changes nothing costs no undo step
//!   7. a stale preview is dropped, never written back
//!   8. the stack's order is load-bearing, so it cannot be reordered silently
use stamp_tool::ImageHorseTool;

const W: u32 = 64;
const H: u32 = 48;

/// Warm, mid-contrast values: every component of the stack does something.
/// NOTE the units differ per component (see `presets.rs`) — shadows and
/// highlights are absolute 8-bit, so they are tens, not fractions.
const VIVID: (f64, f64, f64, f64, f64) = (0.04, 1.35, 1.25, 12.0, 8.0);
const FADE: (f64, f64, f64, f64, f64) = (0.06, 0.72, 0.85, 0.0, 0.0);
const IDENTITY: (f64, f64, f64, f64, f64) = (0.0, 1.0, 1.0, 0.0, 0.0);

/// A gradient in all three channels, so a tonal change visibly moves pixels.
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

fn preview(t: &mut ImageHorseTool, p: (f64, f64, f64, f64, f64)) -> bool {
    t.preset_preview_set(p.0, p.1, p.2, p.3, p.4)
}

fn apply(t: &mut ImageHorseTool, p: (f64, f64, f64, f64, f64)) -> bool {
    t.preset_apply(p.0, p.1, p.2, p.3, p.4)
}

#[test]
fn hovering_then_leaving_restores_every_pixel() {
    let mut t = tool();
    let before = hash(&mut t);
    assert!(t.tonal_preview_begin());
    assert!(preview(&mut t, VIVID));
    assert_ne!(hash(&mut t), before, "the hover changed the picture");
    assert!(t.tonal_preview_cancel(), "leaving restored pixels");
    assert_eq!(hash(&mut t), before, "leaving put back every pixel");
    assert!(!t.tonal_preview_active());
}

#[test]
fn hovering_is_never_an_undo_step() {
    let mut t = tool();
    let undos = t.undo_count();
    t.tonal_preview_begin();
    preview(&mut t, VIVID);
    preview(&mut t, FADE);
    preview(&mut t, IDENTITY);
    assert_eq!(t.undo_count(), undos, "hovering adds no undo steps");
    t.tonal_preview_cancel();
    assert_eq!(t.undo_count(), undos, "leaving adds none either");
}

#[test]
fn applying_is_exactly_one_undo_step_and_undo_restores() {
    let mut t = tool();
    let before = hash(&mut t);
    let undos = t.undo_count();
    assert!(apply(&mut t, VIVID));
    assert_eq!(
        t.undo_count(),
        undos + 1,
        "ONE step for a whole preset — the Quick Adjust grid cost two"
    );
    assert_ne!(hash(&mut t), before);
    assert!(t.undo());
    assert_eq!(hash(&mut t), before, "undo restores every pixel");
}

#[test]
fn applying_after_a_hover_works_from_the_untouched_pixels_once() {
    let mut hovered = tool();
    hovered.tonal_preview_begin();
    preview(&mut hovered, VIVID);
    assert!(apply(&mut hovered, VIVID));

    let mut direct = tool();
    assert!(apply(&mut direct, VIVID));

    assert_eq!(
        hash(&mut hovered),
        hash(&mut direct),
        "the hover must not be applied a second time on top of itself"
    );
    assert!(!hovered.tonal_preview_active(), "apply closes the preview");
}

#[test]
fn hovering_one_preset_then_another_shows_the_second_alone() {
    let mut both = tool();
    both.tonal_preview_begin();
    preview(&mut both, VIVID);
    preview(&mut both, FADE);

    let mut only_second = tool();
    only_second.tonal_preview_begin();
    preview(&mut only_second, FADE);

    assert_eq!(
        hash(&mut both),
        hash(&mut only_second),
        "B after A must show B, not B composed over A"
    );
}

#[test]
fn a_preset_that_changes_nothing_costs_no_undo_step() {
    let mut t = tool();
    let before = hash(&mut t);
    let undos = t.undo_count();
    assert!(!apply(&mut t, IDENTITY), "nothing changed");
    assert_eq!(t.undo_count(), undos, "and nothing was snapshotted");
    assert_eq!(hash(&mut t), before);
}

#[test]
fn a_stale_preview_is_dropped_and_never_written_back() {
    let mut t = tool();
    apply(&mut t, FADE); // depth 1
    let faded = hash(&mut t);

    t.tonal_preview_begin(); // copy taken at depth 1
    preview(&mut t, VIVID);
    t.undo(); // history moves: the copy no longer describes the layer
    let undone = hash(&mut t);

    assert!(
        !preview(&mut t, VIVID),
        "a stale preview refuses to write and drops itself"
    );
    assert!(!t.tonal_preview_active());
    assert_eq!(hash(&mut t), undone, "the stale copy was not written back");
    assert_ne!(undone, faded, "the undo really did change the picture");
}

#[test]
fn the_stacks_order_is_load_bearing() {
    // Saturation last is a decision, not an accident: saturating and then
    // adding contrast is not the same picture as contrasting and then
    // saturating. If this ever passes, the order stopped mattering and the
    // documented order in `presets.rs` needs revisiting.
    let mut sat_then_contrast = tool();
    sat_then_contrast.adjust_saturation(1.25);
    sat_then_contrast.adjust_contrast(1.35);

    let mut contrast_then_sat = tool();
    contrast_then_sat.adjust_contrast(1.35);
    contrast_then_sat.adjust_saturation(1.25);

    assert_ne!(
        hash(&mut sat_then_contrast),
        hash(&mut contrast_then_sat),
        "order changes the pixels, so the stack's order is part of its meaning"
    );
}

#[test]
fn a_preset_equals_its_filters_applied_in_the_documented_order() {
    // The stack is not new math: it is brightness, contrast, highlights,
    // shadows, saturation, in that order. Pinning it against the raw filter
    // calls means a reordered or dropped component fails here.
    let (b, c, s, sh, hi) = VIVID;

    let mut by_preset = tool();
    apply(&mut by_preset, VIVID);

    let mut by_hand = tool();
    by_hand.adjust_brightness(b);
    by_hand.adjust_contrast(c);
    by_hand.adjust_highlights(hi);
    by_hand.adjust_shadows(sh);
    by_hand.adjust_saturation(s);

    assert_eq!(
        hash(&mut by_preset),
        hash(&mut by_hand),
        "a preset is exactly its filters, in the documented order"
    );
}
